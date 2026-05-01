import React, { useCallback, useEffect, useState } from 'react';
import { transactionService } from '../services/transactionService';
import { budgetService }      from '../services/budgetService';
import { runInsightsEngine, summariseSeverity } from '../utils/insightsEngine';
import { useCurrency }        from '../context/CurrencyContext';
import ErrorMessage           from '../components/common/ErrorMessage';
import './InsightsPage.css';

// ── Filter tabs ──────────────────────────────────────────────────────────────
const TABS = [
  { key: 'all',            label: 'All Insights' },
  { key: 'anomaly',        label: 'Anomalies' },
  { key: 'budget',         label: 'Budget' },
  { key: 'trend',          label: 'Trends' },
  { key: 'income_expense', label: 'Income' },
];

// ── Severity helpers ─────────────────────────────────────────────────────────
const SEV_CONFIG = {
  critical: { cls: 'badge-danger',   label: 'Critical', bar: 'var(--red)'    },
  warning:  { cls: 'badge-warning',  label: 'Warning',  bar: 'var(--orange)' },
  info:     { cls: 'badge-info',     label: 'Info',     bar: '#3B82F6'       },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDateRange(months) {
  const end   = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  start.setDate(1);
  const fmt = (d) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

async function fetchAllTransactions(months = 4) {
  const { start, end } = getDateRange(months);
  const results = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await transactionService.list({ startDate: start, endDate: end, limit: 200, page });
    const txs = res.transactions || [];
    results.push(...txs);
    if (txs.length < 200) break;
    page++;
  }
  return results;
}

// ── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ insight }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEV_CONFIG[insight.severity] || SEV_CONFIG.info;

  return (
    <div
      className={`insight-card insight-card--${insight.severity}`}
      role="article"
      aria-label={insight.title}
    >
      <div className="insight-card__header">
        <span className="insight-card__icon" aria-hidden="true">{insight.icon}</span>
        <div className="insight-card__titles">
          <p className="insight-card__title">{insight.title}</p>
          <p className="insight-card__desc">{insight.description}</p>
        </div>
        <div className="insight-card__meta">
          <span className={`badge ${sev.cls}`}>{sev.label}</span>
          <button
            className="insight-card__expand"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse detail' : 'Expand detail'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="insight-card__conf-row">
        <span className="insight-card__conf-label">Confidence</span>
        <div className="insight-card__conf-bar" role="progressbar"
          aria-valuenow={insight.confidence} aria-valuemin="0" aria-valuemax="100">
          <div
            className="insight-card__conf-fill"
            style={{ width: `${insight.confidence}%`, background: sev.bar }}
          />
        </div>
        <span className="insight-card__conf-pct">{insight.confidence}%</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="insight-card__detail">
          <p>{insight.detail}</p>
          {insight.pctChange !== undefined && (
            <p className="insight-card__pct-change" style={{
              color: insight.pctChange > 0 ? 'var(--red)' : 'var(--green)',
            }}>
              {insight.pctChange > 0 ? '▲' : '▼'} {Math.abs(insight.pctChange)}% change
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────────────
function SummaryStrip({ insights }) {
  const counts = summariseSeverity(insights);
  return (
    <div className="insights-summary-strip">
      <span className="insights-summary-strip__total">
        {insights.length} insight{insights.length !== 1 ? 's' : ''} found
      </span>
      <div className="insights-summary-strip__counts">
        {counts.critical > 0 && (
          <span className="badge badge-danger">{counts.critical} critical</span>
        )}
        {counts.warning > 0 && (
          <span className="badge badge-warning">{counts.warning} warning{counts.warning !== 1 ? 's' : ''}</span>
        )}
        {counts.info > 0 && (
          <span className="badge badge-info">{counts.info} info</span>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ activeTab }) {
  const messages = {
    all:            { icon: '✨', msg: 'No insights yet — run the analysis to get started.' },
    anomaly:        { icon: '⚡', msg: 'No spending anomalies detected this month.' },
    budget:         { icon: '⚠️', msg: 'All budgets are on track — great work!' },
    trend:          { icon: '📊', msg: 'Not enough historical data to detect trends yet.' },
    income_expense: { icon: '💰', msg: 'Income/expense summary will appear once you have transactions this month.' },
  };
  const { icon, msg } = messages[activeTab] || messages.all;
  return (
    <div className="empty-state">
      <span style={{ fontSize: '2.5rem' }}>{icon}</span>
      <p>{msg}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const { fmtCurrency }            = useCurrency();
  const [insights, setInsights]    = useState([]);
  const [loading,  setLoading]     = useState(false);
  const [ran,      setRan]         = useState(false);
  const [error,    setError]       = useState(null);
  const [activeTab, setActiveTab]  = useState('all');
  const [lastRun,  setLastRun]     = useState(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [transactions, budgetsRes] = await Promise.all([
        fetchAllTransactions(4),
        budgetService.list(),
      ]);
      const budgets = budgetsRes.budgets || [];
      const result  = runInsightsEngine(transactions, budgets);
      setInsights(result);
      setRan(true);
      setLastRun(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load data for analysis.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-run on mount
  useEffect(() => { runAnalysis(); }, [runAnalysis]);

  const filtered = activeTab === 'all'
    ? insights
    : insights.filter((i) => i.type === activeTab);

  // Tab counts
  const tabCounts = TABS.reduce((acc, t) => {
    acc[t.key] = t.key === 'all'
      ? insights.length
      : insights.filter((i) => i.type === t.key).length;
    return acc;
  }, {});

  return (
    <div className="insights-page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Insights</h1>
          <p className="page-subtitle">
            Rule-based analysis of your spending patterns, budgets, and trends
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={runAnalysis}
          disabled={loading}
          aria-label="Re-run analysis"
        >
          {loading
            ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Analysing…</>
            : '⟳ Run Analysis'}
        </button>
      </div>

      {/* Last run timestamp */}
      {lastRun && !loading && (
        <p className="insights-last-run">
          Last analysed: {lastRun.toLocaleTimeString()}
        </p>
      )}

      {/* Error */}
      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Summary strip */}
      {ran && !loading && insights.length > 0 && (
        <SummaryStrip insights={insights} />
      )}

      {/* Filter tabs */}
      {ran && (
        <div className="insights-tabs" role="tablist" aria-label="Filter insights by type">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`insights-tab${activeTab === tab.key ? ' insights-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className="insights-tab__count">{tabCounts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="loading-center" style={{ minHeight: 200 }}>
          <span className="spinner" />
          <span>Analysing your financial data…</span>
        </div>
      ) : !ran ? (
        <div className="insights-welcome">
          <div className="insights-welcome__icon">🧠</div>
          <h2>Financial Insights Engine</h2>
          <p>
            Click <strong>Run Analysis</strong> to detect spending anomalies, budget warnings,
            income trends, and more — all computed locally from your own data.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState activeTab={activeTab} />
      ) : (
        <div className="insights-list" role="tabpanel">
          {filtered.map((insight) => (
            <InsightCard key={insight.id} insight={insight} fmtCurrency={fmtCurrency} />
          ))}
        </div>
      )}

      {/* Info footer */}
      {ran && !loading && (
        <div className="insights-footer">
          <p>
            ℹ️ Insights are calculated client-side using your last 4 months of transactions
            and current budgets. No data leaves your device.
          </p>
        </div>
      )}
    </div>
  );
}
