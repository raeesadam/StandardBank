import { state } from './state.js';
import { todayIso } from './util.js';

const meta = () => state.meta || {};

export function themeFields() {
  const m = meta();
  return [
    { name: 'title', label: 'Recurrent complaint', required: true, wide: true,
      placeholder: 'e.g. Duplicate debit order deductions after a failed presentation',
      hint: 'Describe the recurring issue, not a single customer case.' },
    { name: 'description', label: 'What customers are experiencing', type: 'textarea', rows: 4, wide: true },
    { name: 'product', label: 'Product', type: 'select', options: m.products || [] },
    { name: 'channel', label: 'Channel', type: 'select', options: m.channels || [] },
    { name: 'category', label: 'Complaint category', type: 'select', options: m.categories || [] },
    { name: 'severity', label: 'Severity', type: 'select', options: m.severities || [] },
    { name: 'status', label: 'Status', type: 'select', options: m.themeStatuses || [] },
    { name: 'business_unit', label: 'Business unit' },
    { name: 'product_owner', label: 'Product owner' },
    { name: 'product_owner_email', label: 'Product owner email', type: 'email' },
    { name: 'complaint_manager', label: 'Complaint manager', default: state.actor },
    { name: 'first_reported_on', label: 'First reported', type: 'date', nullable: true },
    { name: 'last_reported_on', label: 'Last reported', type: 'date', nullable: true },
    { name: 'target_close_date', label: 'Target close date', type: 'date', nullable: true },
    { name: 'regulatory_risk', label: 'Regulatory or ombud exposure', type: 'checkbox' },
    { name: 'watchlist', label: 'On the executive watchlist', type: 'checkbox' },
  ];
}

export function observationFields() {
  return [
    { name: 'period_start', label: 'Reporting period (first day)', type: 'date', required: true,
      default: monthStart(), hint: 'One entry per theme per period.' },
    { name: 'period_label', label: 'Period label', placeholder: 'e.g. Aug 2026',
      hint: 'Leave blank to derive from the date.' },
    { name: 'complaint_count', label: 'Complaints received', type: 'number', min: 0, required: true },
    { name: 'resolved_count', label: 'Complaints resolved', type: 'number', min: 0 },
    { name: 'avg_resolution_days', label: 'Average days to resolve', type: 'number', min: 0, step: '0.1' },
    { name: 'financial_impact', label: 'Refunds and goodwill (ZAR)', type: 'number', min: 0 },
    { name: 'repeat_customers', label: 'Repeat complainants', type: 'number', min: 0 },
    { name: 'recorded_by', label: 'Recorded by', default: state.actor },
    { name: 'notes', label: 'Notes for this period', type: 'textarea', wide: true },
  ];
}

export function rootCauseFields() {
  const m = meta();
  return [
    { name: 'title', label: 'Root cause', required: true, wide: true,
      placeholder: 'e.g. Re-presentment job does not check the original collection status' },
    { name: 'description', label: 'Explanation', type: 'textarea', rows: 3, wide: true },
    { name: 'category', label: 'Cause category', type: 'select', options: m.rootCauseCategories || [] },
    { name: 'confidence', label: 'Confidence', type: 'select', options: m.rootCauseConfidence || [] },
    { name: 'status', label: 'Status', type: 'select', options: m.rootCauseStatuses || [] },
    { name: 'contribution_pct', label: 'Share of complaints (%)', type: 'number', min: 0, max: 100 },
    { name: 'identified_by', label: 'Identified by', default: state.actor },
    { name: 'identified_on', label: 'Identified on', type: 'date', nullable: true, default: todayIso() },
    { name: 'evidence', label: 'Evidence', type: 'textarea', rows: 2, wide: true,
      hint: 'What makes this a cause rather than a theory - analysis, defect reference, sample size.' },
  ];
}

export function actionFields(rootCauses = []) {
  const m = meta();
  return [
    { name: 'title', label: 'Proposed action', required: true, wide: true },
    { name: 'description', label: 'What will be done', type: 'textarea', rows: 3, wide: true },
    { name: 'root_cause_id', label: 'Addresses root cause', type: 'select', allowEmpty: true,
      emptyLabel: '— not linked to a root cause —', nullable: true,
      options: rootCauses.map((rc) => ({ value: rc.id, label: rc.title })) },
    { name: 'proposed_by', label: 'Proposed by', required: true, default: state.actor },
    { name: 'proposer_role', label: 'Role', type: 'select', options: m.proposerRoles || [] },
    { name: 'proposed_on', label: 'Proposed on', type: 'date', nullable: true, default: todayIso() },
    { name: 'due_date', label: 'Due date', type: 'date', nullable: true },
    { name: 'priority', label: 'Priority', type: 'select', options: m.actionPriorities || [] },
    { name: 'status', label: 'Status', type: 'select', options: m.actionStatuses || [] },
    { name: 'completed_on', label: 'Completed on', type: 'date', nullable: true },
    { name: 'effectiveness', label: 'Effectiveness once live', type: 'select',
      options: m.actionEffectiveness || [],
      hint: 'Assess after the action has been live for a monitoring period.' },
    { name: 'notes', label: 'Progress notes', type: 'textarea', rows: 2, wide: true },
  ];
}

export function incidentFields() {
  const m = meta();
  return [
    { name: 'incident_ref', label: 'Incident reference', placeholder: 'e.g. INC-2026-0412' },
    { name: 'title', label: 'Incident', required: true },
    { name: 'description', label: 'What happened', type: 'textarea', rows: 3, wide: true },
    { name: 'severity', label: 'Severity', type: 'select', options: m.incidentSeverities || [] },
    { name: 'status', label: 'Status', type: 'select', options: m.incidentStatuses || [] },
    { name: 'started_at', label: 'Started', type: 'date', nullable: true },
    { name: 'resolved_at', label: 'Resolved', type: 'date', nullable: true },
    { name: 'customers_affected', label: 'Customers affected', type: 'number', min: 0 },
    { name: 'systems_affected', label: 'Systems affected', wide: true,
      placeholder: 'e.g. Collections Engine, Core Banking' },
    { name: 'postmortem_url', label: 'Post-incident review link', type: 'url', wide: true },
  ];
}

export function noteFields() {
  const m = meta();
  return [
    { name: 'note_type', label: 'Note type', type: 'select', options: m.noteTypes || [] },
    { name: 'author', label: 'Author', required: true, default: state.actor },
    { name: 'body', label: 'Note', type: 'textarea', rows: 5, required: true, wide: true },
  ];
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
