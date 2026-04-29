import React, { useEffect, useState, useCallback } from 'react';
import { toast }              from 'react-toastify';
import investmentService      from '../services/investmentService';
import { fmtCurrency }        from '../utils/formatCurrency';
import ErrorMessage           from '../components/common/ErrorMessage';
import ConfirmDialog          from '../components/common/ConfirmDialog';
import { CardSkeleton }       from '../components/common/LoadingSkeleton';

const ASSET_TYPES = ['stock', 'etf', 'mutual_fund', 'crypto', 'bond', 'real_estate', 'commodity', 'other'];
const EMPTY_FORM  = { symbol: '', name: '', assetType: 'stock', quantity: '', purchasePrice: '', currentPrice: '', purchaseDate: '', currency: 'USD' };

const TYPE_BADGE_COLOURS = {
  stock:       '#3B82F6',
  etf:         '#10B981',
  mutual_fund: '#8B5CF6',
  crypto:      '#F59E0B',
  bond:        '#06B6D4',
  real_estate: '#F97316',
  commodity:   '#84CC16',
  other:       '#94A3B8',
};

export default function InvestmentsPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await investmentService.portfolio();
      setPortfolio(result);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.symbol.trim()) { toast.error('Symbol is required'); return; }
    if (!form.quantity || isNaN(form.quantity)) { toast.error('Valid quantity required'); return; }
    if (!form.purchasePrice || isNaN(form.purchasePrice)) { toast.error('Valid purchase price required'); return; }
    setSaving(true);
    try {
      await investmentService.create({
        ...form,
        quantity:      parseFloat(form.quantity),
        purchasePrice: parseFloat(form.purchasePrice),
        currentPrice:  form.currentPrice ? parseFloat(form.currentPrice) : undefined,
      });
      toast.success('Holding added');
      setForm(EMPTY_FORM); setShowForm(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await investmentService.remove(confirmId);
      toast.success('Holding removed');
      load();
    } catch (err) { toast.error(err.message); }
    finally { setConfirmId(null); }
  };

  const summary  = portfolio?.summary;
  const holdings = portfolio?.holdings || [];

  // Asset allocation by type
  const allocationMap = holdings.reduce((acc, h) => {
    const key = (h.assetType || 'other').toUpperCase();
    if (!acc[key]) acc[key] = { value: 0, count: 0, type: h.assetType };
    acc[key].value += h.currentValue || 0;
    acc[key].count++;
    return acc;
  }, {});
  const totalPortfolioValue = summary?.totalCurrentValue || 0;
  const allocationEntries = Object.entries(allocationMap).sort((a, b) => b[1].value - a[1].value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="flex-between">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Investments</h2>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? '✕ Cancel' : '+ Add Holding'}
        </button>
      </div>

      {/* 4 KPI Cards */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[1,2,3,4].map((i) => <CardSkeleton key={i} lines={2} />)}
        </div>
      ) : summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          <div className="card">
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Portfolio Value</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
              {fmtCurrency(summary.totalCurrentValue)}
            </p>
          </div>
          <div className="card">
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Total Gain / Loss</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700,
              color: (summary.totalGainLoss ?? 0) >= 0 ? 'var(--accent)' : 'var(--red)' }}>
              {(summary.totalGainLoss ?? 0) >= 0 ? '+' : ''}{fmtCurrency(summary.totalGainLoss ?? 0)}
            </p>
            <p style={{ fontSize: '0.8125rem',
              color: (summary.totalGainLossPct ?? 0) >= 0 ? 'var(--accent)' : 'var(--red)', marginTop: 2 }}>
              {(summary.totalGainLossPct ?? 0) >= 0 ? '+' : ''}{(summary.totalGainLossPct ?? 0).toFixed(1)}%
            </p>
          </div>
          <div className="card">
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Total Cost Basis</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              {fmtCurrency(summary.totalCostBasis)}
            </p>
          </div>
          <div className="card">
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Dividend Income YTD</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3B82F6' }}>
              {fmtCurrency(summary.totalDividendsReceived ?? 0)}
            </p>
          </div>
        </div>
      )}

      {/* Add Holding Form */}
      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 600 }}>New Holding</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { id: 'symbol', label: 'Symbol *', placeholder: 'AAPL', field: 'symbol' },
                { id: 'hname',  label: 'Name',     placeholder: 'Apple Inc.', field: 'name' },
                { id: 'qty',    label: 'Quantity *', placeholder: '10', field: 'quantity', type: 'number' },
                { id: 'pprice', label: 'Purchase Price ($) *', placeholder: '0.00', field: 'purchasePrice', type: 'number' },
                { id: 'cprice', label: 'Current Price ($)', placeholder: '0.00', field: 'currentPrice', type: 'number' },
                { id: 'pdate',  label: 'Purchase Date', field: 'purchaseDate', type: 'date' },
              ].map(({ id, label, placeholder, field, type = 'text' }) => (
                <div key={id} className="form-group">
                  <label className="form-label" htmlFor={id}>{label}</label>
                  <input id={id} type={type} step="any" className="form-input" placeholder={placeholder}
                    value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Asset Type</label>
                <select className="form-select" value={form.assetType}
                  onChange={(e) => setForm({ ...form, assetType: e.target.value })}>
                  {ASSET_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : 'Add Holding'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={load} />}

      {/* Holdings Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table" aria-label="Investment holdings">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>Type</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Avg Cost</th>
              <th className="text-right">Price</th>
              <th className="text-right">Value</th>
              <th className="text-right">Gain / Loss</th>
              <th className="text-right">Dividends</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <td key={j} style={{ padding: '12px 14px' }}>
                      <span className="skeleton" style={{ display: 'block', height: 13, width: '70%', borderRadius: 4 }} />
                    </td>
                  ))}
                </tr>
              ))
              : holdings.length === 0
              ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                    No holdings yet. Add your first investment above.
                  </td>
                </tr>
              )
              : holdings.map((h) => {
                const gl    = (h.currentValue || 0) - (h.totalCostBasis || 0);
                const glPct = h.totalCostBasis ? (gl / h.totalCostBasis) * 100 : 0;
                const glCol = gl >= 0 ? 'var(--accent)' : 'var(--red)';
                const badgeColour = TYPE_BADGE_COLOURS[h.assetType] || '#94A3B8';
                return (
                  <tr key={h._id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{h.symbol}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{h.name || '—'}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                        background: `${badgeColour}22`, color: badgeColour, textTransform: 'uppercase',
                      }}>
                        {h.assetType}
                      </span>
                    </td>
                    <td className="text-right mono">{h.quantity}</td>
                    <td className="text-right mono">{fmtCurrency(h.purchasePrice || 0)}</td>
                    <td className="text-right mono">{fmtCurrency(h.currentPrice || 0)}</td>
                    <td className="text-right mono">{fmtCurrency(h.currentValue || 0)}</td>
                    <td className="text-right mono" style={{ color: glCol }}>
                      <div>{gl >= 0 ? '+' : ''}{fmtCurrency(gl)}</div>
                      <div style={{ fontSize: '0.75rem', marginTop: 2 }}>
                        {gl >= 0 ? '+' : ''}{glPct.toFixed(1)}%
                      </div>
                    </td>
                    <td className="text-right mono" style={{ color: 'var(--text-secondary)' }}>
                      {fmtCurrency(h.dividendsReceived || 0)}
                    </td>
                    <td className="text-right">
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.8125rem', color: 'var(--red)' }}
                        onClick={() => setConfirmId(h._id)} aria-label={`Remove ${h.symbol}`}>✕</button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Asset Allocation */}
      {!loading && allocationEntries.length > 0 && (
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 16, fontSize: '0.9375rem' }}>Asset Allocation</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {allocationEntries.map(([key, data]) => {
              const pct = totalPortfolioValue > 0 ? (data.value / totalPortfolioValue) * 100 : 0;
              const colour = TYPE_BADGE_COLOURS[data.type] || '#94A3B8';
              return (
                <div key={key} style={{ padding: '14px 16px', background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: colour, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase' }}>{key}</span>
                  </div>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: colour }}>{pct.toFixed(1)}%</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {fmtCurrency(data.value)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {confirmId && (
        <ConfirmDialog
          title="Remove Holding"
          message="This holding and all its dividend history will be removed."
          confirmLabel="Remove"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
