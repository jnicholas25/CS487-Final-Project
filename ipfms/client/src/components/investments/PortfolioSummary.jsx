import React from 'react';
import { useCurrency } from '../../context/CurrencyContext';
export default function PortfolioSummary({ summary }) {
  const { fmtCurrency } = useCurrency();
  if (!summary) return null;
  return (
    <div className="card">
      <p style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', marginBottom:6 }}>Portfolio Value</p>
      <p style={{ fontSize:'1.5rem', fontWeight:700, color:'var(--accent)' }}>
        {fmtCurrency(summary.totalCurrentValue||0)}
      </p>
      <p style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:4 }}>
        {(summary.totalGainLossPct||0)>=0?'+':''}{(summary.totalGainLossPct||0).toFixed(1)}% total return
      </p>
    </div>
  );
}
