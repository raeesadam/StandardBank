import { getDb } from './store.js';
import { NotFoundError } from './validate.js';
import { CLOSED_THEME_STATUSES, OPEN_ACTION_STATUSES, OPEN_INCIDENT_STATUSES } from './reference.js';

const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

const RECENT_PERIODS = 6;   // the comparison window that defines a trend
const TREND_BAND = 15;      // +/- percent inside which a theme counts as stable

/* ------------------------------------------------------------------ *
 * Activity log - the history every view is rendered from.
 * ------------------------------------------------------------------ */

/**
 * `subject` is the thing that changed - a reference, a title, a period. The
 * client composes the sentence around it in the reader's language; `summary`
 * is kept as a plain-language fallback for anything that predates this.
 */
export function logActivity(db, { themeId, entityType, entityId, action, summary, subject = '', detail = [], actor }) {
  return db.insert('activity', {
    theme_id: themeId ?? null,
    entity_type: entityType,
    entity_id: entityId ?? null,
    action,
    subject,
    summary,
    detail,
    actor: actor || 'Unknown user',
    created_at: now(),
  });
}

/** Field-level diff so the timeline can say "Severity: High -> Critical". */
export function diffRecord(before, after, labels = {}) {
  const changes = [];
  for (const [key, value] of Object.entries(after)) {
    if (!(key in before)) continue;
    if (key === 'updated_at' || key === 'id') continue;
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
 * Generic record helpers
 * ------------------------------------------------------------------ */

export function insertRow(db, table, data) {
  return db.insert(table, { ...data, created_at: now(), updated_at: now() });
}

export function updateRow(db, table, id, patch) {
  const result = db.update(table, id, { ...patch, updated_at: now() });
  if (!result) throw new NotFoundError();
  return result;
}

export function getRow(db, table, id) {
  const row = db.get(table, id);
  if (!row) throw new NotFoundError();
  return row;
}

export function deleteRow(db, table, id) {
  const row = getRow(db, table, id);
  db.remove(table, id);
  return row;
}

/** Children of a theme, oldest first by id unless a comparator is given. */
export function childrenOf(db, table, themeId, compare) {
  const rows = db.find(table, (row) => row.theme_id === Number(themeId));
  return compare ? rows.sort(compare) : rows;
}

/* ------------------------------------------------------------------ *
 * Themes
 * ------------------------------------------------------------------ */

export function nextReference(db) {
  const year = new Date().getFullYear();
  const prefix = `RC-${year}-`;
  const highest = db.find('themes', (theme) => String(theme.reference).startsWith(prefix))
    .reduce((max, theme) => Math.max(max, Number(String(theme.reference).split('-')[2]) || 0), 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

const SEVERITY_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

const THEME_SORTS = {
  volume: (a, b) => b.volume_recent - a.volume_recent || a.title.localeCompare(b.title),
  reference: (a, b) => a.reference.localeCompare(b.reference),
  title: (a, b) => a.title.localeCompare(b.title),
  severity: (a, b) => b.severity_rank - a.severity_rank || b.volume_recent - a.volume_recent,
  updated: (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)),
  last_reported: (a, b) => String(b.last_reported_on || '').localeCompare(String(a.last_reported_on || '')),
  open_actions: (a, b) => b.open_actions - a.open_actions || b.volume_recent - a.volume_recent,
};

const matches = (value, wanted) => !wanted || value === wanted;

/**
 * Themes with their rolled-up monitoring numbers. `volume_recent` is the last
 * six reporting periods and `volume_previous` the six before, so the two are
 * directly comparable and give the trend.
 */
export function listThemes(db, filters = {}) {
  const search = filters.search ? String(filters.search).toLowerCase() : '';

  const decorated = db.all('themes')
    .filter((theme) => {
      if (search) {
        const haystack = [theme.title, theme.description, theme.reference,
                          theme.product_owner, theme.product].join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (!matches(theme.status, filters.status)) return false;
      if (!matches(theme.product, filters.product)) return false;
      if (!matches(theme.channel, filters.channel)) return false;
      if (!matches(theme.severity, filters.severity)) return false;
      if (!matches(theme.category, filters.category)) return false;
      if (!matches(theme.business_unit, filters.business_unit)) return false;
      if (filters.owner && theme.product_owner !== filters.owner) return false;
      if (filters.regulatory === true && !theme.regulatory_risk) return false;
      if (filters.watchlist === true && !theme.watchlist) return false;
      if (filters.open === true && CLOSED_THEME_STATUSES.has(theme.status)) return false;
      return true;
    })
    .map((theme) => decorateTheme(db, theme));

  return decorated.sort(THEME_SORTS[filters.sort] || THEME_SORTS.volume);
}

function decorateTheme(db, theme) {
  const themeId = theme.id;

  // Newest period first, so "the last six periods" is just the first six rows.
  const observations = db.find('observations', (row) => row.theme_id === themeId)
    .sort((a, b) => String(b.period_start).localeCompare(String(a.period_start)));

  const sumCounts = (rows) => rows.reduce((acc, row) => acc + (Number(row.complaint_count) || 0), 0);
  const recent = observations.slice(0, RECENT_PERIODS);
  const previous = observations.slice(RECENT_PERIODS, RECENT_PERIODS * 2);

  const volumeRecent = sumCounts(recent);
  const volumePrevious = sumCounts(previous);
  const volumeTotal = sumCounts(observations);

  let changePct = null;
  if (volumePrevious > 0) {
    changePct = Math.round(((volumeRecent - volumePrevious) / volumePrevious) * 1000) / 10;
  }

  let trend = 'Insufficient history';
  if (changePct !== null) {
    if (changePct >= TREND_BAND) trend = 'Increasing';
    else if (changePct <= -TREND_BAND) trend = 'Decreasing';
    else trend = 'Stable';
  }

  const lastThree = observations.slice(0, 3);
  const avgResolution = lastThree.length === 0 ? null
    : Math.round((lastThree.reduce((acc, row) => acc + (Number(row.avg_resolution_days) || 0), 0)
        / lastThree.length) * 10) / 10;

  const actions = db.find('actions', (row) => row.theme_id === themeId);
  const rootCauses = db.find('root_causes', (row) => row.theme_id === themeId);
  const incidents = db.find('incidents', (row) => row.theme_id === themeId);
  const openActions = actions.filter((action) => OPEN_ACTION_STATUSES.has(action.status));
  const stamp = today();

  return {
    ...theme,
    regulatory_risk: !!theme.regulatory_risk,
    watchlist: !!theme.watchlist,
    volume_recent: volumeRecent,
    volume_previous: volumePrevious,
    volume_total: volumeTotal,
    financial_impact_total: observations.reduce((acc, row) => acc + (Number(row.financial_impact) || 0), 0),
    avg_resolution_days: avgResolution,
    latest_count: observations[0]?.complaint_count ?? null,
    latest_period: observations[0]?.period_label ?? null,
    observation_count: observations.length,
    root_cause_count: rootCauses.length,
    confirmed_cause_count: rootCauses.filter((cause) => cause.confidence === 'Confirmed').length,
    action_count: actions.length,
    open_actions: openActions.length,
    overdue_actions: openActions.filter((action) => action.due_date && action.due_date < stamp).length,
    completed_actions: actions.filter((action) => action.status === 'Completed').length,
    incident_count: incidents.length,
    open_incidents: incidents.filter((incident) => OPEN_INCIDENT_STATUSES.has(incident.status)).length,
    note_count: db.count('notes', (row) => row.theme_id === themeId),
    severity_rank: SEVERITY_RANK[theme.severity] || 1,
    change_pct: changePct,
    trend,
  };
}

export function getTheme(db, id) {
  const theme = db.get('themes', id);
  if (!theme) throw new NotFoundError('Complaint theme');
  return decorateTheme(db, theme);
}

const byPeriodAscending = (a, b) => String(a.period_start).localeCompare(String(b.period_start));
const byContribution = (a, b) => (b.contribution_pct || 0) - (a.contribution_pct || 0) || a.id - b.id;
const ACTION_ORDER = { Blocked: 0, 'In progress': 1, Approved: 2, Proposed: 3 };
const byActionUrgency = (a, b) =>
  (ACTION_ORDER[a.status] ?? 4) - (ACTION_ORDER[b.status] ?? 4) ||
  String(a.due_date || '9999-12-31').localeCompare(String(b.due_date || '9999-12-31'));
const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id;

export function getThemeDetail(db, id) {
  const theme = getTheme(db, id);
  const themeId = theme.id;
  const causeTitles = new Map(
    db.find('root_causes', (row) => row.theme_id === themeId).map((row) => [row.id, row.title])
  );

  return {
    ...theme,
    observations: childrenOf(db, 'observations', themeId, byPeriodAscending),
    rootCauses: childrenOf(db, 'root_causes', themeId, byContribution),
    actions: childrenOf(db, 'actions', themeId, byActionUrgency)
      .map((action) => ({ ...action, root_cause_title: causeTitles.get(action.root_cause_id) ?? null })),
    incidents: childrenOf(db, 'incidents', themeId,
      (a, b) => String(b.started_at || '').localeCompare(String(a.started_at || ''))),
    notes: childrenOf(db, 'notes', themeId, byNewest),
    activity: db.find('activity', (row) => row.theme_id === themeId)
      .sort((a, b) => b.id - a.id)
      .slice(0, 200),
  };
}

/** Removing a theme removes everything recorded against it. */
export function deleteThemeCascade(db, themeId) {
  const theme = getRow(db, 'themes', themeId);
  const id = Number(themeId);
  for (const table of ['observations', 'root_causes', 'actions', 'incidents', 'notes', 'activity']) {
    db.removeWhere(table, (row) => row.theme_id === id);
  }
  db.remove('themes', id);
  return theme;
}

/** An action outlives the root cause it was raised against; it is only unlinked. */
export function unlinkActionsFromCause(db, causeId) {
  for (const action of db.find('actions', (row) => row.root_cause_id === Number(causeId))) {
    db.update('actions', action.id, { root_cause_id: null });
  }
}

/* ------------------------------------------------------------------ *
 * Dashboard aggregates
 * ------------------------------------------------------------------ */

export function dashboard(db, { months = 12 } = {}) {
  const themes = listThemes(db);
  const openThemes = themes.filter((theme) => !CLOSED_THEME_STATUSES.has(theme.status));
  const stamp = today();

  const periods = new Map();
  for (const row of db.all('observations')) {
    const key = row.period_start;
    if (!periods.has(key)) {
      periods.set(key, {
        period_start: key, period_label: row.period_label || key,
        complaints: 0, resolved: 0, financial_impact: 0,
      });
    }
    const bucket = periods.get(key);
    bucket.complaints += Number(row.complaint_count) || 0;
    bucket.resolved += Number(row.resolved_count) || 0;
    bucket.financial_impact += Number(row.financial_impact) || 0;
  }
  const volumeByPeriod = [...periods.values()]
    .sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)))
    .slice(-months);

  const overdueActions = db.all('actions')
    .filter((action) => OPEN_ACTION_STATUSES.has(action.status) && action.due_date && action.due_date < stamp)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .map((action) => {
      const theme = db.get('themes', action.theme_id);
      return {
        id: action.id, title: action.title, due_date: action.due_date,
        status: action.status, priority: action.priority, proposed_by: action.proposed_by,
        theme_id: action.theme_id,
        reference: theme?.reference ?? '', theme_title: theme?.title ?? '',
      };
    });

  const recentActivity = db.all('activity')
    .sort((a, b) => b.id - a.id)
    .slice(0, 25)
    .map((entry) => {
      const theme = entry.theme_id ? db.get('themes', entry.theme_id) : null;
      return { ...entry, reference: theme?.reference ?? null, theme_title: theme?.title ?? null };
    });

  const latestPeriod = volumeByPeriod[volumeByPeriod.length - 1] || null;
  const previousPeriod = volumeByPeriod[volumeByPeriod.length - 2] || null;

  return {
    generatedAt: now(),
    kpis: {
      totalThemes: themes.length,
      openThemes: openThemes.length,
      watchlist: themes.filter((theme) => theme.watchlist).length,
      regulatory: themes.filter((theme) => theme.regulatory_risk).length,
      increasing: openThemes.filter((theme) => theme.trend === 'Increasing').length,
      complaintsLatestPeriod: latestPeriod?.complaints ?? 0,
      complaintsPreviousPeriod: previousPeriod?.complaints ?? 0,
      latestPeriodLabel: latestPeriod?.period_label ?? null,
      openActions: sum(themes, 'open_actions'),
      overdueActions: overdueActions.length,
      completedActions: sum(themes, 'completed_actions'),
      openIncidents: sum(themes, 'open_incidents'),
      linkedIncidents: sum(themes, 'incident_count'),
      confirmedRootCauses: sum(themes, 'confirmed_cause_count'),
      financialImpact: themes.reduce((acc, theme) => acc + (theme.financial_impact_total || 0), 0),
    },
    volumeByPeriod,
    topThemes: [...themes].sort((a, b) => b.volume_recent - a.volume_recent).slice(0, 8),
    increasingThemes: openThemes
      .filter((theme) => theme.trend === 'Increasing')
      .sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0))
      .slice(0, 6),
    byStatus: countBy(db, 'themes', 'status'),
    bySeverity: countBy(db, 'themes', 'severity'),
    byProduct: countBy(db, 'themes', 'product'),
    byChannel: countBy(db, 'themes', 'channel'),
    rootCauseCategories: countBy(db, 'root_causes', 'category'),
    actionsByStatus: countBy(db, 'actions', 'status'),
    actionEffectiveness: countBy(db, 'actions', 'effectiveness',
      (action) => action.status === 'Completed'),
    overdueActions,
    recentActivity,
  };
}

function countBy(db, table, field, predicate) {
  const rows = predicate ? db.find(table, predicate) : db.all(table);
  const counts = new Map();
  for (const row of rows) {
    const label = row[field] ?? 'Unassigned';
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function sum(rows, key) {
  return rows.reduce((acc, row) => acc + (row[key] || 0), 0);
}

export function exportAll(db) {
  const out = { exportedAt: now(), version: 1 };
  for (const table of ['themes', 'observations', 'root_causes', 'actions', 'incidents', 'notes', 'activity']) {
    out[table] = db.all(table);
  }
  return out;
}

export { getDb };
