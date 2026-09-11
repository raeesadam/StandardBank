import { api } from '../api.js';
import { el, clear, fmtNumber, fmtDate, fmtPercent, pill, debounce,
         severityTone, themeStatusTone, trendTone, trendGlyph } from '../util.js';
import { loading, emptyState, openFormModal, toast } from '../ui.js';
import { state, withActor } from '../state.js';
import { themeFields } from '../forms.js';
import { navigate, currentPath, replacePath } from '../router.js';

const SORTS = [
  { value: 'volume', label: 'Most complaints (last 6 periods)' },
  { value: 'severity', label: 'Severity' },
  { value: 'open_actions', label: 'Open actions' },
  { value: 'last_reported', label: 'Most recently reported' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'reference', label: 'Reference' },
  { value: 'title', label: 'Title' },
];

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
      el('h1', { text: 'Recurrent complaint register' }),
      el('div', {
        class: 'page-head__sub',
        text: 'Every recurring complaint the bank monitors, with its history, root causes, actions and linked incidents.',
      }),
    ]),
    el('div', {}, [
      el('button', {
        class: 'btn btn--primary', type: 'button',
        onclick: () => openThemeForm(null, () => load()),
      }, '+ New recurrent complaint'),
    ]),
  ]));

  host.appendChild(filterBar(filters, () => load()));
  host.appendChild(results);

  async function load() {
    clear(results).appendChild(loading('Loading the register…'));
    pushFilters(filters);
    try {
      const themes = await api.listThemes(filters);
      clear(results);
      results.appendChild(summaryLine(themes));
      results.appendChild(themes.length === 0
        ? emptyState('No recurrent complaint matches these filters.', 'Register a new one',
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

  const select = (name, label, options) => el('select', {
    'aria-label': label,
    onchange: (event) => { filters[name] = event.target.value; onChange(); },
  }, [
    el('option', { value: '', text: label }),
    ...options.map((option) => el('option', {
      value: option, text: option, selected: filters[name] === option,
    })),
  ]);

  const toggle = (name, label) => el('label', { class: 'switch' }, [
    el('input', {
      type: 'checkbox', checked: filters[name],
      onchange: (event) => { filters[name] = event.target.checked; onChange(); },
    }),
    el('span', { text: label }),
  ]);

  return el('div', { class: 'filters', role: 'search' }, [
    el('input', {
      type: 'search', placeholder: 'Search title, description, reference or owner…',
      value: filters.search, 'aria-label': 'Search recurrent complaints',
      oninput: (event) => { filters.search = event.target.value; apply(); },
    }),
    select('status', 'Any status', m.themeStatuses || []),
    select('product', 'Any product', m.products || []),
    select('channel', 'Any channel', m.channels || []),
    select('severity', 'Any severity', m.severities || []),
    el('select', {
      'aria-label': 'Sort by',
      onchange: (event) => { filters.sort = event.target.value; onChange(); },
    }, SORTS.map((sort) => el('option', {
      value: sort.value, text: sort.label, selected: filters.sort === sort.value,
    }))),
    toggle('open', 'Open only'),
    toggle('watchlist', 'Watchlist'),
    toggle('regulatory', 'Regulatory'),
  ]);
}

function summaryLine(themes) {
  const complaints = themes.reduce((acc, t) => acc + t.volume_recent, 0);
  const rising = themes.filter((t) => t.trend === 'Increasing').length;
  return el('div', { class: 'small muted', style: { margin: '0 2px 10px' } , text:
    `${themes.length} recurrent complaint${themes.length === 1 ? '' : 's'} · ` +
    `${fmtNumber(complaints)} complaints in the last 6 monitoring periods · ${rising} trending up` });
}

function table(themes) {
  return el('div', { class: 'card', style: { padding: '0' } }, [
    el('div', { class: 'table-wrap' }, [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', { text: 'Reference' }),
          el('th', { class: 'col-title', text: 'Recurrent complaint' }),
          el('th', { text: 'Severity' }),
          el('th', { text: 'Status' }),
          el('th', { class: 'num', text: 'Last 6 periods' }),
          el('th', { text: 'Trend' }),
          el('th', { class: 'num', text: 'Causes' }),
          el('th', { class: 'num', text: 'Actions' }),
          el('th', { class: 'num', text: 'Incidents' }),
          el('th', { text: 'Product owner' }),
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
        theme.regulatory_risk ? pill('Regulatory', 'serious') : null,
        theme.watchlist ? pill('Watchlist', 'accent') : null,
      ]),
    ]),
    el('td', { class: 'col-title' }, [
      el('div', { class: 'cell-title', text: theme.title }),
      el('div', { class: 'cell-sub', text: `${theme.product} · ${theme.channel} · ${theme.category}` }),
      el('div', { class: 'cell-sub', text: `Last reported ${fmtDate(theme.last_reported_on)}` }),
    ]),
    el('td', {}, [pill(theme.severity, severityTone(theme.severity), { dot: true })]),
    el('td', {}, [pill(theme.status, themeStatusTone(theme.status), { dot: true })]),
    el('td', { class: 'num nowrap' }, [
      el('div', { text: fmtNumber(theme.volume_recent) }),
      el('div', { class: 'cell-sub', text: `${fmtNumber(theme.volume_total)} all time` }),
    ]),
    el('td', {}, [
      pill(theme.change_pct === null ? theme.trend : fmtPercent(theme.change_pct, { signed: true }),
        trendTone(theme.trend), { glyph: trendGlyph(theme.trend) }),
    ]),
    el('td', { class: 'num nowrap' }, [
      el('div', { text: fmtNumber(theme.root_cause_count) }),
      el('div', { class: 'cell-sub', text: `${theme.confirmed_cause_count} confirmed` }),
    ]),
    el('td', { class: 'num nowrap' }, [
      el('div', { text: `${fmtNumber(theme.open_actions)} open` }),
      theme.overdue_actions > 0
        ? el('div', { class: 'cell-sub', style: { color: 'var(--critical)' }, text: `${theme.overdue_actions} overdue` })
        : el('div', { class: 'cell-sub', text: `${theme.completed_actions} done` }),
    ]),
    el('td', { class: 'num', text: fmtNumber(theme.incident_count) }),
    el('td', {}, [
      el('div', { text: theme.product_owner || '—' }),
      el('div', { class: 'cell-sub', text: theme.business_unit || '' }),
    ]),
  ]);
}

/** Shared by the register and the detail view. */
export function openThemeForm(theme, onSaved) {
  const isNew = !theme;
  openFormModal({
    title: isNew ? 'Register a recurrent complaint' : `Edit ${theme.reference}`,
    fields: themeFields(),
    values: theme || {},
    submitLabel: isNew ? 'Register complaint' : 'Save changes',
    onSubmit: async (values) => {
      const saved = isNew
        ? await api.createTheme(withActor(values))
        : await api.updateTheme(theme.id, withActor(values));
      toast(isNew ? `${saved.reference} registered.` : 'Complaint theme updated.', 'success');
      await onSaved?.(saved);
      if (isNew) navigate(`/themes/${saved.id}`);
    },
  });
}
