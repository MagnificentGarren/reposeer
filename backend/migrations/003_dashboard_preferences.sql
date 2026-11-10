ALTER TABLE analysis_jobs
    ADD COLUMN repository_url TEXT;

UPDATE analysis_jobs
SET repository_url = input_payload->>'repo_url'
WHERE input_payload ? 'repo_url';

CREATE TABLE saved_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    repository_url TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (owner_id, repository_url)
);

CREATE INDEX saved_repositories_owner_created_idx
    ON saved_repositories (owner_id, created_at DESC);

CREATE TABLE user_preferences (
    owner_id UUID PRIMARY KEY,
    theme TEXT NOT NULL DEFAULT 'default'
        CHECK (theme IN ('default', 'light', 'dark')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
