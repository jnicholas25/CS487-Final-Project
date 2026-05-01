import React from 'react';
/** Inline alert banner shown when a budget category is near or over limit */
export default function BudgetAlertBanner({ budgets = [] }) {
  const alerts = budgets.filter(b => b.categories?.some(c => (c.spent / c.limit) >= 0.8));
  if (!alerts.length) return null;
  return (
    <div role="alert" style={{ padding:'12px 16px', background:'var(--orange-muted)',
      border:'1px solid rgba(245,158,11,0.3)', borderRadius:'var(--radius)',
      color:'var(--orange)', fontSize:'0.875rem', marginBottom:16 }}>
      ⚠ {alerts.length} budget {alerts.length===1?'category':'categories'} near or over limit.
    </div>
  );
}
