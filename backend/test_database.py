import asyncio

import pytest
from fastapi import HTTPException

import app.services.database as database

from app.services.database import (
    _active_analysis_error,
    _database_connection_options,
    _quota_error,
    hash_client_ip,
)


def test_quota_error_has_actionable_http_response():
    error = _quota_error("ai_actions", 10, "day")

    assert error.status_code == 429
    assert error.detail["code"] == "quota_exceeded"
    assert error.detail["message"] == "Ai actions limit reached (10 per day). Please try again later."


@pytest.mark.parametrize(
    ("daily", "monthly", "expected_window"),
    [(database.AI_ACTIONS_PER_DAY, 0, "day"), (0, database.AI_ACTIONS_PER_MONTH, "month")],
)
def test_ai_action_quota_blocks_database_write(daily, monthly, expected_window):
    class FakeConnection:
        def __init__(self):
            self.executed_statements = []

        class Transaction:
            async def __aenter__(self):
                return None

            async def __aexit__(self, *_args):
                return False

        def transaction(self):
            return self.Transaction()

        async def execute(self, query, *_args):
            self.executed_statements.append(query)

        async def fetchrow(self, _query, _subject):
            return {"daily": daily, "monthly": monthly}

    class FakeAcquire:
        def __init__(self, connection):
            self.connection = connection

        async def __aenter__(self):
            return self.connection

        async def __aexit__(self, *_args):
            return False

    class FakePool:
        def __init__(self, connection):
            self.connection = connection

        def acquire(self):
            return FakeAcquire(self.connection)

    connection = FakeConnection()
    store = database.DatabaseStore(FakePool(connection))

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            store.consume_ai_action(
                "00000000-0000-0000-0000-000000000001",
                "hashed-test-ip",
                "chat",
            )
        )

    assert error.value.status_code == 429
    assert error.value.detail["window"] == expected_window
    assert not any("INSERT INTO usage_records" in query for query in connection.executed_statements)


def test_analysis_quota_blocks_job_and_usage_inserts():
    class FakeConnection:
        def __init__(self):
            self.executed_statements = []

        class Transaction:
            async def __aenter__(self):
                return None

            async def __aexit__(self, *_args):
                return False

        def transaction(self):
            return self.Transaction()

        async def execute(self, query, *_args):
            self.executed_statements.append(query)

        async def fetchval(self, _query, *_args):
            return 0

        async def fetchrow(self, _query, _subject):
            return {"daily": database.ANALYSES_PER_DAY, "monthly": 0}

    class FakeAcquire:
        def __init__(self, connection):
            self.connection = connection

        async def __aenter__(self):
            return self.connection

        async def __aexit__(self, *_args):
            return False

    class FakePool:
        def __init__(self, connection):
            self.connection = connection

        def acquire(self):
            return FakeAcquire(self.connection)

    connection = FakeConnection()
    store = database.DatabaseStore(FakePool(connection))

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            store.create_analysis(
                "00000000-0000-0000-0000-000000000001",
                "hashed-test-ip",
                input_type="github",
                input_payload={"repo_url": "https://github.com/example/repo"},
            )
        )

    assert error.value.status_code == 429
    assert error.value.detail["quota"] == "analyses"
    assert not any("INSERT INTO analysis_jobs" in query for query in connection.executed_statements)
    assert not any("INSERT INTO usage_records" in query for query in connection.executed_statements)


def test_active_analysis_conflict_is_distinct_from_quota_exhaustion():
    error = _active_analysis_error()

    assert error.status_code == 409
    assert error.detail["code"] == "active_analysis"


def test_client_ip_hash_is_stable_and_keyed(monkeypatch):
    monkeypatch.setenv("REPOSEER_RATE_LIMIT_HMAC_KEY", "test-key")
    first_hash = hash_client_ip("192.0.2.1")

    assert first_hash == hash_client_ip("192.0.2.1")
    assert first_hash != "192.0.2.1"
    monkeypatch.setenv("REPOSEER_RATE_LIMIT_HMAC_KEY", "rotated-key")
    assert first_hash != hash_client_ip("192.0.2.1")


@pytest.mark.parametrize(
    ("url", "expected_ssl"),
    [
        ("postgresql://user:pass@localhost/db", None),
        ("postgresql://user:pass@db.example/db?sslmode=require", "require"),
        ("postgresql://user:pass@db.example/db?sslmode=verify-full", "verify-full"),
    ],
)
def test_database_url_ssl_options(url, expected_ssl):
    _, ssl = _database_connection_options(url)
    assert ssl == expected_ssl


def test_database_url_normalizes_sqlalchemy_asyncpg_scheme():
    dsn, ssl = _database_connection_options(
        "postgresql+asyncpg://db.example/reposeer?sslmode=require"
    )

    assert dsn == "postgresql://db.example/reposeer"
    assert ssl == "require"


def test_database_url_rejects_unknown_ssl_mode():
    with pytest.raises(ValueError, match="Unsupported DATABASE_URL sslmode"):
        _database_connection_options("postgresql://user:pass@db.example/db?sslmode=invalid")


def test_database_pool_disables_prepared_statement_cache_for_pooler(monkeypatch):
    received_options = {}
    pool = object()

    async def create_pool(**options):
        received_options.update(options)
        return pool

    async def apply_migrations(_pool):
        assert _pool is pool

    monkeypatch.setattr(database.asyncpg, "create_pool", create_pool)
    monkeypatch.setattr(database, "apply_migrations", apply_migrations)

    result = asyncio.run(
        database.create_database_pool("postgresql://user:pass@pooler.example/db")
    )
    assert result is pool
    assert received_options["statement_cache_size"] == 0
