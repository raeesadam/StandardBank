import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_DB_PATH = process.env.RCM_DB_PATH || resolve(ROOT, 'data', 'complaints.json');

export const TABLES = [
  'themes', 'observations', 'root_causes', 'actions', 'incidents', 'notes', 'activity',
];

/**
 * A small document store held in memory and persisted as one JSON file.
 *
 * The register is a few hundred records, so querying in JavaScript is both fast
 * enough and simpler to reason about than SQL - and it keeps the platform
 * running on any Node 18 or later with nothing to install. Swapping in a real
 * database means reimplementing this one module; nothing above it touches
 * storage directly.
 *
 * Writes go to a temporary file and are then renamed over the target, so an
 * interrupted save can never leave a half-written register behind.
 */
export class Store {
  constructor(path = DEFAULT_DB_PATH) {
    this.path = path;
    this.memoryOnly = path === ':memory:';
    this.tables = Object.fromEntries(TABLES.map((name) => [name, []]));
    this.sequences = Object.fromEntries(TABLES.map((name) => [name, 0]));
    this.suspended = false;
    this.load();
  }

  load() {
    if (this.memoryOnly || !existsSync(this.path)) return;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(this.path, 'utf8'));
    } catch (error) {
      throw new Error(
        `Could not read the register at ${this.path}: ${error.message}. ` +
        'Fix or remove the file, then run "npm run seed" to start again.'
      );
    }
    for (const name of TABLES) {
      const rows = Array.isArray(parsed[name]) ? parsed[name] : [];
      this.tables[name] = rows;
      this.sequences[name] = rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
    }
  }

  persist() {
    if (this.memoryOnly || this.suspended) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const payload = { version: 1, savedAt: new Date().toISOString() };
    for (const name of TABLES) payload[name] = this.tables[name];
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    renameSync(temp, this.path);
  }

  /** Batches a burst of writes into a single save - used by the seeder. */
  batch(fn) {
    this.suspended = true;
    try {
      return fn();
    } finally {
      this.suspended = false;
      this.persist();
    }
  }

  rows(table) {
    const rows = this.tables[table];
    if (!rows) throw new Error(`Unknown table: ${table}`);
    return rows;
  }

  /* Reads hand out copies. Callers can pass records straight into responses
   * and helpers without a stray mutation reaching the stored register. */

  all(table) { return this.rows(table).map(copy); }

  find(table, predicate) { return this.rows(table).filter(predicate).map(copy); }

  first(table, predicate) {
    const row = this.rows(table).find(predicate);
    return row ? copy(row) : null;
  }

  get(table, id) {
    const numericId = Number(id);
    const row = this.rows(table).find((candidate) => candidate.id === numericId);
    return row ? copy(row) : null;
  }

  count(table, predicate) {
    return predicate ? this.rows(table).filter(predicate).length : this.rows(table).length;
  }

  insert(table, data) {
    const id = (this.sequences[table] += 1);
    const row = { id, ...data };
    this.rows(table).push(row);
    this.persist();
    return { ...row };
  }

  update(table, id, patch) {
    const numericId = Number(id);
    const row = this.rows(table).find((candidate) => candidate.id === numericId);
    if (!row) return null;
    const before = { ...row };
    Object.assign(row, patch);
    this.persist();
    return { before, after: { ...row } };
  }

  remove(table, id) {
    const numericId = Number(id);
    const rows = this.rows(table);
    const index = rows.findIndex((row) => row.id === numericId);
    if (index === -1) return null;
    const [row] = rows.splice(index, 1);
    this.persist();
    return row;
  }

  removeWhere(table, predicate) {
    const rows = this.rows(table);
    const removed = rows.filter(predicate);
    if (removed.length === 0) return removed;
    this.tables[table] = rows.filter((row) => !predicate(row));
    this.persist();
    return removed;
  }

  close() { this.persist(); }
}

const copy = (row) => ({ ...row });

let instance = null;

export function openDatabase(path = DEFAULT_DB_PATH) {
  return new Store(path);
}

export function getDb() {
  if (!instance) instance = openDatabase();
  return instance;
}

export function closeDb() {
  if (instance) {
    instance.close();
    instance = null;
  }
}
