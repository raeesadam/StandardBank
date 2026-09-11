import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_DB_PATH = process.env.RCM_DB_PATH || resolve(ROOT, 'data', 'complaints.db');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- A "theme" is a recurrent complaint: the recurring issue the bank monitors,
-- not a single customer complaint. Individual complaint volumes roll up to it.
CREATE TABLE IF NOT EXISTS themes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  reference           TEXT    NOT NULL UNIQUE,
  title               TEXT    NOT NULL,
  description         TEXT    NOT NULL DEFAULT '',
  product             TEXT    NOT NULL DEFAULT 'Unassigned',
  channel             TEXT    NOT NULL DEFAULT 'Unassigned',
  category            TEXT    NOT NULL DEFAULT 'Unassigned',
  severity            TEXT    NOT NULL DEFAULT 'Medium',
  status              TEXT    NOT NULL DEFAULT 'Under investigation',
  business_unit       TEXT    NOT NULL DEFAULT '',
  product_owner       TEXT    NOT NULL DEFAULT '',
  product_owner_email TEXT    NOT NULL DEFAULT '',
  complaint_manager   TEXT    NOT NULL DEFAULT '',
  first_reported_on   TEXT,
  last_reported_on    TEXT,
  target_close_date   TEXT,
  regulatory_risk     INTEGER NOT NULL DEFAULT 0,
  watchlist           INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL
);

-- Periodic monitoring numbers. One row per theme per reporting period.
CREATE TABLE IF NOT EXISTS observations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id           INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  period_start       TEXT    NOT NULL,
  period_label       TEXT    NOT NULL,
  complaint_count    INTEGER NOT NULL DEFAULT 0,
  resolved_count     INTEGER NOT NULL DEFAULT 0,
  avg_resolution_days REAL   NOT NULL DEFAULT 0,
  financial_impact   REAL    NOT NULL DEFAULT 0,
  repeat_customers   INTEGER NOT NULL DEFAULT 0,
  notes              TEXT    NOT NULL DEFAULT '',
  recorded_by        TEXT    NOT NULL DEFAULT '',
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,
  UNIQUE (theme_id, period_start)
);

CREATE TABLE IF NOT EXISTS root_causes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id         INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  title            TEXT    NOT NULL,
  description      TEXT    NOT NULL DEFAULT '',
  category         TEXT    NOT NULL DEFAULT 'Process',
  confidence       TEXT    NOT NULL DEFAULT 'Suspected',
  contribution_pct INTEGER NOT NULL DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'Open',
  evidence         TEXT    NOT NULL DEFAULT '',
  identified_by    TEXT    NOT NULL DEFAULT '',
  identified_on    TEXT,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);

-- Actions proposed by product owners. root_cause_id links the action to the
-- cause it is meant to remove; NULL means the action is not yet attributed.
CREATE TABLE IF NOT EXISTS actions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id      INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  root_cause_id INTEGER REFERENCES root_causes(id) ON DELETE SET NULL,
  title         TEXT    NOT NULL,
  description   TEXT    NOT NULL DEFAULT '',
  proposed_by   TEXT    NOT NULL DEFAULT '',
  proposer_role TEXT    NOT NULL DEFAULT 'Product owner',
  proposed_on   TEXT,
  due_date      TEXT,
  completed_on  TEXT,
  priority      TEXT    NOT NULL DEFAULT 'Medium',
  status        TEXT    NOT NULL DEFAULT 'Proposed',
  effectiveness TEXT    NOT NULL DEFAULT 'Not assessed',
  notes         TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id           INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  incident_ref       TEXT    NOT NULL DEFAULT '',
  title              TEXT    NOT NULL,
  description        TEXT    NOT NULL DEFAULT '',
  severity           TEXT    NOT NULL DEFAULT 'P3',
  status             TEXT    NOT NULL DEFAULT 'Resolved',
  started_at         TEXT,
  resolved_at        TEXT,
  systems_affected   TEXT    NOT NULL DEFAULT '',
  customers_affected INTEGER NOT NULL DEFAULT 0,
  postmortem_url     TEXT    NOT NULL DEFAULT '',
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL
);

-- Free-form input from the complaint manager.
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id   INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  note_type  TEXT    NOT NULL DEFAULT 'Observation',
  body       TEXT    NOT NULL,
  author     TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

-- Append-only history. Every create/update/delete on any record above writes
-- one row here, which is what the timeline on a theme is rendered from.
CREATE TABLE IF NOT EXISTS activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id    INTEGER REFERENCES themes(id) ON DELETE CASCADE,
  entity_type TEXT    NOT NULL,
  entity_id   INTEGER,
  action      TEXT    NOT NULL,
  summary     TEXT    NOT NULL,
  detail      TEXT    NOT NULL DEFAULT '[]',
  actor       TEXT    NOT NULL DEFAULT 'System',
  created_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_observations_theme ON observations(theme_id, period_start);
CREATE INDEX IF NOT EXISTS idx_root_causes_theme  ON root_causes(theme_id);
CREATE INDEX IF NOT EXISTS idx_actions_theme      ON actions(theme_id);
CREATE INDEX IF NOT EXISTS idx_incidents_theme    ON incidents(theme_id);
CREATE INDEX IF NOT EXISTS idx_notes_theme        ON notes(theme_id);
CREATE INDEX IF NOT EXISTS idx_activity_theme     ON activity(theme_id, id);
`;

let instance = null;

export function openDatabase(path = DEFAULT_DB_PATH) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

export function getDb() {
  if (!instance) instance = openDatabase();
  return instance;
}

export function closeDb() {
  if (instance) {
    instance.close();
    instance = null;
  }
}
