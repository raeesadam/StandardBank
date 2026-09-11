import { api } from '../api.js';
import { el, clear, fmtNumber, fmtMoney, fmtDate, fmtDateTime, fmtRelative, fmtPercent,
         pill, severityTone, themeStatusTone, actionStatusTone, incidentTone,
         confidenceTone, trendTone, trendGlyph, isOverdue, daysUntil } from '../util.js';
import { lineChart, barChart, seriesColor } from '../charts.js';
import { loading, emptyState, openFormModal, confirmDialog, toast, sectionHead } from '../ui.js';
import { withActor } from '../state.js';
import { observationFields, rootCauseFields, actionFields, incidentFields, noteFields } from '../forms.js';
import { openThemeForm } from './register.js';
import { navigate } from '../router.js';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'monitoring', label: 'Monitoring history', count: (t) => t.observations.length },
  { key: 'causes', label: 'Root causes', count: (t) => t.rootCauses.length },
  { key: 'actions', label: 'Actions', count: (t) => t.actions.length },
  { key: 'incidents', label: 'Incidents', count: (t) => t.incidents.length },
  { key: 'notes', label: 'Notes', count: (t) => t.notes.length },
  { key: 'history', label: 'Full history', count: (t) => t.activity.length },
];

export async function renderTheme(host, themeId, query = {}) {
  clear(host).appendChild(loading('Loading the recurrent complaint…'));

  let theme;
  try {
    theme = await api.getTheme(themeId);
  } catch (error) {
    clear(host).appendChild(el('div', { class: 'empty' }, [
      el('div', { text: error.message }),
      el('div', { style: { marginTop: '12px' } }, [
        el('button', { class: 'btn', type: 'button', onclick: () => navigate('/register') },
          'Back to the register'),
      ]),
    ]));
    return;
  }

  let activeTab = TABS.some((t) => t.key === query.tab) ? query.tab : 'overview';

  const body = el('div', {});
  const tabBar = el('div', { class: 'tabs', role: 'tablist' });

  const reload = async () => {
    theme = await api.getTheme(themeId);
    paint();
  };

  const setTab = (key) => {
    activeTab = key;
    const url = new URL(window.location.href);
    if (key === 'overview') url.searchParams.delete('tab');
    else url.searchParams.set('tab', key);
    history.replaceState({}, '', url.pathname + url.search);
    paint();
  };

  function paint() {
    clear(host);
    host.appendChild(header(theme, reload));
    host.appendChild(kpiStrip(theme));

    clear(tabBar);
    for (const tab of TABS) {
      const count = tab.count ? tab.count(theme) : null;
      tabBar.appendChild(el('button', {
        type: 'button', role: 'tab', 'aria-selected': String(tab.key === activeTab),
        onclick: () => setTab(tab.key),
      }, [
        el('span', { text: tab.label }),
        count !== null ? el('span', { class: 'tab-count', text: String(count) }) : null,
      ]));
    }
    host.appendChild(tabBar);

    clear(body);
    body.appendChild(renderTab(activeTab, theme, reload, setTab));
    host.appendChild(body);
  }

  paint();
}

/* -------------------------------- header ------------------------------- */

function header(theme, reload) {
  return el('div', {}, [
    el('div', { style: { marginBottom: '10px' } }, [
      el('button', {
        class: 'btn btn--ghost btn--sm', type: 'button',
        onclick: () => navigate('/register'),
      }, '← Register'),
    ]),
    el('div', { class: 'detail-head' }, [
      el('div', { class: 'detail-head__main' }, [
        el('div', { class: 'detail-ref', text: theme.reference }),
        el('h1', { text: theme.title }),
        el('div', { class: 'badges', style: { marginBottom: '10px' } }, [
          pill(theme.severity, severityTone(theme.severity), { dot: true }),
          pill(theme.status, themeStatusTone(theme.status), { dot: true }),
          pill(theme.trend, trendTone(theme.trend), { glyph: trendGlyph(theme.trend) }),
          theme.regulatory_risk ? pill('Regulatory / ombud exposure', 'serious') : null,
          theme.watchlist ? pill('Executive watchlist', 'accent') : null,
        ]),
        theme.description ? el('p', { class: 'detail-desc', text: theme.description }) : null,
      ]),
      el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
        el('button', {
          class: 'btn', type: 'button',
          onclick: () => openThemeForm(theme, reload),
        }, 'Edit details'),
        el('button', {
          class: 'btn btn--danger', type: 'button',
          onclick: async () => {
            const ok = await confirmDialog({
              title: `Delete ${theme.reference}?`,
              message: 'This removes the recurrent complaint and all of its monitoring history, root causes, actions, incidents and notes. It cannot be undone.',
            });
            if (!ok) return;
            await api.deleteTheme(theme.id, withActor({}));
            toast(`${theme.reference} deleted.`, 'success');
            navigate('/register');
          },
        }, 'Delete'),
      ]),
    ]),
  ]);
}

function kpiStrip(theme) {
  return el('div', { class: 'grid grid--kpi', style: { marginBottom: '16px' } }, [
    tile('Complaints, last 6 periods', fmtNumber(theme.volume_recent),
      theme.change_pct === null
        ? 'No comparable prior periods'
        : `${fmtPercent(theme.change_pct, { signed: true })} vs the 6 before`,
      theme.trend === 'Increasing' ? 'critical' : theme.trend === 'Decreasing' ? 'good-ink' : null),
    tile('All-time complaints', fmtNumber(theme.volume_total),
      `${theme.observation_count} monitoring periods captured`),
    tile('Average days to resolve', theme.avg_resolution_days === null ? '—' : String(theme.avg_resolution_days),
      'mean of the last 3 periods'),
    tile('Refunds & goodwill', fmtMoney(theme.financial_impact_total), 'recorded against this theme'),
    tile('Open actions', fmtNumber(theme.open_actions),
      `${theme.completed_actions} completed · ${theme.overdue_actions} overdue`,
      theme.overdue_actions > 0 ? 'critical' : null),
    tile('Root causes', fmtNumber(theme.root_cause_count),
      `${theme.confirmed_cause_count} confirmed`),
    tile('Linked incidents', fmtNumber(theme.incident_count),
      theme.open_incidents > 0 ? `${theme.open_incidents} still open` : 'none open'),
  ]);
}

function tile(label, value, meta, tone) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat__label', text: label }),
    el('div', { class: 'stat__value', style: tone ? { color: `var(--${tone})` } : {}, text: value }),
    meta ? el('div', { class: 'stat__meta', text: meta }) : null,
  ]);
}

/* --------------------------------- tabs -------------------------------- */

function renderTab(key, theme, reload, setTab) {
  switch (key) {
    case 'monitoring': return monitoringTab(theme, reload);
    case 'causes': return causesTab(theme, reload);
    case 'actions': return actionsTab(theme, reload);
    case 'incidents': return incidentsTab(theme, reload);
    case 'notes': return notesTab(theme, reload);
    case 'history': return historyTab(theme);
    default: return overviewTab(theme, reload, setTab);
  }
}

/* ------------------------------- overview ------------------------------ */

function overviewTab(theme, reload, setTab) {
  const points = theme.observations.map((o) => ({
    label: o.period_label || o.period_start,
    values: { complaints: o.complaint_count, resolved: o.resolved_count },
  }));

  const causeRows = theme.rootCauses
    .filter((rc) => rc.contribution_pct > 0)
    .map((rc) => ({ label: rc.title, value: rc.contribution_pct, sublabel: 'Share of complaints' }));

  return el('div', { class: 'stack' }, [
    el('div', { class: 'grid grid--2' }, [
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('h3', { text: 'Complaint volume over time' }),
          el('div', { class: 'card__sub', text: 'Received against resolved, by monitoring period' }),
        ]),
        points.length === 0
          ? emptyState('No monitoring data captured for this theme yet.', 'Add the first period',
              () => openObservationForm(theme, null, reload))
          : lineChart({
              points,
              series: [
                { key: 'complaints', name: 'Received', color: seriesColor(1) },
                { key: 'resolved', name: 'Resolved', color: seriesColor(2) },
              ],
              height: 250,
            }),
      ]),
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('h3', { text: 'Ownership and dates' }),
        ]),
        el('div', { class: 'facts' }, [
          fact('Product owner', theme.product_owner || '—', theme.product_owner_email),
          fact('Complaint manager', theme.complaint_manager || '—'),
          fact('Business unit', theme.business_unit || '—'),
          fact('Product', theme.product),
          fact('Channel', theme.channel),
          fact('Complaint category', theme.category),
          fact('First reported', fmtDate(theme.first_reported_on)),
          fact('Last reported', fmtDate(theme.last_reported_on)),
          fact('Target close date', targetCloseText(theme)),
          fact('Last updated', `${fmtDate(theme.updated_at)} · ${fmtRelative(theme.updated_at)}`),
        ]),
      ]),
    ]),
    el('div', { class: 'grid grid--2' }, [
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('h3', { text: 'What is driving it' }),
          el('div', { class: 'card__sub', text: 'Root causes by the share of complaints attributed to each' }),
        ]),
        causeRows.length === 0
          ? emptyState('No root cause has been attributed a share yet.', 'Add a root cause',
              () => openRootCauseForm(theme, null, reload))
          : barChart({
              rows: causeRows, valueLabel: 'Share', color: seriesColor(1),
              formatValue: (v) => `${v}%`, barHeight: 18, gap: 9,
            }),
        el('div', { style: { marginTop: '12px' } }, [
          el('button', {
            class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => setTab('causes'),
          }, 'All root causes →'),
        ]),
      ]),
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('h3', { text: 'Action plan at a glance' }),
          el('div', { class: 'card__sub', text: 'What product owners have proposed, and where it stands' }),
        ]),
        theme.actions.length === 0
          ? emptyState('No action has been proposed yet.', 'Propose an action',
              () => openActionForm(theme, null, reload))
          : el('div', {}, theme.actions.slice(0, 5).map((action) => actionRow(action, theme, reload, true))),
        theme.actions.length > 5 ? el('div', { style: { marginTop: '12px' } }, [
          el('button', {
            class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => setTab('actions'),
          }, `All ${theme.actions.length} actions →`),
        ]) : null,
      ]),
    ]),
  ]);
}

function fact(label, value, sub) {
  return el('div', {}, [
    el('div', { class: 'fact__label', text: label }),
    el('div', { class: 'fact__value', text: value }),
    sub ? el('div', { class: 'small muted', text: sub }) : null,
  ]);
}

function targetCloseText(theme) {
  if (!theme.target_close_date) return '—';
  const days = daysUntil(theme.target_close_date);
  const base = fmtDate(theme.target_close_date);
  if (theme.status === 'Resolved') return base;
  if (days === null) return base;
  if (days < 0) return `${base} · ${Math.abs(days)} days past`;
  return `${base} · ${days} days left`;
}

/* ------------------------------ monitoring ----------------------------- */

function monitoringTab(theme, reload) {
  const observations = [...theme.observations].reverse();
  const points = theme.observations.map((o) => ({
    label: o.period_label || o.period_start,
    values: {
      complaints: o.complaint_count,
      resolved: o.resolved_count,
    },
  }));
  const resolutionPoints = theme.observations.map((o) => ({
    label: o.period_label || o.period_start,
    values: { days: o.avg_resolution_days },
  }));

  return el('div', { class: 'stack' }, [
    sectionHead('Monitoring history',
      'One entry per reporting period. This is what makes a complaint "recurrent" rather than a one-off.',
      [el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openObservationForm(theme, null, reload),
      }, '+ Add a period')]),

    theme.observations.length === 0
      ? emptyState('No monitoring data captured yet.', 'Add the first period',
          () => openObservationForm(theme, null, reload))
      : el('div', { class: 'stack' }, [
          el('div', { class: 'grid grid--2' }, [
            el('div', { class: 'card' }, [
              el('div', { class: 'card__head' }, [
                el('h3', { text: 'Complaints received and resolved' }),
              ]),
              lineChart({
                points,
                series: [
                  { key: 'complaints', name: 'Received', color: seriesColor(1) },
                  { key: 'resolved', name: 'Resolved', color: seriesColor(2) },
                ],
                height: 240,
              }),
            ]),
            el('div', { class: 'card' }, [
              el('div', { class: 'card__head' }, [
                el('h3', { text: 'Average days to resolve' }),
                el('div', { class: 'card__sub', text: 'Plotted separately - a different measure belongs on its own scale' }),
              ]),
              lineChart({
                points: resolutionPoints,
                series: [{ key: 'days', name: 'Days to resolve', color: seriesColor(1) }],
                height: 240,
                formatValue: (v) => `${Number(v).toFixed(1)}`,
              }),
            ]),
          ]),
          el('div', { class: 'card', style: { padding: '0' } }, [
            el('div', { class: 'table-wrap' }, [
              el('table', {}, [
                el('thead', {}, [el('tr', {}, [
                  el('th', { text: 'Period' }),
                  el('th', { class: 'num', text: 'Received' }),
                  el('th', { class: 'num', text: 'Resolved' }),
                  el('th', { class: 'num', text: 'Avg days' }),
                  el('th', { class: 'num', text: 'Repeat customers' }),
                  el('th', { class: 'num', text: 'Refunds & goodwill' }),
                  el('th', { text: 'Notes' }),
                  el('th', { text: 'Recorded by' }),
                  el('th', { text: '' }),
                ])]),
                el('tbody', {}, observations.map((row) => el('tr', {}, [
                  el('td', { class: 'nowrap' }, [
                    el('div', { class: 'cell-title', text: row.period_label || row.period_start }),
                    el('div', { class: 'cell-sub', text: fmtDate(row.period_start) }),
                  ]),
                  el('td', { class: 'num', text: fmtNumber(row.complaint_count) }),
                  el('td', { class: 'num', text: fmtNumber(row.resolved_count) }),
                  el('td', { class: 'num', text: String(row.avg_resolution_days ?? '—') }),
                  el('td', { class: 'num', text: fmtNumber(row.repeat_customers) }),
                  el('td', { class: 'num', text: fmtMoney(row.financial_impact) }),
                  el('td', { text: row.notes || '—' }),
                  el('td', { text: row.recorded_by || '—' }),
                  el('td', {}, [rowActions(
                    () => openObservationForm(theme, row, reload),
                    () => removeChild(theme, 'observations', row.id,
                      `monitoring entry for ${row.period_label || row.period_start}`, reload),
                  )]),
                ]))),
              ]),
            ]),
          ]),
        ]),
  ]);
}

/* ------------------------------ root causes ---------------------------- */

function causesTab(theme, reload) {
  return el('div', { class: 'stack' }, [
    sectionHead('Root causes',
      'What is actually causing the complaints, how confident we are, and how much of the volume each accounts for.',
      [el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openRootCauseForm(theme, null, reload),
      }, '+ Add a root cause')]),

    theme.rootCauses.length === 0
      ? emptyState('No root cause has been documented yet.', 'Document the first one',
          () => openRootCauseForm(theme, null, reload))
      : el('div', {}, theme.rootCauses.map((cause) => {
          const linked = theme.actions.filter((a) => a.root_cause_id === cause.id);
          return el('div', { class: 'record' }, [
            el('div', { class: 'record__head' }, [
              el('div', { class: 'record__title', text: cause.title }),
              el('div', { class: 'badges' }, [
                pill(cause.confidence, confidenceTone(cause.confidence), { dot: true }),
                pill(cause.category, 'muted'),
                pill(cause.status, cause.status === 'Addressed' ? 'good' : 'muted'),
                cause.contribution_pct > 0 ? pill(`${cause.contribution_pct}% of complaints`, 'accent') : null,
              ]),
              rowActions(
                () => openRootCauseForm(theme, cause, reload),
                () => removeChild(theme, 'root-causes', cause.id, `root cause "${cause.title}"`, reload),
              ),
            ]),
            cause.description ? el('div', { class: 'record__body', text: cause.description }) : null,
            cause.evidence ? el('div', { class: 'record__body small' }, [
              el('strong', { text: 'Evidence: ' }),
              el('span', { text: cause.evidence }),
            ]) : null,
            el('div', { class: 'record__meta' }, [
              el('span', { text: `Identified by ${cause.identified_by || 'unknown'}` }),
              el('span', { text: fmtDate(cause.identified_on) }),
              el('span', {
                text: linked.length === 0
                  ? 'No action linked to this cause yet'
                  : `${linked.length} action${linked.length === 1 ? '' : 's'} addressing it`,
                style: linked.length === 0 ? { color: 'var(--serious)' } : {},
              }),
            ]),
          ]);
        })),
  ]);
}

/* --------------------------------- actions ----------------------------- */

function actionsTab(theme, reload) {
  return el('div', { class: 'stack' }, [
    sectionHead('Actions proposed by product owners',
      'The history of what has been proposed, by whom, where it stands and whether it worked.',
      [el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openActionForm(theme, null, reload),
      }, '+ Propose an action')]),

    theme.actions.length === 0
      ? emptyState('No action has been proposed for this recurrent complaint.', 'Propose the first action',
          () => openActionForm(theme, null, reload))
      : el('div', {}, theme.actions.map((action) => actionRow(action, theme, reload, false))),
  ]);
}

function actionRow(action, theme, reload, compact) {
  const overdue = isOverdue(action.due_date) && action.status !== 'Completed' && action.status !== 'Rejected';
  const modifier = action.status === 'Blocked' ? ' record--blocked'
    : overdue ? ' record--overdue'
    : action.status === 'Completed' ? ' record--done' : '';

  return el('div', { class: `record${modifier}`, style: compact ? { padding: '11px 12px' } : {} }, [
    el('div', { class: 'record__head' }, [
      el('div', { class: 'record__title', text: action.title }),
      el('div', { class: 'badges' }, [
        pill(action.status, actionStatusTone(action.status), { dot: true }),
        !compact ? pill(action.priority, severityTone(action.priority)) : null,
        overdue ? pill(`Overdue ${Math.abs(daysUntil(action.due_date))} days`, 'critical', { glyph: '!' }) : null,
        action.status === 'Completed' && action.effectiveness !== 'Not assessed'
          ? pill(action.effectiveness, effectivenessTone(action.effectiveness),
              { glyph: effectivenessGlyph(action.effectiveness) })
          : null,
      ]),
      compact ? null : rowActions(
        () => openActionForm(theme, action, reload),
        () => removeChild(theme, 'actions', action.id, `action "${action.title}"`, reload),
      ),
    ]),
    !compact && action.description ? el('div', { class: 'record__body', text: action.description }) : null,
    !compact && action.notes ? el('div', { class: 'record__body small' }, [
      el('strong', { text: 'Progress: ' }), el('span', { text: action.notes }),
    ]) : null,
    el('div', { class: 'record__meta' }, [
      el('span', { text: `${action.proposed_by || 'Unknown'} · ${action.proposer_role}` }),
      action.proposed_on ? el('span', { text: `Proposed ${fmtDate(action.proposed_on)}` }) : null,
      action.due_date ? el('span', { text: `Due ${fmtDate(action.due_date)}` }) : null,
      action.completed_on ? el('span', { text: `Completed ${fmtDate(action.completed_on)}` }) : null,
      action.root_cause_title
        ? el('span', { text: `Addresses: ${action.root_cause_title}` })
        : el('span', { style: { color: 'var(--serious)' }, text: 'Not linked to a root cause' }),
    ]),
  ]);
}

function effectivenessTone(value) {
  return {
    Effective: 'good', 'Partially effective': 'warning',
    Ineffective: 'critical', 'Too early to tell': 'muted',
  }[value] || 'muted';
}
function effectivenessGlyph(value) {
  return {
    Effective: '✓', 'Partially effective': '~',
    Ineffective: '✕', 'Too early to tell': '…',
  }[value] || '';
}

/* -------------------------------- incidents ---------------------------- */

function incidentsTab(theme, reload) {
  return el('div', { class: 'stack' }, [
    sectionHead('Related incidents',
      'Operational incidents that caused or coincided with this recurrent complaint.',
      [el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openIncidentForm(theme, null, reload),
      }, '+ Link an incident')]),

    theme.incidents.length === 0
      ? emptyState('No incident has been linked to this recurrent complaint.', 'Link an incident',
          () => openIncidentForm(theme, null, reload))
      : el('div', {}, theme.incidents.map((incident) => el('div', { class: 'record' }, [
          el('div', { class: 'record__head' }, [
            el('div', { class: 'record__title' }, [
              incident.incident_ref
                ? el('span', { class: 'detail-ref', text: `${incident.incident_ref} · ` })
                : null,
              el('span', { text: incident.title }),
            ]),
            el('div', { class: 'badges' }, [
              pill(incident.severity, incidentTone(incident.severity), { dot: true }),
              pill(incident.status, incident.status === 'Open' ? 'critical'
                : incident.status === 'Mitigated' ? 'warning' : 'good'),
            ]),
            rowActions(
              () => openIncidentForm(theme, incident, reload),
              () => removeChild(theme, 'incidents', incident.id,
                `incident "${incident.incident_ref || incident.title}"`, reload),
            ),
          ]),
          incident.description ? el('div', { class: 'record__body', text: incident.description }) : null,
          el('div', { class: 'record__meta' }, [
            el('span', { text: `Started ${fmtDate(incident.started_at)}` }),
            el('span', { text: `Resolved ${fmtDate(incident.resolved_at)}` }),
            el('span', { text: `${fmtNumber(incident.customers_affected)} customers affected` }),
            incident.systems_affected ? el('span', { text: incident.systems_affected }) : null,
            incident.postmortem_url
              ? el('a', { href: incident.postmortem_url, target: '_blank', rel: 'noreferrer noopener', text: 'Post-incident review' })
              : null,
          ]),
        ]))),
  ]);
}

/* --------------------------------- notes ------------------------------- */

function notesTab(theme, reload) {
  return el('div', { class: 'stack' }, [
    sectionHead('Complaint manager notes',
      'Anything that does not fit the structured fields - escalations, decisions, customer wording, meeting outcomes.',
      [el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openNoteForm(theme, null, reload),
      }, '+ Add a note')]),

    theme.notes.length === 0
      ? emptyState('No notes captured yet.', 'Add the first note',
          () => openNoteForm(theme, null, reload))
      : el('div', {}, theme.notes.map((note) => el('div', { class: 'record' }, [
          el('div', { class: 'record__head' }, [
            el('div', { class: 'record__title' }, [pill(note.note_type, noteTone(note.note_type))]),
            rowActions(
              () => openNoteForm(theme, note, reload),
              () => removeChild(theme, 'notes', note.id, 'this note', reload),
            ),
          ]),
          el('div', { class: 'record__body', text: note.body }),
          el('div', { class: 'record__meta' }, [
            el('span', { text: note.author || 'Unknown' }),
            el('span', { text: `${fmtDateTime(note.created_at)} · ${fmtRelative(note.created_at)}` }),
          ]),
        ]))),
  ]);
}

function noteTone(type) {
  return {
    Escalation: 'critical', Regulatory: 'serious', Decision: 'accent',
    'Customer feedback': 'muted', 'Meeting note': 'muted', Observation: 'muted',
  }[type] || 'muted';
}

/* -------------------------------- history ------------------------------ */

function historyTab(theme) {
  if (theme.activity.length === 0) {
    return el('div', { class: 'empty', text: 'No history recorded yet.' });
  }
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: 'Full history' }),
      el('div', { class: 'card__sub', text: 'Every change made to this recurrent complaint, newest first' }),
    ]),
    el('div', { class: 'timeline' }, theme.activity.map((entry) => el('div', {
      class: `timeline__item timeline__item--${entry.action}`,
    }, [
      el('div', { class: 'timeline__when', text: `${fmtDateTime(entry.created_at)} · ${fmtRelative(entry.created_at)}` }),
      el('div', { class: 'timeline__what', text: entry.summary }),
      el('div', { class: 'timeline__who', text: entry.actor }),
      Array.isArray(entry.detail) && entry.detail.length > 0
        ? el('div', { class: 'timeline__changes' }, entry.detail.map((change) => el('div', {}, [
            el('span', { text: `${change.field}: ` }),
            el('code', { text: String(change.from) || '(empty)' }),
            el('span', { text: ' → ' }),
            el('code', { text: String(change.to) || '(empty)' }),
          ])))
        : null,
    ]))),
  ]);
}

/* --------------------------- shared row actions ------------------------ */

function rowActions(onEdit, onDelete) {
  return el('div', { class: 'record__actions' }, [
    el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: onEdit, title: 'Edit' }, 'Edit'),
    el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: onDelete, title: 'Delete' }, 'Delete'),
  ]);
}

async function removeChild(theme, collection, id, description, reload) {
  const ok = await confirmDialog({
    title: 'Delete this record?',
    message: `This permanently removes the ${description}. The deletion itself stays in the history.`,
  });
  if (!ok) return;
  await api.deleteChild(theme.id, collection, id, withActor({}));
  toast('Record deleted.', 'success');
  await reload();
}

/* ------------------------------- child forms --------------------------- */

function childForm({ theme, record, collection, fields, title, reload, successNoun }) {
  openFormModal({
    title,
    fields,
    values: record || {},
    submitLabel: record ? 'Save changes' : 'Add',
    onSubmit: async (values) => {
      if (record) await api.updateChild(theme.id, collection, record.id, withActor(values));
      else await api.createChild(theme.id, collection, withActor(values));
      toast(record ? `${successNoun} updated.` : `${successNoun} added.`, 'success');
      await reload();
    },
  });
}

export function openObservationForm(theme, record, reload) {
  childForm({
    theme, record, reload, collection: 'observations', fields: observationFields(),
    title: record ? 'Edit monitoring entry' : 'Add a monitoring period',
    successNoun: 'Monitoring entry',
  });
}

export function openRootCauseForm(theme, record, reload) {
  childForm({
    theme, record, reload, collection: 'root-causes', fields: rootCauseFields(),
    title: record ? 'Edit root cause' : 'Document a root cause',
    successNoun: 'Root cause',
  });
}

export function openActionForm(theme, record, reload) {
  childForm({
    theme, record, reload, collection: 'actions', fields: actionFields(theme.rootCauses),
    title: record ? 'Edit action' : 'Propose an action',
    successNoun: 'Action',
  });
}

export function openIncidentForm(theme, record, reload) {
  childForm({
    theme, record, reload, collection: 'incidents', fields: incidentFields(),
    title: record ? 'Edit incident' : 'Link a related incident',
    successNoun: 'Incident',
  });
}

export function openNoteForm(theme, record, reload) {
  childForm({
    theme, record, reload, collection: 'notes', fields: noteFields(),
    title: record ? 'Edit note' : 'Add a note',
    successNoun: 'Note',
  });
}
