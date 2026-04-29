import React, { useEffect, useState } from 'react';
import { toast }         from 'react-toastify';
import { useBudget }     from '../hooks/useBudget';
import { fmtCurrency }   from '../utils/formatCurrency';
import { CATEGORY_LABELS, CATEGORIES } from '../constants/categories';
import ErrorMessage      from '../components/common/ErrorMessage';
import ConfirmDialog     from '../components/common/ConfirmDialog';
import { CardSkeleton }  from '../components/common/LoadingSkeleton';

const PERIODS = ['weekly', 'monthly', 'yearly'];
const EMPTY_FORM = { category: 'food_dining', amount: '', period: 'monthly' };

export default function BudgetPage() {
  const { budgets, recommendations, loading, error, fetch, fetchRecommendations, create, update, remove } = useBudget();
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [editId,    setEditId]    = useState(null);

  useEffect(() => {
    fetch();
    fetchRecommendations();
  }, []); // eslint-disable-line

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + (b.spent || 0), 0);
  const overCount     = budgets.filter((b) => (b.spent || 0) >= b.amount).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) {
      toast.error('Enter a valid positive amount'); return;
    }
    setSaving(true);
    try {
      if (editId) {
        await update(editId, { ...form, amount: parseFloat(form.amount) });
        toast.success('Budget updated');
      } else {
        await create({ ...form, amount: parseFloat(form.amount) });
        toast.success('Budget created');
      }
      setForm(EMPTY_FORM); setShowForm(false); setEditId(null);
    } catch (err) {
      toast.error(err.message || 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (b) => {
    setForm({ category: b.category, amount: String(b.amount), period: b.period });
    setEditId(b._id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    try {
      await remove(confirmId);
      toast.success('Budget removed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="flex-between">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Budgets</h2>
        <button className="btn btn-primary" onClick={() => { setShowForm((s) => !s); setEditId(null); setForm(EMPTY_FORM); }}>
          {showForm && !editId ? '✕ Cancel' : '+ New Budget'}
        </button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {loading ? [1,2,3].map((i) => <CardSkeleton key={i} lines={2} />) : (
          <>
            <div className="card">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Total Budgeted</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{fmtCurrency(totalBudgeted)}</p>
            </div>
            <div className="card">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Total Spent</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: totalSpent > totalBudgeted ? 'var(--red)' : 'var(--text-primary)' }}>
                {fmtCurrency(totalSpent)}
              </p>
            </div>
            <div className="card">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Over Limit</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: overCount > 0 ? 'var(--red)' : 'var(--accent)' }}>
                {overCount} {overCount === 1 ? 'category' : 'categories'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 600 }}>{editId ? 'Edit Budget' : 'New Budget'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount ($)</label>
                <input type="number" step="0.01" className="form-input" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Period</label>
                <select className="form-select" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                  {PERIODS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : (editId ? 'Update' : 'Create Budget')}
              </button>
              <button type="button" className="btn btn-secondary"
                onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={fetch} />}

      {/* Budget cards */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {[1,2,3,4].map((i) => <CardSkeleton key={i} lines={3} />)}
        </div>
      ) : budgets.length === 0 ? (
        <div className="empty-state card">
          <span style={{ fontSize: '2rem' }}>📊</span>
          <h3>No budgets yet</h3>
          <p>Create your first budget to start tracking spending.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {budgets.map((b) => {
            const pct    = b.amount > 0 ? Math.min(100, ((b.spent || 0) / b.amount) * 100) : 0;
            const colour = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--orange)' : 'var(--accent)';
            return (
              <div key={b._id} className="card">
                <div className="flex-between gap-8" style={{ marginBottom: 10 }}>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{CATEGORY_LABELS[b.category] || b.category}</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{b.period}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => startEdit(b)} aria-label={`Edit ${b.category} budget`}>✎</button>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--red)' }}
                      onClick={() => setConfirmId(b._id)} aria-label={`Delete ${b.category} budget`}>✕</button>
                  </div>
                </div>
                <div className="flex-between gap-8" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {fmtCurrency(b.spent || 0)} spent
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: colour }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: colour }} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 6 }}>
                  of {fmtCurrency(b.amount)} budget
                </p>
                {pct >= 100 && (
                  <span className="badge badge-danger" style={{ marginTop: 8 }}>Over limit</span>
                )}
                {pct >= 80 && pct < 100 && (
                  <span className="badge badge-warning" style={{ marginTop: 8 }}>Near limit</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 14 }}>💡 Savings Recommendations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recommendations.map((r, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {r.message || r}
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmId && (
        <ConfirmDialog
          title="Delete Budget"
          message="This budget and its tracking data will be removed."
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
