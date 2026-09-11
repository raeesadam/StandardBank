/**
 * Minimal fetch for Node 16, which has no global fetch (it arrived in Node 18).
 *
 * Only covers what the tests need - a method, JSON headers, a body, and a
 * response you can read as text - so the test files can be written against the
 * same API regardless of which Node version is running them.
 */
import { request } from 'node:http';

function nodeFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = options.body === undefined || options.body === null
      ? null : Buffer.from(String(options.body), 'utf8');

    // Content-Length is not optional here: Node 16 silently drops the body of a
    // DELETE that has neither a length nor chunked encoding, which is exactly
    // how the audit-trail tests send the actor. A real fetch always sets it.
    const headers = { ...(options.headers || {}) };
    if (body) headers['Content-Length'] = body.length;

    const req = request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            headers: {
              get: (name) => res.headers[String(name).toLowerCase()] ?? null,
            },
            text: () => Promise.resolve(body),
            json: () => Promise.resolve(JSON.parse(body)),
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Node 18+ already has a real fetch; leave it alone. */
export function installFetch() {
  if (typeof globalThis.fetch !== 'function') globalThis.fetch = nodeFetch;
  return globalThis.fetch;
}

installFetch();
