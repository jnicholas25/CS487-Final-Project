import React, { useEffect, useState, useCallback } from 'react';
import { toast }          from 'react-toastify';
import paymentService     from '../services/paymentService';
import { fmtCurrency }    from '../utils/formatCurrency';
import { fmtDate }        from '../utils/dateHelpers';
import ErrorMessage       from '../components/common/ErrorMessage';
import ConfirmDialog      from '../components/common/ConfirmDialog';
import { CATEGORIES, CATEGORY_LABELS } from '../constants/categories';

const FREQUENCIES = ['daily','weekly','bi-weekly','monthly','quarterly','annually'];
const EMPTY_FORM  = { name: '', amount: '', frequency: 'monthly', nextDueDate: '', category: 'other', description: '' };

function toMonthlyAmount(amount, frequency) {
  switch (frequency) {
    case 'daily':     return amount * 30;
    case 'weekly':    return amount * 4.33;
    case 'bi-weekly': return amount * 2.17;
    case 'monthly':   return amount;
    case 'quarterly': return amount / 3;
    case 'annually':  return amount / 12;
    default:          return amount;
  }
}

export default function AutopaymentsPage() {
  const [payments,  setPayments]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [processing,setProcessing]= useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await paymentService.list();
      setPayments(r.payments || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())  { toast.error('Name is required'); return; }
    if (!form.amount || isNaN(form.amount)) { toast.error('Valid amount required'); return; }
    if (!form.nextDueDate)  { toast.error('Next due date is required'); return; }
    setSaving(true);
    try {
      await paymentService.create({ ...form, amount: parseFloat(form.amount) });
      toast.success('Scheduled payment created');
      setForm(EMPTY_FORM); setShowForm(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleCancel = async () => {
    try {
      await paymentService.cancel(confirmId);
      toast.success('Payment cancelled');
      setPayments((prev) => prev.filter((p) => p._id !== confirmId));
    } catch (err) { toast.error(err.message); }
    finally { setConfirmId(null); }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const r = await paymentService.process();
      toast.success(`Processed: ${r.processed} payment(s)`);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setProcessing(false); }
  };

  // KPI derived values
  const activePayments = payments.filter((p) => p.status === 'active');
  const monthlyObligations = activePayments.reduce(
    (sum, p) => sum + toMonthlyAmount(p.amount, p.frequency), 0
  );
  const nextDue = activePayments
    .filter((p) => p.nextDueDate)
    .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))[0] || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Scheduled Payments</h2>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleProcess} disabled={processing}>
            {processing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing…</> : '⟳ Run Now'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? '✕ Cancel' : '+ Schedule Payment'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <div className="card">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Monthly Obligations</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--red)' }}>{fmtCurrency(monthlyObligations)}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>estimated / month</p>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Active Payments</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{activePayments.length}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
            {payments.length} total
          </p>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Next Due</p>
          {nextDue ? (
            <>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{nextDue.name}</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                {fmtDate(nextDue.nextDueDate)} · {fmtCurrency(nextDue.amount)}
              </p>
            </>
          ) : (
            <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>—</p>
          )}
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 600 }}>New Scheduled Payment</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Netflix" />
              </div>
              <div className="form-group">
                <label className="form-label">Amount ($) *</label>
                <input type="number" step="0.01" className="form-input" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Next Due Date *</label>
                <input type="date" className="form-input" value={form.nextDueDate}
                  onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select className="form-select" value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f.replace('-', ' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={load} />}

      {/* Payment List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <span className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span className="skeleton" style={{ display: 'block', height: 14, width: '40%', borderRadius: 4, marginBottom: 6 }} />
                  <span className="skeleton" style={{ display: 'block', height: 12, width: '60%', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p>No scheduled payments.</p>
          </div>
        ) : (
          <div>
            {payments.map((p, idx) => {
              const isActive = p.status === 'active';
              const initial  = (p.name || '?')[0].toUpperCase();
              const avatarBg = isActive ? 'var(--accent)' : 'var(--bg-elevated)';
              const avatarFg = isActive ? '#fff' : 'var(--text-secondary)';
              return (
                <div key={p._id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                  borderBottom: idx < payments.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: avatarBg,
                    color: avatarFg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '1rem', flexShrink: 0,
                  }}>
                    {initial}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                        {p.name}
                      </span>
                      <span className={`badge ${isActive ? 'badge-success' : 'badge-neutral'}`}
                        style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                        {p.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {CATEGORY_LABELS[p.category] || p.category} · {(p.frequency || '').replace('-', ' ')}
                    </p>
                  </div>

                  {/* Amount + due */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 3 }}>
                      {fmtCurrency(p.amount)}
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      Due {fmtDate(p.nextDueDate)}
                    </p>
                  </div>

                  {/* Action */}
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.8125rem', color: 'var(--red)', flexShrink: 0 }}
                    onClick={() => setConfirmId(p._id)} aria-label={`Cancel ${p.name}`}>Cancel</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmId && (
        <ConfirmDialog
          title="Cancel Payment"
          message="This scheduled payment will be cancelled and no longer processed."
          confirmLabel="Cancel Payment"
          danger
          onConfirm={handleCancel}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
