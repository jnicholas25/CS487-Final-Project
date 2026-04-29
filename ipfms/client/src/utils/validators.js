/** Basic email format check */
export function isEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

/** Password strength: min 8 chars, at least 1 letter + 1 digit */
export function isStrongPassword(val) {
  return val.length >= 8 && /[A-Za-z]/.test(val) && /\d/.test(val);
}

/** Non-empty string */
export function isRequired(val) {
  return val !== undefined && val !== null && String(val).trim().length > 0;
}

/** Positive number */
export function isPositive(val) {
  const n = parseFloat(val);
  return !isNaN(n) && n > 0;
}

/** Non-negative number */
export function isNonNegative(val) {
  const n = parseFloat(val);
  return !isNaN(n) && n >= 0;
}

/** ISO date string */
export function isDateString(val) {
  if (!val) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
}

/**
 * Validate a form values object against a rules map.
 * Rules map: { fieldName: (value) => errorString | null }
 * Returns an object of { fieldName: errorString } for all failing fields.
 */
export function validateForm(values, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const err = rule(values[field], values);
    if (err) errors[field] = err;
  }
  return errors;
}
