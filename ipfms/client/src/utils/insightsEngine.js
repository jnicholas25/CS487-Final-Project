/**
 * insightsEngine.js
 *
 * Pure client-side analysis engine. Receives arrays of transactions and
 * budgets (already fetched from the API) and returns an array of Insight
 * objects — no network calls, no React, no side-effects.
 *
 * Insight shape:
 * {
 *   id:          string        – unique key
 *   type:        'anomaly' | 'budget' | 'income_expense' | 'trend'
 *   severity:    'info' | 'warning' | 'critical'
 *   title:       string        – short headline
 *   description: string        – natural-language sentence
 *   detail:      string        – supporting numbers / context
 *   confidence:  number        – 0–100
 *   icon:        string        – emoji
 *   category?:   string
 *   pctChange?:  number        – signed % change (for trends)
 *   data?:       object        – raw numbers surfaced in the UI
 * }
 */

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return 'YYYY-MM' string for a Date.
 * Uses UTC methods so that server-stored midnight-UTC dates are never
 * shifted backward by a local UTC+ timezone (e.g. IST = UTC+5:30).
 */
function toYM(date) {
  if (typeof date === 'string') return date.slice(0, 7);   // 'YYYY-MM-DD…' → 'YYYY-MM'
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Current month as 'YYYY-MM' (UTC) */
function currentYM() {
  return new Date().toISOString().slice(0, 7);
}

/** Month offset from today (UTC): -1 = last month, -2 = two months ago */
function offsetYM(offset) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n));
}

function pctStr(n) { return `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`; }

/**
 * Nicely capitalise a raw category key like 'food_dining' → 'Food & Dining'
 */
function niceCategory(cat) {
  if (!cat) return 'Other';
  return cat
    .replace(/_/g, ' & ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(' & Dining', ' & Dining')   // preserve ampersand styling
    .replace('&  ', '& ');
}

// ── 1. Spending Anomaly Detection ────────────────────────────────────────────

/**
 * Compare current-month category spending against 3-month average.
 * Flags if:  current > 1.8× average  AND  difference > $40
 */
function detectSpendingAnomalies(transactions) {
  const insights = [];
  const cur  = currentYM();
  const prev = [offsetYM(-1), offsetYM(-2), offsetYM(-3)];

  // Build spending maps  { 'YYYY-MM': { category: totalSpent } }
  const byMonthCat = {};
  for (const tx of transactions) {
    if (tx.type !== 'debit') continue;            // ignore income
    const ym  = toYM(tx.date);
    const cat = (tx.category || 'other').toLowerCase();
    if (!byMonthCat[ym]) byMonthCat[ym] = {};
    byMonthCat[ym][cat] = (byMonthCat[ym][cat] || 0) + Math.abs(tx.amount);
  }

  const curMonthData = byMonthCat[cur] || {};
  const categories   = Object.keys(curMonthData);

  for (const cat of categories) {
    const curSpend = curMonthData[cat] || 0;

    // Average across the 3 previous months (only months with data)
    const prevSpends = prev
      .map((ym) => byMonthCat[ym]?.[cat] || 0)
      .filter((v) => v > 0);

    if (prevSpends.length === 0) continue;   // no history → can't compare

    const avg  = prevSpends.reduce((a, b) => a + b, 0) / prevSpends.length;
    const ratio = avg > 0 ? curSpend / avg : 0;
    const diff  = curSpend - avg;

    if (ratio >= 1.8 && diff >= 40) {
      const multiplier = ratio.toFixed(1);
      const nice       = niceCategory(cat);
      const severity   = ratio >= 3 ? 'critical' : ratio >= 2.2 ? 'warning' : 'info';
      const confidence = Math.min(95, 60 + prevSpends.length * 10 + Math.min(20, diff / 20));

      insights.push({
        id:          `anomaly-${cat}`,
        type:        'anomaly',
        severity,
        icon:        '⚡',
        title:       `${nice} spend ${multiplier}× above normal`,
        description: `You've spent ${fmt(curSpend)} on ${nice} this month — `
                   + `${multiplier}× higher than your ${prevSpends.length}-month average of ${fmt(avg)}.`,
        detail:      `Difference: ${fmt(diff)} above typical. `
                   + `Previous months: ${prevSpends.map(fmt).join(', ')}.`,
        confidence:  Math.round(confidence),
        category:    cat,
        pctChange:   Math.round((ratio - 1) * 100),
        data:        { curSpend, avg, ratio, diff },
      });
    }
  }

  // Sort by severity then ratio
  const order = { critical: 0, warning: 1, info: 2 };
  return insights.sort((a, b) =>
    order[a.severity] - order[b.severity] || b.data.ratio - a.data.ratio
  );
}

// ── 2. Budget Warnings ───────────────────────────────────────────────────────

/**
 * For each budget, project end-of-period spending based on current burn rate
 * and warn if it will exceed the limit.
 */
function detectBudgetWarnings(budgets) {
  const insights = [];
  const today    = new Date();

  for (const budget of budgets) {
    const limit  = budget.totalLimit || budget.amount || 0;
    if (!limit) continue;

    // spent = sum of category spending within this budget
    const spent = budget.categories
      ? budget.categories.reduce((s, c) => s + (c.spent || 0), 0)
      : (budget.spent || 0);

    const pctUsed = limit > 0 ? (spent / limit) * 100 : 0;

    // Project end-of-period spend using days elapsed
    const start      = new Date(budget.startDate || today);
    const end        = new Date(budget.endDate   || today);
    const totalDays  = Math.max(1, (end - start) / 86400000);
    const elapsed    = Math.max(1, (today - start) / 86400000);
    const remaining  = Math.max(0, (end - today) / 86400000);
    const burnRate   = spent / elapsed;            // $ per day
    const projected  = spent + burnRate * remaining;
    const projPct    = limit > 0 ? (projected / limit) * 100 : 0;
    const name       = budget.name || 'Budget';

    // Already over budget
    if (pctUsed >= 100) {
      insights.push({
        id:          `budget-over-${budget._id}`,
        type:        'budget',
        severity:    'critical',
        icon:        '🚨',
        title:       `${name} budget exceeded`,
        description: `You've spent ${fmt(spent)} against a ${fmt(limit)} budget — `
                   + `${(pctUsed - 100).toFixed(0)}% over the limit.`,
        detail:      `${fmt(spent - limit)} over budget. Consider reviewing your spending in this category.`,
        confidence:  99,
        data:        { spent, limit, pctUsed, projected, projPct },
      });

    // Will exceed by month end at current rate
    } else if (projPct >= 90 && elapsed >= 3) {
      const severity   = projPct >= 110 ? 'critical' : 'warning';
      const confidence = Math.min(90, 50 + Math.round(elapsed / totalDays * 50));
      insights.push({
        id:          `budget-warn-${budget._id}`,
        type:        'budget',
        severity,
        icon:        '⚠️',
        title:       `${name} budget on track to overspend`,
        description: `At your current pace (${fmt(burnRate)}/day) you'll reach `
                   + `${projPct.toFixed(0)}% of your ${fmt(limit)} ${name} budget by period end.`,
        detail:      `Already used ${pctUsed.toFixed(0)}% (${fmt(spent)}). `
                   + `Projected total: ${fmt(projected)}.`,
        confidence,
        data:        { spent, limit, pctUsed, projected, projPct, burnRate },
      });

    // Approaching 80% warning
    } else if (pctUsed >= 75 && pctUsed < 100) {
      insights.push({
        id:          `budget-approaching-${budget._id}`,
        type:        'budget',
        severity:    'info',
        icon:        '💡',
        title:       `${name} budget at ${pctUsed.toFixed(0)}%`,
        description: `You've used ${fmt(spent)} of your ${fmt(limit)} ${name} budget — `
                   + `${fmt(limit - spent)} remaining for this period.`,
        detail:      `${(100 - pctUsed).toFixed(0)}% of budget left.`,
        confidence:  95,
        data:        { spent, limit, pctUsed, projected, projPct },
      });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ── 3. Income vs Expense Summary ─────────────────────────────────────────────

/**
 * Compare current and previous month net savings (income − expenses).
 */
function buildIncomeExpenseSummary(transactions) {
  const insights = [];
  const cur  = currentYM();
  const prev = offsetYM(-1);

  let curIncome = 0,  curExpense = 0;
  let prevIncome = 0, prevExpense = 0;

  for (const tx of transactions) {
    const ym = toYM(tx.date);
    const amount = Math.abs(tx.amount);
    if (ym === cur) {
      if (tx.type === 'credit') curIncome   += amount;
      else                      curExpense  += amount;
    } else if (ym === prev) {
      if (tx.type === 'credit') prevIncome  += amount;
      else                      prevExpense += amount;
    }
  }

  const curSavings  = curIncome  - curExpense;
  const prevSavings = prevIncome - prevExpense;
  const savingsDiff = curSavings - prevSavings;
  const savingsPct  = prevSavings !== 0
    ? ((curSavings - prevSavings) / Math.abs(prevSavings)) * 100
    : 0;

  if (curIncome === 0 && curExpense === 0) return insights;

  const better   = savingsDiff >= 0;
  const severity = curSavings < 0 ? 'critical' : curSavings < 200 ? 'warning' : 'info';

  insights.push({
    id:          'income-expense-summary',
    type:        'income_expense',
    severity,
    icon:        curSavings >= 0 ? '💰' : '📉',
    title:       curSavings >= 0
                   ? `You saved ${fmt(curSavings)} this month`
                   : `Expenses exceeded income by ${fmt(Math.abs(curSavings))}`,
    description: `This month: ${fmt(curIncome)} income, ${fmt(curExpense)} expenses → `
               + `net ${curSavings >= 0 ? 'savings' : 'deficit'} of ${fmt(Math.abs(curSavings))}. `
               + (prevSavings !== 0
                   ? `That's ${fmt(Math.abs(savingsDiff))} ${better ? 'more' : 'less'} saved than last month.`
                   : ''),
    detail:      prevIncome > 0
                   ? `Last month: income ${fmt(prevIncome)}, expenses ${fmt(prevExpense)}, net ${fmt(prevSavings)}.`
                   : 'Not enough prior-month data for comparison.',
    confidence:  prevIncome > 0 ? 92 : 75,
    pctChange:   Math.round(savingsPct),
    data:        { curIncome, curExpense, curSavings, prevIncome, prevExpense, prevSavings, savingsDiff },
  });

  // Expense efficiency change
  if (prevExpense > 0 && curExpense > 0) {
    const expenseDiff = curExpense - prevExpense;
    const expensePct  = (expenseDiff / prevExpense) * 100;
    if (Math.abs(expensePct) >= 10) {
      insights.push({
        id:          'expense-change',
        type:        'income_expense',
        severity:    expensePct > 20 ? 'warning' : 'info',
        icon:        expensePct > 0 ? '📈' : '📉',
        title:       `Total expenses ${expensePct > 0 ? 'up' : 'down'} ${Math.abs(expensePct).toFixed(0)}% vs last month`,
        description: `You spent ${fmt(curExpense)} this month vs ${fmt(prevExpense)} last month — `
                   + `a ${fmt(Math.abs(expenseDiff))} ${expensePct > 0 ? 'increase' : 'decrease'}.`,
        detail:      `Month-over-month expense change: ${pctStr(expensePct)}.`,
        confidence:  88,
        pctChange:   Math.round(expensePct),
        data:        { curExpense, prevExpense, expenseDiff, expensePct },
      });
    }
  }

  return insights;
}

// ── 4. Trend Analysis ────────────────────────────────────────────────────────

/**
 * Compare category spending: most-recent full month vs two months ago.
 * Flags categories with > 15% change and > $30 absolute difference.
 */
function detectTrends(transactions) {
  const insights   = [];
  const recent     = offsetYM(-1);   // last completed month
  const baseline   = offsetYM(-3);   // three months ago

  const recentData   = {};
  const baselineData = {};

  for (const tx of transactions) {
    if (tx.type !== 'debit') continue;
    const ym  = toYM(tx.date);
    const cat = (tx.category || 'other').toLowerCase();
    const amt = Math.abs(tx.amount);
    if (ym === recent)   recentData[cat]   = (recentData[cat]   || 0) + amt;
    if (ym === baseline) baselineData[cat] = (baselineData[cat] || 0) + amt;
  }

  // Only categories present in both months
  const cats = Object.keys(recentData).filter((c) => baselineData[c] > 0);

  for (const cat of cats) {
    const r    = recentData[cat];
    const b    = baselineData[cat];
    const pct  = ((r - b) / b) * 100;
    const diff = r - b;

    if (Math.abs(pct) < 15 || Math.abs(diff) < 30) continue;

    const nice     = niceCategory(cat);
    const rising   = pct > 0;
    const absPct   = Math.abs(pct).toFixed(0);
    const severity = Math.abs(pct) >= 40 ? 'warning' : 'info';
    const confidence = Math.min(90, 60 + Math.min(25, Math.abs(diff) / 10));

    insights.push({
      id:          `trend-${cat}`,
      type:        'trend',
      severity,
      icon:        rising ? '📈' : '📉',
      title:       `${nice} spend ${rising ? 'rising' : 'falling'} ${absPct}%`,
      description: `Your ${nice} spending ${rising ? 'increased' : 'decreased'} by ${absPct}% `
                 + `over the past 3 months — from ${fmt(b)} to ${fmt(r)}.`,
      detail:      `Change: ${fmt(Math.abs(diff))} ${rising ? 'more' : 'less'} per month. `
                 + `Compared ${recent} vs ${baseline}.`,
      confidence:  Math.round(confidence),
      category:    cat,
      pctChange:   Math.round(pct),
      data:        { recent: r, baseline: b, pct, diff },
    });
  }

  // Sort: biggest absolute % change first
  return insights.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all four analysis passes and return a combined, deduplicated array of
 * Insight objects sorted by severity (critical first).
 *
 * @param {object[]} transactions  - raw transaction objects from the API
 * @param {object[]} budgets       - raw budget objects from the API
 * @returns {object[]}             - array of Insight objects
 */
export function runInsightsEngine(transactions = [], budgets = []) {
  if (!transactions.length) return [];

  const anomalies   = detectSpendingAnomalies(transactions);
  const budgetWarns = detectBudgetWarnings(budgets);
  const incomeExp   = buildIncomeExpenseSummary(transactions);
  const trends      = detectTrends(transactions);

  const all = [...anomalies, ...budgetWarns, ...incomeExp, ...trends];

  // Deduplicate by id (shouldn't happen, but safety net)
  const seen = new Set();
  return all.filter((i) => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
}

/** Convenience: count insights by severity */
export function summariseSeverity(insights) {
  return insights.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, { critical: 0, warning: 0, info: 0 });
}
