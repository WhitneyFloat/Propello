-- Propello Initial Schema
-- Run this in your Supabase SQL editor to initialize all tables.

-- 1. subscriber_profiles
CREATE TABLE subscriber_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMP DEFAULT now(),
  org_name             TEXT NOT NULL,
  mission_statement    TEXT,
  ntee_code            TEXT,
  primary_geo          TEXT,
  program_types        TEXT[],
  annual_budget        TEXT,
  budget_tier_minimum  INTEGER,
  staff_count          INTEGER,
  profile_id           TEXT UNIQUE,
  tier                 TEXT DEFAULT 'free' -- free | core | growth | board_brief
);

-- 2. grants_raw
CREATE TABLE grants_raw (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMP DEFAULT now(),
  foundation_name  TEXT,
  grant_title      TEXT,
  description      TEXT,
  award_min        INTEGER,
  award_max        INTEGER,
  deadline         DATE,
  geo              TEXT,
  program_types    TEXT[],
  source_url       TEXT,
  source           TEXT, -- candid | foundation_site | az_nonprofit | google_news
  raw_data         JSONB
);

-- 3. grant_matches
CREATE TABLE grant_matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMP DEFAULT now(),
  subscriber_id         UUID REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  grant_id              UUID REFERENCES grants_raw(id) ON DELETE CASCADE,
  raw_similarity_score  FLOAT,
  final_score           INTEGER, -- 0-100
  score_breakdown       JSONB,
  rationale             TEXT,
  high_priority         BOOLEAN DEFAULT false, -- true if final_score >= 85
  scored_at             TIMESTAMP
);

-- 4. funder_profiles
CREATE TABLE funder_profiles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ein                    TEXT UNIQUE,
  foundation_name        TEXT,
  total_assets           BIGINT,
  total_distributions    BIGINT,
  fiscal_year_end        DATE,
  required_distribution  BIGINT,
  underspend_gap         BIGINT,
  primary_program_areas  TEXT[],
  geographic_focus       TEXT,
  average_grant_size     INTEGER,
  board_members          JSONB,
  last_990_year          INTEGER,
  updated_at             TIMESTAMP DEFAULT now()
);

-- 5. liquidity_alerts
CREATE TABLE liquidity_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMP DEFAULT now(),
  funder_id           UUID REFERENCES funder_profiles(id) ON DELETE CASCADE,
  funder_name         TEXT,
  gap_amount          BIGINT,
  fiscal_year_end     DATE,
  days_remaining      INTEGER,
  hidden_liquidity    BOOLEAN DEFAULT false,
  recommended_action  TEXT,
  published           BOOLEAN DEFAULT false
);

-- 6. drafting_kits
CREATE TABLE drafting_kits (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              TIMESTAMP DEFAULT now(),
  subscriber_id           UUID REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  grant_id                UUID REFERENCES grants_raw(id) ON DELETE CASCADE,
  strategic_narrative     TEXT,
  key_data_points         TEXT[],
  budget_framing          TEXT,
  loi_opening_paragraph   TEXT,
  generated_at            TIMESTAMP
);

-- 7. board_briefs
CREATE TABLE board_briefs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                TIMESTAMP DEFAULT now(),
  subscriber_id             UUID REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  quarter                   TEXT, -- e.g. Q1 2026
  pdf_url                   TEXT,
  sector_intelligence       TEXT,
  top_grants                JSONB,
  funder_landscape_shifts   TEXT,
  strategic_recommendations JSONB,
  generated_at              TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX idx_grant_matches_subscriber ON grant_matches(subscriber_id);
CREATE INDEX idx_grant_matches_high_priority ON grant_matches(high_priority) WHERE high_priority = true;
CREATE INDEX idx_grant_matches_final_score ON grant_matches(final_score DESC);
CREATE INDEX idx_grants_raw_created ON grants_raw(created_at DESC);
CREATE INDEX idx_grants_raw_deadline ON grants_raw(deadline ASC);
CREATE INDEX idx_liquidity_alerts_published ON liquidity_alerts(published) WHERE published = false;
CREATE INDEX idx_funder_profiles_ein ON funder_profiles(ein);
