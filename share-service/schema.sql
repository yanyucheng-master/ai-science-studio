CREATE TABLE IF NOT EXISTS experiment_shares (
  code text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS experiment_shares_expires_at ON experiment_shares (expires_at);
