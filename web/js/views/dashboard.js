import { api } from '../api.js';
import { el, clear, fmtNumber, fmtMoney, fmtPercent, fmtDate, fmtRelative, pill,
         trendGlyph } from '../util.js';
import { lineChart, barChart, distribution, sparkline, seriesColor } from '../charts.js';
import { loading } from '../ui.js';
import { navigate } from '../router.js';

export async function renderDashboard(host) {
  clear(host).appendChild(loading('Loading the complaints picture…'));
  const data = await api.dashboard({ months: 12 });
  clear(host);

  host.appendChild(el('div', { class: 'page-head' }, [
    el('div', { class: 'page-head__text' }, [
      el('h1', { text: 'Recurrent complaints overview' }),
      el('div', {
        class: 'page-head__sub',
        text: `${data.kpis.openThemes} open recurrent complaints on the register · monitoring period ${data.kpis.latestPeriodLabel || '—'}`,
      }),
    ]),
    el('div', {}, [
      el('button', {
        class: 'btn', type: 'button', onclick: () => navigate('/register'),
      }, 'Open the register →'),
    ]),
  ]));

  host.appendChild(kpiRow(data));
  host.appendChild(el('div', { class: 'grid grid--2', style: { marginTop: '16px' } }, [
    volumeCard(data),
    topThemesCard(data),
  ]));
  host.appendChild(el('div', { class: 'grid grid--3', style: { marginTop: '16px' } }, [
    trendingCard(data),
    rootCauseCard(data),
    actionsCard(data),
  ]));
  host.appendChild(el('div', { class: 'grid grid--2', style: { marginTop: '16px' } }, [
    overdueCard(data),
    activityCard(data),
  ]));
}

/* --------------------------------- KPIs -------------------------------- */

function kpiRow(data) {
  const k = data.kpis;
  const series = data.volumeByPeriod.map((p) => p.complaints);
  const delta = k.complaintsPreviousPeriod
    ? ((k.complaintsLatestPeriod - k.complaintsPreviousPeriod) / k.complaintsPreviousPeriod) * 100
    : null;

  return el('div', { class: 'grid grid--kpi' }, [
    el('div', { class: 'stat' }, [
      el('div', { class: 'stat__label', text: `Complaints in ${k.latestPeriodLabel || 'the latest period'}` }),
      el('div', { class: 'stat__value stat__value--hero', text: fmtNumber(k.complaintsLatestPeriod) }),
      deltaLine(delta, 'vs previous period'),
      el('div', { style: { marginTop: '6px' } }, [sparkline(series)]),
    ]),
    statTile('Open recurrent complaints', fmtNumber(k.openThemes),
      `${fmtNumber(k.totalThemes)} on the register in total`),
    statTile('Themes trending up', fmtNumber(k.increasing),
      'last 6 periods vs the 6 before', k.increasing > 0 ? 'critical' : null),
    statTile('Open actions', fmtNumber(k.openActions),
      `${fmtNumber(k.overdueActions)} overdue · ${fmtNumber(k.completedActions)} completed`,
      k.overdueActions > 0 ? 'serious' : null),
    statTile('Confirmed root causes', fmtNumber(k.confirmedRootCauses),
      `${fmtNumber(k.linkedIncidents)} linked incidents`),
    statTile('Refunds & goodwill', fmtMoney(k.financialImpact), 'across all monitoring periods'),
    statTile('Regulatory exposure', fmtNumber(k.regulatory),
      `${fmtNumber(k.watchlist)} on the executive watchlist`,
      k.regulatory > 0 ? 'serious' : null),
  ]);
}

function statTile(label, value, meta, tone) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat__label', text: label }),
    el('div', {
      class: 'stat__value', text: value,
      style: tone ? { color: `var(--${tone})` } : {},
    }),
    meta ? el('div', { class: 'stat__meta', text: meta }) : null,
  ]);
}

function deltaLine(delta, suffix) {
  if (delta === null || !Number.isFinite(delta)) {
    return el('div', { class: 'stat__meta', text: 'No comparable prior period' });
  }
  const direction = delta > 2 ? 'up' : delta < -2 ? 'down' : 'flat';
  const glyph = { up: '▲', down: '▼', flat: '◆' }[direction];
  return el('div', { class: `stat__delta delta--${direction}` }, [
    el('span', { text: glyph, 'aria-hidden': 'true' }),
    el('span', { text: `${fmtPercent(delta, { signed: true })} ${suffix}` }),
  ]);
}

/* -------------------------------- charts ------------------------------- */

function volumeCard(data) {
  const points = data.volumeByPeriod.map((p) => ({
    label: p.period_label,
    values: { complaints: p.complaints, resolved: p.resolved },
  }));

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: 'Complaint volume across all recurrent themes' }),
      el('div', { class: 'card__sub', text: 'Received against resolved, by monitoring period' }),
    ]),
    lineChart({
      points,
      series: [
        { key: 'complaints', name: 'Received', color: seriesColor(1) },
        { key: 'resolved', name: 'Resolved', color: seriesColor(2) },
      ],
      height: 260,
    }),
  ]);
}

function topThemesCard(data) {
  const rows = data.topThemes.map((theme) => ({
    label: theme.title,
    value: theme.volume_recent,
    sublabel: 'Complaints, last 6 periods',
    onClick: () => navigate(`/themes/${theme.id}`),
  }));

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: 'Most recurrent complaints' }),
      el('div', { class: 'card__sub', text: 'Volume over the last 6 monitoring periods · select a bar to open the theme' }),
    ]),
    barChart({ rows, valueLabel: 'Complaints', color: seriesColor(1) }),
  ]);
}

function rootCauseCard(data) {
  const rows = data.rootCauseCategories.map((row) => ({ label: row.label, value: row.count }));
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: 'Root causes by category' }),
      el('div', { class: 'card__sub', text: 'Across every recurrent complaint on the register' }),
    ]),
    barChart({ rows, valueLabel: 'Root causes', color: seriesColor(1), barHeight: 16, gap: 8 }),
  ]);
}

function actionsCard(data) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: 'Product owner actions' }),
      el('div', { class: 'card__sub', text: 'Every action proposed, by current status' }),
    ]),
    distribution(data.actionsByStatus),
    data.actionEffectiveness.length > 0 ? el('div', { style: { marginTop: '16px' } }, [
      el('h4', { class: 'muted', text: 'Effectiveness of completed actions' }),
      el('div', { style: { marginTop: '8px' } }, [distribution(data.actionEffectiveness)]),
    ]) : null,
  ]);
}

/* -------------------------------- panels ------------------------------- */

function trendingCard(data) {
  const body = data.increasingThemes.length === 0
    ? el('div', { class: 'empty', text: 'No theme is trending up right now.' })
    : el('div', { class: 'stack scroll-panel', style: { gap: '10px' } }, data.increasingThemes.map((theme) =>
        el('div', {
          class: 'record', tabindex: 0, role: 'link',
          style: { cursor: 'pointer', padding: '11px 12px' },
          onclick: () => navigate(`/themes/${theme.id}`),
          onkeydown: (e) => { if (e.key === 'Enter') navigate(`/themes/${theme.id}`); },
        }, [
          el('div', { class: 'record__head' }, [
            el('div', { class: 'record__title', text: theme.title }),
            pill(fmtPercent(theme.change_pct, { signed: true }), 'critical',
              { glyph: trendGlyph('Increasing') }),
          ]),
          el('div', { class: 'record__meta' }, [
            el('span', { text: theme.reference }),
            el('span', { text: `${fmtNumber(theme.volume_recent)} complaints, last 6 periods` }),
            el('span', { text: theme.product_owner || 'No product owner' }),
          ]),
        ])));

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: 'Trending up' }),
      el('div', { class: 'card__sub', text: 'Last 6 periods at least 15% above the 6 before' }),
    ]),
    body,
  ]);
}

function overdueCard(data) {
  const body = data.overdueActions.length === 0
    ? el('div', { class: 'empty', text: 'No action has passed its due date.' })
    : el('div', { class: 'table-wrap' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { class: 'col-title', text: 'Action' }), el('th', { text: 'Recurrent complaint' }),
            el('th', { text: 'Owner' }), el('th', { text: 'Due' }), el('th', { text: 'Status' }),
          ])]),
          el('tbody', {}, data.overdueActions.map((action) => el('tr', {
            class: 'row-link', onclick: () => navigate(`/themes/${action.theme_id}?tab=actions`),
          }, [
            el('td', { class: 'col-title' }, [el('div', { class: 'cell-title', text: action.title })]),
            el('td', {}, [el('div', { class: 'cell-sub', text: `${action.reference} · ${action.theme_title}` })]),
            el('td', { text: action.proposed_by || '—' }),
            el('td', {}, [pill(fmtDate(action.due_date), 'critical')]),
            el('td', {}, [pill(action.status, 'muted')]),
          ]))),
        ]),
      ]);

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: 'Overdue actions' }),
      el('div', { class: 'card__sub', text: 'Proposed actions past their due date and not yet completed' }),
    ]),
    body,
  ]);
}

function activityCard(data) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: 'Latest activity' }),
      el('div', { class: 'card__sub', text: 'Everything captured on the platform, newest first' }),
    ]),
    el('div', { class: 'timeline', style: { maxHeight: '420px', overflowY: 'auto' } },
      data.recentActivity.map((entry) => el('div', {
        class: `timeline__item timeline__item--${entry.action}`,
      }, [
        el('div', { class: 'timeline__when', text: `${fmtDate(entry.created_at)} · ${fmtRelative(entry.created_at)}` }),
        el('div', { class: 'timeline__what', text: entry.summary }),
        el('div', { class: 'timeline__who' }, [
          el('span', { text: entry.actor }),
          entry.reference ? el('span', { class: 'muted', text: ` · ${entry.reference}` }) : null,
        ]),
      ]))),
  ]);
}
