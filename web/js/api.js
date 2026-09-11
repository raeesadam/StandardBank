const BASE = '/api';

export class ApiError extends Error {
  constructor(message, { status, fields } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields || null;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { error: text }; }
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || `Request failed (${response.status})`, {
      status: response.status,
      fields: payload?.fields,
    });
  }
  return payload;
}

const qs = (params = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== null && value !== undefined && value !== false) {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
};

export const api = {
  meta: () => request('/meta'),
  dashboard: (params) => request(`/dashboard${qs(params)}`),
  activity: (params) => request(`/activity${qs(params)}`),

  listThemes: (params) => request(`/themes${qs(params)}`),
  getTheme: (id) => request(`/themes/${id}`),
  createTheme: (body) => request('/themes', { method: 'POST', body }),
  updateTheme: (id, body) => request(`/themes/${id}`, { method: 'PATCH', body }),
  deleteTheme: (id, body) => request(`/themes/${id}`, { method: 'DELETE', body }),

  createChild: (themeId, collection, body) =>
    request(`/themes/${themeId}/${collection}`, { method: 'POST', body }),
  updateChild: (themeId, collection, id, body) =>
    request(`/themes/${themeId}/${collection}/${id}`, { method: 'PATCH', body }),
  deleteChild: (themeId, collection, id, body) =>
    request(`/themes/${themeId}/${collection}/${id}`, { method: 'DELETE', body }),
};
