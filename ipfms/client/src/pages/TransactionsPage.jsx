import React, { useEffect, useState, useCallback } from 'react';
import { toast }                from 'react-toastify';
import { useTransactions }      from '../hooks/useTransactions';
import { fmtCurrency }          from '../utils/formatCurrency';
import { fmtDate, startOfCurrentMonth, endOfCurrentMonth } from '../utils/dateHelpers';
import { CATEGORY_LABELS, CATEGORIES } from '../constants/categories';
import ErrorMessage             from '../components/common/ErrorMessage';
import ConfirmDialog            from '../components/common/ConfirmDialog';
import { RowSkeleton }          from '../components/common/LoadingSkeleton';

const EMPTY_FORM = {
  description: '', amount: '', date: '', type: 'debit',
  category: 'other', accountId: '',
};

export default function TransactionsPage() {
  const { transactions, pagination, loading, error, fetch, create, remove } = useTransactions();

  const [filters, setFilters] = useState({
    startDate: startOfCurrentMonth(),
    endDate:   endOfCurrentMonth(),
    type:      '',
    category:  '',
    search:    '',
    page:      1,
  });
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [confirmId,  setConfirmId]  = useState(null);
  const [sortDir,    setSortDir]    = useState('desc');

  const load = useCallback(() => {
    fetch({ ...filters, sort: `-date` });
  }, [filters, fetch]);

  useEffect(() => { load(); }, [load]);

  const handleFilterChange = (key, val) =>
    setFilters((f) => ({ ...f, [key]: val, page: 1 }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.amount || isNaN(form.amount)) { toast.error('Valid amount is required'); return; }
    if (!form.date) { toast.error('Date is required'); return; }
    setSaving(true);
    try {
      await create({ ...form, amount: parseFloat(form.amount) });
      toast.success('Transaction added');
      setForm(EMPTY_FORM);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Transactions</h2>
          {pagination && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              {pagination.total} total
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? '✕ Cancel' : '+ Add Transaction'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: '0.9375rem', fontWeight: 600 }}>New Transaction</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="desc">Description *</label>
                <input id="desc" className="form-input" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Grocery run" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="amt">Amount ($) *</label>
                <input id="amt" type="number" step="0.01" className="form-input" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="txdate">Date *</label>
                <input id="txdate" type="date" className="form-input" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="txtype">Type</label>
                <select id="txtype" className="form-select" value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="txcat">Category</label>
                <select id="txcat" className="form-select" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : 'Save Transaction'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: 130 }}>
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)} />
          </div>
          <div className="form-group" style={{ minWidth: 130 }}>
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)} />
          </div>
          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label">Type</label>
            <select className="form-select" value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}>
              <option value="">All types</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 150 }}>
            <label className="form-label">Category</label>
            <select className="form-select" value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-label">Search</label>
            <input type="search" className="form-input" placeholder="Description…"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)} />
          </div>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={load} />}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table" aria-label="Transactions list">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Type</th>
              <th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
                aria-sort={sortDir === 'desc' ? 'descending' : 'ascending'}
              >
                Date {sortDir === 'desc' ? '↓' : '↑'}
              </th>
              <th className="text-right">Amount</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} cols={6} />)
              : transactions.length === 0
              ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>
                    No transactions found.
                  </td>
                </tr>
              )
              : transactions.map((tx) => (
                <tr key={tx._id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {tx.isFlagged && <span title="Flagged" style={{ color: 'var(--red)', marginRight: 6 }}>⚑</span>}
                    {tx.description}
                  </td>
                  <td>
                    <span className="badge badge-neutral">{CATEGORY_LABELS[tx.category] || tx.category}</span>
                  </td>
                  <td>
                    <span className={`badge ${tx.type === 'credit' ? 'badge-success' : tx.type === 'transfer' ? 'badge-info' : 'badge-neutral'}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td>{fmtDate(tx.date)}</td>
                  <td className="text-right mono"
                    style={{ color: tx.type === 'credit' ? 'var(--accent)' : tx.amount < 0 ? 'var(--red)' : 'var(--text-primary)' }}>
                    {tx.type === 'credit' ? '+' : '-'}{fmtCurrency(tx.amount)}
                  </td>
                  <td className="text-right">
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.8125rem', color: 'var(--red)' }}
                      onClick={() => setConfirmId(tx._id)}
                      aria-label={`Delete transaction: ${tx.description}`}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex-center gap-8" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" disabled={filters.page <= 1}
              onClick={() => handleFilterChange('page', filters.page - 1)}>← Prev</button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Page {filters.page} of {pagination.pages}
            </span>
            <button className="btn btn-secondary" disabled={filters.page >= pagination.pages}
              onClick={() => handleFilterChange('page', filters.page + 1)}>Next →</button>
          </div>
        )}
      </div>

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
