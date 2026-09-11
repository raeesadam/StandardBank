const routes = [];
let notFound = null;
let current = null;

export function route(pattern, handler) {
  routes.push({ pattern, handler });
}

export function setNotFound(handler) { notFound = handler; }

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  resolve();
}

export function currentPath() {
  return window.location.pathname + window.location.search;
}

export async function resolve() {
  const path = window.location.pathname;
  const query = Object.fromEntries(new URLSearchParams(window.location.search).entries());

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
