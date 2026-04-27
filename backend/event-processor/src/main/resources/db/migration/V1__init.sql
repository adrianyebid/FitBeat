CREATE TABLE IF NOT EXISTS processed_events (
    event_id VARCHAR(80) PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS session_metrics (
    session_id VARCHAR(80) PRIMARY KEY,
    user_id VARCHAR(80),
    activity_type VARCHAR(50),
    mode VARCHAR(30),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    real_duration_sec INT,
    skip_count INT NOT NULL DEFAULT 0,
    week_start DATE
);

CREATE TABLE IF NOT EXISTS weekly_user_stats (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(80) NOT NULL,
    week_start DATE NOT NULL,
    sessions_finished INT NOT NULL DEFAULT 0,
    minutes_total INT NOT NULL DEFAULT 0,
    adherence_pct INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_weekly_user UNIQUE (user_id, week_start)
);

CREATE TABLE IF NOT EXISTS emitted_business_events (
    event_key VARCHAR(150) PRIMARY KEY,
    event_type VARCHAR(80) NOT NULL,
    emitted_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_metrics_user_finished
    ON session_metrics (user_id, finished_at);
