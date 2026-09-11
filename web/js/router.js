const routes = [];
let notFound = null;
let current = null;

export function route(pattern, handler) {
  routes.push({ pattern, handler });
}

export function setNotFound(handler) { notFound = handler; }

/**
 * The address bar is the source of truth where it works. Some embedded
 * contexts refuse History API calls, so a failure falls back to tracking the
 * location in memory - navigation keeps working, it just stops being
 * bookmarkable.
 */
let tracked = null;

function writeLocation(path, { replace }) {
  try {
    if (replace) history.replaceState({}, '', path);
    else history.pushState({}, '', path);
    tracked = null;
  } catch {
    const [pathname, search = ''] = String(path).split('?');
    tracked = { pathname, search: search ? `?${search}` : '' };
  }
}

function readLocation() {
  return tracked || { pathname: window.location.pathname, search: window.location.search };
}

export function navigate(path, { replace = false } = {}) {
  writeLocation(path, { replace });
  resolve();
}

/** Updates the address bar without re-rendering - for filters and tab changes. */
export function replacePath(path) {
  writeLocation(path, { replace: true });
}

export function currentPath() {
  const { pathname, search } = readLocation();
  return pathname + search;
}

export async function resolve() {
  const { pathname: path, search } = readLocation();
  const query = Object.fromEntries(new URLSearchParams(search).entries());

  for (const { pattern, handler } of routes) {
    const params = match(pattern, path);
    if (params) {
      current = { pattern, params, query };
      await handler(params, query);
      return;
    }
  }
  notFound?.(path);
}

export function currentRoute() { return current; }

function match(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    if (patternParts[i].startsWith(':')) params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    else if (patternParts[i] !== pathParts[i]) return null;
  }
  return params;
}

window.addEventListener('popstate', () => resolve());
