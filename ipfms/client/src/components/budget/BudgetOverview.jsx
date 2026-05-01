import React from 'react';
import { useCurrency } from '../../context/CurrencyContext';
export default function BudgetOverview({ budgets = [] }) {
  const { fmtCurrency } = useCurrency();
  const total   = budgets.reduce((s, b) => s + b.amount, 0);
  const spent   = budgets.reduce((s, b) => s + (b.spent || 0), 0);
  return (
    <div className="card">
      <p style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', marginBottom:6 }}>Total Budgeted</p>
      <p style={{ fontSize:'1.5rem', fontWeight:700 }}>{fmtCurrency(total)}</p>
      <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:4 }}>
        {fmtCurrency(spent)} spent
      </p>
    </div>
  );
}
