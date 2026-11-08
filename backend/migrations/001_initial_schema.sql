CREATE TABLE analysis_jobs (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX analysis_jobs_owner_status_idx ON analysis_jobs (owner_id, status);
CREATE INDEX analysis_jobs_updated_at_idx ON analysis_jobs (updated_at);

CREATE TABLE reports (
    analysis_job_id UUID PRIMARY KEY REFERENCES analysis_jobs (id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX reports_owner_created_idx ON reports (owner_id, created_at DESC);
CREATE INDEX reports_expiration_idx ON reports (expires_at);

CREATE TABLE usage_records (
    id BIGSERIAL PRIMARY KEY,
    owner_id UUID NOT NULL,
    ip_hash TEXT NOT NULL,
    action TEXT NOT NULL,
    analysis_job_id UUID REFERENCES analysis_jobs (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_records_owner_action_created_idx
    ON usage_records (owner_id, action, created_at);
CREATE INDEX usage_records_ip_action_created_idx
    ON usage_records (ip_hash, action, created_at);
