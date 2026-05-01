import React, { useEffect, useState } from 'react';
import { toast }         from 'react-toastify';
import { useBudget }     from '../hooks/useBudget';
import { useCurrency }   from '../context/CurrencyContext';
import { fmtMonthYear, startOfCurrentMonth, endOfCurrentMonth } from '../utils/dateHelpers';
import { CATEGORY_LABELS, CATEGORIES } from '../constants/categories';
import ErrorMessage      from '../components/common/ErrorMessage';
import ConfirmDialog     from '../components/common/ConfirmDialog';
import { CardSkeleton }  from '../components/common/LoadingSkeleton';

const EMPTY_FORM = {
  name: '',
  period: 'monthly',
  startDate: startOfCurrentMonth(),
  endDate: endOfCurrentMonth(),
  savingsGoal: '',
  categories: [{ category: 'food_dining', limit: '' }],
};

export default function BudgetPage() {
  const { fmtCurrency } = useCurrency();
  const { budgets, recommendations, loading, error, fetch, fetchRecommendations, create, remove } = useBudget();
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    fetch();
    fetchRecommendations();
  }, []); // eslint-disable-line

  const activeBudget   = budgets.find((b) => b.isActive) || budgets[0] || null;
  const totalLimit     = activeBudget?.totalLimit ?? 0;
  const totalSpent     = activeBudget?.totalSpent ?? 0;
  const totalRemaining = Math.max(0, totalLimit - totalSpent);
  const savingsGoal    = activeBudget?.savingsGoal ?? null;
  const overallPct     = totalLimit > 0 ? Math.min(100, Math.round((totalSpent / totalLimit) * 100)) : 0;
  const categories     = activeBudget?.categories || [];
  const periodLabel    = activeBudget?.startDate ? fmtMonthYear(activeBudget.startDate) : 'Current Period';

  const addCategoryRow = () =>
    setForm((f) => ({ ...f, categories: [...f.categories, { category: 'other', limit: '' }] }));

  const removeCategoryRow = (i) =>
    setForm((f) => ({ ...f, categories: f.categories.filter((_, idx) => idx !== i) }));

  const updateCategoryRow = (i, key, val) =>
    setForm((f) => ({
      ...f,
      categories: f.categories.map((c, idx) => idx === i ? { ...c, [key]: val } : c),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) { toast.error('Start and end dates are required'); return; }
    const validCats = form.categories.filter(
      (c) => c.category && c.limit && !isNaN(c.limit) && parseFloat(c.limit) > 0
    );
    if (validCats.length === 0) { toast.error('At least one category with a limit is required'); return; }
    setSaving(true);
    try {
      await create({
        name:       form.name || undefined,
        period:     form.period,
        startDate:  form.startDate,
        endDate:    form.endDate,
        savingsGoal: form.savingsGoal ? parseFloat(form.savingsGoal) : undefined,
        categories: validCats.map((c) => ({ category: c.category, limit: parseFloat(c.limit) })),
      });
      toast.success('Budget created');
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save budget');
    } finally {
      setSaving(false);
    }
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
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? '✕ Cancel' : '+ New Budget'}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {loading ? [1,2,3,4].map((i) => <CardSkeleton key={i} lines={2} />) : (
          <>
            <div className="card">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Total Budget</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{fmtCurrency(totalLimit)}</p>
            </div>
            <div className="card">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Total Spent</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: totalSpent > totalLimit ? 'var(--red)' : 'var(--text-primary)' }}>
                {fmtCurrency(totalSpent)}
              </p>
            </div>
            <div className="card">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Remaining</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: totalRemaining > 0 ? 'var(--accent)' : 'var(--red)' }}>
                {fmtCurrency(totalRemaining)}
              </p>
            </div>
            <div className="card">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Savings Goal</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--blue, #3B82F6)' }}>
                {savingsGoal !== null ? fmtCurrency(savingsGoal) : '—'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Create Budget Form */}
      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 600 }}>New Budget</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Name (optional)</label>
                <input className="form-input" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="April Budget" />
              </div>
              <div className="form-group">
                <label className="form-label">Period</label>
                <select className="form-select" value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}>
                  {['weekly','biweekly','monthly','quarterly','yearly'].map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Savings Goal ($)</label>
                <input type="number" step="0.01" className="form-input" value={form.savingsGoal}
                  onChange={(e) => setForm({ ...form, savingsGoal: e.target.value })} placeholder="0.00" />
              </div>
            </div>

            {/* Category rows */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>Categories *</label>
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8125rem' }}
                  onClick={addCategoryRow}>+ Add Category</button>
              </div>
              {form.categories.map((cat, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                  <select className="form-select" style={{ flex: 2 }} value={cat.category}
                    onChange={(e) => updateCategoryRow(i, 'category', e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                  </select>
                  <input type="number" step="0.01" className="form-input" style={{ flex: 1 }}
                    placeholder="Limit $" value={cat.limit}
                    onChange={(e) => updateCategoryRow(i, 'limit', e.target.value)} />
                  {form.categories.length > 1 && (
                    <button type="button" className="btn btn-ghost" style={{ color: 'var(--red)', flexShrink: 0 }}
                      onClick={() => removeCategoryRow(i)}>✕</button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : 'Create Budget'}
              </button>
              <button type="button" className="btn btn-secondary"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={fetch} />}

      {/* Overall Progress */}
      {!loading && activeBudget && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 14 }}>
            <h3 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
              Overall Progress — {periodLabel}
            </h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {budgets.length > 1 && (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                  {budgets.length} budgets
                </span>
              )}
              <button className="btn btn-ghost" style={{ fontSize: '0.8125rem', color: 'var(--red)', padding: '4px 8px' }}
                onClick={() => setConfirmId(activeBudget._id)}>Remove</button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {fmtCurrency(totalSpent)} of {fmtCurrency(totalLimit)}
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700,
              color: overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--orange)' : 'var(--accent)' }}>
              {overallPct}%
            </span>
          </div>
          <div className="progress-track" style={{ height: 10 }}>
            <div className="progress-fill" style={{
              width: `${overallPct}%`,
              background: overallPct >= 100 ? 'var(--red)' : overallPct >= 80 ? 'var(--orange)' : 'var(--accent)',
            }} />
          </div>
        </div>
      )}

      {/* Category Cards */}
      {!loading && categories.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {categories.map((cat) => {
            const pct       = cat.limit > 0 ? Math.min(100, Math.round((cat.spent / cat.limit) * 100)) : 0;
            const colour    = pct >= 100 ? 'var(--red)' : pct >= (cat.alertThreshold || 80) ? 'var(--orange)' : 'var(--accent)';
            const remaining = Math.max(0, cat.limit - cat.spent);
            return (
              <div key={cat._id} className="card">
                <div className="flex-between gap-8" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                      background: cat.color || colour,
                    }} />
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {CATEGORY_LABELS[cat.category] || cat.category}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {fmtCurrency(cat.spent)} / {fmtCurrency(cat.limit)}
                  </span>
                </div>
                <div className="progress-track" style={{ marginBottom: 8 }}>
                  <div className="progress-fill" style={{ width: `${pct}%`, background: colour }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: colour }}>{pct}% used</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {fmtCurrency(remaining)} left
                  </span>
                </div>
                {pct >= 100 && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.1)',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--red)' }}>
                    Budget exceeded by {fmtCurrency(cat.spent - cat.limit)}
                  </div>
                )}
                {pct >= (cat.alertThreshold || 80) && pct < 100 && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(245,158,11,0.1)',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--orange)' }}>
                    Approaching limit — {fmtCurrency(remaining)} left
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && budgets.length === 0 && (
        <div className="empty-state card">
          <h3>No budgets yet</h3>
          <p>Create your first budget to start tracking spending.</p>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 14 }}>Savings Recommendations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recommendations.map((r, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
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
