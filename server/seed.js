/**
 * Loads a realistic demo dataset so the platform is explorable from the first run.
 *
 *   node server/seed.js            # only seeds when the database is empty
 *   node server/seed.js --force    # wipes and reloads
 */
import { existsSync, rmSync } from 'node:fs';
import { openDatabase, DEFAULT_DB_PATH } from './store.js';

const TODAY = new Date('2026-09-11T00:00:00Z');
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

function periods(count = PERIOD_COUNT) {
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - i, 1));
    out.push({
      start: d.toISOString().slice(0, 10),
      label: d.toLocaleString('en-ZA', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    });
  }
  return out;
}

/**
 * shape: start volume, end volume and a wobble factor. The series is
 * interpolated between the two so each theme has a readable trend.
 */
function buildObservations(seed, { from, to, wobble = 0.18, resolutionFrom, resolutionTo, impactPerComplaint, recorder }) {
  const rand = mulberry32(seed);
  const list = periods();
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

const dateBack = (months, day = 12) => {
  const d = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - months, day));
  return d.toISOString().slice(0, 10);
};
const dateAhead = (months, day = 20) => {
  const d = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + months, day));
  return d.toISOString().slice(0, 10);
};

const THEMES = [
  {
    theme: {
      reference: 'RC-2026-001',
      title: 'Duplicate debit order deductions after a failed first presentation',
      description: 'Where a debit order fails on first presentation, the re-presentment run is collecting the instruction a second time on the same day. Customers see two identical deductions and are pushed into unarranged overdraft. Volumes stepped up sharply after the March collections release.',
      product: 'Personal Current Account', channel: 'Internet Banking', category: 'Debit Orders',
      severity: 'Critical', status: 'Remediation in progress',
      business_unit: 'Personal & Private Banking', product_owner: 'Thandeka Mokoena',
      product_owner_email: 'thandeka.mokoena@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(17), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(2), regulatory_risk: 1, watchlist: 1,
    },
    obs: { seed: 101, from: 46, to: 188, wobble: 0.16, resolutionFrom: 9, resolutionTo: 14, impactPerComplaint: 640, recorder: 'Sipho Ndlovu' },
    rootCauses: [
      { title: 'Re-presentment job does not check the original collection status', description: 'The nightly re-presentment batch selects all instructions flagged "unpaid" without excluding those already successfully collected in the same cycle.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 65, status: 'Being addressed', evidence: 'Defect DEF-44219; reproduced in pre-prod on 3 consecutive cycles.', identified_by: 'Nomsa Dlamini', identified_on: dateBack(6, 4) },
      { title: 'Reversal SLA is manual and depends on branch escalation', description: 'Duplicate collections are only reversed once a consultant logs a request, so the customer carries the debit for up to 5 days.', category: 'Process', confidence: 'Confirmed', contribution_pct: 25, status: 'Open', evidence: 'Process walkthrough with Collections Ops, 14 cases sampled.', identified_by: 'Sipho Ndlovu', identified_on: dateBack(5, 19) },
      { title: 'Third-party sponsor file format change not regression tested', description: 'Sponsor bank changed the unpaid-reason code layout; mapping was assumed unchanged.', category: 'Third party / Vendor', confidence: 'Under analysis', contribution_pct: 10, status: 'Open', evidence: 'Sponsor change note CN-2211 received after go-live.', identified_by: 'Nomsa Dlamini', identified_on: dateBack(3, 8) },
    ],
    actions: [
      { title: 'Add a collected-status guard to the re-presentment batch', description: 'Exclude instructions with a successful collection in the current cycle before the file is built.', proposed_by: 'Thandeka Mokoena', proposer_role: 'Product owner', proposed_on: dateBack(6, 9), due_date: dateBack(1, 30), priority: 'Critical', status: 'In progress', effectiveness: 'Not assessed', notes: 'In system test; release train 26.9.', causeIndex: 0 },
      { title: 'Automate same-day reversal for confirmed duplicates', description: 'Auto-reverse where amount, mandate and date match an already-collected instruction, with customer SMS.', proposed_by: 'Thandeka Mokoena', proposer_role: 'Product owner', proposed_on: dateBack(5, 22), due_date: dateAhead(1), priority: 'High', status: 'Approved', effectiveness: 'Not assessed', notes: 'Funded from the collections remediation budget.', causeIndex: 1 },
      { title: 'Proactive goodwill credit for fees caused by duplicates', description: 'Identify unarranged overdraft fees traceable to a duplicate and credit without the customer asking.', proposed_by: 'Sipho Ndlovu', proposer_role: 'Complaint manager', proposed_on: dateBack(4, 3), due_date: dateBack(2, 28), completed_on: dateBack(2, 25), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'R1.42m credited across 2 211 accounts; repeat contacts on this theme fell the following month.', causeIndex: 1 },
      { title: 'Regression pack for sponsor file format changes', description: 'Add sponsor-file contract tests to the release gate so a layout change fails the build.', proposed_by: 'Lerato Khumalo', proposer_role: 'Technology lead', proposed_on: dateBack(3, 11), due_date: dateAhead(2), priority: 'Medium', status: 'Proposed', effectiveness: 'Not assessed', notes: 'Awaiting sizing from the payments platform squad.', causeIndex: 2 },
    ],
    incidents: [
      { incident_ref: 'INC-2026-0412', title: 'Collections re-presentment ran twice against the March cycle', description: 'A retry after an aborted batch re-submitted the full file. 18 400 accounts were double-debited overnight.', severity: 'P1', status: 'Closed', started_at: dateBack(6, 2), resolved_at: dateBack(6, 3), systems_affected: 'Collections Engine, Core Banking, Notification Service', customers_affected: 18400, postmortem_url: 'https://intranet.example.bank/pir/INC-2026-0412' },
      { incident_ref: 'INC-2026-0571', title: 'Reversal queue backlog after the automated credit run', description: 'Manual reversal queue exceeded 6 000 items; turnaround slipped to 7 days.', severity: 'P2', status: 'Resolved', started_at: dateBack(4, 8), resolved_at: dateBack(4, 15), systems_affected: 'Collections Ops workflow', customers_affected: 6100, postmortem_url: '' },
    ],
    notes: [
      { note_type: 'Regulatory', body: 'Ombud for Banking Services opened a systemic enquiry on 3 grouped cases. Response pack due within 30 days; Legal and Compliance briefed.', author: 'Sipho Ndlovu' },
      { note_type: 'Meeting note', body: 'Monthly complaints forum: product owner confirmed the batch fix is in system test. Forum agreed to keep this theme on the watchlist until two consecutive months of declining volume.', author: 'Sipho Ndlovu' },
      { note_type: 'Customer feedback', body: 'Recurring wording in customer letters: "the bank took my money twice and I had to phone four times". Tone of complaints is escalating even where the money is returned.', author: 'Ayanda Peters' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-002',
      title: 'Replacement cards not delivered within the 10 working day commitment',
      description: 'Replacement and renewal cards are arriving outside the promised 10 working days, most acutely in Eastern Cape and Limpopo. Customers are told at branch that the card has been "dispatched" when it is still at the personalisation bureau.',
      product: 'Credit Card', channel: 'Branch', category: 'Card Delivery',
      severity: 'High', status: 'Monitoring',
      business_unit: 'Card & Payments', product_owner: 'Rajesh Naidoo',
      product_owner_email: 'rajesh.naidoo@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(17), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(1), regulatory_risk: 0, watchlist: 1,
    },
    obs: { seed: 202, from: 134, to: 41, wobble: 0.14, resolutionFrom: 12, resolutionTo: 6, impactPerComplaint: 180, recorder: 'Ayanda Peters' },
    rootCauses: [
      { title: 'Courier coverage gaps in non-metro districts', description: 'The courier contract guarantees next-day delivery to metros only; outlying branches are served on a twice-weekly run.', category: 'Third party / Vendor', confidence: 'Confirmed', contribution_pct: 55, status: 'Addressed', evidence: 'Courier SLA schedule B; delivery scan data for 6 months.', identified_by: 'Rajesh Naidoo', identified_on: dateBack(12, 6) },
      { title: 'Card status shown to consultants is the bureau hand-off, not the courier scan', description: 'The branch screen flips to "dispatched" when the file reaches the bureau, so staff promise a date the courier has not committed to.', category: 'Customer communication', confidence: 'Confirmed', contribution_pct: 35, status: 'Addressed', evidence: 'Screen walkthrough with 9 consultants; 22 recorded calls reviewed.', identified_by: 'Ayanda Peters', identified_on: dateBack(11, 2) },
      { title: 'Peak renewal batches were not smoothed', description: 'Expiry clusters push 3x normal volume through the bureau in the first week of a month.', category: 'Process', confidence: 'Confirmed', contribution_pct: 10, status: 'Addressed', evidence: 'Bureau throughput analysis.', identified_by: 'Rajesh Naidoo', identified_on: dateBack(10, 17) },
    ],
    actions: [
      { title: 'Add a second courier for non-metro districts', description: 'Dual-source delivery so outlying branches get a daily run.', proposed_by: 'Rajesh Naidoo', proposer_role: 'Product owner', proposed_on: dateBack(12, 10), due_date: dateBack(8, 30), completed_on: dateBack(8, 22), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'Non-metro delivery time fell from 14 to 7 days within two months.', causeIndex: 0 },
      { title: 'Show the real courier tracking status in the branch and app', description: 'Surface the courier scan event rather than the bureau hand-off, with an SMS on dispatch.', proposed_by: 'Rajesh Naidoo', proposer_role: 'Product owner', proposed_on: dateBack(11, 5), due_date: dateBack(6, 28), completed_on: dateBack(6, 19), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: '"Where is my card" call volume dropped by roughly a third.', causeIndex: 1 },
      { title: 'Smooth renewal batches across the month', description: 'Spread expiry-driven reissues over four weekly runs.', proposed_by: 'Naledi Mahlangu', proposer_role: 'Operations lead', proposed_on: dateBack(10, 20), due_date: dateBack(7, 31), completed_on: dateBack(7, 29), priority: 'Medium', status: 'Completed', effectiveness: 'Partially effective', notes: 'Helped the bureau but month-start peaks still visible.', causeIndex: 2 },
      { title: 'Keep monthly monitoring until volumes hold below 45', description: 'Close the theme only after three consecutive months under the threshold.', proposed_by: 'Sipho Ndlovu', proposer_role: 'Complaint manager', proposed_on: dateBack(5, 6), due_date: dateAhead(1), priority: 'Low', status: 'In progress', effectiveness: 'Not assessed', notes: 'Two months under threshold so far.', causeIndex: null },
    ],
    incidents: [
      { incident_ref: 'INC-2025-3388', title: 'Personalisation bureau outage for 36 hours', description: 'Bureau printer failure halted all card production over a weekend, creating a 9 000 card backlog.', severity: 'P2', status: 'Closed', started_at: dateBack(13, 7), resolved_at: dateBack(13, 9), systems_affected: 'Card personalisation bureau', customers_affected: 9000, postmortem_url: 'https://intranet.example.bank/pir/INC-2025-3388' },
    ],
    notes: [
      { note_type: 'Decision', body: 'Complaints forum agreed to move this theme from "Remediation in progress" to "Monitoring". Trend is down 69% against the prior six months and both confirmed causes are addressed.', author: 'Sipho Ndlovu' },
      { note_type: 'Observation', body: 'Residual complaints are concentrated in three branches that are still using the old dispatch wording in their SMS templates. Raised with regional ops.', author: 'Ayanda Peters' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-003',
      title: 'App login fails after biometric re-enrolment on a new device',
      description: 'Customers who re-enrol biometrics on a replacement handset are locked out at the second authentication step and must call the contact centre for a manual reset. The fallback OTP screen loops without an error message.',
      product: 'Digital Banking', channel: 'Mobile App', category: 'Account Access',
      severity: 'High', status: 'Action plan agreed',
      business_unit: 'Digital & eCommerce', product_owner: 'Farhaan Ismail',
      product_owner_email: 'farhaan.ismail@example.bank', complaint_manager: 'Zanele Mthembu',
      first_reported_on: dateBack(11), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(3), regulatory_risk: 0, watchlist: 1,
    },
    obs: { seed: 303, from: 22, to: 96, wobble: 0.2, resolutionFrom: 3, resolutionTo: 5, impactPerComplaint: 90, recorder: 'Zanele Mthembu' },
    rootCauses: [
      { title: 'Device binding token is not invalidated when biometrics are re-enrolled', description: 'The old device key stays active, so the risk engine sees two competing bindings and fails the step-up silently.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 70, status: 'Being addressed', evidence: 'Auth service traces on 40 affected profiles.', identified_by: 'Farhaan Ismail', identified_on: dateBack(4, 15) },
      { title: 'Fallback screen has no error state', description: 'When step-up fails the app re-renders the OTP screen rather than explaining the failure or offering self-service reset.', category: 'Customer communication', confidence: 'Confirmed', contribution_pct: 30, status: 'Open', evidence: 'Usability review; 12 session recordings.', identified_by: 'Zanele Mthembu', identified_on: dateBack(3, 21) },
    ],
    actions: [
      { title: 'Invalidate stale device bindings on re-enrolment', description: 'Revoke previous device keys when a new biometric enrolment completes.', proposed_by: 'Farhaan Ismail', proposer_role: 'Product owner', proposed_on: dateBack(4, 18), due_date: dateAhead(1), priority: 'Critical', status: 'Approved', effectiveness: 'Not assessed', notes: 'Security review passed; scheduled for the 26.10 app release.', causeIndex: 0 },
      { title: 'Add a self-service unlock journey with a clear error state', description: 'Replace the silent loop with an explanation and an in-app reset path.', proposed_by: 'Farhaan Ismail', proposer_role: 'Product owner', proposed_on: dateBack(3, 25), due_date: dateAhead(2), priority: 'High', status: 'Proposed', effectiveness: 'Not assessed', notes: 'Design ready; awaiting prioritisation at the digital portfolio board.', causeIndex: 1 },
      { title: 'Interim contact centre script and fast-path reset', description: 'Give agents a one-step reset so customers are not transferred.', proposed_by: 'Zanele Mthembu', proposer_role: 'Complaint manager', proposed_on: dateBack(3, 2), due_date: dateBack(2, 14), completed_on: dateBack(2, 11), priority: 'Medium', status: 'Completed', effectiveness: 'Partially effective', notes: 'Handling time improved but the volume of calls did not drop.', causeIndex: 1 },
    ],
    incidents: [
      { incident_ref: 'INC-2026-0733', title: 'Authentication service degraded after risk-engine deploy', description: 'Step-up authentication latency rose above 8 seconds, timing out biometric enrolments.', severity: 'P2', status: 'Resolved', started_at: dateBack(3, 6), resolved_at: dateBack(3, 6), systems_affected: 'Auth Service, Risk Engine', customers_affected: 14200, postmortem_url: 'https://intranet.example.bank/pir/INC-2026-0733' },
    ],
    notes: [
      { note_type: 'Escalation', body: 'Trend is the sharpest on the register: up 118% against the previous six months. Escalated to the digital portfolio board to get the unlock journey funded this quarter rather than next.', author: 'Zanele Mthembu' },
      { note_type: 'Customer feedback', body: 'App store reviews mentioning "cannot log in after new phone" have tripled since April. Social listening picked up the same phrase.', author: 'Ayanda Peters' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-004',
      title: 'Unexpected monthly fees after the bundled pricing change',
      description: 'Customers migrated onto the new bundled pricing are being charged for transactions they believed were included. The pre-migration letter did not spell out which transactions fall outside the bundle.',
      product: 'Personal Current Account', channel: 'Call Centre', category: 'Fees & Charges',
      severity: 'High', status: 'Remediation in progress',
      business_unit: 'Personal & Private Banking', product_owner: 'Michelle van Wyk',
      product_owner_email: 'michelle.vanwyk@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(9), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(2), regulatory_risk: 1, watchlist: 0,
    },
    obs: { seed: 404, from: 58, to: 112, wobble: 0.17, resolutionFrom: 6, resolutionTo: 8, impactPerComplaint: 310, recorder: 'Sipho Ndlovu' },
    rootCauses: [
      { title: 'Migration letter omitted the out-of-bundle transaction list', description: 'The communication described the benefits of the bundle but not the exclusions, so customers formed a reasonable but wrong expectation.', category: 'Customer communication', confidence: 'Confirmed', contribution_pct: 50, status: 'Being addressed', evidence: 'Letter template PRC-114 reviewed against the pricing guide.', identified_by: 'Michelle van Wyk', identified_on: dateBack(7, 9) },
      { title: 'Fee narrative on the statement is not plain language', description: 'Statement lines read as internal fee codes, so customers cannot self-diagnose the charge.', category: 'Policy & Product design', confidence: 'Confirmed', contribution_pct: 30, status: 'Open', evidence: 'Plain-language review; 30 statements sampled.', identified_by: 'Ayanda Peters', identified_on: dateBack(6, 14) },
      { title: 'Some accounts migrated onto the wrong bundle tier', description: 'A mapping rule placed low-volume accounts on the mid tier.', category: 'Data quality', confidence: 'Confirmed', contribution_pct: 20, status: 'Addressed', evidence: 'Migration reconciliation: 4 780 accounts on the wrong tier.', identified_by: 'Michelle van Wyk', identified_on: dateBack(5, 3) },
    ],
    actions: [
      { title: 'Reissue the pricing communication with the exclusion list', description: 'Send a plain-language follow-up naming every out-of-bundle transaction type.', proposed_by: 'Michelle van Wyk', proposer_role: 'Product owner', proposed_on: dateBack(7, 12), due_date: dateBack(3, 30), completed_on: dateBack(3, 27), priority: 'High', status: 'Completed', effectiveness: 'Partially effective', notes: 'Complaint growth slowed but did not reverse.', causeIndex: 0 },
      { title: 'Rewrite statement fee narratives in plain language', description: 'Replace fee codes with customer-readable descriptions on statements and in the app.', proposed_by: 'Michelle van Wyk', proposer_role: 'Product owner', proposed_on: dateBack(6, 18), due_date: dateAhead(2), priority: 'High', status: 'In progress', effectiveness: 'Not assessed', notes: 'Statement platform change is the long pole.', causeIndex: 1 },
      { title: 'Correct mis-tiered accounts and refund the difference', description: 'Re-tier the 4 780 accounts and refund fees charged since migration.', proposed_by: 'Michelle van Wyk', proposer_role: 'Product owner', proposed_on: dateBack(5, 6), due_date: dateBack(4, 30), completed_on: dateBack(4, 28), priority: 'Critical', status: 'Completed', effectiveness: 'Effective', notes: 'R2.1m refunded; no repeat complaints from this cohort.', causeIndex: 2 },
      { title: 'Add a fee explainer to the app transaction detail', description: 'Tap a fee to see what it was for and whether the bundle covers it.', proposed_by: 'Farhaan Ismail', proposer_role: 'Product owner', proposed_on: dateBack(2, 9), due_date: dateAhead(3), priority: 'Medium', status: 'Blocked', effectiveness: 'Not assessed', notes: 'Blocked on the statement narrative work landing first.', causeIndex: 1 },
    ],
    incidents: [],
    notes: [
      { note_type: 'Regulatory', body: 'Two cases referred by the Ombud, both upheld on communication grounds rather than on the fee itself. Conduct risk has asked for the remediation plan by month end.', author: 'Sipho Ndlovu' },
      { note_type: 'Meeting note', body: 'Pricing committee confirmed no change to the bundle itself. The agreed position is that the fees are correct but were not adequately disclosed, so remediation focuses on communication and refunds for the mis-tiered cohort.', author: 'Michelle van Wyk' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-005',
      title: 'No proactive feedback on home loan application progress',
      description: 'Applicants hear nothing between submission and approval and have to chase for updates. Most complaints are about silence rather than the outcome.',
      product: 'Home Loans', channel: 'Call Centre', category: 'Service & Turnaround',
      severity: 'Medium', status: 'Remediation in progress',
      business_unit: 'Home Services', product_owner: 'Gugu Sithole',
      product_owner_email: 'gugu.sithole@example.bank', complaint_manager: 'Zanele Mthembu',
      first_reported_on: dateBack(16), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(4), regulatory_risk: 0, watchlist: 0,
    },
    obs: { seed: 505, from: 71, to: 64, wobble: 0.15, resolutionFrom: 11, resolutionTo: 9, impactPerComplaint: 120, recorder: 'Zanele Mthembu' },
    rootCauses: [
      { title: 'No status notification between submission and decision', description: 'The journey sends an acknowledgement and a decision, with nothing in the 5-15 days between.', category: 'Process', confidence: 'Confirmed', contribution_pct: 60, status: 'Being addressed', evidence: 'Journey map; notification event audit.', identified_by: 'Gugu Sithole', identified_on: dateBack(9, 11) },
      { title: 'Consultants cannot see the assessor queue position', description: 'Front-line staff can only say "it is with credit", which reads as a brush-off.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 25, status: 'Open', evidence: 'Contact centre screen audit.', identified_by: 'Zanele Mthembu', identified_on: dateBack(8, 5) },
      { title: 'Documents requested in sequence rather than up front', description: 'Each missing document restarts the clock and triggers another silent wait.', category: 'Process', confidence: 'Under analysis', contribution_pct: 15, status: 'Open', evidence: '35 applications sampled; average 2.4 document requests each.', identified_by: 'Gugu Sithole', identified_on: dateBack(4, 22) },
    ],
    actions: [
      { title: 'Milestone SMS and email at each stage change', description: 'Notify on receipt, valuation booked, assessment started and decision.', proposed_by: 'Gugu Sithole', proposer_role: 'Product owner', proposed_on: dateBack(9, 15), due_date: dateBack(1, 30), completed_on: dateBack(1, 26), priority: 'High', status: 'Completed', effectiveness: 'Too early to tell', notes: 'Live since last month; watching the next two monitoring periods.', causeIndex: 0 },
      { title: 'Expose queue position to contact centre consultants', description: 'Add assessor queue position and expected date to the servicing screen.', proposed_by: 'Gugu Sithole', proposer_role: 'Product owner', proposed_on: dateBack(8, 9), due_date: dateAhead(2), priority: 'Medium', status: 'In progress', effectiveness: 'Not assessed', notes: 'Integration with the credit workflow in build.', causeIndex: 1 },
      { title: 'Single up-front document checklist', description: 'Request every likely document at application instead of in sequence.', proposed_by: 'Gugu Sithole', proposer_role: 'Product owner', proposed_on: dateBack(4, 26), due_date: dateAhead(4), priority: 'Medium', status: 'Proposed', effectiveness: 'Not assessed', notes: 'Needs credit policy sign-off.', causeIndex: 2 },
    ],
    incidents: [],
    notes: [
      { note_type: 'Observation', body: 'Volumes are flat rather than falling. The milestone notifications only went live last month, so the next two monitoring periods will tell us whether the main action worked.', author: 'Zanele Mthembu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-006',
      title: 'Disputed card transactions taking longer than 45 days to resolve',
      description: 'Chargeback cases are exceeding the disclosed 45-day turnaround, with customers left out of pocket while the dispute runs. Cases involving international merchants are the worst affected.',
      product: 'Credit Card', channel: 'Call Centre', category: 'Fraud & Disputes',
      severity: 'Critical', status: 'Under investigation',
      business_unit: 'Card & Payments', product_owner: 'Rajesh Naidoo',
      product_owner_email: 'rajesh.naidoo@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(14), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(3), regulatory_risk: 1, watchlist: 1,
    },
    obs: { seed: 606, from: 63, to: 129, wobble: 0.18, resolutionFrom: 38, resolutionTo: 52, impactPerComplaint: 1450, recorder: 'Sipho Ndlovu' },
    rootCauses: [
      { title: 'Dispute case load per assessor has doubled', description: 'Headcount was set against pre-growth volumes; cases now queue for 11 days before a first review.', category: 'People & Training', confidence: 'Confirmed', contribution_pct: 45, status: 'Open', evidence: 'Workforce model vs actual intake, 12 months.', identified_by: 'Naledi Mahlangu', identified_on: dateBack(6, 7) },
      { title: 'Scheme representment responses handled manually', description: 'Every scheme message is re-keyed into the case system, adding 3-4 days per exchange.', category: 'Process', confidence: 'Confirmed', contribution_pct: 35, status: 'Open', evidence: 'Time-and-motion study on 60 cases.', identified_by: 'Rajesh Naidoo', identified_on: dateBack(5, 16) },
      { title: 'Provisional credit is not applied consistently', description: 'Whether the customer gets a temporary credit depends on the assessor, so similar cases are treated differently.', category: 'Policy & Product design', confidence: 'Confirmed', contribution_pct: 20, status: 'Open', evidence: '50-case consistency review; 19 divergences.', identified_by: 'Sipho Ndlovu', identified_on: dateBack(3, 19) },
    ],
    actions: [
      { title: 'Add 12 dispute assessors and cross-skill the fraud team', description: 'Bring first-review time back under 3 days.', proposed_by: 'Rajesh Naidoo', proposer_role: 'Product owner', proposed_on: dateBack(6, 12), due_date: dateAhead(1), priority: 'Critical', status: 'Approved', effectiveness: 'Not assessed', notes: 'Recruitment approved; 5 of 12 seats filled.', causeIndex: 0 },
      { title: 'Automate scheme representment ingestion', description: 'Consume scheme messages directly into the case system instead of re-keying.', proposed_by: 'Lerato Khumalo', proposer_role: 'Technology lead', proposed_on: dateBack(5, 20), due_date: dateAhead(3), priority: 'High', status: 'In progress', effectiveness: 'Not assessed', notes: 'Scheme sandbox connected; mapping in build.', causeIndex: 1 },
      { title: 'Mandatory provisional credit under a set threshold', description: 'Auto-credit disputes below the threshold within 2 days, pending investigation.', proposed_by: 'Rajesh Naidoo', proposer_role: 'Product owner', proposed_on: dateBack(3, 23), due_date: dateAhead(2), priority: 'High', status: 'Blocked', effectiveness: 'Not assessed', notes: 'Blocked pending credit-loss modelling from Risk.', causeIndex: 2 },
      { title: 'Weekly ageing report to the product owner and complaints forum', description: 'Publish cases over 30 days so ageing is visible before it breaches.', proposed_by: 'Sipho Ndlovu', proposer_role: 'Complaint manager', proposed_on: dateBack(4, 4), due_date: dateBack(3, 29), completed_on: dateBack(3, 26), priority: 'Medium', status: 'Completed', effectiveness: 'Partially effective', notes: 'Visibility improved; the queue itself is unchanged without capacity.', causeIndex: 0 },
    ],
    incidents: [
      { incident_ref: 'INC-2026-0899', title: 'Dispute case system unavailable for 2 days after a database migration', description: 'Case work stopped entirely; the backlog took three weeks to clear.', severity: 'P1', status: 'Closed', started_at: dateBack(5, 11), resolved_at: dateBack(5, 13), systems_affected: 'Disputes Case Management, Scheme Gateway', customers_affected: 7300, postmortem_url: 'https://intranet.example.bank/pir/INC-2026-0899' },
      { incident_ref: 'INC-2026-1024', title: 'Scheme gateway certificate expiry blocked outbound representments', description: 'Outbound scheme messages failed for 19 hours, silently ageing 1 200 cases.', severity: 'P2', status: 'Closed', started_at: dateBack(2, 17), resolved_at: dateBack(2, 18), systems_affected: 'Scheme Gateway', customers_affected: 1200, postmortem_url: '' },
    ],
    notes: [
      { note_type: 'Escalation', body: 'This theme carries the highest financial impact on the register and is the most likely source of a systemic finding. Both incidents above pushed volumes up in the month that followed, which is visible in the monitoring history.', author: 'Sipho Ndlovu' },
      { note_type: 'Decision', body: 'Forum decision: do not close the provisional-credit action as rejected. It stays Blocked until Risk delivers the loss model, and the blockage is reported to the executive committee monthly.', author: 'Sipho Ndlovu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-007',
      title: 'Instant payments failing at the daily cut-over window',
      description: 'Real-time payments submitted between 23:40 and 00:20 fail with a generic error but still reserve the funds, so customers see money leave without the beneficiary being paid.',
      product: 'Digital Banking', channel: 'Mobile App', category: 'Payments & Transfers',
      severity: 'High', status: 'Action plan agreed',
      business_unit: 'Digital & eCommerce', product_owner: 'Farhaan Ismail',
      product_owner_email: 'farhaan.ismail@example.bank', complaint_manager: 'Zanele Mthembu',
      first_reported_on: dateBack(8), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(2), regulatory_risk: 0, watchlist: 1,
    },
    obs: { seed: 707, from: 19, to: 57, wobble: 0.22, resolutionFrom: 4, resolutionTo: 6, impactPerComplaint: 260, recorder: 'Zanele Mthembu' },
    rootCauses: [
      { title: 'Funds reservation is not released when the cut-over rejects the payment', description: 'The reservation and the payment instruction are committed separately; a cut-over rejection rolls back only the instruction.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 75, status: 'Being addressed', evidence: 'Transaction traces across 3 cut-over windows.', identified_by: 'Lerato Khumalo', identified_on: dateBack(3, 13) },
      { title: 'Generic error message gives the customer nothing to act on', description: '"Payment could not be processed" does not say the money will return or when.', category: 'Customer communication', confidence: 'Confirmed', contribution_pct: 25, status: 'Open', evidence: 'Error catalogue review.', identified_by: 'Zanele Mthembu', identified_on: dateBack(2, 20) },
    ],
    actions: [
      { title: 'Make reservation and instruction a single atomic operation', description: 'Release the reservation in the same transaction that rejects the instruction.', proposed_by: 'Farhaan Ismail', proposer_role: 'Product owner', proposed_on: dateBack(3, 16), due_date: dateAhead(1), priority: 'Critical', status: 'In progress', effectiveness: 'Not assessed', notes: 'Fix built; awaiting a cut-over window to deploy.', causeIndex: 0 },
      { title: 'Block instant payment submissions during the cut-over window', description: 'Interim guard rail: show a clear "try again after 00:20" message instead of failing.', proposed_by: 'Farhaan Ismail', proposer_role: 'Product owner', proposed_on: dateBack(3, 16), due_date: dateBack(2, 28), completed_on: dateBack(2, 24), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'Cut failures during the window by about 80% while the real fix is built.', causeIndex: 0 },
      { title: 'Rewrite payment failure messages with next steps and timing', description: 'Say what happened, when the money returns and what to do next.', proposed_by: 'Zanele Mthembu', proposer_role: 'Complaint manager', proposed_on: dateBack(2, 24), due_date: dateAhead(2), priority: 'Medium', status: 'Approved', effectiveness: 'Not assessed', notes: 'Copy approved by Legal and Conduct.', causeIndex: 1 },
    ],
    incidents: [
      { incident_ref: 'INC-2026-0967', title: 'Extended cut-over after a core banking patch', description: 'The cut-over window ran 70 minutes instead of 40, widening the failure window.', severity: 'P2', status: 'Closed', started_at: dateBack(4, 2), resolved_at: dateBack(4, 2), systems_affected: 'Core Banking, Instant Payments Gateway', customers_affected: 2400, postmortem_url: 'https://intranet.example.bank/pir/INC-2026-0967' },
    ],
    notes: [
      { note_type: 'Observation', body: 'The interim guard rail is holding volumes down, but the underlying reservation defect is still open. If the deploy slips past the target date this theme should move back to Remediation in progress.', author: 'Zanele Mthembu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-008',
      title: 'ATM cash shortfalls not automatically reversed',
      description: 'Where an ATM dispenses less than the requested amount, the difference is only credited after the customer complains and the cash centre reconciles the device, typically 5-8 days later.',
      product: 'Personal Current Account', channel: 'ATM', category: 'System Availability',
      severity: 'Medium', status: 'Monitoring',
      business_unit: 'Channel Operations', product_owner: 'Naledi Mahlangu',
      product_owner_email: 'naledi.mahlangu@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(17), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(1), regulatory_risk: 0, watchlist: 0,
    },
    obs: { seed: 808, from: 88, to: 37, wobble: 0.16, resolutionFrom: 8, resolutionTo: 4, impactPerComplaint: 540, recorder: 'Ayanda Peters' },
    rootCauses: [
      { title: 'Reversal waits for the physical cash reconciliation', description: 'Credit is only raised once the cash centre counts the device, even where the dispense log is unambiguous.', category: 'Process', confidence: 'Confirmed', contribution_pct: 70, status: 'Addressed', evidence: 'Cash centre process review.', identified_by: 'Naledi Mahlangu', identified_on: dateBack(12, 4) },
      { title: 'Older device fleet reports partial dispenses inconsistently', description: 'Pre-2019 units log a partial dispense as a success, so no exception is raised.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 30, status: 'Being addressed', evidence: 'Device firmware audit across the fleet.', identified_by: 'Lerato Khumalo', identified_on: dateBack(10, 9) },
    ],
    actions: [
      { title: 'Auto-credit where the dispense log confirms a shortfall', description: 'Credit within 24 hours off the device log, and reconcile afterwards.', proposed_by: 'Naledi Mahlangu', proposer_role: 'Product owner', proposed_on: dateBack(12, 8), due_date: dateBack(6, 30), completed_on: dateBack(6, 24), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'Average resolution fell from 8 days to 4; complaint volume more than halved.', causeIndex: 0 },
      { title: 'Firmware upgrade for the pre-2019 device fleet', description: 'Roll out the firmware that raises a partial-dispense exception.', proposed_by: 'Lerato Khumalo', proposer_role: 'Technology lead', proposed_on: dateBack(10, 13), due_date: dateAhead(1), priority: 'Medium', status: 'In progress', effectiveness: 'Not assessed', notes: '61% of the fleet upgraded.', causeIndex: 1 },
    ],
    incidents: [
      { incident_ref: 'INC-2025-3901', title: 'Cash centre reconciliation backlog over the festive period', description: 'Reconciliation ran 11 days behind, delaying every shortfall credit.', severity: 'P3', status: 'Closed', started_at: dateBack(9, 27), resolved_at: dateBack(8, 9), systems_affected: 'Cash centre reconciliation', customers_affected: 3100, postmortem_url: '' },
    ],
    notes: [
      { note_type: 'Observation', body: 'Remaining complaints track almost exactly to branches still running un-upgraded devices. Expect this theme to be closable once the firmware rollout completes.', author: 'Ayanda Peters' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-009',
      title: 'Transactions missing from statements after the data platform migration',
      description: 'Statements generated after the migration are missing point-of-sale transactions from the migration weekend. Balances are correct but the statement does not reconcile, which affects customers who submit statements for credit applications.',
      product: 'Digital Banking', channel: 'Internet Banking', category: 'Statements & Reporting',
      severity: 'High', status: 'Reopened',
      business_unit: 'Data & Analytics', product_owner: 'Lerato Khumalo',
      product_owner_email: 'lerato.khumalo@example.bank', complaint_manager: 'Zanele Mthembu',
      first_reported_on: dateBack(7), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(2), regulatory_risk: 1, watchlist: 1,
    },
    obs: { seed: 909, from: 31, to: 44, wobble: 0.3, resolutionFrom: 7, resolutionTo: 10, impactPerComplaint: 210, recorder: 'Zanele Mthembu' },
    rootCauses: [
      { title: 'Migration cut-over dropped in-flight point-of-sale records', description: 'Records written during the switch-over window landed in neither the old nor the new store.', category: 'Data quality', confidence: 'Confirmed', contribution_pct: 80, status: 'Being addressed', evidence: 'Reconciliation found 214 000 orphaned records.', identified_by: 'Lerato Khumalo', identified_on: dateBack(6, 21) },
      { title: 'No reconciliation gate before statements were released', description: 'Statements were generated from the new store without a count check against the source.', category: 'Process', confidence: 'Confirmed', contribution_pct: 20, status: 'Open', evidence: 'Migration runbook has no reconciliation step.', identified_by: 'Zanele Mthembu', identified_on: dateBack(5, 8) },
    ],
    actions: [
      { title: 'Backfill the orphaned records and reissue affected statements', description: 'Recover from the source system, load, then regenerate and reissue statements.', proposed_by: 'Lerato Khumalo', proposer_role: 'Product owner', proposed_on: dateBack(6, 24), due_date: dateBack(3, 31), completed_on: dateBack(3, 28), priority: 'Critical', status: 'Completed', effectiveness: 'Partially effective', notes: 'First backfill missed February records, which is why the theme was reopened.', causeIndex: 0 },
      { title: 'Second backfill pass covering February', description: 'Re-run the recovery for the period the first pass missed.', proposed_by: 'Lerato Khumalo', proposer_role: 'Product owner', proposed_on: dateBack(1, 12), due_date: dateAhead(1), priority: 'Critical', status: 'In progress', effectiveness: 'Not assessed', notes: 'Scoped after the reopen; reconciliation counts agreed with Finance.', causeIndex: 0 },
      { title: 'Add a mandatory reconciliation gate to the migration runbook', description: 'No statement release without a source-to-target count and value match.', proposed_by: 'Lerato Khumalo', proposer_role: 'Product owner', proposed_on: dateBack(5, 12), due_date: dateAhead(2), priority: 'High', status: 'Approved', effectiveness: 'Not assessed', notes: 'Change management have agreed to make this a release gate.', causeIndex: 1 },
    ],
    incidents: [
      { incident_ref: 'INC-2026-0810', title: 'Data platform migration cut-over overran', description: 'The migration window overran by 5 hours with dual-write disabled, dropping in-flight records.', severity: 'P1', status: 'Closed', started_at: dateBack(7, 15), resolved_at: dateBack(7, 16), systems_affected: 'Data Platform, Statement Generation', customers_affected: 214000, postmortem_url: 'https://intranet.example.bank/pir/INC-2026-0810' },
    ],
    notes: [
      { note_type: 'Decision', body: 'Theme reopened last month. The first backfill was signed off as complete but did not cover February, and complaints resumed within two weeks. Closure now requires a Finance-signed reconciliation, not just the action being marked complete.', author: 'Zanele Mthembu' },
      { note_type: 'Regulatory', body: 'Statement accuracy is a reportable data-integrity matter. Compliance notified; a formal report is required if the second backfill does not reconcile.', author: 'Sipho Ndlovu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-010',
      title: 'Vehicle finance settlement quotes taking more than 5 working days',
      description: 'Customers settling or refinancing a vehicle wait over a week for a settlement quote, and the quote often expires before they can act on it.',
      product: 'Vehicle & Asset Finance', channel: 'Call Centre', category: 'Service & Turnaround',
      severity: 'Medium', status: 'Under investigation',
      business_unit: 'Vehicle & Asset Finance', product_owner: 'Pieter Coetzee',
      product_owner_email: 'pieter.coetzee@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(10), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(4), regulatory_risk: 0, watchlist: 0,
    },
    obs: { seed: 1010, from: 27, to: 49, wobble: 0.19, resolutionFrom: 6, resolutionTo: 7, impactPerComplaint: 95, recorder: 'Ayanda Peters' },
    rootCauses: [
      { title: 'Settlement quotes are produced manually by a single team', description: 'Every quote is calculated by hand against the amortisation schedule, capped at roughly 60 a day.', category: 'Process', confidence: 'Confirmed', contribution_pct: 60, status: 'Open', evidence: 'Throughput data; queue depth over 6 months.', identified_by: 'Pieter Coetzee', identified_on: dateBack(4, 9) },
      { title: 'Quote validity is 5 days from calculation, not from issue', description: 'By the time the customer receives the quote, much of its validity has expired.', category: 'Policy & Product design', confidence: 'Confirmed', contribution_pct: 40, status: 'Open', evidence: 'Policy VAF-22; 40 quotes sampled, average 3.1 days of validity left on receipt.', identified_by: 'Sipho Ndlovu', identified_on: dateBack(3, 14) },
    ],
    actions: [
      { title: 'Self-service settlement quote in the app and internet banking', description: 'Generate the quote from the amortisation schedule on demand.', proposed_by: 'Pieter Coetzee', proposer_role: 'Product owner', proposed_on: dateBack(4, 14), due_date: dateAhead(4), priority: 'High', status: 'Proposed', effectiveness: 'Not assessed', notes: 'Business case submitted; competing for the same delivery capacity as the disputes automation.', causeIndex: 0 },
      { title: 'Start quote validity from the issue date', description: 'Policy change so the customer gets the full 5 days.', proposed_by: 'Pieter Coetzee', proposer_role: 'Product owner', proposed_on: dateBack(3, 18), due_date: dateAhead(1), priority: 'Medium', status: 'Approved', effectiveness: 'Not assessed', notes: 'Credit policy sign-off obtained; system change is small.', causeIndex: 1 },
    ],
    incidents: [],
    notes: [
      { note_type: 'Observation', body: 'Low absolute volume but a steady climb, and the cause is a capacity constraint that will not fix itself. Worth keeping visible before it becomes a High.', author: 'Sipho Ndlovu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-011',
      title: 'Business banking customers asked for the same KYC documents repeatedly',
      description: 'Business customers are asked to resubmit KYC documents already provided, sometimes three or four times across different teams, and accounts are restricted while the requests are outstanding.',
      product: 'Business Banking', channel: 'Email', category: 'Data & Privacy',
      severity: 'High', status: 'Remediation in progress',
      business_unit: 'Business & Commercial Banking', product_owner: 'Anele Jacobs',
      product_owner_email: 'anele.jacobs@example.bank', complaint_manager: 'Zanele Mthembu',
      first_reported_on: dateBack(15), last_reported_on: dateBack(1, 28),
      target_close_date: dateAhead(3), regulatory_risk: 1, watchlist: 1,
    },
    obs: { seed: 1111, from: 52, to: 78, wobble: 0.17, resolutionFrom: 14, resolutionTo: 12, impactPerComplaint: 380, recorder: 'Zanele Mthembu' },
    rootCauses: [
      { title: 'No shared document store across onboarding, credit and compliance', description: 'Each team holds its own copy, so none can see that a document has already been supplied.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 55, status: 'Being addressed', evidence: 'Systems map; three separate document repositories in use.', identified_by: 'Anele Jacobs', identified_on: dateBack(8, 12) },
      { title: 'Refresh cycles are not coordinated between teams', description: 'Periodic KYC refresh runs per team on its own calendar, so the customer is asked repeatedly in the same quarter.', category: 'Process', confidence: 'Confirmed', contribution_pct: 30, status: 'Open', evidence: 'Refresh calendars compared across three teams.', identified_by: 'Zanele Mthembu', identified_on: dateBack(6, 26) },
      { title: 'Restriction applied before the customer is contacted', description: 'The account is restricted the day the request is raised rather than after a grace period.', category: 'Policy & Product design', confidence: 'Confirmed', contribution_pct: 15, status: 'Open', evidence: 'Restriction event log vs outbound contact log.', identified_by: 'Anele Jacobs', identified_on: dateBack(4, 11) },
    ],
    actions: [
      { title: 'Single KYC document vault across all three teams', description: 'One store of record, with every team reading from it before raising a request.', proposed_by: 'Anele Jacobs', proposer_role: 'Product owner', proposed_on: dateBack(8, 16), due_date: dateAhead(3), priority: 'Critical', status: 'In progress', effectiveness: 'Not assessed', notes: 'Phase 1 (onboarding + compliance) delivered; credit joins in phase 2.', causeIndex: 0 },
      { title: 'Coordinate refresh cycles on a single customer calendar', description: 'One refresh event per customer per cycle, covering every team’s requirements.', proposed_by: 'Anele Jacobs', proposer_role: 'Product owner', proposed_on: dateBack(6, 30), due_date: dateAhead(1), priority: 'High', status: 'Approved', effectiveness: 'Not assessed', notes: 'Operating model agreed with Compliance.', causeIndex: 1 },
      { title: 'Give a 10 working day grace period before restricting', description: 'Contact first, restrict only if the customer does not respond.', proposed_by: 'Zanele Mthembu', proposer_role: 'Complaint manager', proposed_on: dateBack(4, 15), due_date: dateBack(2, 27), completed_on: dateBack(2, 21), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'Complaints citing "account frozen without warning" dropped sharply.', causeIndex: 2 },
    ],
    incidents: [],
    notes: [
      { note_type: 'Customer feedback', body: 'A relationship manager escalated on behalf of five commercial clients who received the same request from two teams in one week. Used as the evidence pack for the coordinated refresh calendar.', author: 'Anele Jacobs' },
      { note_type: 'Meeting note', body: 'Phase 1 of the vault is live and the grace period is working, but volumes are still rising because credit is not yet on the vault. Forum agreed the theme stays in remediation until phase 2 lands.', author: 'Zanele Mthembu' },
    ],
  },
  {
    theme: {
      reference: 'RC-2026-012',
      title: 'Insurance claim feedback loops between assessor and call centre',
      description: 'Claimants are passed between the assessor and the contact centre, each saying the other holds the file. Complaints are about the runaround rather than the claim decision.',
      product: 'Insurance', channel: 'Call Centre', category: 'Service & Turnaround',
      severity: 'Medium', status: 'Resolved',
      business_unit: 'Insurance & Wealth', product_owner: 'Kirsten Botha',
      product_owner_email: 'kirsten.botha@example.bank', complaint_manager: 'Sipho Ndlovu',
      first_reported_on: dateBack(17), last_reported_on: dateBack(3, 28),
      target_close_date: dateBack(1), regulatory_risk: 0, watchlist: 0,
    },
    obs: { seed: 1212, from: 66, to: 9, wobble: 0.14, resolutionFrom: 13, resolutionTo: 5, impactPerComplaint: 150, recorder: 'Ayanda Peters' },
    rootCauses: [
      { title: 'No named owner on a claim once it leaves first line', description: 'Ownership passed implicitly, so neither party held accountability for the next contact.', category: 'Process', confidence: 'Confirmed', contribution_pct: 65, status: 'Addressed', evidence: 'Call recordings on 25 escalated claims.', identified_by: 'Kirsten Botha', identified_on: dateBack(14, 8) },
      { title: 'Assessor notes not visible to the contact centre', description: 'Agents could not see the latest assessment note, so they could not answer without a transfer.', category: 'System / Technology', confidence: 'Confirmed', contribution_pct: 35, status: 'Addressed', evidence: 'Screen audit; assessor notes held in a separate system.', identified_by: 'Kirsten Botha', identified_on: dateBack(13, 15) },
    ],
    actions: [
      { title: 'Named claim owner for the life of the claim', description: 'One accountable owner, named to the customer, from registration to settlement.', proposed_by: 'Kirsten Botha', proposer_role: 'Product owner', proposed_on: dateBack(14, 12), due_date: dateBack(9, 30), completed_on: dateBack(9, 25), priority: 'High', status: 'Completed', effectiveness: 'Effective', notes: 'Transfers per claim fell from 3.4 to 1.1.', causeIndex: 0 },
      { title: 'Surface assessor notes in the contact centre view', description: 'Read-only assessor notes on the agent desktop.', proposed_by: 'Kirsten Botha', proposer_role: 'Product owner', proposed_on: dateBack(13, 19), due_date: dateBack(7, 31), completed_on: dateBack(7, 26), priority: 'Medium', status: 'Completed', effectiveness: 'Effective', notes: 'First-contact resolution up 22 points on claim queries.', causeIndex: 1 },
      { title: 'Three-month post-implementation review before closing the theme', description: 'Confirm the improvement holds before the theme is resolved.', proposed_by: 'Sipho Ndlovu', proposer_role: 'Complaint manager', proposed_on: dateBack(6, 5), due_date: dateBack(2, 28), completed_on: dateBack(2, 26), priority: 'Low', status: 'Completed', effectiveness: 'Effective', notes: 'Volumes held below 12 a month for three consecutive periods; theme resolved.', causeIndex: null },
    ],
    incidents: [],
    notes: [
      { note_type: 'Decision', body: 'Theme resolved. Both root causes addressed and confirmed effective by the post-implementation review. Kept on the register as a worked example of a recurrent complaint closed on evidence rather than on elapsed time.', author: 'Sipho Ndlovu' },
    ],
  },
];

function seedDatabase(db) {
  db.batch(() => loadFixtures(db));
}

function loadFixtures(db) {
  const insert = (table, row) => db.insert(table, row).id;
  const stamp = (offsetDays = 0) =>
    new Date(TODAY.getTime() - offsetDays * 86400000).toISOString();

  let activityOffset = 200;
  const logged = (themeId, entityType, entityId, action, summary, actor, detail = []) => {
    activityOffset = Math.max(0, activityOffset - 1);
    insert('activity', {
      theme_id: themeId, entity_type: entityType, entity_id: entityId, action,
      summary, detail, actor, created_at: stamp(activityOffset),
    });
  };

  for (const entry of THEMES) {
    const themeId = insert('themes', {
      ...entry.theme,
      created_at: stamp(180),
      updated_at: stamp(3),
    });
    logged(themeId, 'theme', themeId, 'created',
      `Recurrent complaint ${entry.theme.reference} registered`, entry.theme.complaint_manager);

    const observations = buildObservations(entry.obs.seed, entry.obs);
    for (const obs of observations) {
      insert('observations', { ...obs, theme_id: themeId, created_at: stamp(30), updated_at: stamp(30) });
    }
    // Keep the theme's reported-on dates consistent with the monitoring history.
    db.update('themes', themeId, {
      first_reported_on: observations[0].period_start,
      last_reported_on: observations[observations.length - 1].period_start,
    });
    logged(themeId, 'observations', null, 'created',
      `${PERIOD_COUNT} months of monitoring data loaded`, entry.obs.recorder);

    const causeIds = entry.rootCauses.map((rc) => {
      const id = insert('root_causes', {
        ...rc, theme_id: themeId, created_at: stamp(60), updated_at: stamp(20),
      });
      logged(themeId, 'root_causes', id, 'created',
        `Root cause added - ${rc.title}`, rc.identified_by);
      return id;
    });

    for (const action of entry.actions) {
      const { causeIndex, ...rest } = action;
      const id = insert('actions', {
        ...rest,
        root_cause_id: causeIndex === null || causeIndex === undefined ? null : causeIds[causeIndex],
        theme_id: themeId, created_at: stamp(45), updated_at: stamp(10),
      });
      logged(themeId, 'actions', id, 'created',
        `Action proposed by ${action.proposed_by} - ${action.title}`, action.proposed_by);
      if (action.status === 'Completed') {
        logged(themeId, 'actions', id, 'updated',
          `Action "${action.title}" updated - Status: In progress → Completed`,
          action.proposed_by,
          [{ field: 'Status', from: 'In progress', to: 'Completed' },
           { field: 'Effectiveness', from: 'Not assessed', to: action.effectiveness }]);
      }
    }

    for (const incident of entry.incidents) {
      const id = insert('incidents', {
        ...incident, theme_id: themeId, created_at: stamp(50), updated_at: stamp(15),
      });
      logged(themeId, 'incidents', id, 'created',
        `Incident linked - ${incident.incident_ref} ${incident.title}`, entry.theme.complaint_manager);
    }

    entry.notes.forEach((note, index) => {
      const id = insert('notes', {
        ...note, theme_id: themeId,
        created_at: stamp(12 + index * 9), updated_at: stamp(12 + index * 9),
      });
      logged(themeId, 'notes', id, 'created', `${note.note_type} note added`, note.author);
    });
  }
}

function main() {
  const force = process.argv.includes('--force');
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

  seedDatabase(db);
  const counts = ['themes', 'observations', 'root_causes', 'actions', 'incidents', 'notes', 'activity']
    .map((table) => `${db.count(table)} ${table}`)
    .join(', ');
  console.log(`Seeded: ${counts}.`);
  console.log(`Saved to ${DEFAULT_DB_PATH}`);
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) main();

export { seedDatabase, THEMES };
