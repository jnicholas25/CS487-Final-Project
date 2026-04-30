import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, BarElement, CategoryScale,
  LinearScale, Tooltip, Legend,
} from 'chart.js';
import reportService       from '../services/reportService';
import { fmtCurrency }    from '../utils/formatCurrency';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../constants/categories';
import ErrorMessage        from '../components/common/ErrorMessage';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const PERIODS = [
  { label: '1 Month',  months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '1 Year',   months: 12 },
];

function getDateRange(months) {
  const end   = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months + 1);
  start.setDate(1);
  const fmt = (d) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

export default function ReportsPage() {
  const [netWorth,    setNetWorth]    = useState(null);
  const [breakdown,   setBreakdown]   = useState([]);
  const [incomeVsExp, setIncomeVsExp] = useState([]);
  const [spending,    setSpending]    = useState(null);
  const [income,      setIncome]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [activePeriod, setActivePeriod] = useState(1); // index into PERIODS

  const load = async (periodIdx = activePeriod) => {
    setLoading(true); setError(null);
    const { months } = PERIODS[periodIdx];
    const { start, end } = getDateRange(months);
    try {
      const [nw, bd, ive, sp, inc] = await Promise.all([
        reportService.netWorth(),
        reportService.categoryBreakdown({ startDate: start, endDate: end }),
        reportService.incomeVsExpense({ months }),
        reportService.spending({ startDate: start, endDate: end }),
        reportService.income({ startDate: start, endDate: end }),
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

  const handlePeriodChange = (idx) => {
    setActivePeriod(idx);
    load(idx);
  };

  const handleExportPDF = () => {
    window.print();
  };

  // Horizontal bar chart for category breakdown
  const hBarData = {
    labels: breakdown.slice(0, 8).map((b) => CATEGORY_LABELS[b.category] || b.category),
    datasets: [{
      label: 'Spending',
      data: breakdown.slice(0, 8).map((b) => b.total),
      backgroundColor: CATEGORY_COLORS.slice(0, breakdown.length),
      borderRadius: 4,
    }],
  };
  const hBarOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${fmtCurrency(ctx.raw)}` } },
    },
    scales: {
      x: { grid: { color: 'rgba(42,53,85,0.5)' }, ticks: { color: '#64748B', callback: (v) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}` } },
      y: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 12 } } },
    },
  };

  // Grouped bar chart for income vs expense
  const barData = {
    labels: incomeVsExp.map((m) => m.month),
    datasets: [
      { label: 'Income',  data: incomeVsExp.map((m) => m.income),  backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 },
      { label: 'Expense', data: incomeVsExp.map((m) => m.expense), backgroundColor: 'rgba(239,68,68,0.7)',  borderRadius: 4 },
    ],
  };
  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#94A3B8', font: { size: 12 } } },
      tooltip: { callbacks: { label: (ctx) => ` ${fmtCurrency(ctx.raw)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748B' } },
      y: { grid: { color: 'rgba(42,53,85,0.5)' }, ticks: { color: '#64748B', callback: (v) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}` } },
    },
  };

  // Net Worth Summary values
  const bankTotal    = netWorth?.totalBankBalance    ?? netWorth?.bankTotal    ?? 0;
  const investTotal  = netWorth?.totalInvestmentValue ?? netWorth?.investmentTotal ?? 0;
  const totalSpend   = spending?.totalSpend   ?? spending?.grandTotal  ?? 0;
  const totalIncome  = income?.totalIncome   ?? income?.grandTotal   ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Reports</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Period tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: 4, gap: 2 }}>
            {PERIODS.map((p, i) => (
              <button key={p.label} onClick={() => handlePeriodChange(i)}
                style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 500,
                  background: activePeriod === i ? 'var(--bg-card)' : 'transparent',
                  color: activePeriod === i ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: activePeriod === i ? 'var(--shadow-sm)' : 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}>
                {p.label}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={handleExportPDF} style={{ fontSize: '0.8125rem' }}>
            Export PDF
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => load()} />}

      {/* Net Worth Summary */}
      <div className="card">
        <h3 style={{ fontWeight: 600, marginBottom: 16, fontSize: '0.9375rem' }}>Net Worth Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {[
            { label: 'Cash & Checking', value: fmtCurrency(bankTotal),   colour: 'var(--accent)' },
            { label: 'Investments',     value: fmtCurrency(investTotal),  colour: '#3B82F6' },
            { label: 'Total Income',    value: fmtCurrency(totalIncome),  colour: 'var(--accent)' },
            { label: 'Total Spent',     value: fmtCurrency(totalSpend),   colour: 'var(--red)' },
            { label: 'Net Worth',       value: fmtCurrency(bankTotal + investTotal), colour: 'var(--text-primary)' },
          ].map(({ label, value, colour }) => (
            <div key={label} style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: colour }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        {/* Spending by Category — horizontal bars */}
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 16, fontSize: '0.9375rem' }}>Spending by Category</h3>
          {loading ? (
            <div className="loading-center"><span className="spinner" /></div>
          ) : breakdown.length === 0 ? (
            <div className="empty-state"><p>No spending data in range.</p></div>
          ) : (
            <>
              <div style={{ height: Math.max(180, breakdown.slice(0, 8).length * 38) }}>
                <Bar data={hBarData} options={hBarOptions} aria-label="Spending by category horizontal bar chart" />
              </div>
              {/* Percentage annotations */}
              {breakdown.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {breakdown.slice(0, 6).map((b, i) => {
                    const pct = totalSpend > 0 ? ((b.total / totalSpend) * 100).toFixed(0) : 0;
                    return (
                      <div key={b.category} className="flex-between gap-8">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: CATEGORY_COLORS[i], flexShrink: 0 }} />
                          {CATEGORY_LABELS[b.category] || b.category}
                        </span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Income vs Expense */}
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 16, fontSize: '0.9375rem' }}>Income vs Expenses</h3>
          <div style={{ height: 280 }}>
            {loading ? (
              <div className="loading-center"><span className="spinner" /></div>
            ) : (
              <Bar data={barData} options={barOptions} aria-label="Income vs expense bar chart" />
            )}
          </div>
        </div>
      </div>

      {/* Spending Details Table */}
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
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{CATEGORY_LABELS[c.category] || c.category}</td>
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
