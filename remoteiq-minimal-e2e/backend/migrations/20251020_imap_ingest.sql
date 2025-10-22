-- 20251020_imap_ingest.sql

-- Keep IDs simple to avoid extensions
CREATE TABLE IF NOT EXISTS imap_ingested_mail (
  id            BIGSERIAL PRIMARY KEY,
  purpose       TEXT NOT NULL,
  -- IMAP UID within the mailbox you polled (unique per purpose)
  uid           BIGINT NOT NULL,
  from_addr     TEXT,
  subject       TEXT,
  size_bytes    INTEGER,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Bounce detection fields (for DSN-style bounces)
  is_bounce           BOOLEAN NOT NULL DEFAULT FALSE,
  bounce_recipient    TEXT,
  bounce_status       TEXT,
  bounce_action       TEXT,
  bounce_diagnostic   TEXT,
  -- Raw headers can be helpful for debugging; optional and kept small-ish
  headers_snippet TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS imap_ingested_mail_purpose_uid_uq
  ON imap_ingested_mail (purpose, uid);

CREATE INDEX IF NOT EXISTS imap_ingested_mail_recent
  ON imap_ingested_mail (received_at DESC);

-- (Optional) If you ever want the service to keep its own cursor here
-- rather than memory/kv, you can use this table. We won't use it
-- automatically yet, but it's handy.
CREATE TABLE IF NOT EXISTS imap_poll_cursor (
  purpose   TEXT PRIMARY KEY,
  last_uid  BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
