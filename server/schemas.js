import * as ref from './reference.js';

export const themeSchema = {
  title:               { type: 'string', required: true, maxLength: 200 },
  description:         { type: 'string', maxLength: 4000 },
  product:             { type: 'string', enum: ref.PRODUCTS, default: 'Unassigned' },
  channel:             { type: 'string', enum: ref.CHANNELS, default: 'Unassigned' },
  category:            { type: 'string', enum: ref.CATEGORIES, default: 'Unassigned' },
  severity:            { type: 'string', enum: ref.SEVERITIES, default: 'Medium' },
  status:              { type: 'string', enum: ref.THEME_STATUSES, default: 'New' },
  business_unit:       { type: 'string', maxLength: 120 },
  product_owner:       { type: 'string', maxLength: 120 },
  product_owner_email: { type: 'string', maxLength: 160 },
  complaint_manager:   { type: 'string', maxLength: 120 },
  first_reported_on:   { type: 'date', nullable: true },
  last_reported_on:    { type: 'date', nullable: true },
  target_close_date:   { type: 'date', nullable: true },
  regulatory_risk:     { type: 'boolean' },
  watchlist:           { type: 'boolean' },
};

export const observationSchema = {
  period_start:        { type: 'date', required: true },
  period_label:        { type: 'string', maxLength: 40 },
  complaint_count:     { type: 'integer', min: 0, max: 1_000_000, required: true },
  resolved_count:      { type: 'integer', min: 0, max: 1_000_000 },
  avg_resolution_days: { type: 'number', min: 0, max: 3650 },
  financial_impact:    { type: 'number', min: 0 },
  repeat_customers:    { type: 'integer', min: 0 },
  notes:               { type: 'string', maxLength: 2000 },
  recorded_by:         { type: 'string', maxLength: 120 },
};

export const rootCauseSchema = {
  title:            { type: 'string', required: true, maxLength: 200 },
  description:      { type: 'string', maxLength: 4000 },
  category:         { type: 'string', enum: ref.ROOT_CAUSE_CATEGORIES, default: 'Process' },
  confidence:       { type: 'string', enum: ref.ROOT_CAUSE_CONFIDENCE, default: 'Suspected' },
  contribution_pct: { type: 'integer', min: 0, max: 100 },
  status:           { type: 'string', enum: ref.ROOT_CAUSE_STATUSES, default: 'Open' },
  evidence:         { type: 'string', maxLength: 4000 },
  identified_by:    { type: 'string', maxLength: 120 },
  identified_on:    { type: 'date', nullable: true },
};

export const actionSchema = {
  title:         { type: 'string', required: true, maxLength: 200 },
  description:   { type: 'string', maxLength: 4000 },
  root_cause_id: { type: 'id', nullable: true },
  proposed_by:   { type: 'string', required: true, maxLength: 120 },
  proposer_role: { type: 'string', enum: ref.PROPOSER_ROLES, default: 'Product owner' },
  proposed_on:   { type: 'date', nullable: true },
  due_date:      { type: 'date', nullable: true },
  completed_on:  { type: 'date', nullable: true },
  priority:      { type: 'string', enum: ref.ACTION_PRIORITIES, default: 'Medium' },
  status:        { type: 'string', enum: ref.ACTION_STATUSES, default: 'Proposed' },
  effectiveness: { type: 'string', enum: ref.ACTION_EFFECTIVENESS, default: 'Not assessed' },
  notes:         { type: 'string', maxLength: 4000 },
};

export const incidentSchema = {
  incident_ref:       { type: 'string', maxLength: 60 },
  title:              { type: 'string', required: true, maxLength: 200 },
  description:        { type: 'string', maxLength: 4000 },
  severity:           { type: 'string', enum: ref.INCIDENT_SEVERITIES, default: 'P3' },
  status:             { type: 'string', enum: ref.INCIDENT_STATUSES, default: 'Resolved' },
  started_at:         { type: 'date', nullable: true },
  resolved_at:        { type: 'date', nullable: true },
  systems_affected:   { type: 'string', maxLength: 400 },
  customers_affected: { type: 'integer', min: 0 },
  postmortem_url:     { type: 'string', maxLength: 500 },
};

export const noteSchema = {
  note_type: { type: 'string', enum: ref.NOTE_TYPES, default: 'Observation' },
  body:      { type: 'string', required: true, maxLength: 8000 },
  author:    { type: 'string', required: true, maxLength: 120 },
};
