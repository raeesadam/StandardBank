/**
 * A very small test harness.
 *
 * Node's own test runner would do this, but its API changed across the versions
 * this platform supports - Node 16.17 has `test` and `describe` but no `before`
 * or `after` - and the platform's whole point is running wherever it is put.
 * A short runner buys identical behaviour on Node 16, 18, 20 and 22, with
 * nothing to install and no escape codes to confuse a Windows terminal.
 */
const root = { name: null, tests: [], before: [], after: [] };
const suites = [];
let current = root;

export function describe(name, fn) {
  const suite = { name, tests: [], before: [], after: [] };
  suites.push(suite);
  const parent = current;
  current = suite;
  try {
    fn();
  } finally {
    current = parent;
  }
}

export function test(name, fn) {
  current.tests.push({ name, fn });
}

export const it = test;
export function before(fn) { current.before.push(fn); }
export function after(fn) { current.after.push(fn); }

async function runHooks(hooks, label) {
  for (const hook of hooks) {
    try {
      await hook();
    } catch (error) {
      console.error(`\n  ${label} hook failed: ${error.message}`);
      throw error;
    }
  }
}

async function runSuite(suite, results) {
  if (suite.name) console.log(`\n${suite.name}`);
  await runHooks(suite.before, 'before');

  for (const { name, fn } of suite.tests) {
    const started = Date.now();
    try {
      await fn();
      results.passed += 1;
      console.log(`  ok    ${name}  (${Date.now() - started}ms)`);
    } catch (error) {
      results.failed += 1;
      results.failures.push({ suite: suite.name, name, error });
      console.log(`  FAIL  ${name}`);
      console.log(`        ${String(error.message).split('\n').join('\n        ')}`);
    }
  }

  await runHooks(suite.after, 'after');
}

export async function run() {
  const results = { passed: 0, failed: 0, failures: [] };
  const started = Date.now();

  await runHooks(root.before, 'before');
  for (const suite of suites) await runSuite(suite, results);
  if (root.tests.length > 0) await runSuite(root, results);
  await runHooks(root.after, 'after');

  const total = results.passed + results.failed;
  const duration = Date.now() - started;
  console.log(`\n${'-'.repeat(52)}`);
  if (results.failed === 0) {
    console.log(`${total} tests, all passed  (${duration}ms)`);
  } else {
    console.log(`${results.failed} of ${total} tests failed  (${duration}ms)`);
    for (const failure of results.failures) {
      console.log(`  - ${failure.suite ? `${failure.suite} / ` : ''}${failure.name}`);
    }
    process.exitCode = 1;
  }
  console.log(`Node ${process.versions.node}\n`);
}
