import React, { useEffect, useState } from 'react';
import { useNavigate }    from 'react-router-dom';
import { Bar }            from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';
import '../styles/dashboard.css';

import { useHealthScore }  from '../hooks/useHealthScore';
import { useAlertContext } from '../context/AlertContext';
import reportService       from '../services/reportService';
import transactionService  from '../services/transactionService';
import budgetService       from '../services/budgetService';
import { fmtPctRaw }    from '../utils/formatCurrency';
import { useCurrency } from '../context/CurrencyContext';
import { fmtDate }         from '../utils/dateHelpers';
import { ROUTES }          from '../constants/routes';
import { CATEGORY_LABELS } from '../constants/categories';
import ErrorMessage        from '../components/common/ErrorMessage';
import { CardSkeleton }    from '../components/common/LoadingSkeleton';
import './DashboardPage.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// ── Health Score Ring (SVG) ──────────────────────────────────────────────
function HealthScoreRing({ score, label }) {
  const R   = 54;
  const C   = 2 * Math.PI * R;
  const pct = Math.min(100, Math.max(0, score ?? 0));
  const offset = C - (pct / 100) * C;
  const colour =
    pct >= 80 ? 'var(--accent)' :
    pct >= 60 ? 'var(--orange)' :
    pct >= 40 ? 'var(--orange)' : 'var(--red)';

  return (
    <div className="health-ring" aria-label={`Financial health score: ${pct} out of 100, ${label}`}>
      <svg width="130" height="130" viewBox="0 0 130 130" role="img">
        <circle cx="65" cy="65" r={R} stroke="var(--bg-elevated)" strokeWidth="10" fill="none" />
        <circle
          cx="65" cy="65" r={R}
          stroke={colour} strokeWidth="10" fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.4s' }}
        />
      </svg>
      <div className="health-ring__inner">
        <span className="health-ring__score" style={{ color: colour }}>{pct}</span>
        <span className="health-ring__label">{label || '—'}</span>
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, colour }) {
  return (
    <div className="card kpi-card">
      <p className="kpi-card__label">{label}</p>
      <p className="kpi-card__value" style={{ color: colour }}>{value}</p>
      {sub && <p className="kpi-card__sub">{sub}</p>}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { fmtCurrency } = useCurrency();
  const { scoreData, loading: scoreLoading, error: scoreError, fetchScore } = useHealthScore();
  const { unreadCount } = useAlertContext();

  const [netWorth,  setNetWorth]  = useState(null);
  const [trend,     setTrend]     = useState([]);
  const [recent,    setRecent]    = useState([]);
  const [budgets,   setBudgets]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    fetchScore();
    loadDashboard();
  }, []); // eslint-disable-line

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nw, tr, tx, bud] = await Promise.all([
        reportService.netWorth(),
        reportService.spendingTrend({ months: 6 }),
        transactionService.list({ limit: 5, sort: '-date' }),
        budgetService.list(),
      ]);
      setNetWorth(nw);
      setTrend(tr.trend || []);
      setRecent(tx.transactions || []);
      setBudgets(bud.budgets || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Chart data ───────────────────────────────────────────────────────
  const chartData = {
    labels: trend.map((t) => t.month),
    datasets: [{
      label: 'Spending',
      data:  trend.map((t) => t.total),
      backgroundColor: 'rgba(16,185,129,0.7)',
      borderRadius: 5,
      borderSkipped: false,
    }],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      label: (ctx) => ` ${fmtCurrency(ctx.raw)}`,
    }}},
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748B' } },
      y: { grid: { color: 'rgba(42,53,85,0.5)' }, ticks: { color: '#64748B', callback: (v) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}` } },
    },
  };

  const health = scoreData;

  // KPI derived values
  const totalBalance    = netWorth?.bankTotal ?? null;
  const monthlySpending = trend.length > 0 ? trend[trend.length - 1].total : null;
  const prevSpending    = trend.length > 1 ? trend[trend.length - 2].total : null;
  const spendingChangePct = (monthlySpending !== null && prevSpending && prevSpending > 0)
    ? ((monthlySpending - prevSpending) / prevSpending) * 100
    : null;

  const activeBudget  = budgets.find((b) => b.isActive) || budgets[0] || null;
  const budgetUsedPct = activeBudget && activeBudget.totalLimit > 0
    ? Math.round((activeBudget.totalSpent / activeBudget.totalLimit) * 100)
    : null;
  const budgetRemaining = activeBudget
    ? activeBudget.totalLimit - activeBudget.totalSpent
    : null;

  return (
    <div className="dashboard">
      {error && <ErrorMessage message={error} onRetry={loadDashboard} style={{ marginBottom: 20 }} />}

      {/* Alert banner */}
      {unreadCount > 0 && (
        <div className="dashboard__alert-banner" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{unreadCount} unread anomaly {unreadCount === 1 ? 'alert' : 'alerts'} detected.</span>
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
            onClick={() => navigate(ROUTES.ALERTS)}>
            View Alerts →
          </button>
        </div>
      )}

      {/* KPI row */}
      <div className="dashboard__kpi-row">
        {loading ? (
          [1,2,3,4].map((i) => <CardSkeleton key={i} lines={2} />)
        ) : (
          <>
            <KPICard
              label="Total Balance"
              value={totalBalance !== null ? fmtCurrency(totalBalance) : '—'}
              sub={netWorth ? `Investments: ${fmtCurrency(netWorth.investmentTotal)}` : null}
              colour="var(--accent)"
            />
            <KPICard
              label="Monthly Spending"
              value={monthlySpending !== null ? fmtCurrency(monthlySpending) : '—'}
              sub={spendingChangePct !== null
                ? `${spendingChangePct > 0 ? '↑' : '↓'} ${Math.abs(spendingChangePct).toFixed(1)}% vs last month`
                : null}
              colour={spendingChangePct !== null && spendingChangePct < 0 ? 'var(--accent)' : 'var(--orange)'}
            />
            <KPICard
              label="Budget Used"
              value={budgetUsedPct !== null ? `${budgetUsedPct}%` : '—'}
              sub={budgetRemaining !== null ? `${fmtCurrency(budgetRemaining)} remaining` : null}
              colour={budgetUsedPct !== null && budgetUsedPct >= 90 ? 'var(--red)' : budgetUsedPct >= 75 ? 'var(--orange)' : 'var(--text-primary)'}
            />
            <KPICard
              label="Health Score"
              value={scoreLoading ? '…' : (health?.score ?? '—')}
              sub={health ? `↑ ${health.label} standing` : null}
              colour={health?.score >= 80 ? 'var(--accent)' : health?.score >= 65 ? 'var(--orange)' : 'var(--red)'}
            />
          </>
        )}
      </div>

      {/* Middle row: Spending trend chart + Health score */}
      <div className="dashboard__mid-row">
        {/* Spending chart */}
        <div className="card dashboard__chart-card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Spending Trend</h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Last 6 months</span>
          </div>
          <div style={{ height: 200 }}>
            {loading ? (
              <div className="loading-center"><span className="spinner" /></div>
            ) : (
              <Bar data={chartData} options={chartOptions} aria-label="Monthly spending trend bar chart" />
            )}
          </div>
        </div>

        {/* Health score */}
        <div className="card dashboard__health-card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20 }}>Financial Health</h2>
          {scoreLoading ? (
            <div className="loading-center"><span className="spinner" /></div>
          ) : scoreError ? (
            <ErrorMessage message={scoreError} onRetry={fetchScore} />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <HealthScoreRing
                  score={health?.score ?? 0}
                  label={health?.label ?? 'N/A'}
                />
              </div>
              <div className="health-components">
                {(health?.components || []).map((c) => (
                  <div key={c.key} className="health-component">
                    <div className="flex-between gap-8" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{c.label}</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{fmtPctRaw(c.score)}</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${c.score}%`,
                          background: c.score >= 70 ? 'var(--accent)' : c.score >= 40 ? 'var(--orange)' : 'var(--red)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row: Recent transactions + Budget status */}
      <div className="dashboard__bottom-row">
        {/* Recent transactions */}
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Recent Transactions</h2>
            <button className="btn btn-ghost" style={{ fontSize: '0.8125rem', padding: '4px 10px' }}
              onClick={() => navigate(ROUTES.TRANSACTIONS)}>
              View all →
            </button>
          </div>
          {loading ? (
            <div className="loading-center"><span className="spinner" /></div>
          ) : recent.length === 0 ? (
            <div className="empty-state"><p>No transactions yet.</p></div>
          ) : (
            <table className="data-table" aria-label="Recent transactions">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx) => (
                  <tr key={tx._id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }} className="truncate">
                      {tx.description}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{CATEGORY_LABELS[tx.category] || tx.category || 'Other'}</span>
                    </td>
                    <td>{fmtDate(tx.date)}</td>
                    <td className="text-right mono" style={{ color: tx.amount < 0 ? 'var(--red)' : 'var(--accent)' }}>
                      {tx.amount < 0 ? '-' : '+'}{fmtCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Budget status */}
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Budget Status</h2>
            <button className="btn btn-ghost" style={{ fontSize: '0.8125rem', padding: '4px 10px' }}
              onClick={() => navigate(ROUTES.BUDGETS)}>
              View all →
            </button>
          </div>
          {loading ? (
            <div className="loading-center"><span className="spinner" /></div>
          ) : !activeBudget || !activeBudget.categories?.length ? (
            <div className="empty-state"><p>No budgets set up yet.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {activeBudget.categories.slice(0, 5).map((cat) => {
                const pct = cat.limit > 0 ? Math.min(100, (cat.spent / cat.limit) * 100) : 0;
                const colour = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--orange)' : 'var(--accent)';
                return (
                  <div key={cat._id || cat.category}>
                    <div className="flex-between gap-8" style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{CATEGORY_LABELS[cat.category] || cat.category}</span>
                      <span style={{ fontSize: '0.8125rem', color: pct >= 100 ? 'var(--red)' : 'var(--text-secondary)' }}>
                        {fmtCurrency(cat.spent)} / {fmtCurrency(cat.limit)}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: colour }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
