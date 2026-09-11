/**
 * Browser build of the store. Same surface as server/store.js, holding the
 * register in memory only - there is no file to persist to, and a reload is
 * meant to hand the next person a clean demo.
 *
 * Published in place of the Node store, so repository.js and api.js above it
 * run in the browser completely unchanged.
 */
import { DEMO_REGISTER } from '../demo-data.js';

export const TABLES = [
  'themes', 'observations', 'root_causes', 'actions', 'incidents', 'notes', 'activity',
];

const copy = (row) => ({ ...row });

export class Store {
  constructor(seed = null) {
    this.tables = Object.fromEntries(TABLES.map((name) => [name, []]));
    this.sequences = Object.fromEntries(TABLES.map((name) => [name, 0]));
    if (seed) this.loadFrom(seed);
  }

  loadFrom(seed) {
    for (const name of TABLES) {
      const rows = Array.isArray(seed[name]) ? seed[name].map(copy) : [];
      this.tables[name] = rows;
      this.sequences[name] = rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
    }
  }

  persist() { /* nothing to persist in the demo */ }

  batch(fn) { return fn(); }

  rows(table) {
    const rows = this.tables[table];
    if (!rows) throw new Error(`Unknown table: ${table}`);
    return rows;
  }

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
    return copy(row);
  }

  update(table, id, patch) {
    const numericId = Number(id);
    const row = this.rows(table).find((candidate) => candidate.id === numericId);
    if (!row) return null;
    const before = copy(row);
    Object.assign(row, patch);
    return { before, after: copy(row) };
  }

  remove(table, id) {
    const numericId = Number(id);
    const rows = this.rows(table);
    const index = rows.findIndex((row) => row.id === numericId);
    if (index === -1) return null;
    return rows.splice(index, 1)[0];
  }

  removeWhere(table, predicate) {
    const rows = this.rows(table);
    const removed = rows.filter(predicate);
    if (removed.length === 0) return removed;
    this.tables[table] = rows.filter((row) => !predicate(row));
    return removed;
  }

  close() { /* no-op */ }
}

let instance = null;

export function openDatabase() {
  return new Store(DEMO_REGISTER);
}

export function getDb() {
  if (!instance) instance = openDatabase();
  return instance;
}

export function closeDb() { instance = null; }

export const DEFAULT_DB_PATH = ':memory:';
