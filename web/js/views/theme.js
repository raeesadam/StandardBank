import { api } from '../api.js';
import { el, clear, fmtNumber, fmtMoney, fmtDate, fmtDateTime, fmtRelative, fmtPercent,
         pill, severityTone, themeStatusTone, actionStatusTone, incidentTone,
         confidenceTone, trendTone, trendGlyph, trendLabel, isOverdue, daysUntil } from '../util.js';
import { t, label, activityText } from '../i18n.js';
import { lineChart, barChart, seriesColor } from '../charts.js';
import { loading, emptyState, openFormModal, confirmDialog, toast, sectionHead } from '../ui.js';
import { withActor } from '../state.js';
import { observationFields, rootCauseFields, actionFields, incidentFields, noteFields } from '../forms.js';
import { openThemeForm } from './register.js';
import { navigate, currentPath, replacePath } from '../router.js';

const TABS = [
  { key: 'overview' },
  { key: 'monitoring', count: (theme) => theme.observations.length },
  { key: 'causes', count: (theme) => theme.rootCauses.length },
  { key: 'actions', count: (theme) => theme.actions.length },
  { key: 'incidents', count: (theme) => theme.incidents.length },
  { key: 'notes', count: (theme) => theme.notes.length },
  { key: 'history', count: (theme) => theme.activity.length },
];

export async function renderTheme(host, themeId, query = {}) {
  clear(host).appendChild(loading(t('theme.loading')));

  let theme;
  try {
    theme = await api.getTheme(themeId);
  } catch (error) {
    clear(host).appendChild(el('div', { class: 'empty' }, [
      el('div', { text: error.message }),
      el('div', { style: { marginTop: '12px' } }, [
        el('button', { class: 'btn', type: 'button', onclick: () => navigate('/register') },
          t('theme.back')),
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
    const [path, search = ''] = currentPath().split('?');
    const params = new URLSearchParams(search);
    if (key === 'overview') params.delete('tab');
    else params.set('tab', key);
    replacePath(`${path}${params.toString() ? `?${params}` : ''}`);
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
        el('span', { text: t(`tab.${tab.key}`) }),
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
      }, t('theme.back')),
    ]),
    el('div', { class: 'detail-head' }, [
      el('div', { class: 'detail-head__main' }, [
        el('div', { class: 'detail-ref', text: theme.reference }),
        el('h1', { text: theme.title }),
        el('div', { class: 'badges', style: { marginBottom: '10px' } }, [
          pill(label(theme.severity), severityTone(theme.severity), { dot: true }),
          pill(label(theme.status), themeStatusTone(theme.status), { dot: true }),
          pill(trendLabel(theme.trend), trendTone(theme.trend), { glyph: trendGlyph(theme.trend) }),
          theme.regulatory_risk ? pill(t('theme.regulatory'), 'serious') : null,
          theme.watchlist ? pill(t('theme.watchlist'), 'accent') : null,
        ]),
        theme.description ? el('p', { class: 'detail-desc', text: theme.description }) : null,
      ]),
      el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
        el('button', {
          class: 'btn', type: 'button',
          onclick: () => openThemeForm(theme, reload),
        }, t('theme.editDetails')),
        el('button', {
          class: 'btn btn--danger', type: 'button',
          onclick: async () => {
            const ok = await confirmDialog({
              title: t('theme.deleteTitle', { reference: theme.reference }),
              message: t('theme.deleteMessage'),
            });
            if (!ok) return;
            await api.deleteTheme(theme.id, withActor({}));
            toast(t('theme.deleted', { reference: theme.reference }), 'success');
            navigate('/register');
          },
        }, t('common.delete')),
      ]),
    ]),
  ]);
}

function kpiStrip(theme) {
  return el('div', { class: 'grid grid--kpi', style: { marginBottom: '16px' } }, [
    tile(t('theme.kpi.recent'), fmtNumber(theme.volume_recent),
      theme.change_pct === null
        ? t('theme.kpi.noPrior')
        : t('theme.kpi.recentMeta', { change: fmtPercent(theme.change_pct, { signed: true }) }),
      theme.trend === 'Increasing' ? 'critical' : theme.trend === 'Decreasing' ? 'good-ink' : null),
    tile(t('theme.kpi.total'), fmtNumber(theme.volume_total),
      t('theme.kpi.totalMeta', { count: theme.observation_count })),
    tile(t('theme.kpi.resolution'),
      theme.avg_resolution_days === null ? t('common.none') : String(theme.avg_resolution_days),
      t('theme.kpi.resolutionMeta')),
    tile(t('theme.kpi.money'), fmtMoney(theme.financial_impact_total), t('theme.kpi.moneyMeta')),
    tile(t('theme.kpi.actions'), fmtNumber(theme.open_actions),
      t('theme.kpi.actionsMeta', { done: theme.completed_actions, overdue: theme.overdue_actions }),
      theme.overdue_actions > 0 ? 'critical' : null),
    tile(t('theme.kpi.causes'), fmtNumber(theme.root_cause_count),
      t('theme.kpi.causesMeta', { count: theme.confirmed_cause_count })),
    tile(t('theme.kpi.incidents'), fmtNumber(theme.incident_count),
      theme.open_incidents > 0
        ? t('theme.kpi.incidentsOpen', { count: theme.open_incidents })
        : t('theme.kpi.incidentsNone')),
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
    .map((rc) => ({ label: rc.title, value: rc.contribution_pct, sublabel: t('overview.drivers.subtitle') }));

  return el('div', { class: 'stack' }, [
    el('div', { class: 'grid grid--2' }, [
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('h3', { text: t('overview.volume.title') }),
          el('div', { class: 'card__sub', text: t('overview.volume.subtitle') }),
        ]),
        points.length === 0
          ? emptyState(t('overview.volume.empty'), t('overview.volume.emptyAction'),
              () => openObservationForm(theme, null, reload))
          : lineChart({
              points,
              series: [
                { key: 'complaints', name: t('dashboard.series.received'), color: seriesColor(1) },
                { key: 'resolved', name: t('dashboard.series.resolved'), color: seriesColor(2) },
              ],
              height: 250,
            }),
      ]),
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('h3', { text: t('overview.facts.title') }),
        ]),
        el('div', { class: 'facts' }, [
          fact(t('overview.facts.owner'), theme.product_owner || t('common.none'), theme.product_owner_email),
          fact(t('overview.facts.manager'), theme.complaint_manager || t('common.none')),
          fact(t('overview.facts.unit'), theme.business_unit || t('common.none')),
          fact(t('overview.facts.product'), label(theme.product)),
          fact(t('overview.facts.channel'), label(theme.channel)),
          fact(t('overview.facts.category'), label(theme.category)),
          fact(t('overview.facts.first'), fmtDate(theme.first_reported_on)),
          fact(t('overview.facts.last'), fmtDate(theme.last_reported_on)),
          fact(t('overview.facts.target'), targetCloseText(theme)),
          fact(t('overview.facts.updated'), `${fmtDate(theme.updated_at)} · ${fmtRelative(theme.updated_at)}`),
        ]),
      ]),
    ]),
    el('div', { class: 'grid grid--2' }, [
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('h3', { text: t('overview.drivers.title') }),
          el('div', { class: 'card__sub', text: t('overview.drivers.subtitle') }),
        ]),
        causeRows.length === 0
          ? emptyState(t('overview.drivers.empty'), t('overview.drivers.emptyAction'),
              () => openRootCauseForm(theme, null, reload))
          : barChart({
              rows: causeRows, valueLabel: t('overview.drivers.share'), color: seriesColor(1),
              formatValue: (v) => `${v}%`, barHeight: 18, gap: 9,
            }),
        el('div', { style: { marginTop: '12px' } }, [
          el('button', {
            class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => setTab('causes'),
          }, t('overview.drivers.all')),
        ]),
      ]),
      el('div', { class: 'card' }, [
        el('div', { class: 'card__head' }, [
          el('h3', { text: t('overview.plan.title') }),
          el('div', { class: 'card__sub', text: t('overview.plan.subtitle') }),
        ]),
        theme.actions.length === 0
          ? emptyState(t('overview.plan.empty'), t('overview.plan.emptyAction'),
              () => openActionForm(theme, null, reload))
          : el('div', {}, theme.actions.slice(0, 5).map((action) => actionRow(action, theme, reload, true))),
        theme.actions.length > 5 ? el('div', { style: { marginTop: '12px' } }, [
          el('button', {
            class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => setTab('actions'),
          }, t('overview.plan.all', { count: theme.actions.length })),
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
  if (!theme.target_close_date) return t('common.none');
  const days = daysUntil(theme.target_close_date);
  const base = fmtDate(theme.target_close_date);
  if (theme.status === 'Resolved' || days === null) return base;
  if (days < 0) return `${base} · ${t('overview.facts.daysPast', { days: Math.abs(days) })}`;
  return `${base} · ${t('overview.facts.daysLeft', { days })}`;
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
    sectionHead(t('monitoring.title'), t('monitoring.subtitle'),
      [el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openObservationForm(theme, null, reload),
      }, t('monitoring.add'))]),

    theme.observations.length === 0
      ? emptyState(t('monitoring.empty'), t('monitoring.emptyAction'),
          () => openObservationForm(theme, null, reload))
      : el('div', { class: 'stack' }, [
          el('div', { class: 'grid grid--2' }, [
            el('div', { class: 'card' }, [
              el('div', { class: 'card__head' }, [
                el('h3', { text: t('monitoring.chartTitle') }),
              ]),
              lineChart({
                points,
                series: [
                  { key: 'complaints', name: t('dashboard.series.received'), color: seriesColor(1) },
                  { key: 'resolved', name: t('dashboard.series.resolved'), color: seriesColor(2) },
                ],
                height: 240,
              }),
            ]),
            el('div', { class: 'card' }, [
              el('div', { class: 'card__head' }, [
                el('h3', { text: t('monitoring.resolutionTitle') }),
                el('div', { class: 'card__sub', text: t('monitoring.resolutionSubtitle') }),
              ]),
              lineChart({
                points: resolutionPoints,
                series: [{ key: 'days', name: t('monitoring.resolutionSeries'), color: seriesColor(1) }],
                height: 240,
                formatValue: (v) => `${Number(v).toFixed(1)}`,
              }),
            ]),
          ]),
          el('div', { class: 'card', style: { padding: '0' } }, [
            el('div', { class: 'table-wrap' }, [
              el('table', {}, [
                el('thead', {}, [el('tr', {}, [
                  el('th', { text: t('common.period') }),
                  el('th', { class: 'num', text: t('monitoring.col.received') }),
                  el('th', { class: 'num', text: t('monitoring.col.resolved') }),
                  el('th', { class: 'num', text: t('monitoring.col.avgDays') }),
                  el('th', { class: 'num', text: t('monitoring.col.repeat') }),
                  el('th', { class: 'num', text: t('monitoring.col.money') }),
                  el('th', { text: t('monitoring.col.notes') }),
                  el('th', { text: t('monitoring.col.recordedBy') }),
                  el('th', { text: '' }),
                ])]),
                el('tbody', {}, observations.map((row) => el('tr', {}, [
                  el('td', { class: 'nowrap' }, [
                    el('div', { class: 'cell-title', text: row.period_label || row.period_start }),
                    el('div', { class: 'cell-sub', text: fmtDate(row.period_start) }),
                  ]),
                  el('td', { class: 'num', text: fmtNumber(row.complaint_count) }),
                  el('td', { class: 'num', text: fmtNumber(row.resolved_count) }),
                  el('td', { class: 'num', text: String(row.avg_resolution_days ?? t('common.none')) }),
                  el('td', { class: 'num', text: fmtNumber(row.repeat_customers) }),
                  el('td', { class: 'num', text: fmtMoney(row.financial_impact) }),
                  el('td', { text: row.notes || t('common.none') }),
                  el('td', { text: row.recorded_by || t('common.none') }),
                  el('td', {}, [rowActions(
                    () => openObservationForm(theme, row, reload),
                    () => removeChild(theme, 'observations', row.id,
                      t('monitoring.deleteTarget', { period: row.period_label || row.period_start }), reload),
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
    sectionHead(t('causes.title'), t('causes.subtitle'),
      [el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openRootCauseForm(theme, null, reload),
      }, t('causes.add'))]),

    theme.rootCauses.length === 0
      ? emptyState(t('causes.empty'), t('causes.emptyAction'),
          () => openRootCauseForm(theme, null, reload))
      : el('div', {}, theme.rootCauses.map((cause) => {
          const linked = theme.actions.filter((a) => a.root_cause_id === cause.id);
          return el('div', { class: 'record' }, [
            el('div', { class: 'record__head' }, [
              el('div', { class: 'record__title', text: cause.title }),
              el('div', { class: 'badges' }, [
                pill(label(cause.confidence), confidenceTone(cause.confidence), { dot: true }),
                pill(label(cause.category), 'muted'),
                pill(label(cause.status), cause.status === 'Addressed' ? 'good' : 'muted'),
                cause.contribution_pct > 0
                  ? pill(t('causes.share', { pct: cause.contribution_pct }), 'accent') : null,
              ]),
              rowActions(
                () => openRootCauseForm(theme, cause, reload),
                () => removeChild(theme, 'root-causes', cause.id,
                  t('causes.deleteTarget', { title: cause.title }), reload),
              ),
            ]),
            cause.description ? el('div', { class: 'record__body', text: cause.description }) : null,
            cause.evidence ? el('div', { class: 'record__body small' }, [
              el('strong', { text: t('causes.evidence') }),
              el('span', { text: cause.evidence }),
            ]) : null,
            el('div', { class: 'record__meta' }, [
              el('span', {
                text: t('causes.identifiedBy', { name: cause.identified_by || t('common.unknown') }),
              }),
              el('span', { text: fmtDate(cause.identified_on) }),
              el('span', {
                text: linked.length === 0
                  ? t('causes.noActions')
                  : t('causes.actionCount', { count: linked.length }),
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
    sectionHead(t('actions.title'), t('actions.subtitle'),
      [el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openActionForm(theme, null, reload),
      }, t('actions.add'))]),

    theme.actions.length === 0
      ? emptyState(t('actions.empty'), t('actions.emptyAction'),
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
        pill(label(action.status), actionStatusTone(action.status), { dot: true }),
        !compact ? pill(label(action.priority), severityTone(action.priority)) : null,
        overdue
          ? pill(t('actions.overdue', { days: Math.abs(daysUntil(action.due_date)) }), 'critical', { glyph: '!' })
          : null,
        action.status === 'Completed' && action.effectiveness !== 'Not assessed'
          ? pill(label(action.effectiveness), effectivenessTone(action.effectiveness),
              { glyph: effectivenessGlyph(action.effectiveness) })
          : null,
      ]),
      compact ? null : rowActions(
        () => openActionForm(theme, action, reload),
        () => removeChild(theme, 'actions', action.id,
          t('actions.deleteTarget', { title: action.title }), reload),
      ),
    ]),
    !compact && action.description ? el('div', { class: 'record__body', text: action.description }) : null,
    !compact && action.notes ? el('div', { class: 'record__body small' }, [
      el('strong', { text: t('actions.progress') }), el('span', { text: action.notes }),
    ]) : null,
    el('div', { class: 'record__meta' }, [
      el('span', {
        text: `${action.proposed_by || t('common.unknown')} · ${label(action.proposer_role)}`,
      }),
      action.proposed_on
        ? el('span', { text: t('actions.proposedOn', { date: fmtDate(action.proposed_on) }) }) : null,
      action.due_date
        ? el('span', { text: t('actions.dueOn', { date: fmtDate(action.due_date) }) }) : null,
      action.completed_on
        ? el('span', { text: t('actions.completedOn', { date: fmtDate(action.completed_on) }) }) : null,
      action.root_cause_title
        ? el('span', { text: t('actions.addresses', { title: action.root_cause_title }) })
        : el('span', { style: { color: 'var(--serious)' }, text: t('actions.unlinked') }),
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
    sectionHead(t('incidents.title'), t('incidents.subtitle'),
      [el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openIncidentForm(theme, null, reload),
      }, t('incidents.add'))]),

    theme.incidents.length === 0
      ? emptyState(t('incidents.empty'), t('incidents.emptyAction'),
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
              pill(label(incident.status), incident.status === 'Open' ? 'critical'
                : incident.status === 'Mitigated' ? 'warning' : 'good'),
            ]),
            rowActions(
              () => openIncidentForm(theme, incident, reload),
              () => removeChild(theme, 'incidents', incident.id,
                t('incidents.deleteTarget', { title: incident.incident_ref || incident.title }), reload),
            ),
          ]),
          incident.description ? el('div', { class: 'record__body', text: incident.description }) : null,
          el('div', { class: 'record__meta' }, [
            el('span', { text: t('incidents.started', { date: fmtDate(incident.started_at) }) }),
            el('span', { text: t('incidents.resolved', { date: fmtDate(incident.resolved_at) }) }),
            el('span', { text: t('incidents.customers', { count: fmtNumber(incident.customers_affected) }) }),
            incident.systems_affected ? el('span', { text: incident.systems_affected }) : null,
            incident.postmortem_url
              ? el('a', {
                  href: incident.postmortem_url, target: '_blank', rel: 'noreferrer noopener',
                  text: t('incidents.postmortem'),
                })
              : null,
          ]),
        ]))),
  ]);
}

/* --------------------------------- notes ------------------------------- */

function notesTab(theme, reload) {
  return el('div', { class: 'stack' }, [
    sectionHead(t('notes.title'), t('notes.subtitle'),
      [el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onclick: () => openNoteForm(theme, null, reload),
      }, t('notes.add'))]),

    theme.notes.length === 0
      ? emptyState(t('notes.empty'), t('notes.emptyAction'),
          () => openNoteForm(theme, null, reload))
      : el('div', {}, theme.notes.map((note) => el('div', { class: 'record' }, [
          el('div', { class: 'record__head' }, [
            el('div', { class: 'record__title' }, [pill(label(note.note_type), noteTone(note.note_type))]),
            rowActions(
              () => openNoteForm(theme, note, reload),
              () => removeChild(theme, 'notes', note.id, t('notes.deleteTarget'), reload),
            ),
          ]),
          el('div', { class: 'record__body', text: note.body }),
          el('div', { class: 'record__meta' }, [
            el('span', { text: note.author || t('common.unknown') }),
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
    return el('div', { class: 'empty', text: t('history.empty') });
  }
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: t('history.title') }),
      el('div', { class: 'card__sub', text: t('history.subtitle') }),
    ]),
    el('div', { class: 'timeline' }, theme.activity.map((entry) => el('div', {
      class: `timeline__item timeline__item--${entry.action}`,
    }, [
      el('div', { class: 'timeline__when', text: `${fmtDateTime(entry.created_at)} · ${fmtRelative(entry.created_at)}` }),
      el('div', { class: 'timeline__what', text: activityText(entry) }),
      el('div', { class: 'timeline__who', text: entry.actor }),
      Array.isArray(entry.detail) && entry.detail.length > 0
        ? el('div', { class: 'timeline__changes' }, entry.detail.map((change) => el('div', {}, [
            el('span', { text: `${change.field}: ` }),
            el('code', { text: String(change.from) || t('history.emptyValue') }),
            el('span', { text: ' → ' }),
            el('code', { text: String(change.to) || t('history.emptyValue') }),
          ])))
        : null,
    ]))),
  ]);
}

/* --------------------------- shared row actions ------------------------ */

function rowActions(onEdit, onDelete) {
  return el('div', { class: 'record__actions' }, [
    el('button', {
      class: 'btn btn--ghost btn--sm', type: 'button', onclick: onEdit, title: t('common.edit'),
    }, t('common.edit')),
    el('button', {
      class: 'btn btn--ghost btn--sm', type: 'button', onclick: onDelete, title: t('common.delete'),
    }, t('common.delete')),
  ]);
}

async function removeChild(theme, collection, id, description, reload) {
  const ok = await confirmDialog({
    title: t('record.deleteTitle'),
    message: t('record.deleteMessage', { target: description }),
  });
  if (!ok) return;
  await api.deleteChild(theme.id, collection, id, withActor({}));
  toast(t('common.deleted'), 'success');
  await reload();
}

/* ------------------------------- child forms --------------------------- */

function childForm({ theme, record, collection, fields, title, reload, successNoun }) {
  openFormModal({
    title,
    fields,
    values: record || {},
    submitLabel: record ? t('common.save') : t('common.add'),
    onSubmit: async (values) => {
      if (record) await api.updateChild(theme.id, collection, record.id, withActor(values));
      else await api.createChild(theme.id, collection, withActor(values));
      toast(record ? t('record.updated', { noun: successNoun }) : t('record.added', { noun: successNoun }),
        'success');
      await reload();
    },
  });
}

export function openObservationForm(theme, record, reload) {
  childForm({
    theme, record, reload, collection: 'observations', fields: observationFields(),
    title: record ? t('monitoring.editTitle') : t('monitoring.addTitle'),
    successNoun: t('monitoring.noun'),
  });
}

export function openRootCauseForm(theme, record, reload) {
  childForm({
    theme, record, reload, collection: 'root-causes', fields: rootCauseFields(),
    title: record ? t('causes.editTitle') : t('causes.addTitle'),
    successNoun: t('causes.noun'),
  });
}

export function openActionForm(theme, record, reload) {
  childForm({
    theme, record, reload, collection: 'actions', fields: actionFields(theme.rootCauses),
    title: record ? t('actions.editTitle') : t('actions.addTitle'),
    successNoun: t('actions.noun'),
  });
}

export function openIncidentForm(theme, record, reload) {
  childForm({
    theme, record, reload, collection: 'incidents', fields: incidentFields(),
    title: record ? t('incidents.editTitle') : t('incidents.addTitle'),
    successNoun: t('incidents.noun'),
  });
}

export function openNoteForm(theme, record, reload) {
  childForm({
    theme, record, reload, collection: 'notes', fields: noteFields(),
    title: record ? t('notes.editTitle') : t('notes.addTitle'),
    successNoun: t('notes.noun'),
  });
}
