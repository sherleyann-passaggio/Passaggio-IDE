-- ═════════════════════════════════════════════════════════════════════════════
-- Neon schema for deployment-intake
-- Run this once against your Neon database via the Neon SQL Editor or:
--   psql "$DATABASE_URL" -f schema.sql
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS intakes (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  website       TEXT,
  fallback_notes TEXT,
  file_urls     JSONB DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add website column if the table already exists without it
ALTER TABLE intakes ADD COLUMN IF NOT EXISTS website TEXT;

-- Migration: add Vapi-specific columns (vapi_transcript, vapi_summary, game_plan_markdown)
ALTER TABLE intakes ADD COLUMN IF NOT EXISTS vapi_transcript TEXT;
ALTER TABLE intakes ADD COLUMN IF NOT EXISTS vapi_summary TEXT;
ALTER TABLE intakes ADD COLUMN IF NOT EXISTS game_plan_markdown TEXT;

-- Optional: index for fast lookups by email / recency
CREATE INDEX IF NOT EXISTS idx_intakes_email      ON intakes(email);
CREATE INDEX IF NOT EXISTS idx_intakes_created_at ON intakes(created_at DESC);
