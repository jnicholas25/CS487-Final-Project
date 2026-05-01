import React from 'react';
import { fmtDate } from '../../utils/dateHelpers';
import { useCurrency } from '../../context/CurrencyContext';
/** Calendar-style view: groups payments by their next due date */
export default function PaymentCalendar({ payments = [] }) {
  const { fmtCurrency } = useCurrency();
  const upcoming = [...payments]
    .filter(p => p.status === 'active' && p.nextDueDate)
    .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))
    .slice(0, 10);
  if (!upcoming.length) return (
    <div className="empty-state"><p>No upcoming payments.</p></div>
  );
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {upcoming.map(p => (
        <div key={p._id} className="flex-between gap-8"
          style={{ padding:'10px 14px', background:'var(--bg-elevated)', borderRadius:'var(--radius)' }}>
          <div>
            <p style={{ fontWeight:600, fontSize:'0.9rem' }}>{p.name}</p>
            <p style={{ fontSize:'0.75rem', color:'var(--text-tertiary)' }}>{p.frequency}</p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontWeight:600, color:'var(--accent)' }}>{fmtCurrency(p.amount)}</p>
            <p style={{ fontSize:'0.75rem', color:'var(--text-tertiary)' }}>{fmtDate(p.nextDueDate)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
