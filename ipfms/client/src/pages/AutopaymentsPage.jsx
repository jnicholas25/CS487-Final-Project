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

  const statusColour = (s) => s === 'active' ? 'var(--accent)' : s === 'paused' ? 'var(--orange)' : 'var(--text-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Scheduled Payments</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {payments.filter((p) => p.status === 'active').length} active
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleProcess} disabled={processing}>
            {processing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing…</> : '⟳ Run Now'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? '✕ Cancel' : '+ New Payment'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 600 }}>New Scheduled Payment</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Netflix" />
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
                <select className="form-select" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f.replace('-', ' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table" aria-label="Scheduled payments">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Frequency</th>
              <th>Next Due</th>
              <th>Status</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} style={{ padding: '12px 14px' }}>
                    <span className="skeleton" style={{ display: 'block', height: 13, width: '70%', borderRadius: 4 }} />
                  </td>
                ))}</tr>
              ))
              : payments.length === 0
              ? (<tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No scheduled payments.</td></tr>)
              : payments.map((p) => (
                <tr key={p._id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</td>
                  <td><span className="badge badge-neutral">{CATEGORY_LABELS[p.category] || p.category}</span></td>
                  <td style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{p.frequency}</td>
                  <td>{fmtDate(p.nextDueDate)}</td>
                  <td><span style={{ color: statusColour(p.status), fontWeight: 600, fontSize: '0.8125rem' }}>{p.status}</span></td>
                  <td className="text-right mono">{fmtCurrency(p.amount)}</td>
                  <td className="text-right">
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.8125rem', color: 'var(--red)' }}
                      onClick={() => setConfirmId(p._id)} aria-label={`Cancel ${p.name}`}>Cancel</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
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
