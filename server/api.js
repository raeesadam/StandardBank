import { REFERENCE } from './reference.js';
import { coerce, requireSomething, NotFoundError, ValidationError } from './validate.js';
import * as repo from './repository.js';
import {
  themeSchema, observationSchema, rootCauseSchema, actionSchema, incidentSchema, noteSchema,
} from './schemas.js';

/**
 * Child collections all behave the same way, so they are described once here
 * and the CRUD routes are generated from this table.
 */
const CHILDREN = {
  observations: {
    table: 'observations', schema: observationSchema, label: 'Monitoring entry',
    describe: (r) => `${r.period_label || r.period_start}: ${r.complaint_count} complaints`,
  },
  'root-causes': {
    table: 'root_causes', schema: rootCauseSchema, label: 'Root cause',
    describe: (r) => r.title,
  },
  actions: {
    table: 'actions', schema: actionSchema, label: 'Action',
    describe: (r) => r.title,
  },
  incidents: {
    table: 'incidents', schema: incidentSchema, label: 'Incident',
    describe: (r) => `${r.incident_ref ? r.incident_ref + ' - ' : ''}${r.title}`,
  },
  notes: {
    table: 'notes', schema: noteSchema, label: 'Note',
    describe: (r) => `${r.note_type} note`,
  },
};

const actorOf = (body, fallback = 'Complaint manager') =>
  (body?.actor || body?.recorded_by || body?.author || body?.identified_by || body?.proposed_by || fallback)
    .toString().trim() || fallback;

export function handleApi(db, { method, segments, query, body }) {
  // /api/meta
  if (segments.length === 1 && segments[0] === 'meta' && method === 'GET') {
    return { status: 200, body: REFERENCE };
  }

  // /api/dashboard
  if (segments.length === 1 && segments[0] === 'dashboard' && method === 'GET') {
    const months = Math.min(Math.max(Number(query.months) || 12, 1), 60);
    return { status: 200, body: repo.dashboard(db, { months }) };
  }

  // /api/export
  if (segments.length === 1 && segments[0] === 'export' && method === 'GET') {
    return { status: 200, body: repo.exportAll(db) };
  }

  // /api/activity
  if (segments.length === 1 && segments[0] === 'activity' && method === 'GET') {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500);
    const rows = db.all('activity')
      .sort((a, b) => b.id - a.id)
      .slice(0, limit)
      .map((entry) => {
        const theme = entry.theme_id ? db.get('themes', entry.theme_id) : null;
        return { ...entry, reference: theme?.reference ?? null, theme_title: theme?.title ?? null };
      });
    return { status: 200, body: rows };
  }

  if (segments[0] !== 'themes') throw new NotFoundError('Endpoint');

  // /api/themes
  if (segments.length === 1) {
    if (method === 'GET') {
      return {
        status: 200,
        body: repo.listThemes(db, {
          search: query.search, status: query.status, product: query.product,
          channel: query.channel, severity: query.severity, category: query.category,
          business_unit: query.business_unit, owner: query.owner, sort: query.sort,
          regulatory: query.regulatory === 'true',
          watchlist: query.watchlist === 'true',
          open: query.open === 'true',
        }),
      };
    }
    if (method === 'POST') return createTheme(db, body);
    throw methodNotAllowed(method);
  }

  const themeId = Number(segments[1]);
  if (!Number.isInteger(themeId) || themeId <= 0) throw new NotFoundError('Complaint theme');

  // /api/themes/:id
  if (segments.length === 2) {
    if (method === 'GET') return { status: 200, body: repo.getThemeDetail(db, themeId) };
    if (method === 'PATCH' || method === 'PUT') return updateTheme(db, themeId, body);
    if (method === 'DELETE') return deleteTheme(db, themeId, body);
    throw methodNotAllowed(method);
  }

  const collection = segments[2];

  // /api/themes/:id/activity
  if (collection === 'activity' && segments.length === 3 && method === 'GET') {
    repo.getTheme(db, themeId);
    const rows = db.find('activity', (row) => row.theme_id === themeId).sort((a, b) => b.id - a.id);
    return { status: 200, body: rows };
  }

  const spec = CHILDREN[collection];
  if (!spec) throw new NotFoundError('Endpoint');

  // /api/themes/:id/<collection>
  if (segments.length === 3) {
    if (method === 'GET') {
      repo.getTheme(db, themeId);
      return {
        status: 200,
        body: db.find(spec.table, (row) => row.theme_id === themeId).sort((a, b) => b.id - a.id),
      };
    }
    if (method === 'POST') return createChild(db, themeId, collection, spec, body);
    throw methodNotAllowed(method);
  }

  // /api/themes/:id/<collection>/:childId
  if (segments.length === 4) {
    const childId = Number(segments[3]);
    if (!Number.isInteger(childId) || childId <= 0) throw new NotFoundError(spec.label);
    if (method === 'GET') {
      return { status: 200, body: requireChild(db, spec, themeId, childId) };
    }
    if (method === 'PATCH' || method === 'PUT') {
      return updateChild(db, themeId, spec, childId, body);
    }
    if (method === 'DELETE') return deleteChild(db, themeId, spec, childId, body);
    throw methodNotAllowed(method);
  }

  throw new NotFoundError('Endpoint');
}

/* ------------------------------- themes ------------------------------- */

function createTheme(db, body) {
  const data = coerce(body || {}, themeSchema);
  const reference = (body?.reference || '').trim() || repo.nextReference(db);
  if (db.first('themes', (theme) => theme.reference === reference)) {
    throw new ValidationError({ reference: 'is already in use' });
  }
  const row = repo.insertRow(db, 'themes', { ...data, reference });
  repo.logActivity(db, {
    themeId: row.id, entityType: 'theme', entityId: row.id, action: 'created',
    summary: `Recurrent complaint ${row.reference} registered`,
    actor: actorOf(body),
  });
  return { status: 201, body: repo.getThemeDetail(db, row.id) };
}

function updateTheme(db, themeId, body) {
  repo.getTheme(db, themeId);
  const patch = requireSomething(coerce(body || {}, themeSchema, { partial: true }));
  const { before, after } = repo.updateRow(db, 'themes', themeId, patch);
  const changes = repo.diffRecord(before, after);
  if (changes.length > 0) {
    repo.logActivity(db, {
      themeId, entityType: 'theme', entityId: themeId, action: 'updated',
      summary: summariseChanges('Complaint theme', changes),
      detail: changes, actor: actorOf(body),
    });
  }
  return { status: 200, body: repo.getThemeDetail(db, themeId) };
}

function deleteTheme(db, themeId, body) {
  const theme = repo.deleteThemeCascade(db, themeId);
  repo.logActivity(db, {
    themeId: null, entityType: 'theme', entityId: themeId, action: 'deleted',
    summary: `Recurrent complaint ${theme.reference} (${theme.title}) deleted`,
    actor: actorOf(body),
  });
  return { status: 200, body: { deleted: true, id: themeId } };
}

/* ------------------------------ children ------------------------------ */

function createChild(db, themeId, collection, spec, body) {
  repo.getTheme(db, themeId);
  const data = coerce(body || {}, spec.schema);

  if (collection === 'observations') {
    if (!data.period_label) data.period_label = monthLabel(data.period_start);
    const clash = db.first('observations',
      (row) => row.theme_id === themeId && row.period_start === data.period_start);
    if (clash) throw new ValidationError({ period_start: 'already has a monitoring entry for this theme' });
  }
  if (collection === 'actions' && data.root_cause_id) {
    assertRootCauseBelongs(db, themeId, data.root_cause_id);
  }

  const row = repo.insertRow(db, spec.table, { ...data, theme_id: themeId });
  repo.logActivity(db, {
    themeId, entityType: spec.table, entityId: row.id, action: 'created',
    summary: `${spec.label} added - ${spec.describe(row)}`,
    actor: actorOf(body),
  });
  touchTheme(db, themeId, collection, row);
  return { status: 201, body: row };
}

function updateChild(db, themeId, spec, childId, body) {
  requireChild(db, spec, themeId, childId);
  const patch = requireSomething(coerce(body || {}, spec.schema, { partial: true }));
  if (spec.table === 'actions' && patch.root_cause_id) {
    assertRootCauseBelongs(db, themeId, patch.root_cause_id);
  }
  const { before, after } = repo.updateRow(db, spec.table, childId, patch);
  const changes = repo.diffRecord(before, after);
  if (changes.length > 0) {
    repo.logActivity(db, {
      themeId, entityType: spec.table, entityId: childId, action: 'updated',
      summary: summariseChanges(`${spec.label} "${truncate(spec.describe(after))}"`, changes),
      detail: changes, actor: actorOf(body),
    });
  }
  return { status: 200, body: after };
}

function deleteChild(db, themeId, spec, childId, body) {
  const row = requireChild(db, spec, themeId, childId);
  if (spec.table === 'root_causes') repo.unlinkActionsFromCause(db, childId);
  repo.deleteRow(db, spec.table, childId);
  repo.logActivity(db, {
    themeId, entityType: spec.table, entityId: childId, action: 'deleted',
    summary: `${spec.label} removed - ${truncate(spec.describe(row))}`,
    actor: actorOf(body),
  });
  return { status: 200, body: { deleted: true, id: childId } };
}

function requireChild(db, spec, themeId, childId) {
  const row = db.get(spec.table, childId);
  if (!row || row.theme_id !== Number(themeId)) throw new NotFoundError(spec.label);
  return row;
}

function assertRootCauseBelongs(db, themeId, rootCauseId) {
  const cause = db.get('root_causes', rootCauseId);
  if (!cause || cause.theme_id !== Number(themeId)) {
    throw new ValidationError({ root_cause_id: 'must be a root cause on this complaint theme' });
  }
}

/** Keeps the theme's "last reported" date honest as monitoring data arrives. */
function touchTheme(db, themeId, collection, row) {
  if (collection !== 'observations') return;
  const theme = db.get('themes', themeId);
  const patch = {};
  if (!theme.last_reported_on || row.period_start > theme.last_reported_on) {
    patch.last_reported_on = row.period_start;
  }
  if (!theme.first_reported_on || row.period_start < theme.first_reported_on) {
    patch.first_reported_on = row.period_start;
  }
  if (Object.keys(patch).length > 0) repo.updateRow(db, 'themes', themeId, patch);
}

/* ------------------------------- helpers ------------------------------ */

function summariseChanges(subject, changes) {
  const head = changes.slice(0, 2)
    .map((c) => `${c.field}: ${truncate(String(c.from) || '(empty)', 40)} → ${truncate(String(c.to) || '(empty)', 40)}`)
    .join('; ');
  const rest = changes.length > 2 ? ` (+${changes.length - 2} more)` : '';
  return `${subject} updated - ${head}${rest}`;
}

function truncate(value, max = 60) {
  const str = String(value ?? '');
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function monthLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleString('en-ZA', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function methodNotAllowed(method) {
  const err = new Error(`${method} is not allowed on this endpoint`);
  err.statusCode = 405;
  return err;
}
