/**
 * Runs the whole suite on any supported Node version.
 *
 *   npm test
 */
import './support/fetch.js';   // Node 16 has no global fetch; this fills it in.
import { run } from './support/harness.js';

await import('./store.test.js');
await import('./api.test.js');

await run();
