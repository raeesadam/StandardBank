import { getDb } from './db.js';
import { NotFoundError } from './validate.js';
import { CLOSED_THEME_STATUSES, OPEN_ACTION_STATUSES, OPEN_INCIDENT_STATUSES } from './reference.js';

const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ *
 * Activity log - the history every view is rendered from.
 * ------------------------------------------------------------------ */

export function logActivity(db, { themeId, entityType, entityId, action, summary, detail = [], actor }) {
  db.prepare(`
    INSERT INTO activity (theme_id, entity_type, entity_id, action, summary, detail, actor, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(themeId ?? null, entityType, entityId ?? null, action, summary,
         JSON.stringify(detail), actor || 'Unknown user', now());
}

/** Field-level diff so the timeline can say "Severity: High -> Critical". */
export function diffRecord(before, after, labels = {}) {
  const changes = [];
  for (const [key, value] of Object.entries(after)) {
    if (!(key in before)) continue;
    const from = before[key];
    if (String(from ?? '') === String(value ?? '')) continue;
    changes.push({ field: labels[key] || humanise(key), from: from ?? '', to: value ?? '' });
  }
  return changes;
}

function humanise(key) {
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ *
 * Themes
 * ------------------------------------------------------------------ */

export function nextReference(db) {
  const year = new Date().getFullYear();
  const row = db.prepare(
    `SELECT reference FROM themes WHERE reference LIKE ? ORDER BY reference DESC LIMIT 1`
  ).get(`RC-${year}-%`);
  const seq = row ? Number(row.reference.split('-')[2]) + 1 : 1;
  return `RC-${year}-${String(seq).padStart(3, '0')}`;
}

const THEME_SORTS = {
  volume: 'volume_recent DESC, t.title ASC',
  reference: 't.reference ASC',
  title: 't.title ASC',
  severity: 'severity_rank DESC, volume_recent DESC',
  updated: 't.updated_at DESC',
  last_reported: 'COALESCE(t.last_reported_on, "") DESC',
  open_actions: 'open_actions DESC, volume_recent DESC',
};

/**
 * Themes with their rolled-up monitoring numbers. `volume_recent` is the last
 * 6 reporting periods and `volume_previous` the 6 before that, so the two are
 * directly comparable and give the trend.
 */
export function listThemes(db, filters = {}) {
  const where = [];
  const params = {};

  if (filters.search) {
    where.push(`(t.title LIKE :search OR t.description LIKE :search OR t.reference LIKE :search
                 OR t.product_owner LIKE :search OR t.product LIKE :search)`);
    params.search = `%${filters.search}%`;
  }
  for (const key of ['status', 'product', 'channel', 'severity', 'category', 'business_unit']) {
    if (filters[key]) { where.push(`t.${key} = :${key}`); params[key] = filters[key]; }
  }
  if (filters.owner) { where.push('t.product_owner = :owner'); params.owner = filters.owner; }
  if (filters.regulatory === true) where.push('t.regulatory_risk = 1');
  if (filters.watchlist === true) where.push('t.watchlist = 1');
  if (filters.open === true) {
    where.push(`t.status NOT IN (${[...CLOSED_THEME_STATUSES].map((s) => `'${s}'`).join(',')})`);
  }

  const openActionList = [...OPEN_ACTION_STATUSES].map((s) => `'${s}'`).join(',');
  const openIncidentList = [...OPEN_INCIDENT_STATUSES].map((s) => `'${s}'`).join(',');

  const sql = `
    WITH ranked AS (
      SELECT theme_id, complaint_count, resolved_count, avg_resolution_days, financial_impact,
             ROW_NUMBER() OVER (PARTITION BY theme_id ORDER BY period_start DESC) AS rn
      FROM observations
    )
    SELECT t.*,
      COALESCE((SELECT SUM(complaint_count) FROM ranked WHERE theme_id = t.id AND rn <= 6), 0)  AS volume_recent,
      COALESCE((SELECT SUM(complaint_count) FROM ranked WHERE theme_id = t.id AND rn BETWEEN 7 AND 12), 0) AS volume_previous,
      COALESCE((SELECT SUM(complaint_count) FROM observations WHERE theme_id = t.id), 0)        AS volume_total,
      COALESCE((SELECT SUM(financial_impact) FROM observations WHERE theme_id = t.id), 0)       AS financial_impact_total,
      (SELECT AVG(avg_resolution_days) FROM ranked WHERE theme_id = t.id AND rn <= 3)           AS avg_resolution_days,
      (SELECT complaint_count FROM observations WHERE theme_id = t.id
        ORDER BY period_start DESC LIMIT 1)                                                     AS latest_count,
      (SELECT period_label FROM observations WHERE theme_id = t.id
        ORDER BY period_start DESC LIMIT 1)                                                     AS latest_period,
      (SELECT COUNT(*) FROM observations WHERE theme_id = t.id)                                 AS observation_count,
      (SELECT COUNT(*) FROM root_causes WHERE theme_id = t.id)                                  AS root_cause_count,
      (SELECT COUNT(*) FROM root_causes WHERE theme_id = t.id AND confidence = 'Confirmed')      AS confirmed_cause_count,
      (SELECT COUNT(*) FROM actions WHERE theme_id = t.id)                                       AS action_count,
      (SELECT COUNT(*) FROM actions WHERE theme_id = t.id AND status IN (${openActionList}))      AS open_actions,
      (SELECT COUNT(*) FROM actions WHERE theme_id = t.id AND status IN (${openActionList})
         AND due_date IS NOT NULL AND due_date < date('now'))                                    AS overdue_actions,
      (SELECT COUNT(*) FROM actions WHERE theme_id = t.id AND status = 'Completed')              AS completed_actions,
      (SELECT COUNT(*) FROM incidents WHERE theme_id = t.id)                                     AS incident_count,
      (SELECT COUNT(*) FROM incidents WHERE theme_id = t.id AND status IN (${openIncidentList}))  AS open_incidents,
      (SELECT COUNT(*) FROM notes WHERE theme_id = t.id)                                         AS note_count,
      CASE t.severity WHEN 'Critical' THEN 4 WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END  AS severity_rank
    FROM themes t
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${THEME_SORTS[filters.sort] || THEME_SORTS.volume}
  `;

  return db.prepare(sql).all(params).map(decorateTheme);
}

function decorateTheme(row) {
  const recent = row.volume_recent || 0;
  const previous = row.volume_previous || 0;
  let changePct = null;
  if (previous > 0) changePct = Math.round(((recent - previous) / previous) * 1000) / 10;
  else if (recent > 0) changePct = null; // no comparable history yet

  let trend = 'Insufficient history';
  if (changePct !== null) {
    if (changePct >= 15) trend = 'Increasing';
    else if (changePct <= -15) trend = 'Decreasing';
    else trend = 'Stable';
  }

  return {
    ...row,
    regulatory_risk: !!row.regulatory_risk,
    watchlist: !!row.watchlist,
    avg_resolution_days: row.avg_resolution_days === null
      ? null : Math.round(row.avg_resolution_days * 10) / 10,
    change_pct: changePct,
    trend,
  };
}

export function getTheme(db, id) {
  const rows = db.prepare(`SELECT id FROM themes WHERE id = ?`).all(id);
  if (rows.length === 0) throw new NotFoundError('Complaint theme');
  return listThemes(db).find((t) => t.id === Number(id));
}

export function getThemeDetail(db, id) {
  const theme = getTheme(db, id);
  return {
    ...theme,
    observations: db.prepare(
      `SELECT * FROM observations WHERE theme_id = ? ORDER BY period_start ASC`).all(id),
    rootCauses: db.prepare(
      `SELECT * FROM root_causes WHERE theme_id = ? ORDER BY contribution_pct DESC, id ASC`).all(id),
    actions: db.prepare(`
      SELECT a.*, rc.title AS root_cause_title
      FROM actions a LEFT JOIN root_causes rc ON rc.id = a.root_cause_id
      WHERE a.theme_id = ?
      ORDER BY CASE a.status WHEN 'Blocked' THEN 0 WHEN 'In progress' THEN 1 WHEN 'Approved' THEN 2
                             WHEN 'Proposed' THEN 3 ELSE 4 END,
               COALESCE(a.due_date, '9999-12-31') ASC`).all(id),
    incidents: db.prepare(
      `SELECT * FROM incidents WHERE theme_id = ? ORDER BY COALESCE(started_at, '') DESC`).all(id),
    notes: db.prepare(
      `SELECT * FROM notes WHERE theme_id = ? ORDER BY created_at DESC, id DESC`).all(id),
    activity: db.prepare(
      `SELECT * FROM activity WHERE theme_id = ? ORDER BY id DESC LIMIT 200`).all(id)
      .map((a) => ({ ...a, detail: safeParse(a.detail) })),
  };
}

function safeParse(json) {
  try { return JSON.parse(json); } catch { return []; }
}

/* ------------------------------------------------------------------ *
 * Generic child-record helpers
 * ------------------------------------------------------------------ */

export function insertRow(db, table, data) {
  const payload = { ...data, created_at: now(), updated_at: now() };
  const cols = Object.keys(payload);
  const stmt = db.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => `:${c}`).join(', ')})`
  );
  const info = stmt.run(payload);
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
}

export function updateRow(db, table, id, patch) {
  const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!existing) throw new NotFoundError();
  const payload = { ...patch, updated_at: now() };
  const sets = Object.keys(payload).map((c) => `${c} = :${c}`).join(', ');
  db.prepare(`UPDATE ${table} SET ${sets} WHERE id = :id`).run({ ...payload, id: Number(id) });
  return {
    before: existing,
    after: db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id),
  };
}

export function getRow(db, table, id) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!row) throw new NotFoundError();
  return row;
}

export function deleteRow(db, table, id) {
  const row = getRow(db, table, id);
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return row;
}

/* ------------------------------------------------------------------ *
 * Dashboard aggregates
 * ------------------------------------------------------------------ */

export function dashboard(db, { months = 12 } = {}) {
  const themes = listThemes(db);
  const openThemes = themes.filter((t) => !CLOSED_THEME_STATUSES.has(t.status));

  const volumeByPeriod = db.prepare(`
    SELECT period_start, period_label,
           SUM(complaint_count) AS complaints,
           SUM(resolved_count)  AS resolved,
           SUM(financial_impact) AS financial_impact
    FROM observations
    GROUP BY period_start, period_label
    ORDER BY period_start DESC
    LIMIT ?
  `).all(months).reverse();

  const byStatus = countBy(db, 'themes', 'status');
  const bySeverity = countBy(db, 'themes', 'severity');
  const byProduct = countBy(db, 'themes', 'product');
  const byChannel = countBy(db, 'themes', 'channel');

  const rootCauseCategories = db.prepare(`
    SELECT category AS label, COUNT(*) AS count FROM root_causes
    GROUP BY category ORDER BY count DESC
  `).all();

  const actionsByStatus = db.prepare(`
    SELECT status AS label, COUNT(*) AS count FROM actions
    GROUP BY status ORDER BY count DESC
  `).all();

  const actionEffectiveness = db.prepare(`
    SELECT effectiveness AS label, COUNT(*) AS count FROM actions
    WHERE status = 'Completed' GROUP BY effectiveness ORDER BY count DESC
  `).all();

  const overdueActions = db.prepare(`
    SELECT a.id, a.title, a.due_date, a.status, a.priority, a.proposed_by,
           t.id AS theme_id, t.reference, t.title AS theme_title
    FROM actions a JOIN themes t ON t.id = a.theme_id
    WHERE a.status IN (${[...OPEN_ACTION_STATUSES].map((s) => `'${s}'`).join(',')})
      AND a.due_date IS NOT NULL AND a.due_date < date('now')
    ORDER BY a.due_date ASC
  `).all();

  const recentActivity = db.prepare(`
    SELECT a.*, t.reference, t.title AS theme_title
    FROM activity a LEFT JOIN themes t ON t.id = a.theme_id
    ORDER BY a.id DESC LIMIT 25
  `).all().map((a) => ({ ...a, detail: safeParse(a.detail) }));

  const latestPeriod = volumeByPeriod.at(-1) || null;
  const previousPeriod = volumeByPeriod.at(-2) || null;

  return {
    generatedAt: now(),
    kpis: {
      totalThemes: themes.length,
      openThemes: openThemes.length,
      watchlist: themes.filter((t) => t.watchlist).length,
      regulatory: themes.filter((t) => t.regulatory_risk).length,
      increasing: openThemes.filter((t) => t.trend === 'Increasing').length,
      complaintsLatestPeriod: latestPeriod?.complaints ?? 0,
      complaintsPreviousPeriod: previousPeriod?.complaints ?? 0,
      latestPeriodLabel: latestPeriod?.period_label ?? null,
      openActions: sum(themes, 'open_actions'),
      overdueActions: overdueActions.length,
      completedActions: sum(themes, 'completed_actions'),
      openIncidents: sum(themes, 'open_incidents'),
      linkedIncidents: sum(themes, 'incident_count'),
      confirmedRootCauses: sum(themes, 'confirmed_cause_count'),
      financialImpact: themes.reduce((acc, t) => acc + (t.financial_impact_total || 0), 0),
    },
    volumeByPeriod,
    topThemes: [...themes].sort((a, b) => b.volume_recent - a.volume_recent).slice(0, 8),
    increasingThemes: openThemes.filter((t) => t.trend === 'Increasing')
      .sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0)).slice(0, 6),
    byStatus, bySeverity, byProduct, byChannel,
    rootCauseCategories, actionsByStatus, actionEffectiveness,
    overdueActions, recentActivity,
  };
}

function countBy(db, table, column) {
  return db.prepare(
    `SELECT ${column} AS label, COUNT(*) AS count FROM ${table} GROUP BY ${column} ORDER BY count DESC`
  ).all();
}

function sum(rows, key) {
  return rows.reduce((acc, row) => acc + (row[key] || 0), 0);
}

export function exportAll(db) {
  const tables = ['themes', 'observations', 'root_causes', 'actions', 'incidents', 'notes', 'activity'];
  const out = { exportedAt: now(), version: 1 };
  for (const table of tables) out[table] = db.prepare(`SELECT * FROM ${table}`).all();
  return out;
}

export { getDb };
