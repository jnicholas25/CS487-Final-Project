import React, { useEffect, useState } from 'react';
import investmentService from '../../services/investmentService';
import { fmtCurrency } from '../../utils/formatCurrency';
import { fmtDate }     from '../../utils/dateHelpers';
export default function DividendHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    investmentService.dividendHistory().then(r=>setHistory(r.history||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  if (loading) return <div className="loading-center"><span className="spinner" /></div>;
  if (!history.length) return <div className="empty-state"><p>No dividend history yet.</p></div>;
  return (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      <table className="data-table" aria-label="Dividend history">
        <thead><tr><th>Symbol</th><th>Type</th><th>Date</th><th className="text-right">Amount</th></tr></thead>
        <tbody>
          {history.map((d,i)=>(
            <tr key={i}>
              <td style={{ fontWeight:600 }}>{d.symbol}</td>
              <td><span className="badge badge-info">{d.type}</span></td>
              <td>{fmtDate(d.date)}</td>
              <td className="text-right mono text-accent">{fmtCurrency(d.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
