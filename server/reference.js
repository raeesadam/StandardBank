// Controlled vocabularies. The API validates against these and the UI builds its
// dropdowns from them, so adding a value here is enough to make it selectable.

export const PRODUCTS = [
  'Personal Current Account', 'Savings & Investments', 'Credit Card', 'Personal Loans',
  'Home Loans', 'Vehicle & Asset Finance', 'Business Banking', 'Digital Banking',
  'Insurance', 'Foreign Exchange', 'Unassigned',
];

export const CHANNELS = [
  'Mobile App', 'Internet Banking', 'Branch', 'Call Centre', 'ATM', 'USSD',
  'Email', 'Social Media', 'Regulator / Ombud', 'Unassigned',
];

export const CATEGORIES = [
  'Fees & Charges', 'Fraud & Disputes', 'Service & Turnaround', 'System Availability',
  'Payments & Transfers', 'Account Access', 'Credit Decisioning', 'Statements & Reporting',
  'Debit Orders', 'Card Delivery', 'Staff Conduct', 'Data & Privacy', 'Unassigned',
];

export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

export const THEME_STATUSES = [
  'New', 'Under investigation', 'Action plan agreed', 'Remediation in progress',
  'Monitoring', 'Resolved', 'Reopened',
];

export const ROOT_CAUSE_CATEGORIES = [
  'Process', 'System / Technology', 'People & Training', 'Third party / Vendor',
  'Policy & Product design', 'Data quality', 'Customer communication', 'Regulatory change',
];

export const ROOT_CAUSE_CONFIDENCE = ['Suspected', 'Under analysis', 'Confirmed', 'Ruled out'];

export const ROOT_CAUSE_STATUSES = ['Open', 'Being addressed', 'Addressed', 'Accepted risk'];

export const ACTION_STATUSES = [
  'Proposed', 'Approved', 'In progress', 'Blocked', 'Completed', 'Deferred', 'Rejected',
];

export const ACTION_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const ACTION_EFFECTIVENESS = [
  'Not assessed', 'Too early to tell', 'Effective', 'Partially effective', 'Ineffective',
];

export const PROPOSER_ROLES = [
  'Product owner', 'Complaint manager', 'Operations lead', 'Compliance', 'Technology lead', 'Executive',
];

export const INCIDENT_SEVERITIES = ['P1', 'P2', 'P3', 'P4'];

export const INCIDENT_STATUSES = ['Open', 'Mitigated', 'Resolved', 'Closed'];

export const NOTE_TYPES = [
  'Observation', 'Customer feedback', 'Meeting note', 'Escalation', 'Regulatory', 'Decision',
];

// Statuses that mean the theme is no longer consuming attention.
export const CLOSED_THEME_STATUSES = new Set(['Resolved']);
export const OPEN_ACTION_STATUSES = new Set(['Proposed', 'Approved', 'In progress', 'Blocked']);
export const OPEN_INCIDENT_STATUSES = new Set(['Open', 'Mitigated']);

export const REFERENCE = {
  products: PRODUCTS,
  channels: CHANNELS,
  categories: CATEGORIES,
  severities: SEVERITIES,
  themeStatuses: THEME_STATUSES,
  rootCauseCategories: ROOT_CAUSE_CATEGORIES,
  rootCauseConfidence: ROOT_CAUSE_CONFIDENCE,
  rootCauseStatuses: ROOT_CAUSE_STATUSES,
  actionStatuses: ACTION_STATUSES,
  actionPriorities: ACTION_PRIORITIES,
  actionEffectiveness: ACTION_EFFECTIVENESS,
  proposerRoles: PROPOSER_ROLES,
  incidentSeverities: INCIDENT_SEVERITIES,
  incidentStatuses: INCIDENT_STATUSES,
  noteTypes: NOTE_TYPES,
};
