/** Dates are expressed relative to a fixed "today" so the demo always reads
 *  as a live register rather than one frozen at a build date. */
export const TODAY = new Date('2026-09-11T00:00:00Z');

export const dateBack = (months, day = 12) =>
  new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - months, day))
    .toISOString().slice(0, 10);

export const dateAhead = (months, day = 20) =>
  new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + months, day))
    .toISOString().slice(0, 10);
