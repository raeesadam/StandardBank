import { t, locale, label } from './i18n.js';

/** Tiny DOM builder. Everything goes in as text nodes, so record content
 *  typed by users is never parsed as HTML. */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && key !== 'list' && typeof value !== 'object') {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(node, children);
  return node;
}

export function svg(tag, props = {}, children = []) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'text') node.textContent = String(value);
    else node.setAttribute(key, String(value));
  }
  append(node, children);
  return node;
}

function append(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ------------------------------ formatting ----------------------------- */
/* Formatters are built per call against the active locale, so switching
 * language reformats dates and numbers along with the labels. */

const formatters = new Map();
function formatter(kind, options) {
  const key = `${kind}:${locale()}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.NumberFormat(locale(), options));
  return formatters.get(key);
}

export const fmtNumber = (value) =>
  formatter('number').format(Math.round(Number(value) || 0));

export function fmtMoney(value) {
  const num = Number(value) || 0;
  if (Math.abs(num) >= 1_000_000) return `R${(num / 1_000_000).toFixed(1)}m`;
  if (Math.abs(num) >= 1_000) return `R${(num / 1_000).toFixed(0)}k`;
  return formatter('money', {
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0,
  }).format(num);
}

export function fmtDate(value) {
  if (!value) return '—';
  const date = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale(), {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export function fmtDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale(), {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function fmtRelative(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.round((Date.now() - then) / 86400000);
  if (days <= 0) return t('date.relative.today');
  if (days === 1) return t('date.relative.yesterday');
  if (days < 30) return t('date.relative.days', { count: days });
  if (days < 365) return t('date.relative.months', { count: Math.round(days / 30) });
  return t('date.relative.years', { count: Math.round(days / 365) });
}

export function fmtPercent(value, { signed = false } = {}) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  const sign = signed && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return null;
  const start = new Date(todayIso() + 'T00:00:00Z').getTime();
  return Math.round((target - start) / 86400000);
}

export const isOverdue = (dateStr) => {
  const d = daysUntil(dateStr);
  return d !== null && d < 0;
};

/* ------------------------- status -> visual tokens --------------------- */

export function severityTone(severity) {
  return { Critical: 'critical', High: 'serious', Medium: 'warning', Low: 'muted' }[severity] || 'muted';
}

export function themeStatusTone(status) {
  return {
    New: 'accent',
    'Under investigation': 'warning',
    'Action plan agreed': 'accent',
    'Remediation in progress': 'serious',
    Monitoring: 'accent',
    Resolved: 'good',
    Reopened: 'critical',
  }[status] || 'muted';
}

export function actionStatusTone(status) {
  return {
    Proposed: 'muted', Approved: 'accent', 'In progress': 'accent',
    Blocked: 'critical', Completed: 'good', Deferred: 'warning', Rejected: 'muted',
  }[status] || 'muted';
}

export function incidentTone(severity) {
  return { P1: 'critical', P2: 'serious', P3: 'warning', P4: 'muted' }[severity] || 'muted';
}

export function confidenceTone(confidence) {
  return {
    Confirmed: 'critical', 'Under analysis': 'warning',
    Suspected: 'muted', 'Ruled out': 'good',
  }[confidence] || 'muted';
}

export function trendTone(trend) {
  return { Increasing: 'critical', Decreasing: 'good', Stable: 'muted' }[trend] || 'muted';
}

/** Status colour never travels alone - every pill carries its label, and
 *  trend/effectiveness pills carry a glyph as well. */
export function pill(text, tone = 'muted', { dot = false, glyph = '' } = {}) {
  return el('span', { class: `pill pill--${tone}` }, [
    dot ? el('span', { class: 'pill__dot' }) : null,
    glyph ? el('span', { text: glyph, 'aria-hidden': 'true' }) : null,
    el('span', { text }),
  ]);
}

export const trendLabel = (trend) => t(`trend.${trend}`);

export const trendGlyph = (trend) =>
  ({ Increasing: '▲', Decreasing: '▼', Stable: '◆' }[trend] || '·');

export function debounce(fn, wait = 220) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
