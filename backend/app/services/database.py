import asyncio
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import UUID, uuid4

import asyncpg
from fastapi import HTTPException, Request


ANALYSES_PER_DAY = 3
ANALYSES_PER_MONTH = 20
CONCURRENT_ANALYSES_PER_ACCOUNT = 1
AI_ACTIONS_PER_DAY = 10
AI_ACTIONS_PER_MONTH = 100
IP_ANALYSES_PER_DAY = 10
IP_ANALYSES_PER_MONTH = 100
IP_AI_ACTIONS_PER_DAY = 30
IP_AI_ACTIONS_PER_MONTH = 300
REPORT_RETENTION_DAYS = 7
ANALYSIS_STALE_SECONDS = 300


def _positive_int_from_env(name: str, default: int) -> int:
    value = os.getenv(name, str(default))
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a positive whole number; received {value!r}.") from exc
    if parsed <= 0:
        raise ValueError(f"{name} must be a positive whole number; received {value!r}.")
    return parsed


REPORT_RETENTION_DAYS = _positive_int_from_env("REPOSEER_REPORT_RETENTION_DAYS", REPORT_RETENTION_DAYS)
ANALYSIS_STALE_SECONDS = _positive_int_from_env(
    "REPOSEER_ANALYSIS_STALE_SECONDS", ANALYSIS_STALE_SECONDS
)
logger = logging.getLogger(__name__)


async def _configure_connection(connection: asyncpg.Connection) -> None:
    await connection.set_type_codec(
        "json",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )
    await connection.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


def _database_connection_options(database_url: str) -> tuple[str, str | None]:
    parsed = urlsplit(database_url)
    query = parse_qsl(parsed.query, keep_blank_values=True)
    ssl_mode = next((value for key, value in query if key == "sslmode"), None)
    query = [(key, value) for key, value in query if key != "sslmode"]
    scheme = "postgresql" if parsed.scheme == "postgresql+asyncpg" else parsed.scheme
    dsn = urlunsplit((scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))
    if ssl_mode in {"require", "verify-ca", "verify-full"}:
        return dsn, "verify-full" if ssl_mode == "verify-full" else "require"
    if ssl_mode in {"disable", "prefer", None}:
        return dsn, None
    raise ValueError(f"Unsupported DATABASE_URL sslmode {ssl_mode!r}.")


async def create_database_pool(database_url: str) -> asyncpg.Pool:
    dsn, ssl = _database_connection_options(database_url)
    pool = await asyncpg.create_pool(dsn=dsn, ssl=ssl, init=_configure_connection)
    try:
        await apply_migrations(pool)
    except Exception:
        await pool.close()
        raise
    return pool


async def apply_migrations(pool: asyncpg.Pool) -> None:
    migration_dir = Path(__file__).resolve().parents[2] / "migrations"
    async with pool.acquire() as connection:
        await connection.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
        )

    for migration_path in sorted(migration_dir.glob("*.sql")):
        async with pool.acquire() as connection:
            async with connection.transaction():
                await connection.execute("SELECT pg_advisory_xact_lock(847293614)")
                applied = await connection.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)",
                    migration_path.name,
                )
                if applied:
                    continue
                await connection.execute(migration_path.read_text(encoding="utf-8"))
                await connection.execute(
                    "INSERT INTO schema_migrations (version) VALUES ($1)",
                    migration_path.name,
                )


def hash_client_ip(client_ip: str | None) -> str:
    database_url = os.getenv("DATABASE_URL", "")
    key = os.getenv("REPOSEER_RATE_LIMIT_HMAC_KEY") or database_url
    if not key:
        raise HTTPException(status_code=503, detail="Rate-limit hashing is not configured on the server.")
    return hmac.new(key.encode("utf-8"), (client_ip or "unknown").encode("utf-8"), hashlib.sha256).hexdigest()


def _quota_error(name: str, limit: int, window: str) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail={
            "code": "quota_exceeded",
            "quota": name,
            "limit": limit,
            "window": window,
            "message": f"{name.replace('_', ' ').capitalize()} limit reached ({limit} per {window}). Please try again later.",
        },
    )


def _active_analysis_error() -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={
            "code": "active_analysis",
            "message": "You already have an active analysis. Resume it or recover it if it is stale.",
        },
    )


class DatabaseStore:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def create_analysis(self, owner_id: str, ip_hash: str, job_id: str | None = None) -> str:
        job_uuid = UUID(job_id) if job_id else uuid4()
        owner_uuid = UUID(owner_id)

        async with self.pool.acquire() as connection:
            async with connection.transaction():
                lock_keys = sorted((f"account:{owner_id}", f"ip:{ip_hash}"))
                for lock_key in lock_keys:
                    await connection.execute(
                        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
                        lock_key,
                    )

                stale_jobs = await connection.fetch(
                    """
                    UPDATE analysis_jobs
                    SET status = 'failed', progress = 0,
                        message = 'Analysis was recovered after no progress was reported.',
                        updated_at = now()
                    WHERE owner_id = $1
                      AND status IN ('queued', 'processing')
                      AND updated_at < now() - ($2 * interval '1 second')
                    RETURNING id
                    """,
                    owner_uuid,
                    ANALYSIS_STALE_SECONDS,
                )
                if stale_jobs:
                    await connection.execute(
                        "DELETE FROM usage_records WHERE analysis_job_id = ANY($1::uuid[])",
                        [row["id"] for row in stale_jobs],
                    )
                active_analyses = await connection.fetchval(
                    """
                    SELECT count(*) FROM analysis_jobs
                    WHERE owner_id = $1 AND status IN ('queued', 'processing')
                    """,
                    owner_uuid,
                )
                if active_analyses >= CONCURRENT_ANALYSES_PER_ACCOUNT:
                    raise _active_analysis_error()

                account_daily, account_monthly = await self._usage_counts(
                    connection, owner_uuid, None, "analysis"
                )
                ip_daily, ip_monthly = await self._usage_counts(
                    connection, None, ip_hash, "analysis"
                )
                if account_daily >= ANALYSES_PER_DAY:
                    raise _quota_error("analyses", ANALYSES_PER_DAY, "day")
                if account_monthly >= ANALYSES_PER_MONTH:
                    raise _quota_error("analyses", ANALYSES_PER_MONTH, "month")
                if ip_daily >= IP_ANALYSES_PER_DAY:
                    raise _quota_error("ip_analyses", IP_ANALYSES_PER_DAY, "day")
                if ip_monthly >= IP_ANALYSES_PER_MONTH:
                    raise _quota_error("ip_analyses", IP_ANALYSES_PER_MONTH, "month")

                await connection.execute(
                    """
                    INSERT INTO analysis_jobs (id, owner_id, status, progress, message)
                    VALUES ($1, $2, 'queued', 5, 'Initializing analysis pipeline...')
                    """,
                    job_uuid,
                    owner_uuid,
                )
                await connection.execute(
                    """
                    INSERT INTO usage_records (owner_id, ip_hash, action, analysis_job_id)
                    VALUES ($1, $2, 'analysis', $3)
                    """,
                    owner_uuid,
                    ip_hash,
                    job_uuid,
                )
        return str(job_uuid)

    async def consume_ai_action(self, owner_id: str, ip_hash: str, action: str) -> None:
        owner_uuid = UUID(owner_id)
        async with self.pool.acquire() as connection:
            async with connection.transaction():
                lock_keys = sorted((f"account:{owner_id}", f"ip:{ip_hash}"))
                for lock_key in lock_keys:
                    await connection.execute(
                        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
                        lock_key,
                    )

                account_daily, account_monthly = await self._usage_counts(
                    connection, owner_uuid, None, "ai"
                )
                ip_daily, ip_monthly = await self._usage_counts(
                    connection, None, ip_hash, "ai"
                )
                if account_daily >= AI_ACTIONS_PER_DAY:
                    raise _quota_error("ai_actions", AI_ACTIONS_PER_DAY, "day")
                if account_monthly >= AI_ACTIONS_PER_MONTH:
                    raise _quota_error("ai_actions", AI_ACTIONS_PER_MONTH, "month")
                if ip_daily >= IP_AI_ACTIONS_PER_DAY:
                    raise _quota_error("ip_ai_actions", IP_AI_ACTIONS_PER_DAY, "day")
                if ip_monthly >= IP_AI_ACTIONS_PER_MONTH:
                    raise _quota_error("ip_ai_actions", IP_AI_ACTIONS_PER_MONTH, "month")

                await connection.execute(
                    """
                    INSERT INTO usage_records (owner_id, ip_hash, action)
                    VALUES ($1, $2, $3)
                    """,
                    owner_uuid,
                    ip_hash,
                    action,
                )

    @staticmethod
    async def _usage_counts(
        connection: asyncpg.Connection,
        owner_id: UUID | None,
        ip_hash: str | None,
        action_group: str,
    ) -> tuple[int, int]:
        if action_group == "analysis":
            action_filter = "action = 'analysis'"
        else:
            action_filter = "action <> 'analysis'"

        if owner_id is not None:
            where_clause = "owner_id = $1"
            subject: UUID | str = owner_id
        else:
            where_clause = "ip_hash = $1"
            subject = ip_hash or ""
        row = await connection.fetchrow(
            f"""
            SELECT
                count(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS daily,
                count(*) FILTER (
                    WHERE created_at >= date_trunc('month', now())
                ) AS monthly
            FROM usage_records
            WHERE {where_clause} AND {action_filter}
            """,
            subject,
        )
        return int(row["daily"]), int(row["monthly"])

    async def update_job(
        self,
        job_id: str,
        *,
        status: str,
        progress: int,
        message: str,
        result: dict | None = None,
    ) -> bool:
        job_uuid = UUID(job_id)
        async with self.pool.acquire() as connection:
            async with connection.transaction():
                updated_id = await connection.fetchval(
                    """
                    UPDATE analysis_jobs
                    SET status = $2, progress = $3, message = $4, updated_at = now()
                    WHERE id = $1 AND status IN ('queued', 'processing')
                    RETURNING id
                    """,
                    job_uuid,
                    status,
                    progress,
                    message,
                )
                if updated_id is None:
                    return False

                if status == "completed" and result is not None:
                    await connection.execute(
                        """
                        INSERT INTO reports (analysis_job_id, owner_id, result, expires_at)
                        SELECT id, owner_id, $2, now() + ($3 * interval '1 day')
                        FROM analysis_jobs WHERE id = $1 AND status = 'completed'
                        ON CONFLICT (analysis_job_id) DO NOTHING
                        """,
                        job_uuid,
                        result,
                        REPORT_RETENTION_DAYS,
                    )
                elif status == "failed":
                    await connection.execute(
                        "DELETE FROM usage_records WHERE analysis_job_id = $1",
                        job_uuid,
                    )
        return True

    async def get_active_job(self, owner_id: str) -> dict | None:
        row = await self.pool.fetchrow(
            """
            SELECT id, status, progress, message, updated_at,
                   updated_at < now() - ($2 * interval '1 second') AS is_stale
            FROM analysis_jobs
            WHERE owner_id = $1 AND status IN ('queued', 'processing')
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            UUID(owner_id),
            ANALYSIS_STALE_SECONDS,
        )
        if not row:
            return None
        return {
            "job_id": str(row["id"]),
            "status": row["status"],
            "progress": row["progress"],
            "message": row["message"],
            "updated_at": row["updated_at"].isoformat(),
            "is_stale": row["is_stale"],
        }

    async def recover_stale_job(self, job_id: str, owner_id: str) -> bool | str | None:
        owner_uuid = UUID(owner_id)
        async with self.pool.acquire() as connection:
            async with connection.transaction():
                await connection.execute(
                    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
                    f"account:{owner_id}",
                )
                recovered_id = await connection.fetchval(
                    """
                    UPDATE analysis_jobs
                    SET status = 'failed', progress = 0,
                        message = 'Analysis was recovered after no progress was reported.',
                        updated_at = now()
                    WHERE id = $1 AND owner_id = $2
                      AND status IN ('queued', 'processing')
                      AND updated_at < now() - ($3 * interval '1 second')
                    RETURNING id
                    """,
                    UUID(job_id),
                    owner_uuid,
                    ANALYSIS_STALE_SECONDS,
                )
                if recovered_id is None:
                    state = await connection.fetchrow(
                        "SELECT status FROM analysis_jobs WHERE id = $1 AND owner_id = $2",
                        UUID(job_id),
                        owner_uuid,
                    )
                    if not state:
                        return None
                    if state["status"] not in ("queued", "processing"):
                        return "not_active"
                    return False

                await connection.execute(
                    "DELETE FROM usage_records WHERE analysis_job_id = $1",
                    recovered_id,
                )
        return True

    async def get_job(self, job_id: str, owner_id: str) -> dict | None:
        row = await self.pool.fetchrow(
            """
            SELECT j.id, j.status, j.progress, j.message, j.updated_at, r.result,
                   j.status IN ('queued', 'processing')
                       AND j.updated_at < now() - ($3 * interval '1 second') AS is_stale
            FROM analysis_jobs j
            LEFT JOIN reports r  ON r.analysis_job_id = j.id
            WHERE j.id = $1 AND j.owner_id = $2
            """,
            UUID(job_id),
            UUID(owner_id),
            ANALYSIS_STALE_SECONDS,
        )
        if not row:
            return None
        return {
            "job_id": str(row["id"]),
            "status": row["status"],
            "progress": row["progress"],
            "message": row["message"],
            "updated_at": row["updated_at"].isoformat(),
            "is_stale": row["is_stale"],
            **({"result": row["result"]} if row["result"] is not None else {}),
        }

    async def list_reports(self, owner_id: str) -> list[dict]:
        rows = await self.pool.fetch(
            """
            SELECT r.analysis_job_id AS id, r.created_at, r.expires_at,
                   r.result->>'files_analyzed' AS files_analyzed
            FROM reports r
            WHERE r.owner_id = $1 AND r.expires_at > now()
            ORDER BY r.created_at DESC
            """,
            UUID(owner_id),
        )
        return [
            {
                "id": str(row["id"]),
                "created_at": row["created_at"].isoformat(),
                "expires_at": row["expires_at"].isoformat(),
                "files_analyzed": int(row["files_analyzed"] or 0),
            }
            for row in rows
        ]

    async def get_report(self, report_id: str, owner_id: str) -> dict | None:
        row = await self.pool.fetchrow(
            """
            SELECT r.analysis_job_id AS id, r.result, r.created_at, r.expires_at
            FROM reports r
            WHERE r.analysis_job_id = $1 AND r.owner_id = $2 AND r.expires_at > now()
            """,
            UUID(report_id),
            UUID(owner_id),
        )
        if not row:
            return None
        return {
            "id": str(row["id"]),
            "result": row["result"],
            "created_at": row["created_at"].isoformat(),
            "expires_at": row["expires_at"].isoformat(),
        }

    async def delete_report(self, report_id: str, owner_id: str) -> bool:
        async with self.pool.acquire() as connection:
            async with connection.transaction():
                deleted = await connection.fetchval(
                    """
                    DELETE FROM reports
                    WHERE analysis_job_id = $1 AND owner_id = $2
                    RETURNING analysis_job_id
                    """,
                    UUID(report_id),
                    UUID(owner_id),
                )
                if deleted is None:
                    return False
                await connection.execute(
                    "DELETE FROM analysis_jobs WHERE id = $1 AND owner_id = $2",
                    deleted,
                    UUID(owner_id),
                )
        return True

    async def prune_expired(self) -> None:
        async with self.pool.acquire() as connection:
            await connection.execute(
                "DELETE FROM reports WHERE expires_at <= now()"
            )
            await connection.execute(
                """
                DELETE FROM analysis_jobs
                WHERE status IN ('completed', 'failed')
                  AND updated_at < now() - ($1 * interval '1 day')
                """,
                REPORT_RETENTION_DAYS,
            )
            await connection.execute(
                "DELETE FROM usage_records WHERE created_at < now() - interval '13 months'"
            )


async def get_database_store(request: Request) -> DatabaseStore:
    pool = getattr(request.app.state, "database_pool", None)
    if pool is None or pool.is_closing():
        raise HTTPException(status_code=503, detail="Database persistence is not configured on the server.")
    return DatabaseStore(pool)


async def run_database_maintenance(store: DatabaseStore) -> None:
    while True:
        await asyncio.sleep(3600)
        try:
            await store.prune_expired()
        except (asyncpg.PostgresError, OSError):
            logger.exception("Database cleanup of expired reports and usage records failed")
