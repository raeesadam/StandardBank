import { state } from './state.js';
import { todayIso } from './util.js';
import { t, options } from './i18n.js';

const meta = () => state.meta || {};

export function themeFields() {
  const m = meta();
  return [
    { name: 'title', label: t('field.theme.title'), required: true, wide: true,
      placeholder: t('field.theme.titlePlaceholder'),
      hint: t('field.theme.titleHint') },
    { name: 'description', label: t('field.theme.description'), type: 'textarea', rows: 4, wide: true },
    { name: 'product', label: t('field.theme.product'), type: 'select', options: options(m.products) },
    { name: 'channel', label: t('field.theme.channel'), type: 'select', options: options(m.channels) },
    { name: 'category', label: t('field.theme.category'), type: 'select', options: options(m.categories) },
    { name: 'severity', label: t('field.theme.severity'), type: 'select', options: options(m.severities) },
    { name: 'status', label: t('field.theme.status'), type: 'select', options: options(m.themeStatuses) },
    { name: 'business_unit', label: t('field.theme.unit') },
    { name: 'product_owner', label: t('field.theme.owner') },
    { name: 'product_owner_email', label: t('field.theme.ownerEmail'), type: 'email' },
    { name: 'complaint_manager', label: t('field.theme.manager'), default: state.actor },
    { name: 'first_reported_on', label: t('field.theme.first'), type: 'date', nullable: true },
    { name: 'last_reported_on', label: t('field.theme.last'), type: 'date', nullable: true },
    { name: 'target_close_date', label: t('field.theme.target'), type: 'date', nullable: true },
    { name: 'regulatory_risk', label: t('field.theme.regulatory'), type: 'checkbox' },
    { name: 'watchlist', label: t('field.theme.watchlist'), type: 'checkbox' },
  ];
}

export function observationFields() {
  return [
    { name: 'period_start', label: t('field.obs.periodStart'), type: 'date', required: true,
      default: monthStart(), hint: t('field.obs.periodStartHint') },
    { name: 'period_label', label: t('field.obs.periodLabel'),
      placeholder: t('field.obs.periodLabelPlaceholder'), hint: t('field.obs.periodLabelHint') },
    { name: 'complaint_count', label: t('field.obs.received'), type: 'number', min: 0, required: true },
    { name: 'resolved_count', label: t('field.obs.resolved'), type: 'number', min: 0 },
    { name: 'avg_resolution_days', label: t('field.obs.avgDays'), type: 'number', min: 0, step: '0.1' },
    { name: 'financial_impact', label: t('field.obs.money'), type: 'number', min: 0 },
    { name: 'repeat_customers', label: t('field.obs.repeat'), type: 'number', min: 0 },
    { name: 'recorded_by', label: t('field.obs.recordedBy'), default: state.actor },
    { name: 'notes', label: t('field.obs.notes'), type: 'textarea', wide: true },
  ];
}

export function rootCauseFields() {
  const m = meta();
  return [
    { name: 'title', label: t('field.cause.title'), required: true, wide: true,
      placeholder: t('field.cause.titlePlaceholder') },
    { name: 'description', label: t('field.cause.description'), type: 'textarea', rows: 3, wide: true },
    { name: 'category', label: t('field.cause.category'), type: 'select', options: options(m.rootCauseCategories) },
    { name: 'confidence', label: t('field.cause.confidence'), type: 'select', options: options(m.rootCauseConfidence) },
    { name: 'status', label: t('field.cause.status'), type: 'select', options: options(m.rootCauseStatuses) },
    { name: 'contribution_pct', label: t('field.cause.share'), type: 'number', min: 0, max: 100 },
    { name: 'identified_by', label: t('field.cause.identifiedBy'), default: state.actor },
    { name: 'identified_on', label: t('field.cause.identifiedOn'), type: 'date', nullable: true, default: todayIso() },
    { name: 'evidence', label: t('field.cause.evidence'), type: 'textarea', rows: 2, wide: true,
      hint: t('field.cause.evidenceHint') },
  ];
}

export function actionFields(rootCauses = []) {
  const m = meta();
  return [
    { name: 'title', label: t('field.action.title'), required: true, wide: true },
    { name: 'description', label: t('field.action.description'), type: 'textarea', rows: 3, wide: true },
    { name: 'root_cause_id', label: t('field.action.cause'), type: 'select', allowEmpty: true,
      emptyLabel: t('field.action.causeEmpty'), nullable: true,
      options: rootCauses.map((rc) => ({ value: rc.id, label: rc.title })) },
    { name: 'proposed_by', label: t('field.action.proposedBy'), required: true, default: state.actor },
    { name: 'proposer_role', label: t('field.action.role'), type: 'select', options: options(m.proposerRoles) },
    { name: 'proposed_on', label: t('field.action.proposedOn'), type: 'date', nullable: true, default: todayIso() },
    { name: 'due_date', label: t('field.action.due'), type: 'date', nullable: true },
    { name: 'priority', label: t('field.action.priority'), type: 'select', options: options(m.actionPriorities) },
    { name: 'status', label: t('field.action.status'), type: 'select', options: options(m.actionStatuses) },
    { name: 'completed_on', label: t('field.action.completedOn'), type: 'date', nullable: true },
    { name: 'effectiveness', label: t('field.action.effectiveness'), type: 'select',
      options: options(m.actionEffectiveness), hint: t('field.action.effectivenessHint') },
    { name: 'notes', label: t('field.action.notes'), type: 'textarea', rows: 2, wide: true },
  ];
}

export function incidentFields() {
  const m = meta();
  return [
    { name: 'incident_ref', label: t('field.incident.ref'), placeholder: t('field.incident.refPlaceholder') },
    { name: 'title', label: t('field.incident.title'), required: true },
    { name: 'description', label: t('field.incident.description'), type: 'textarea', rows: 3, wide: true },
    { name: 'severity', label: t('field.incident.severity'), type: 'select', options: options(m.incidentSeverities) },
    { name: 'status', label: t('field.incident.status'), type: 'select', options: options(m.incidentStatuses) },
    { name: 'started_at', label: t('field.incident.started'), type: 'date', nullable: true },
    { name: 'resolved_at', label: t('field.incident.resolved'), type: 'date', nullable: true },
    { name: 'customers_affected', label: t('field.incident.customers'), type: 'number', min: 0 },
    { name: 'systems_affected', label: t('field.incident.systems'), wide: true,
      placeholder: t('field.incident.systemsPlaceholder') },
    { name: 'postmortem_url', label: t('field.incident.postmortem'), type: 'url', wide: true },
  ];
}

export function noteFields() {
  const m = meta();
  return [
    { name: 'note_type', label: t('field.note.type'), type: 'select', options: options(m.noteTypes) },
    { name: 'author', label: t('field.note.author'), required: true, default: state.actor },
    { name: 'body', label: t('field.note.body'), type: 'textarea', rows: 5, required: true, wide: true },
  ];
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
