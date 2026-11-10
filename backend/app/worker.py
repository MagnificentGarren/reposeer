import asyncio
import logging
import os
import uuid
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=REPO_ROOT / ".env")

from app.api.inspect import process_analysis_job
from app.services.database import (
    ANALYSIS_LEASE_SECONDS,
    DatabaseStore,
    create_database_pool,
    run_database_maintenance,
)
from app.services.ingestion import IngestionService

logger = logging.getLogger(__name__)
TEMP_FILE_RETENTION_SECONDS = 24 * 60 * 60
QUEUE_POLL_SECONDS = 1


async def _maintain_temp_files(store: DatabaseStore) -> None:
    while True:
        await asyncio.sleep(3600)
        try:
            active_job_ids = await store.get_active_job_ids()
            await asyncio.to_thread(
                IngestionService.cleanup_expired_temp_dirs,
                TEMP_FILE_RETENTION_SECONDS,
                active_job_ids,
            )
        except (asyncpg.PostgresError, OSError):
            logger.error("Cleanup of abandoned analysis temporary directories failed.")


async def _heartbeat(store: DatabaseStore, job_id: str, worker_id: str) -> None:
    while True:
        await asyncio.sleep(max(1, ANALYSIS_LEASE_SECONDS // 3))
        try:
            if not await store.heartbeat_analysis(job_id, worker_id):
                logger.warning("Worker lease for analysis job %s was lost", job_id)
                return
        except (asyncpg.PostgresError, OSError):
            logger.error("Could not renew worker lease for analysis job %s.", job_id)


async def run_worker_loop(store: DatabaseStore) -> None:
    worker_id = str(uuid.uuid4())
    maintenance_task = asyncio.create_task(_maintain_temp_files(store))
    try:
        active_job_ids = await store.get_active_job_ids()
        await asyncio.to_thread(
            IngestionService.cleanup_expired_temp_dirs,
            TEMP_FILE_RETENTION_SECONDS,
            active_job_ids,
        )
    except (asyncpg.PostgresError, OSError):
        logger.error("Initial cleanup of abandoned analysis directories failed.")
    logger.info("Analysis worker %s started", worker_id)

    try:
        while True:
            try:
                job = await store.claim_next_analysis(worker_id)
            except (asyncpg.PostgresError, OSError):
                logger.error("Analysis worker could not claim a job.")
                await asyncio.sleep(QUEUE_POLL_SECONDS * 5)
                continue
            if job is None:
                await asyncio.sleep(QUEUE_POLL_SECONDS)
                continue

            job_id = job["job_id"]
            heartbeat_task = asyncio.create_task(_heartbeat(store, job_id, worker_id))
            try:
                await process_analysis_job(job, store, worker_id)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.error("Analysis worker failed while processing job %s.", job_id)
                try:
                    await store.update_job(
                        job_id,
                        status="failed",
                        progress=0,
                        message="Analysis failed because the worker could not process the saved job.",
                        worker_id=worker_id,
                    )
                except (asyncpg.PostgresError, OSError):
                    logger.error("Could not save failure state for analysis job %s.", job_id)
            finally:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
    finally:
        maintenance_task.cancel()
        try:
            await maintenance_task
        except asyncio.CancelledError:
            pass


async def run_worker() -> None:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL must be configured for the analysis worker.")

    pool = await create_database_pool(database_url)
    store = DatabaseStore(pool)
    database_maintenance_task = asyncio.create_task(run_database_maintenance(store))
    try:
        await run_worker_loop(store)
    finally:
        database_maintenance_task.cancel()
        try:
            await database_maintenance_task
        except asyncio.CancelledError:
            pass
        await pool.close()


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    try:
        asyncio.run(run_worker())
    except (asyncpg.PostgresError, OSError):
        logger.error("Analysis worker stopped because it could not reach PostgreSQL.")
        raise


if __name__ == "__main__":
    main()
