import { test, after, before, describe } from './support/harness.js';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/store.js';
import { createApp } from '../server/index.js';
import { seedDatabase } from '../server/seed.js';

let server;
let base;
let db;

before(async () => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  server = createApp(db);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe('reference data', () => {
  test('exposes the controlled vocabularies the UI builds its inputs from', async () => {
    const { status, body } = await call('/api/meta');
    assert.equal(status, 200);
    assert.ok(body.themeStatuses.includes('Remediation in progress'));
    assert.ok(body.rootCauseCategories.includes('Third party / Vendor'));
    assert.ok(body.actionStatuses.includes('Blocked'));
  });
});

describe('recurrent complaint register', () => {
  test('lists themes with rolled-up monitoring figures and a trend', async () => {
    const { status, body } = await call('/api/themes');
    assert.equal(status, 200);
    assert.equal(body.length, 12);

    const theme = body[0];
    assert.ok(theme.volume_recent > 0);
    assert.ok(['Increasing', 'Decreasing', 'Stable', 'Insufficient history'].includes(theme.trend));
    assert.equal(typeof theme.open_actions, 'number');
    assert.equal(typeof theme.root_cause_count, 'number');
  });

  test('trend is derived from the last 6 periods against the 6 before', async () => {
    const { body } = await call('/api/themes');
    const rising = body.find((t) => t.trend === 'Increasing');
    const falling = body.find((t) => t.trend === 'Decreasing');
    assert.ok(rising.volume_recent > rising.volume_previous);
    assert.ok(falling.volume_recent < falling.volume_previous);
  });

  test('filters by status, severity and free text', async () => {
    const byStatus = await call('/api/themes?status=Resolved');
    assert.ok(byStatus.body.length >= 1);
    assert.ok(byStatus.body.every((t) => t.status === 'Resolved'));

    const open = await call('/api/themes?open=true');
    assert.ok(open.body.every((t) => t.status !== 'Resolved'));

    const search = await call('/api/themes?search=debit%20order');
    assert.ok(search.body.length >= 1);
    assert.ok(search.body[0].title.toLowerCase().includes('debit order'));

    const regulatory = await call('/api/themes?regulatory=true');
    assert.ok(regulatory.body.every((t) => t.regulatory_risk === true));
  });

  test('rejects an unknown status value rather than storing it', async () => {
    const { status, body } = await call('/api/themes', {
      method: 'POST',
      body: { title: 'Bad status', status: 'Definitely not a status' },
    });
    assert.equal(status, 422);
    assert.match(body.fields.status, /must be one of/);
  });

  test('requires a title', async () => {
    const { status, body } = await call('/api/themes', { method: 'POST', body: { description: 'x' } });
    assert.equal(status, 422);
    assert.equal(body.fields.title, 'is required');
  });

  test('allocates the next reference automatically', async () => {
    const { status, body } = await call('/api/themes', {
      method: 'POST',
      body: {
        title: 'Statements not received by post',
        product: 'Personal Current Account',
        severity: 'Low',
        actor: 'Test manager',
      },
    });
    assert.equal(status, 201);
    assert.match(body.reference, /^RC-\d{4}-\d{3}$/);
    assert.equal(body.volume_total, 0);
    assert.equal(body.trend, 'Insufficient history');
    assert.equal(body.activity[0].summary, `Recurrent complaint ${body.reference} registered`);
    assert.equal(body.activity[0].actor, 'Test manager');
  });
});

describe('monitoring history', () => {
  let themeId;

  test('accepts a new reporting period and derives the label', async () => {
    const created = await call('/api/themes', {
      method: 'POST', body: { title: 'Monitoring fixture', actor: 'Tester' },
    });
    themeId = created.body.id;

    const { status, body } = await call(`/api/themes/${themeId}/observations`, {
      method: 'POST',
      body: { period_start: '2026-07-01', complaint_count: 42, resolved_count: 30, recorded_by: 'Tester' },
    });
    assert.equal(status, 201);
    assert.equal(body.complaint_count, 42);
    assert.ok(body.period_label.length > 0);
  });

  test('keeps the theme first/last reported dates in step with the data', async () => {
    const { body } = await call(`/api/themes/${themeId}`);
    assert.equal(body.first_reported_on, '2026-07-01');
    assert.equal(body.last_reported_on, '2026-07-01');
  });

  test('refuses a second entry for the same period', async () => {
    const { status, body } = await call(`/api/themes/${themeId}/observations`, {
      method: 'POST', body: { period_start: '2026-07-01', complaint_count: 7 },
    });
    assert.equal(status, 422);
    assert.match(body.fields.period_start, /already has a monitoring entry/);
  });

  test('rejects a negative complaint count', async () => {
    const { status, body } = await call(`/api/themes/${themeId}/observations`, {
      method: 'POST', body: { period_start: '2026-08-01', complaint_count: -3 },
    });
    assert.equal(status, 422);
    assert.match(body.fields.complaint_count, /at least 0/);
  });

  test('rejects a malformed date', async () => {
    const { status, body } = await call(`/api/themes/${themeId}/observations`, {
      method: 'POST', body: { period_start: 'last July', complaint_count: 3 },
    });
    assert.equal(status, 422);
    assert.match(body.fields.period_start, /YYYY-MM-DD/);
  });
});

describe('root causes and actions', () => {
  let themeId;
  let causeId;

  before(async () => {
    const created = await call('/api/themes', {
      method: 'POST', body: { title: 'Action fixture', actor: 'Tester' },
    });
    themeId = created.body.id;
    const cause = await call(`/api/themes/${themeId}/root-causes`, {
      method: 'POST',
      body: {
        title: 'Batch job does not check state', category: 'System / Technology',
        confidence: 'Confirmed', contribution_pct: 70, identified_by: 'Tester',
      },
    });
    causeId = cause.body.id;
  });

  test('an action can be linked to a root cause on the same theme', async () => {
    const { status, body } = await call(`/api/themes/${themeId}/actions`, {
      method: 'POST',
      body: {
        title: 'Add a state guard', proposed_by: 'Product owner A',
        proposer_role: 'Product owner', root_cause_id: causeId,
        due_date: '2026-12-01', priority: 'High',
      },
    });
    assert.equal(status, 201);
    assert.equal(body.root_cause_id, causeId);
    assert.equal(body.status, 'Proposed');
  });

  test('an action cannot be linked to a root cause on a different theme', async () => {
    const other = await call('/api/themes', { method: 'POST', body: { title: 'Other theme' } });
    const { status, body } = await call(`/api/themes/${other.body.id}/actions`, {
      method: 'POST',
      body: { title: 'Cross-linked action', proposed_by: 'Someone', root_cause_id: causeId },
    });
    assert.equal(status, 422);
    assert.match(body.fields.root_cause_id, /root cause on this complaint theme/);
  });

  test('an action requires a proposer, because the register is about accountability', async () => {
    const { status, body } = await call(`/api/themes/${themeId}/actions`, {
      method: 'POST', body: { title: 'Anonymous action' },
    });
    assert.equal(status, 422);
    assert.equal(body.fields.proposed_by, 'is required');
  });

  test('updating an action records a field-level diff in the history', async () => {
    const detail = await call(`/api/themes/${themeId}`);
    const action = detail.body.actions[0];

    const { status } = await call(`/api/themes/${themeId}/actions/${action.id}`, {
      method: 'PATCH',
      body: { status: 'Completed', effectiveness: 'Effective', completed_on: '2026-09-01', actor: 'Product owner A' },
    });
    assert.equal(status, 200);

    const after = await call(`/api/themes/${themeId}`);
    const entry = after.body.activity[0];
    assert.match(entry.summary, /Status: Proposed → Completed/);
    assert.equal(entry.actor, 'Product owner A');
    const statusChange = entry.detail.find((c) => c.field === 'Status');
    assert.deepEqual(statusChange, { field: 'Status', from: 'Proposed', to: 'Completed' });
  });

  test('a PATCH with nothing recognisable is rejected', async () => {
    const detail = await call(`/api/themes/${themeId}`);
    const action = detail.body.actions[0];
    const { status } = await call(`/api/themes/${themeId}/actions/${action.id}`, {
      method: 'PATCH', body: { nonsense: true },
    });
    assert.equal(status, 422);
  });

  test('deleting a root cause unlinks its actions instead of deleting them', async () => {
    const before = await call(`/api/themes/${themeId}`);
    const action = before.body.actions.find((a) => a.root_cause_id === causeId);
    assert.ok(action, 'expected an action linked to the cause');

    const removed = await call(`/api/themes/${themeId}/root-causes/${causeId}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);

    const after = await call(`/api/themes/${themeId}`);
    const survivor = after.body.actions.find((a) => a.id === action.id);
    assert.ok(survivor, 'the action was deleted along with its root cause');
    assert.equal(survivor.root_cause_id, null);
    assert.equal(survivor.root_cause_title, null);
  });

  test('a child record cannot be reached through the wrong theme', async () => {
    const detail = await call(`/api/themes/${themeId}`);
    const action = detail.body.actions[0];
    const { status } = await call(`/api/themes/999999/actions/${action.id}`);
    assert.equal(status, 404);
  });
});

describe('incidents and notes', () => {
  let themeId;

  before(async () => {
    const created = await call('/api/themes', { method: 'POST', body: { title: 'Incident fixture' } });
    themeId = created.body.id;
  });

  test('links an incident to the recurrent complaint', async () => {
    const { status, body } = await call(`/api/themes/${themeId}/incidents`, {
      method: 'POST',
      body: {
        incident_ref: 'INC-2026-9001', title: 'Batch ran twice', severity: 'P1',
        status: 'Closed', started_at: '2026-03-02', resolved_at: '2026-03-03',
        customers_affected: 1800,
      },
    });
    assert.equal(status, 201);
    assert.equal(body.severity, 'P1');
    assert.equal(body.customers_affected, 1800);
  });

  test('captures a free-form note from the complaint manager', async () => {
    const { status, body } = await call(`/api/themes/${themeId}/notes`, {
      method: 'POST',
      body: { note_type: 'Escalation', body: 'Escalated to the complaints forum.', author: 'Sipho' },
    });
    assert.equal(status, 201);
    assert.equal(body.author, 'Sipho');
  });

  test('a note without a body is rejected', async () => {
    const { status, body } = await call(`/api/themes/${themeId}/notes`, {
      method: 'POST', body: { author: 'Sipho' },
    });
    assert.equal(status, 422);
    assert.equal(body.fields.body, 'is required');
  });

  test('deleting a theme cascades to its children and is itself recorded', async () => {
    await call(`/api/themes/${themeId}`, { method: 'DELETE', body: { actor: 'Tester' } });

    const gone = await call(`/api/themes/${themeId}`);
    assert.equal(gone.status, 404);

    const activity = await call('/api/activity?limit=5');
    assert.match(activity.body[0].summary, /deleted/);
    assert.equal(activity.body[0].actor, 'Tester');
  });
});

describe('dashboard aggregates', () => {
  test('summarises the register across every dimension the overview shows', async () => {
    const { status, body } = await call('/api/dashboard');
    assert.equal(status, 200);
    assert.ok(body.kpis.totalThemes > 0);
    assert.ok(body.volumeByPeriod.length > 0);
    assert.ok(body.topThemes.length > 0);
    assert.ok(body.rootCauseCategories.length > 0);
    assert.ok(body.actionsByStatus.length > 0);
    assert.ok(Array.isArray(body.overdueActions));
    assert.ok(body.recentActivity.length > 0);
  });

  test('every overdue action really is past due and still open', async () => {
    const { body } = await call('/api/dashboard');
    const today = new Date().toISOString().slice(0, 10);
    for (const action of body.overdueActions) {
      assert.ok(action.due_date < today, `${action.title} is not past due`);
      assert.ok(!['Completed', 'Rejected', 'Deferred'].includes(action.status));
    }
  });
});

describe('export and errors', () => {
  test('exports every table for reporting', async () => {
    const { status, body } = await call('/api/export');
    assert.equal(status, 200);
    for (const table of ['themes', 'observations', 'root_causes', 'actions', 'incidents', 'notes', 'activity']) {
      assert.ok(Array.isArray(body[table]), `${table} missing from the export`);
    }
  });

  test('unknown endpoints 404 rather than 500', async () => {
    assert.equal((await call('/api/nope')).status, 404);
    assert.equal((await call('/api/themes/1/nope')).status, 404);
  });

  test('malformed JSON is a 400', async () => {
    const response = await fetch(`${base}/api/themes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    assert.equal(response.status, 400);
  });

  test('the app shell is served for client-side routes', async () => {
    const response = await fetch(`${base}/themes/1`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Recurrent Complaints Management/);
  });

  test('static paths cannot escape the web directory', async () => {
    const response = await fetch(`${base}/../server/db.js`, { redirect: 'manual' });
    assert.ok(response.status === 403 || response.status === 404 || response.status === 301);
  });
});
