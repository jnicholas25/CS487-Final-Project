/**
 * Format a number as a USD currency string.
 * e.g. 1234.56 → "$1,234.56"
 */
export function fmtCurrency(amount, opts = {}) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(Math.abs(num));
}

/** Format with sign: positive = green "+$X", negative = red "-$X" */
export function fmtCurrencySigned(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const abs = fmtCurrency(Math.abs(num));
  return num >= 0 ? `+${abs}` : `-${abs}`;
}

/** Format as compact: 1234 → "$1.2K", 1234567 → "$1.2M" */
export function fmtCurrencyCompact(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}

/** Format a percentage: 0.1234 → "12.3%" */
export function fmtPct(value, decimals = 1) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return `${(num * 100).toFixed(decimals)}%`;
}

/** Format a percentage already in percent form: 12.34 → "12.3%" */
export function fmtPctRaw(value, decimals = 1) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return `${num.toFixed(decimals)}%`;
}
