/**
 * Browser build of the API client. Published in place of web/js/api.js.
 *
 * Instead of calling a server over HTTP, it dispatches straight into the real
 * request handler running in the page, against an in-memory register. Every
 * validation rule, roll-up and audit-trail entry is the same code the installed
 * platform runs - only the transport is gone.
 */
import { handleApi } from './server/api.js';
import { getDb } from './server/store.js';

export class ApiError extends Error {
  constructor(message, { status, fields } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields || null;
  }
}

/** Matches how URLSearchParams would have serialised the filters over HTTP. */
function toQuery(params = {}) {
  const query = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === '' || value === null || value === undefined || value === false) continue;
    query[key] = String(value);
  }
  return query;
}

function call(method, segments, { query = {}, body = null } = {}) {
  try {
    const result = handleApi(getDb(), {
      method,
      segments: segments.map(String),
      query,
      body,
    });
    // Round-trip through JSON so callers get plain data, exactly as over the wire.
    return Promise.resolve(JSON.parse(JSON.stringify(result.body)));
  } catch (error) {
    return Promise.reject(new ApiError(error.message || 'Request failed', {
      status: error.statusCode || 500,
      fields: error.errors,
    }));
  }
}

export const api = {
  meta: () => call('GET', ['meta']),
  dashboard: (params) => call('GET', ['dashboard'], { query: toQuery(params) }),
  activity: (params) => call('GET', ['activity'], { query: toQuery(params) }),

  listThemes: (params) => call('GET', ['themes'], { query: toQuery(params) }),
  getTheme: (id) => call('GET', ['themes', id]),
  createTheme: (body) => call('POST', ['themes'], { body }),
  updateTheme: (id, body) => call('PATCH', ['themes', id], { body }),
  deleteTheme: (id, body) => call('DELETE', ['themes', id], { body }),

  createChild: (themeId, collection, body) =>
    call('POST', ['themes', themeId, collection], { body }),
  updateChild: (themeId, collection, id, body) =>
    call('PATCH', ['themes', themeId, collection, id], { body }),
  deleteChild: (themeId, collection, id, body) =>
    call('DELETE', ['themes', themeId, collection, id], { body }),
};
