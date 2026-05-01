import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

// Locale best-suited to each currency for number formatting
const LOCALE_MAP = {
  USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', CAD: 'en-CA',
  AUD: 'en-AU', JPY: 'ja-JP', INR: 'hi-IN', CHF: 'de-CH',
  CNY: 'zh-CN', MXN: 'es-MX',
};

const LS_KEY = 'ipfms_currency';

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const { user } = useAuth();

  const [currency, setCurrencyState] = useState(() => {
    // Priority: user object > localStorage > fallback USD
    return user?.currency || localStorage.getItem(LS_KEY) || 'USD';
  });

  // Sync whenever the logged-in user's preference changes (e.g. after Settings save)
  useEffect(() => {
    const incoming = user?.currency;
    if (incoming && incoming !== currency) {
      setCurrencyState(incoming);
      localStorage.setItem(LS_KEY, incoming);
    }
  }, [user?.currency]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Call this after saving in Settings to update the UI immediately */
  const updateCurrency = (c) => {
    setCurrencyState(c);
    localStorage.setItem(LS_KEY, c);
  };

  const locale = LOCALE_MAP[currency] || 'en-US';

  // ── Formatting helpers bound to current currency ──────────────────────

  /** Format as currency: 1234.56 → "$1,234.56" (or "€1.234,56", etc.) */
  const fmtCurrency = (amount, extraOpts = {}) => {
    const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...extraOpts,
      }).format(Math.abs(num));
    } catch {
      // Fallback if currency code is somehow invalid
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(num));
    }
  };

  /** Format with sign: positive → "+$1,234.56", negative → "-$1,234.56" */
  const fmtCurrencySigned = (amount) => {
    const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    const formatted = fmtCurrency(Math.abs(num));
    return num >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  /** Compact format: 1234 → "$1.2K", 1234567 → "$1.2M" */
  const fmtCurrencyCompact = (amount) => {
    const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(num);
    } catch {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(num);
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, updateCurrency, fmtCurrency, fmtCurrencySigned, fmtCurrencyCompact }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used inside <CurrencyProvider>');
  return ctx;
}

export default CurrencyContext;
