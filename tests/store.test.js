import { test, describe } from './support/harness.js';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../server/store.js';

function withTempStore(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'rcm-'));
  try {
    return fn(join(dir, 'register.json'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('store', () => {
  test('survives a restart - the register is on disk, not just in memory', () => {
    withTempStore((path) => {
      const first = openDatabase(path);
      const theme = first.insert('themes', { reference: 'RC-2026-001', title: 'Duplicate debits' });
      first.insert('observations', { theme_id: theme.id, period_start: '2026-08-01', complaint_count: 12 });
      assert.ok(existsSync(path), 'nothing was written to disk');

      const reopened = openDatabase(path);
      assert.equal(reopened.count('themes'), 1);
      assert.equal(reopened.get('themes', theme.id).title, 'Duplicate debits');
      assert.equal(reopened.find('observations', (row) => row.theme_id === theme.id).length, 1);
    });
  });

  test('ids keep counting up after a restart rather than colliding', () => {
    withTempStore((path) => {
      const first = openDatabase(path);
      first.insert('themes', { title: 'One' });
      first.insert('themes', { title: 'Two' });

      const reopened = openDatabase(path);
      const third = reopened.insert('themes', { title: 'Three' });
      assert.equal(third.id, 3);
      assert.equal(reopened.count('themes'), 3);
    });
  });

  test('update returns what changed, and delete removes only its own row', () => {
    withTempStore((path) => {
      const db = openDatabase(path);
      const kept = db.insert('themes', { title: 'Kept', severity: 'Low' });
      const doomed = db.insert('themes', { title: 'Doomed', severity: 'Low' });

      const { before, after } = db.update('themes', doomed.id, { severity: 'Critical' });
      assert.equal(before.severity, 'Low');
      assert.equal(after.severity, 'Critical');

      db.remove('themes', doomed.id);
      assert.equal(db.count('themes'), 1);
      assert.equal(db.get('themes', kept.id).title, 'Kept');
      assert.equal(db.get('themes', doomed.id), null);
    });
  });

  test('a stored record is a copy - callers cannot mutate the register by accident', () => {
    withTempStore((path) => {
      const db = openDatabase(path);
      const theme = db.insert('themes', { title: 'Original' });
      theme.title = 'Tampered by the insert result';
      assert.equal(db.get('themes', theme.id).title, 'Original');

      const fetched = db.get('themes', theme.id);
      fetched.title = 'Tampered by a read';
      assert.equal(db.get('themes', theme.id).title, 'Original');

      const [listed] = db.find('themes', () => true);
      listed.title = 'Tampered by a list';
      assert.equal(db.get('themes', theme.id).title, 'Original');
    });
  });

  test('a corrupt register file fails loudly with a usable message', () => {
    withTempStore((path) => {
      writeFileSync(path, '{ this is not json', 'utf8');
      assert.throws(() => openDatabase(path), /Could not read the register/);
    });
  });

  test('in-memory mode touches no files', () => {
    const db = openDatabase(':memory:');
    db.insert('themes', { title: 'Ephemeral' });
    assert.equal(db.count('themes'), 1);
  });
});
