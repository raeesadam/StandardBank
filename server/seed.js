/**
 * Loads a realistic demo dataset so the platform is explorable from the first run.
 *
 *   node server/seed.js            # only seeds when the database is empty
 *   node server/seed.js --force    # wipes and reloads
 */
import { existsSync, rmSync } from 'node:fs';
import { openDatabase, DEFAULT_DB_PATH } from './store.js';
import { TODAY } from './fixtures/helpers.js';
import { THEMES as THEMES_PT } from './fixtures/pt.js';
import { THEMES as THEMES_EN } from './fixtures/en.js';

const FIXTURES = { pt: THEMES_PT, en: THEMES_EN };
const DEFAULT_FIXTURE_LANGUAGE = 'pt';
const PERIOD_COUNT = 18; // months of monitoring history

/* Deterministic noise so repeated seeds produce the same demo numbers. */
function mulberry32(seed) {
  return function rand() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERIOD_LOCALE = { pt: 'pt-PT', en: 'en-ZA' };

function periods(count = PERIOD_COUNT, language = DEFAULT_FIXTURE_LANGUAGE) {
  const locale = PERIOD_LOCALE[language] || PERIOD_LOCALE[DEFAULT_FIXTURE_LANGUAGE];
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - i, 1));
    out.push({
      start: d.toISOString().slice(0, 10),
      // Asking for month+year together gives a numeric format in pt-PT
      // ("04/2025"), which reads poorly on an axis - so compose it.
      label: `${d.toLocaleString(locale, { month: 'short', timeZone: 'UTC' }).replace(/\.$/, '')}`
        + ` ${d.getUTCFullYear()}`,
    });
  }
  return out;
}

/**
 * shape: start volume, end volume and a wobble factor. The series is
 * interpolated between the two so each theme has a readable trend.
 */
function buildObservations(seed, { from, to, wobble = 0.18, resolutionFrom, resolutionTo, impactPerComplaint, recorder }, language) {
  const rand = mulberry32(seed);
  const list = periods(PERIOD_COUNT, language);
  return list.map((period, index) => {
    const t = index / (list.length - 1);
    const base = from + (to - from) * t;
    const noise = 1 + (rand() - 0.5) * 2 * wobble;
    const complaints = Math.max(1, Math.round(base * noise));
    const resolved = Math.max(0, Math.round(complaints * (0.72 + rand() * 0.25)));
    const days = resolutionFrom + (resolutionTo - resolutionFrom) * t + (rand() - 0.5) * 2;
    return {
      period_start: period.start,
      period_label: period.label,
      complaint_count: complaints,
      resolved_count: Math.min(resolved, complaints),
      avg_resolution_days: Math.round(Math.max(0.5, days) * 10) / 10,
      financial_impact: Math.round(complaints * impactPerComplaint * (0.8 + rand() * 0.4)),
      repeat_customers: Math.round(complaints * (0.08 + rand() * 0.12)),
      notes: '',
      recorded_by: recorder,
    };
  });
}

/** `language` picks which fixture set to load - see server/fixtures/. */
function seedDatabase(db, language = DEFAULT_FIXTURE_LANGUAGE) {
  const themes = FIXTURES[language] || FIXTURES[DEFAULT_FIXTURE_LANGUAGE];
  db.batch(() => loadFixtures(db, themes, language));
}

function loadFixtures(db, THEMES, language) {
  const insert = (table, row) => db.insert(table, row).id;
  const stamp = (offsetDays = 0) =>
    new Date(TODAY.getTime() - offsetDays * 86400000).toISOString();

  let activityOffset = 200;
  const logged = (themeId, entityType, entityId, action, subject, actor, detail = []) => {
    activityOffset = Math.max(0, activityOffset - 1);
    insert('activity', {
      theme_id: themeId, entity_type: entityType, entity_id: entityId, action,
      subject, summary: '', detail, actor, created_at: stamp(activityOffset),
    });
  };

  for (const entry of THEMES) {
    const themeId = insert('themes', {
      ...entry.theme,
      created_at: stamp(180),
      updated_at: stamp(3),
    });
    logged(themeId, 'theme', themeId, 'created',
      entry.theme.reference, entry.theme.complaint_manager);

    const observations = buildObservations(entry.obs.seed, entry.obs, language);
    for (const obs of observations) {
      insert('observations', { ...obs, theme_id: themeId, created_at: stamp(30), updated_at: stamp(30) });
    }
    // Keep the theme's reported-on dates consistent with the monitoring history.
    db.update('themes', themeId, {
      first_reported_on: observations[0].period_start,
      last_reported_on: observations[observations.length - 1].period_start,
    });
    logged(themeId, 'observations', null, 'seeded',
      String(PERIOD_COUNT), entry.obs.recorder);

    const causeIds = entry.rootCauses.map((rc) => {
      const id = insert('root_causes', {
        ...rc, theme_id: themeId, created_at: stamp(60), updated_at: stamp(20),
      });
      logged(themeId, 'root_causes', id, 'created', rc.title, rc.identified_by);
      return id;
    });

    for (const action of entry.actions) {
      const { causeIndex, ...rest } = action;
      const id = insert('actions', {
        ...rest,
        root_cause_id: causeIndex === null || causeIndex === undefined ? null : causeIds[causeIndex],
        theme_id: themeId, created_at: stamp(45), updated_at: stamp(10),
      });
      logged(themeId, 'actions', id, 'created', action.title, action.proposed_by);
      if (action.status === 'Completed') {
        logged(themeId, 'actions', id, 'updated', action.title, action.proposed_by,
          [{ field: 'Status', from: 'In progress', to: 'Completed' },
           { field: 'Effectiveness', from: 'Not assessed', to: action.effectiveness }]);
      }
    }

    for (const incident of entry.incidents) {
      const id = insert('incidents', {
        ...incident, theme_id: themeId, created_at: stamp(50), updated_at: stamp(15),
      });
      logged(themeId, 'incidents', id, 'created',
        `${incident.incident_ref} ${incident.title}`.trim(), entry.theme.complaint_manager);
    }

    entry.notes.forEach((note, index) => {
      const id = insert('notes', {
        ...note, theme_id: themeId,
        created_at: stamp(12 + index * 9), updated_at: stamp(12 + index * 9),
      });
      logged(themeId, 'notes', id, 'created', note.note_type, note.author);
    });
  }
}

function main() {
  const force = process.argv.includes('--force');
  const langArg = process.argv.find((arg) => arg.startsWith('--lang='));
  const language = (langArg ? langArg.split('=')[1] : process.env.RCM_LANG) || DEFAULT_FIXTURE_LANGUAGE;
  if (!FIXTURES[language]) {
    console.error(`Unknown fixture language "${language}". Available: ${Object.keys(FIXTURES).join(', ')}.`);
    process.exitCode = 1;
    return;
  }
  if (force && existsSync(DEFAULT_DB_PATH)) {
    rmSync(DEFAULT_DB_PATH);
    console.log('Existing register removed.');
  }

  const db = openDatabase();
  const existing = db.count('themes');
  if (existing > 0) {
    console.log(`The register already holds ${existing} recurrent complaints. Use "npm run reset" to reload.`);
    return;
  }

  seedDatabase(db, language);
  const counts = ['themes', 'observations', 'root_causes', 'actions', 'incidents', 'notes', 'activity']
    .map((table) => `${db.count(table)} ${table}`)
    .join(', ');
  console.log(`Seeded (${language}): ${counts}.`);
  console.log(`Saved to ${DEFAULT_DB_PATH}`);
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) main();

export { seedDatabase, FIXTURES };
