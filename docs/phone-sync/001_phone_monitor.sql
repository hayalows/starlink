-- Starlink Ghana phone companion. Run this once in the chosen Neon SQL Editor.
-- No personal account, sign-in, or Starlink authentication credentials are stored.
-- Access is controlled by strong read/write capability hashes.
CREATE TABLE IF NOT EXISTS monitor_pairs (
  monitor_id uuid PRIMARY KEY,
  view_digest text NOT NULL UNIQUE CHECK (length(view_digest) = 64),
  write_digest text NOT NULL UNIQUE CHECK (length(write_digest) = 64),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monitor_pairs_updated_at ON monitor_pairs (updated_at DESC);
-- Future maintenance: remove pairs that have not synchronized for 90 days,
-- only after discussing data-retention needs with the monitor owner.
