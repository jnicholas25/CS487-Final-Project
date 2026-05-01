import React from 'react';
import { useCurrency } from '../../context/CurrencyContext';
export default function BudgetCategoryCard({ category }) {
  const { fmtCurrency } = useCurrency();
  if (!category) return null;
  const pct = category.limit > 0 ? Math.min(100, (category.spent / category.limit) * 100) : 0;
  const colour = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--orange)' : 'var(--accent)';
  return (
    <div className="card">
      <div className="flex-between gap-8" style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>{category.category}</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {fmtCurrency(category.spent)} / {fmtCurrency(category.limit)}
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: colour }} />
      </div>
    </div>
  );
}
