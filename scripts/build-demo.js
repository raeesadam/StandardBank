/**
 * Assembles the hosted demo into dist-demo/.
 *
 * The demo is not a reimplementation: it publishes the real front end and the
 * real server modules, swapping only the two pieces that assume a server - the
 * store (in memory instead of a file) and the API client (a direct call instead
 * of fetch). That way the demo cannot drift from the platform.
 *
 *   npm run demo:data    regenerate the frozen register from data/complaints.json
 *   npm run demo:build   assemble dist-demo/
 */
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist-demo');

/** published path -> source file */
const FILES = {
  'index.html': 'demo/index.html',
  'css/app.css': 'web/css/app.css',

  'js/app.js': 'web/js/app.js',
  'js/util.js': 'web/js/util.js',
  'js/ui.js': 'web/js/ui.js',
  'js/charts.js': 'web/js/charts.js',
  'js/state.js': 'web/js/state.js',
  'js/forms.js': 'web/js/forms.js',
  'js/router.js': 'web/js/router.js',
  'js/views/dashboard.js': 'web/js/views/dashboard.js',
  'js/views/register.js': 'web/js/views/register.js',
  'js/views/theme.js': 'web/js/views/theme.js',

  // The server, running in the page.
  'js/server/api.js': 'server/api.js',
  'js/server/repository.js': 'server/repository.js',
  'js/server/reference.js': 'server/reference.js',
  'js/server/schemas.js': 'server/schemas.js',
  'js/server/validate.js': 'server/validate.js',

  // The only substitutions.
  'js/api.js': 'demo/api.js',
  'js/server/store.js': 'demo/store.js',
  'js/demo-chrome.js': 'demo/chrome.js',
  'js/demo-data.js': 'demo/demo-data.js',
};

function freezeRegister() {
  const source = join(ROOT, 'data', 'complaints.json');
  if (!existsSync(source)) {
    console.error('No register at data/complaints.json - run "npm run seed" first.');
    process.exitCode = 1;
    return false;
  }
  const data = JSON.parse(readFileSync(source, 'utf8'));
  delete data.savedAt;
  writeFileSync(join(ROOT, 'demo', 'demo-data.js'),
    '// Generated from the seeded register by `npm run demo:data`. Do not edit by hand.\n' +
    `export const DEMO_REGISTER = ${JSON.stringify(data)};\n`);
  console.log('Froze the seeded register into demo/demo-data.js');
  return true;
}

function build() {
  rmSync(DIST, { recursive: true, force: true });
  for (const [target, source] of Object.entries(FILES)) {
    const to = join(DIST, target);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(join(ROOT, source), to);
  }
  console.log(`Built the demo into dist-demo/ (${Object.keys(FILES).length} files).`);
  console.log('Preview it with any static server, e.g.  npx serve dist-demo');
}

if (process.argv.includes('--data')) freezeRegister();
else build();
