import { api } from '../api.js';
import { el, clear, fmtNumber, fmtMoney, fmtPercent, fmtDate, fmtRelative, pill,
         trendGlyph } from '../util.js';
import { t, label, activityText } from '../i18n.js';
import { lineChart, barChart, distribution, sparkline, seriesColor } from '../charts.js';
import { loading } from '../ui.js';
import { navigate } from '../router.js';

export async function renderDashboard(host) {
  clear(host).appendChild(loading());
  const data = await api.dashboard({ months: 12 });
  clear(host);

  host.appendChild(el('div', { class: 'page-head' }, [
    el('div', { class: 'page-head__text' }, [
      el('h1', { text: t('dashboard.title') }),
      el('div', {
        class: 'page-head__sub',
        text: t('dashboard.subtitle', {
          open: data.kpis.openThemes,
          period: data.kpis.latestPeriodLabel || t('common.none'),
        }),
      }),
    ]),
    el('div', {}, [
      el('button', {
        class: 'btn', type: 'button', onclick: () => navigate('/register'),
      }, t('dashboard.openRegister')),
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
      el('div', {
        class: 'stat__label',
        text: t('dashboard.kpi.latest', { period: k.latestPeriodLabel || t('dashboard.kpi.latestFallback') }),
      }),
      el('div', { class: 'stat__value stat__value--hero', text: fmtNumber(k.complaintsLatestPeriod) }),
      deltaLine(delta, t('dashboard.kpi.vsPrevious')),
      el('div', { style: { marginTop: '6px' } }, [sparkline(series)]),
    ]),
    statTile(t('dashboard.kpi.open'), fmtNumber(k.openThemes),
      t('dashboard.kpi.openMeta', { total: fmtNumber(k.totalThemes) })),
    statTile(t('dashboard.kpi.rising'), fmtNumber(k.increasing),
      t('dashboard.kpi.risingMeta'), k.increasing > 0 ? 'critical' : null),
    statTile(t('dashboard.kpi.actions'), fmtNumber(k.openActions),
      t('dashboard.kpi.actionsMeta', {
        overdue: fmtNumber(k.overdueActions), done: fmtNumber(k.completedActions),
      }),
      k.overdueActions > 0 ? 'serious' : null),
    statTile(t('dashboard.kpi.money'), fmtMoney(k.financialImpact), t('dashboard.kpi.moneyMeta')),
    statTile(t('dashboard.kpi.regulatory'), fmtNumber(k.regulatory),
      t('dashboard.kpi.regulatoryMeta', { watchlist: fmtNumber(k.watchlist) }),
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
    return el('div', { class: 'stat__meta', text: t('dashboard.kpi.noPrior') });
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
      el('h3', { text: t('dashboard.volume.title') }),
      el('div', { class: 'card__sub', text: t('dashboard.volume.subtitle') }),
    ]),
    lineChart({
      points,
      series: [
        { key: 'complaints', name: t('dashboard.series.received'), color: seriesColor(1) },
        { key: 'resolved', name: t('dashboard.series.resolved'), color: seriesColor(2) },
      ],
      height: 260,
    }),
  ]);
}

function topThemesCard(data) {
  const rows = data.topThemes.map((theme) => ({
    label: theme.title,
    value: theme.volume_recent,
    sublabel: t('dashboard.top.tooltip'),
    onClick: () => navigate(`/themes/${theme.id}`),
  }));

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: t('dashboard.top.title') }),
      el('div', { class: 'card__sub', text: t('dashboard.top.subtitle') }),
    ]),
    barChart({ rows, valueLabel: t('common.complaints'), color: seriesColor(1) }),
  ]);
}

function rootCauseCard(data) {
  const rows = data.rootCauseCategories.map((row) => ({ label: label(row.label), value: row.count }));
  const total = data.rootCauseCategories.reduce((acc, row) => acc + row.count, 0);
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: t('dashboard.causes.title') }),
      el('div', {
        class: 'card__sub',
        text: t('dashboard.causes.subtitle', {
          total: fmtNumber(total),
          confirmed: fmtNumber(data.kpis.confirmedRootCauses),
          incidents: fmtNumber(data.kpis.linkedIncidents),
        }),
      }),
    ]),
    barChart({ rows, valueLabel: t('dashboard.causes.unit'), color: seriesColor(1), barHeight: 16, gap: 8 }),
  ]);
}

function actionsCard(data) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: t('dashboard.actions.title') }),
      el('div', { class: 'card__sub', text: t('dashboard.actions.subtitle') }),
    ]),
    distribution(translateCounts(data.actionsByStatus)),
    data.actionEffectiveness.length > 0 ? el('div', { style: { marginTop: '16px' } }, [
      el('h4', { class: 'muted', text: t('dashboard.actions.effectiveness') }),
      el('div', { style: { marginTop: '8px' } }, [distribution(translateCounts(data.actionEffectiveness))]),
    ]) : null,
  ]);
}

/* -------------------------------- panels ------------------------------- */

function trendingCard(data) {
  const body = data.increasingThemes.length === 0
    ? el('div', { class: 'empty', text: t('dashboard.trending.empty') })
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
            el('span', { text: t('dashboard.trending.volume', { count: fmtNumber(theme.volume_recent) }) }),
            el('span', { text: theme.product_owner || t('common.noOwner') }),
          ]),
        ])));

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: t('dashboard.trending.title') }),
      el('div', { class: 'card__sub', text: t('dashboard.trending.subtitle') }),
    ]),
    body,
  ]);
}

function overdueCard(data) {
  const body = data.overdueActions.length === 0
    ? el('div', { class: 'empty', text: t('dashboard.overdue.empty') })
    : el('div', { class: 'table-wrap' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { class: 'col-title', text: t('dashboard.overdue.action') }),
            el('th', { text: t('dashboard.overdue.theme') }),
            el('th', { text: t('dashboard.overdue.owner') }),
            el('th', { text: t('dashboard.overdue.due') }),
            el('th', { text: t('dashboard.overdue.status') }),
          ])]),
          el('tbody', {}, data.overdueActions.map((action) => el('tr', {
            class: 'row-link', onclick: () => navigate(`/themes/${action.theme_id}?tab=actions`),
          }, [
            el('td', { class: 'col-title' }, [el('div', { class: 'cell-title', text: action.title })]),
            el('td', {}, [el('div', { class: 'cell-sub', text: `${action.reference} · ${action.theme_title}` })]),
            el('td', { text: action.proposed_by || t('common.none') }),
            el('td', {}, [pill(fmtDate(action.due_date), 'critical')]),
            el('td', {}, [pill(label(action.status), 'muted')]),
          ]))),
        ]),
      ]);

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: t('dashboard.overdue.title') }),
      el('div', { class: 'card__sub', text: t('dashboard.overdue.subtitle') }),
    ]),
    body,
  ]);
}

function activityCard(data) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__head' }, [
      el('h3', { text: t('dashboard.activity.title') }),
      el('div', { class: 'card__sub', text: t('dashboard.activity.subtitle') }),
    ]),
    el('div', { class: 'timeline', style: { maxHeight: '420px', overflowY: 'auto' } },
      data.recentActivity.map((entry) => el('div', {
        class: `timeline__item timeline__item--${entry.action}`,
      }, [
        el('div', { class: 'timeline__when', text: `${fmtDate(entry.created_at)} · ${fmtRelative(entry.created_at)}` }),
        el('div', { class: 'timeline__what', text: activityText(entry) }),
        el('div', { class: 'timeline__who' }, [
          el('span', { text: entry.actor }),
          entry.reference ? el('span', { class: 'muted', text: ` · ${entry.reference}` }) : null,
        ]),
      ]))),
  ]);
}

/** Distribution rows carry stored vocabulary values; show their labels. */
function translateCounts(rows) {
  return rows.map((row) => ({ ...row, label: label(row.label) }));
}
