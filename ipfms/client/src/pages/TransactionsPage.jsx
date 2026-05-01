import React, { useEffect, useState, useCallback } from 'react';
import { toast }                from 'react-toastify';
import { useTransactions }      from '../hooks/useTransactions';
import { useCurrency }          from '../context/CurrencyContext';
import accountService           from '../services/accountService';
import { fmtShortDate, startOfCurrentMonth, endOfCurrentMonth } from '../utils/dateHelpers';
import { CATEGORY_LABELS, CATEGORIES } from '../constants/categories';
import ErrorMessage             from '../components/common/ErrorMessage';
import ConfirmDialog            from '../components/common/ConfirmDialog';

const today = () => new Date().toISOString().split('T')[0];

const EMPTY_FORM = {
  description: '', amount: '', date: today(), type: 'debit',
  category: 'other', accountId: '',
};

export default function TransactionsPage() {
  const { fmtCurrency } = useCurrency();
  const { transactions, pagination, loading, error, fetch, create, remove } = useTransactions();

  const [filters, setFilters] = useState({
    startDate: startOfCurrentMonth(),
    endDate:   endOfCurrentMonth(),
    type:      '',
    category:  '',
    search:    '',
    isFlagged: '',
    page:      1,
  });
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [accounts,  setAccounts]  = useState([]);

  // Load accounts once on mount so the add-form always has a valid accountId
  useEffect(() => {
    accountService.list()
      .then((res) => {
        const accs = res.accounts || [];
        setAccounts(accs);
        if (accs.length > 0) {
          setForm((f) => ({ ...f, accountId: accs[0]._id.toString() }));
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    fetch({ ...filters, sort: '-date' });
  }, [filters, fetch]);

  useEffect(() => { load(); }, [load]);

  const handleFilterChange = (key, val) =>
    setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.amount || isNaN(form.amount)) { toast.error('Valid amount is required'); return; }
    if (!form.date) { toast.error('Date is required'); return; }
    if (!form.accountId) { toast.error('No account found. Please contact support.'); return; }
    setSaving(true);
    try {
      await create({ ...form, amount: parseFloat(form.amount) });
      toast.success('Transaction added');
      setForm((f) => ({ ...f, description: '', amount: '', date: today() }));
      setShowForm(false);
    } catch (err) {
      toast.error(err.message || 'Failed to add transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await remove(confirmId);
      toast.success('Transaction deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setConfirmId(null);
    }
  };

  const totalShowing = transactions.length;
  const totalCount   = pagination?.total ?? totalShowing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page title */}
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Transactions</h2>

      {/* Filter bar — all controls on one row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)', fontSize: '0.875rem', pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="search"
            className="form-input"
            placeholder="Search transactions…"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select className="form-select" value={filters.category} style={{ minWidth: 145 }}
          onChange={(e) => handleFilterChange('category', e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
          ))}
        </select>
        <select className="form-select" value={filters.type} style={{ minWidth: 115 }}
          onChange={(e) => handleFilterChange('type', e.target.value)}>
          <option value="">All Types</option>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
          <option value="transfer">Transfer</option>
        </select>
        <button
          className={`btn ${filters.isFlagged === 'true' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
          onClick={() => handleFilterChange('isFlagged', filters.isFlagged === 'true' ? '' : 'true')}>
          ⚑ Flagged
        </button>
        <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}
          onClick={() => setShowForm((s) => !s)}>
          {showForm ? '✕ Cancel' : '+ Add Transaction'}
        </button>
      </div>

      {/* Compact inline add form */}
      {showForm && (
        <div className="card" style={{ padding: '14px 16px', border: '1px solid var(--accent)' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="form-input" style={{ flex: 3, minWidth: 160 }}
                placeholder="e.g. Coffee Shop"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <input
                type="number" step="0.01" className="form-input" style={{ flex: 1, minWidth: 90 }}
                placeholder="Amount"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              {/* Type: debit or credit */}
              <select className="form-select" style={{ flex: 1, minWidth: 100 }}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
                <option value="transfer">Transfer</option>
              </select>
              <select className="form-select" style={{ flex: 1.5, minWidth: 130 }}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                ))}
              </select>
              <input
                type="date" className="form-input" style={{ flex: 1.2, minWidth: 130 }}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              {/* Account selector */}
              {accounts.length > 1 && (
                <select className="form-select" style={{ flex: 1.5, minWidth: 130 }}
                  value={form.accountId}
                  onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}{a.institutionName ? ` — ${a.institutionName}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ flexShrink: 0 }}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={load} />}

      {/* Transactions table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table" aria-label="Transactions list">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Account</th>
              <th className="text-right">Amount</th>
              <th style={{ width: 100 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {[90, '40%', '12%', '12%', 80, 80].map((w, j) => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <span className="skeleton" style={{ display: 'block', height: 13,
                        width: typeof w === 'string' ? w : w, borderRadius: 4 }} />
                    </td>
                  ))}
                </tr>
              ))
              : transactions.length === 0
              ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
                    No transactions found.
                  </td>
                </tr>
              )
              : transactions.map((tx) => {
                const accountName = tx.accountId?.name || '—';
                const isCredit    = tx.type === 'credit';
                return (
                  <tr key={tx._id}
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={() => setConfirmId(tx._id)}
                    title="Double-click to delete">
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                      {fmtShortDate(tx.date)}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {tx.description}
                      {tx.isRecurring && (
                        <span className="badge badge-info"
                          style={{ marginLeft: 6, fontSize: '0.65rem', verticalAlign: 'middle' }}>REC</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {CATEGORY_LABELS[tx.category] || tx.category || 'other'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      {accountName}
                    </td>
                    <td className="text-right mono"
                      style={{ color: isCredit ? 'var(--accent)' : 'var(--red)', fontWeight: 600 }}>
                      {isCredit ? '+' : '-'}{fmtCurrency(Math.abs(tx.amount))}
                    </td>
                    <td>
                      {tx.isFlagged
                        ? <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>FLAGGED</span>
                        : tx.isPending
                        ? <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>PENDING</span>
                        : <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1rem' }}>✓</span>
                      }
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Showing {totalShowing} of {totalCount} transactions
          </span>
          {pagination && pagination.pages > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-secondary" style={{ padding: '4px 10px' }}
                disabled={filters.page <= 1}
                onClick={() => handleFilterChange('page', filters.page - 1)}>←</button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pagination.pages || Math.abs(p - filters.page) <= 1)
                .map((p, idx, arr) => (
                  <React.Fragment key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span style={{ padding: '4px 4px', color: 'var(--text-tertiary)', lineHeight: '28px' }}>…</span>
                    )}
                    <button
                      className={`btn ${p === filters.page ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 10px', minWidth: 36 }}
                      onClick={() => handleFilterChange('page', p)}>{p}</button>
                  </React.Fragment>
                ))}
              <button className="btn btn-secondary" style={{ padding: '4px 10px' }}
                disabled={filters.page >= pagination.pages}
                onClick={() => handleFilterChange('page', filters.page + 1)}>→</button>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm — triggered by double-click on row */}
      {confirmId && (
        <ConfirmDialog
          title="Delete Transaction"
          message="This transaction will be permanently removed. This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
