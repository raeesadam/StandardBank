import { api } from '../api.js';
import { el, clear, fmtNumber, fmtDate, fmtPercent, pill, debounce,
         severityTone, themeStatusTone, trendTone, trendGlyph, trendLabel } from '../util.js';
import { t, label, options as enumOptions } from '../i18n.js';
import { loading, emptyState, openFormModal, toast } from '../ui.js';
import { state, withActor } from '../state.js';
import { themeFields } from '../forms.js';
import { navigate, currentPath, replacePath } from '../router.js';

const SORT_KEYS = ['volume', 'severity', 'open_actions', 'last_reported', 'updated', 'reference', 'title'];
const sortOptions = () =>
  SORT_KEYS.map((value) => ({ value, label: t(`register.sort.${value}`) }));

export async function renderRegister(host, query = {}) {
  clear(host);

  const filters = {
    search: query.search || '',
    status: query.status || '',
    product: query.product || '',
    channel: query.channel || '',
    severity: query.severity || '',
    sort: query.sort || 'volume',
    open: query.open === 'true',
    watchlist: query.watchlist === 'true',
    regulatory: query.regulatory === 'true',
  };

  const results = el('div', {});

  host.appendChild(el('div', { class: 'page-head' }, [
    el('div', { class: 'page-head__text' }, [
      el('h1', { text: t('register.title') }),
      el('div', { class: 'page-head__sub', text: t('register.subtitle') }),
    ]),
    el('div', {}, [
      el('button', {
        class: 'btn btn--primary', type: 'button',
        onclick: () => openThemeForm(null, () => load()),
      }, t('register.new')),
    ]),
  ]));

  host.appendChild(filterBar(filters, () => load()));
  host.appendChild(results);

  async function load() {
    clear(results).appendChild(loading(t('register.loading')));
    pushFilters(filters);
    try {
      const themes = await api.listThemes(filters);
      clear(results);
      results.appendChild(summaryLine(themes));
      results.appendChild(themes.length === 0
        ? emptyState(t('register.empty'), t('register.emptyAction'),
            () => openThemeForm(null, () => load()))
        : table(themes));
    } catch (error) {
      clear(results).appendChild(el('div', { class: 'empty', text: error.message }));
    }
  }

  await load();
}

function pushFilters(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'volume') params.set(key, String(value));
  }
  const next = `/register${params.toString() ? `?${params}` : ''}`;
  if (next !== currentPath()) replacePath(next);
}

function filterBar(filters, onChange) {
  const m = state.meta || {};
  const apply = debounce(onChange, 240);

  const select = (name, anyLabel, values) => el('select', {
    'aria-label': anyLabel,
    onchange: (event) => { filters[name] = event.target.value; onChange(); },
  }, [
    el('option', { value: '', text: anyLabel }),
    ...enumOptions(values).map((option) => el('option', {
      value: option.value, text: option.label, selected: filters[name] === option.value,
    })),
  ]);

  const toggle = (name, text) => el('label', { class: 'switch' }, [
    el('input', {
      type: 'checkbox', checked: filters[name],
      onchange: (event) => { filters[name] = event.target.checked; onChange(); },
    }),
    el('span', { text }),
  ]);

  return el('div', { class: 'filters', role: 'search' }, [
    el('input', {
      type: 'search', placeholder: t('register.search'),
      value: filters.search, 'aria-label': t('register.searchLabel'),
      oninput: (event) => { filters.search = event.target.value; apply(); },
    }),
    select('status', t('register.anyStatus'), m.themeStatuses || []),
    select('product', t('register.anyProduct'), m.products || []),
    select('channel', t('register.anyChannel'), m.channels || []),
    select('severity', t('register.anySeverity'), m.severities || []),
    el('select', {
      'aria-label': t('register.sortLabel'),
      onchange: (event) => { filters.sort = event.target.value; onChange(); },
    }, sortOptions().map((sort) => el('option', {
      value: sort.value, text: sort.label, selected: filters.sort === sort.value,
    }))),
    toggle('open', t('register.openOnly')),
    toggle('watchlist', t('register.watchlist')),
    toggle('regulatory', t('register.regulatory')),
  ]);
}

function summaryLine(themes) {
  const complaints = themes.reduce((acc, t) => acc + t.volume_recent, 0);
  const rising = themes.filter((t) => t.trend === 'Increasing').length;
  return el('div', {
    class: 'small muted', style: { margin: '0 2px 10px' },
    text: t('register.summary', {
      count: themes.length, volume: fmtNumber(complaints), rising,
    }),
  });
}

function table(themes) {
  return el('div', { class: 'card', style: { padding: '0' } }, [
    el('div', { class: 'table-wrap' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: t('register.col.reference') }),
          el('th', { class: 'col-title', text: t('register.col.complaint') }),
          el('th', { text: t('register.col.severity') }),
          el('th', { text: t('register.col.status') }),
          el('th', { class: 'num', text: t('register.col.volume') }),
          el('th', { text: t('register.col.trend') }),
          el('th', { class: 'num', text: t('register.col.causes') }),
          el('th', { class: 'num', text: t('register.col.actions') }),
          el('th', { class: 'num', text: t('register.col.incidents') }),
          el('th', { text: t('register.col.owner') }),
        ])]),
        el('tbody', {}, themes.map(rowFor)),
      ]),
    ]),
  ]);
}

function rowFor(theme) {
  const open = () => navigate(`/themes/${theme.id}`);
  return el('tr', {
    class: 'row-link', tabindex: 0, onclick: open,
    onkeydown: (event) => { if (event.key === 'Enter') open(); },
  }, [
    el('td', { class: 'nowrap' }, [
      el('div', { class: 'detail-ref', text: theme.reference }),
      el('div', { class: 'badges', style: { marginTop: '4px' } }, [
        theme.regulatory_risk ? pill(t('register.regulatory'), 'serious') : null,
        theme.watchlist ? pill(t('register.watchlist'), 'accent') : null,
      ]),
    ]),
    el('td', { class: 'col-title' }, [
      el('div', { class: 'cell-title', text: theme.title }),
      el('div', {
        class: 'cell-sub',
        text: `${label(theme.product)} · ${label(theme.channel)} · ${label(theme.category)}`,
      }),
      el('div', {
        class: 'cell-sub',
        text: t('register.lastReported', { date: fmtDate(theme.last_reported_on) }),
      }),
    ]),
    el('td', {}, [pill(label(theme.severity), severityTone(theme.severity), { dot: true })]),
    el('td', {}, [pill(label(theme.status), themeStatusTone(theme.status), { dot: true })]),
    el('td', { class: 'num nowrap' }, [
      el('div', { text: fmtNumber(theme.volume_recent) }),
      el('div', { class: 'cell-sub', text: t('register.allTime', { count: fmtNumber(theme.volume_total) }) }),
    ]),
    el('td', {}, [
      pill(theme.change_pct === null ? trendLabel(theme.trend) : fmtPercent(theme.change_pct, { signed: true }),
        trendTone(theme.trend), { glyph: trendGlyph(theme.trend) }),
    ]),
    el('td', { class: 'num nowrap' }, [
      el('div', { text: fmtNumber(theme.root_cause_count) }),
      el('div', { class: 'cell-sub', text: t('register.confirmed', { count: theme.confirmed_cause_count }) }),
    ]),
    el('td', { class: 'num nowrap' }, [
      el('div', { text: t('register.openCount', { count: fmtNumber(theme.open_actions) }) }),
      theme.overdue_actions > 0
        ? el('div', {
            class: 'cell-sub', style: { color: 'var(--critical)' },
            text: t('register.overdueCount', { count: theme.overdue_actions }),
          })
        : el('div', { class: 'cell-sub', text: t('register.doneCount', { count: theme.completed_actions }) }),
    ]),
    el('td', { class: 'num', text: fmtNumber(theme.incident_count) }),
    el('td', {}, [
      el('div', { text: theme.product_owner || t('common.none') }),
      el('div', { class: 'cell-sub', text: theme.business_unit || '' }),
    ]),
  ]);
}

/** Shared by the register and the detail view. */
export function openThemeForm(theme, onSaved) {
  const isNew = !theme;
  openFormModal({
    title: isNew ? t('form.themeCreate') : t('form.themeEdit', { reference: theme.reference }),
    fields: themeFields(),
    values: theme || {},
    submitLabel: isNew ? t('form.themeSubmit') : t('common.save'),
    onSubmit: async (values) => {
      const saved = isNew
        ? await api.createTheme(withActor(values))
        : await api.updateTheme(theme.id, withActor(values));
      toast(isNew ? t('theme.registered', { reference: saved.reference }) : t('theme.updated'), 'success');
      await onSaved?.(saved);
      if (isNew) navigate(`/themes/${saved.id}`);
    },
  });
}
