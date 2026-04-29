import React, { useEffect, useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale,
  LinearScale, Tooltip, Legend,
} from 'chart.js';
import reportService       from '../services/reportService';
import { fmtCurrency }    from '../utils/formatCurrency';
import { startOfCurrentMonth, endOfCurrentMonth } from '../utils/dateHelpers';
import { CATEGORY_COLORS } from '../constants/categories';
import ErrorMessage        from '../components/common/ErrorMessage';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function ReportsPage() {
  const [netWorth, setNetWorth] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [incomeVsExp, setIncomeVsExp] = useState([]);
  const [spending, setSpending] = useState(null);
  const [income,   setIncome]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [dateRange, setDateRange] = useState({
    start: startOfCurrentMonth(),
    end:   endOfCurrentMonth(),
  });

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [nw, bd, ive, sp, inc] = await Promise.all([
        reportService.netWorth(),
        reportService.categoryBreakdown({ startDate: dateRange.start, endDate: dateRange.end }),
        reportService.incomeVsExpense({ months: 6 }),
        reportService.spending({ startDate: dateRange.start, endDate: dateRange.end }),
        reportService.income({ startDate: dateRange.start, endDate: dateRange.end }),
      ]);
      setNetWorth(nw);
      setBreakdown(bd.breakdown || []);
      setIncomeVsExp(ive.monthly || []);
      setSpending(sp);
      setIncome(inc);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  // Doughnut data
  const doughnutData = {
    labels: breakdown.map((b) => b.category),
    datasets: [{
      data: breakdown.map((b) => b.total),
      backgroundColor: CATEGORY_COLORS.slice(0, breakdown.length),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  // Bar data
  const barData = {
    labels: incomeVsExp.map((m) => m.month),
    datasets: [
      { label: 'Income',  data: incomeVsExp.map((m) => m.income),  backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 5 },
      { label: 'Expense', data: incomeVsExp.map((m) => m.expense), backgroundColor: 'rgba(239,68,68,0.7)',  borderRadius: 5 },
    ],
  };
  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { color: '#94A3B8', font: { size: 12 } } },
      tooltip: { callbacks: { label: (ctx) => ` ${fmtCurrency(ctx.raw)}` }}},
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748B' } },
      y: { grid: { color: 'rgba(42,53,85,0.5)' }, ticks: { color: '#64748B', callback: (v) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}` } },
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex-between">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Reports</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="date" className="form-input" style={{ width: 150 }} value={dateRange.start}
            onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))} />
          <span style={{ color: 'var(--text-tertiary)' }}>to</span>
          <input type="date" className="form-input" style={{ width: 150 }} value={dateRange.end}
            onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))} />
          <button className="btn btn-primary" onClick={load}>Apply</button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={load} />}

      {/* Net Worth */}
      {netWorth && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {[
            { label: 'Net Worth',   value: fmtCurrency(netWorth.bankTotal + netWorth.investmentTotal), colour: 'var(--accent)' },
            { label: 'Bank Total',  value: fmtCurrency(netWorth.bankTotal) },
            { label: 'Investments', value: fmtCurrency(netWorth.investmentTotal), colour: 'var(--blue)' },
            { label: 'Total Spent', value: fmtCurrency(spending?.totalSpend || 0), colour: 'var(--red)' },
            { label: 'Total Income',value: fmtCurrency(income?.totalIncome || 0), colour: 'var(--accent)' },
          ].map(({ label, value, colour }) => (
            <div key={label} className="card">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: colour || 'var(--text-primary)' }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 }}>
        {/* Category breakdown */}
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Spending by Category</h3>
          {loading ? (
            <div className="loading-center"><span className="spinner" /></div>
          ) : breakdown.length === 0 ? (
            <div className="empty-state"><p>No spending data in range.</p></div>
          ) : (
            <>
              <div style={{ height: 220 }}>
                <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${fmtCurrency(ctx.raw)}` }}}}} />
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {breakdown.slice(0, 6).map((b, i) => (
                  <div key={b.category} className="flex-between gap-8">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: CATEGORY_COLORS[i], flexShrink: 0 }} />
                      {b.category}
                    </span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{fmtCurrency(b.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Income vs expense */}
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Income vs Expense (6 months)</h3>
          <div style={{ height: 280 }}>
            {loading ? (
              <div className="loading-center"><span className="spinner" /></div>
            ) : (
              <Bar data={barData} options={barOptions} aria-label="Income vs expense bar chart" />
            )}
          </div>
        </div>
      </div>

      {/* Spending details table */}
      {spending?.categories?.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontWeight: 600 }}>Spending Breakdown</h3>
          </div>
          <table className="data-table" aria-label="Spending by category">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">Transactions</th>
                <th className="text-right">Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {spending.categories.map((c) => (
                <tr key={c.category}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.category}</td>
                  <td className="text-right">{c.count}</td>
                  <td className="text-right mono" style={{ color: 'var(--red)' }}>{fmtCurrency(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
