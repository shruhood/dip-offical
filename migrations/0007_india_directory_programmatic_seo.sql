-- Migration 0007: India Digital Directory Multilingual Programmatic SEO System
-- Hosted inside existing `dip_content` logical domain (`DB_CONTENT` / primary `DB` fallback)
-- Preserves the strict 10-database Cloudflare Free-Plan cap.

CREATE TABLE IF NOT EXISTS india_locations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  parent_id TEXT,
  level TEXT NOT NULL CHECK (level IN ('country', 'state', 'ut', 'district', 'city', 'town')),
  state_slug TEXT NOT NULL,
  district_slug TEXT,
  city_slug TEXT,
  canonical_path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  native_names_json TEXT NOT NULL DEFAULT '{}',
  lgd_code TEXT UNIQUE NOT NULL,
  census_code TEXT,
  iso_code TEXT,
  capital TEXT,
  pin_codes TEXT NOT NULL DEFAULT '000000',
  latitude REAL NOT NULL DEFAULT 20.5937,
  longitude REAL NOT NULL DEFAULT 78.9629,
  official_languages_json TEXT NOT NULL DEFAULT '["en","hi"]',
  region_zone TEXT NOT NULL DEFAULT 'West India',
  source_authority TEXT NOT NULL DEFAULT 'Local Government Directory (LGD), Govt. of India',
  source_url TEXT NOT NULL DEFAULT 'https://lgdirectory.gov.in/',
  verified INTEGER NOT NULL DEFAULT 1,
  published INTEGER NOT NULL DEFAULT 1,
  index_policy TEXT NOT NULL DEFAULT 'auto' CHECK (index_policy IN ('auto', 'index', 'noindex')),
  highlighted_services_json TEXT NOT NULL DEFAULT '[]',
  custom_summary TEXT NOT NULL DEFAULT '',
  seo_title TEXT,
  seo_description TEXT,
  quality_score INTEGER NOT NULL DEFAULT 100,
  content_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_india_locations_level ON india_locations(level);
CREATE INDEX IF NOT EXISTS idx_india_locations_state ON india_locations(state_slug);
CREATE INDEX IF NOT EXISTS idx_india_locations_parent ON india_locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_india_locations_published ON india_locations(published, verified);

CREATE TABLE IF NOT EXISTS directory_translations (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  lang_code TEXT NOT NULL,
  localized_name TEXT,
  headline TEXT,
  summary TEXT,
  seo_title TEXT,
  seo_description TEXT,
  faqs_json TEXT NOT NULL DEFAULT '[]',
  translation_status TEXT NOT NULL DEFAULT 'machine_reviewed' CHECK (translation_status IN ('verified', 'machine_reviewed', 'draft')),
  updated_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (location_id, lang_code)
);

CREATE INDEX IF NOT EXISTS idx_dir_trans_loc_lang ON directory_translations(location_id, lang_code);

CREATE TABLE IF NOT EXISTS seo_import_batches (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  format TEXT NOT NULL,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_duplicates INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  actor_user_id TEXT NOT NULL,
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
