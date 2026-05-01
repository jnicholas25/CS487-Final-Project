/**
 * Static currency formatting utilities.
 *
 * Prefer `useCurrency()` from CurrencyContext inside React components — it
 * is reactive and will re-render when the user changes their currency in
 * Settings.  These helpers exist for non-component contexts (e.g. PDF export,
 * report generation) and accept an explicit currency override.
 */

function activeCurrency(override) {
  return override || localStorage.getItem('ipfms_currency') || 'USD';
}

/**
 * Format a number as a currency string.
 * e.g. fmtCurrency(1234.56)          → "$1,234.56"  (when currency = USD)
 *      fmtCurrency(1234.56, 'EUR')    → "1.234,56 €" (when locale = de-DE)
 */
export function fmtCurrency(amount, currencyOverride, opts = {}) {
  // Support old call-signature fmtCurrency(amount, optsObj)
  if (currencyOverride && typeof currencyOverride === 'object') {
    opts = currencyOverride;
    currencyOverride = undefined;
  }
  const currency = activeCurrency(currencyOverride);
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...opts,
    }).format(Math.abs(num));
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(num));
  }
}

/** Format with sign: positive = "+$X", negative = "-$X" */
export function fmtCurrencySigned(amount, currencyOverride) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const abs = fmtCurrency(Math.abs(num), currencyOverride);
  return num >= 0 ? `+${abs}` : `-${abs}`;
}

/** Format as compact: 1234 → "$1.2K", 1234567 → "$1.2M" */
export function fmtCurrencyCompact(amount, currencyOverride) {
  const currency = activeCurrency(currencyOverride);
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(num);
  }
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
