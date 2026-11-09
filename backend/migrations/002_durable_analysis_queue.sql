ALTER TABLE analysis_jobs
    ADD COLUMN input_type TEXT,
    ADD COLUMN input_payload JSONB,
    ADD COLUMN input_archive BYTEA,
    ADD COLUMN worker_id TEXT,
    ADD COLUMN lease_until TIMESTAMPTZ,
    ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX analysis_jobs_queue_idx
    ON analysis_jobs (status, created_at)
    WHERE status IN ('queued', 'processing');

UPDATE analysis_jobs
SET status = 'failed',
    progress = 0,
    message = 'This job was interrupted before durable queueing was enabled. Please start it again.',
    updated_at = now()
WHERE status IN ('queued', 'processing');

DELETE FROM usage_records
WHERE analysis_job_id IN (
    SELECT id FROM analysis_jobs WHERE status = 'failed' AND input_type IS NULL
);
