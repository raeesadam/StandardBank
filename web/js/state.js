import { api } from './api.js';
import { t } from './i18n.js';

const ACTOR_KEY = 'rcm.actor';
const THEME_KEY = 'rcm.theme';

export const state = {
  meta: null,
  // Falls back to the reader's own language; overwritten the moment they type a name.
  actor: read(ACTOR_KEY) || t('state.defaultActor'),
};

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

export async function loadMeta() {
  if (!state.meta) state.meta = await api.meta();
  return state.meta;
}

export function setActor(name) {
  state.actor = name.trim() || t('state.defaultActor');
  write(ACTOR_KEY, state.actor);
}

/** Every write carries the person who made it, so the audit trail is real. */
export function withActor(body) {
  return { actor: state.actor, ...body };
}

export function initTheme() {
  const saved = read(THEME_KEY);
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.setAttribute('data-theme', saved);
  }
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const next = current ? (current === 'dark' ? 'light' : 'dark') : (systemDark ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', next);
  write(THEME_KEY, next);
  return next;
}
