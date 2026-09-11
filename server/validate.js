export class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.statusCode = 422;
    this.errors = errors;
  }
}

export class NotFoundError extends Error {
  constructor(what = 'Record') {
    super(`${what} not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Field-by-field validator/coercer driven by a small spec object.
 *
 * Each spec entry: { type, required, enum, min, max, maxLength, default }
 * `partial` mode (PATCH) only validates the keys actually present in `input`,
 * so a partial update never has to resend the whole record.
 */
export function coerce(input, spec, { partial = false } = {}) {
  const errors = {};
  const out = {};

  for (const [field, rule] of Object.entries(spec)) {
    const present = Object.prototype.hasOwnProperty.call(input, field);
    if (partial && !present) continue;

    let value = present ? input[field] : rule.default;

    if (value === undefined || value === null || value === '') {
      if (rule.required && !rule.nullable) {
        errors[field] = 'is required';
        continue;
      }
      out[field] = rule.nullable ? null : (rule.default ?? defaultFor(rule.type));
      continue;
    }

    switch (rule.type) {
      case 'string': {
        value = String(value).trim();
        if (rule.required && value === '') { errors[field] = 'is required'; continue; }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors[field] = `must be ${rule.maxLength} characters or fewer`; continue;
        }
        if (rule.enum && !rule.enum.includes(value)) {
          errors[field] = `must be one of: ${rule.enum.join(', ')}`; continue;
        }
        break;
      }
      case 'integer':
      case 'number': {
        const num = Number(value);
        if (!Number.isFinite(num)) { errors[field] = 'must be a number'; continue; }
        value = rule.type === 'integer' ? Math.round(num) : num;
        if (rule.min !== undefined && value < rule.min) { errors[field] = `must be at least ${rule.min}`; continue; }
        if (rule.max !== undefined && value > rule.max) { errors[field] = `must be at most ${rule.max}`; continue; }
        break;
      }
      case 'boolean': {
        value = value === true || value === 1 || value === 'true' || value === '1' ? 1 : 0;
        break;
      }
      case 'date': {
        value = String(value).trim().slice(0, 10);
        if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) {
          errors[field] = 'must be a date in YYYY-MM-DD format'; continue;
        }
        break;
      }
      case 'id': {
        const num = Number(value);
        if (!Number.isInteger(num) || num <= 0) { errors[field] = 'must be a valid id'; continue; }
        value = num;
        break;
      }
      default:
        throw new Error(`Unknown spec type: ${rule.type}`);
    }

    out[field] = value;
  }

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return out;
}

function defaultFor(type) {
  if (type === 'integer' || type === 'number' || type === 'boolean') return 0;
  if (type === 'date' || type === 'id') return null;
  return '';
}

/** Rejects a PATCH body that contains nothing the spec recognises. */
export function requireSomething(patch) {
  if (Object.keys(patch).length === 0) {
    throw new ValidationError({ _: 'no recognised fields to update' });
  }
  return patch;
}
