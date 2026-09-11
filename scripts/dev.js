/**
 * Starts the platform, restarting on file changes where Node supports it.
 *
 * `node --watch` arrived in Node 18.11. On anything older this falls back to a
 * plain start and says so, rather than failing with an unknown-flag error.
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(ROOT, 'server', 'index.js');

const [major, minor] = process.versions.node.split('.').map(Number);
const canWatch = major > 18 || (major === 18 && minor >= 11);

if (!canWatch) {
  console.log(`Node ${process.versions.node} has no --watch (added in 18.11).`);
  console.log('Starting normally - stop with Ctrl+C and run this again after you edit a file.\n');
}

const child = spawn(process.execPath, canWatch ? ['--watch', SERVER] : [SERVER], {
  stdio: 'inherit',
  cwd: ROOT,
});

child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
