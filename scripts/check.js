/**
 * Environment check. Answers "will this run on my machine, and if not, why?"
 * without needing admin rights, a package install, or a network connection.
 *
 *   npm run check
 */
import { createServer } from 'node:http';
import { accessSync, constants, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED_MAJOR = 18;
const PORT = Number(process.env.PORT) || 4173;

const results = [];
const record = (ok, label, detail) => results.push({ ok, label, detail });

/* 1. Node version - the only hard requirement. */
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > REQUIRED_MAJOR || (major === REQUIRED_MAJOR && minor >= 0)) {
  record(true, `Node ${process.versions.node}`, `meets the minimum of ${REQUIRED_MAJOR}.0.0`);
} else {
  record(false, `Node ${process.versions.node} is too old`,
    `this platform needs Node ${REQUIRED_MAJOR} or later. Install it from https://nodejs.org - ` +
    'the Windows and macOS installers do not need admin rights if you choose a folder ' +
    'inside your user profile, or use nvm / nvm-windows / fnm.');
}

/* 2. Somewhere to keep the register. */
const dataDir = resolve(ROOT, 'data');
try {
  mkdirSync(dataDir, { recursive: true });
  accessSync(dataDir, constants.W_OK);
  record(true, 'The data folder is writable', dataDir);
} catch (error) {
  record(false, 'The data folder cannot be written to',
    `${dataDir} - ${error.message}. Set RCM_DB_PATH to a folder you can write to, ` +
    'for example: RCM_DB_PATH=%USERPROFILE%\\rcm.json npm start');
}

/* 3. A free port to listen on. */
const portFree = await new Promise((done) => {
  const probe = createServer();
  probe.once('error', () => done(false));
  probe.once('listening', () => probe.close(() => done(true)));
  probe.listen(PORT, '127.0.0.1');
});
if (portFree) {
  record(true, `Port ${PORT} is free`, `the platform will be at http://localhost:${PORT}`);
} else {
  record(false, `Port ${PORT} is already in use`,
    'either something else is using it, or the platform is already running. ' +
    `To use a different port: PORT=8080 npm start (then open http://localhost:8080)`);
}

/* 4. Is there data to look at? */
const { openDatabase, DEFAULT_DB_PATH } = await import('../server/store.js');
try {
  const db = openDatabase();
  const count = db.count('themes');
  if (count > 0) record(true, `The register holds ${count} recurrent complaints`, DEFAULT_DB_PATH);
  else record(true, 'The register is empty', 'run "npm run seed" to load the demo data');
} catch (error) {
  record(false, 'The register file could not be read', error.message);
}

/* ------------------------------- report ------------------------------- */

const pad = (text, width) => text + ' '.repeat(Math.max(0, width - text.length));
const width = Math.max(...results.map((r) => r.label.length));

console.log('\nRecurrent Complaints Management - environment check\n');
for (const { ok, label, detail } of results) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${pad(label, width)}   ${detail}`);
}

const failures = results.filter((r) => !r.ok);
if (failures.length === 0) {
  console.log('\nEverything checks out. Next:  npm run seed  then  npm start\n');
} else {
  const noun = failures.length === 1 ? 'thing needs' : 'things need';
  console.log(`\n${failures.length} ${noun} attention before the platform will run.\n`);
  process.exitCode = 1;
}
