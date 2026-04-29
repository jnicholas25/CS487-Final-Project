import React, { useEffect, useState } from 'react';
import { toast }      from 'react-toastify';
import useAlerts      from '../hooks/useAlerts';
import { fmtDate, fmtRelative } from '../utils/dateHelpers';
import ErrorMessage   from '../components/common/ErrorMessage';

const SEVERITY_STYLES = {
  critical: { bg: 'var(--red-muted)',    border: 'rgba(239,68,68,0.25)',   text: 'var(--red)',    badge: 'badge-danger'  },
  high:     { bg: 'var(--orange-muted)', border: 'rgba(245,158,11,0.25)', text: 'var(--orange)', badge: 'badge-warning' },
  medium:   { bg: 'var(--blue-muted)',   border: 'rgba(59,130,246,0.25)', text: 'var(--blue)',   badge: 'badge-info'    },
  low:      { bg: 'var(--bg-elevated)',  border: 'var(--border)',         text: 'var(--text-secondary)', badge: 'badge-neutral' },
};

function ResolveModal({ alert, onResolve, onClose }) {
  const [feedback, setFeedback] = useState('');
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);

  const submit = async () => {
    if (!feedback) { toast.error('Select a feedback option'); return; }
    setSaving(true);
    try { await onResolve(alert._id, { feedback, notes }); onClose(); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-lg)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Resolve Alert</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
          {alert.description || alert.alertType}
        </p>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Feedback *</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['confirmed_fraud', 'false_positive', 'investigating'].map((v) => (
              <button key={v} type="button"
                className={`btn ${feedback === v ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8125rem' }}
                onClick={() => setFeedback(v)}>
                {v.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Notes (optional)</label>
          <textarea className="form-textarea" rows={3} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Any additional context…" />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Resolving…</> : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { alerts, loading, error, fetch, acknowledge, resolve, dismiss, scan } = useAlerts();
  const [resolveAlert, setResolveAlert] = useState(null);
  const [scanning,     setScanning]     = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { fetch({ status: statusFilter || undefined }); }, [statusFilter]); // eslint-disable-line

  const handleScan = async () => {
    setScanning(true);
    try {
      const r = await scan(24);
      toast.success(`Scan complete — ${r.created} new alert(s)`);
      fetch({ status: statusFilter || undefined });
    } catch (err) { toast.error(err.message); }
    finally { setScanning(false); }
  };

  const handleAck = async (id) => {
    try { await acknowledge(id); toast.info('Acknowledged'); }
    catch (err) { toast.error(err.message); }
  };

  const handleDismiss = async (id) => {
    try { await dismiss(id); toast.success('Dismissed'); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Anomaly Alerts</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="form-select" style={{ width: 130 }} value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <button className="btn btn-primary" onClick={handleScan} disabled={scanning}>
            {scanning ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Scanning…</> : '⟳ Scan Now'}
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => fetch()} />}

      {loading ? (
        <div className="loading-center"><span className="spinner" /><span>Loading alerts…</span></div>
      ) : alerts.length === 0 ? (
        <div className="empty-state card">
          <span style={{ fontSize: '2rem' }}>✓</span>
          <h3>All clear</h3>
          <p>No anomaly alerts matching this filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map((a) => {
            const sty = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.low;
            return (
              <div key={a._id} style={{
                background: sty.bg, border: `1px solid ${sty.border}`,
                borderRadius: 'var(--radius-lg)', padding: '16px 20px',
              }}>
                <div className="flex-between gap-8" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge ${sty.badge}`}>{a.severity}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                      {a.alertType?.replace(/_/g, ' ') || 'Anomaly'}
                    </span>
                    {!a.acknowledgedAt && (
                      <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>NEW</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                    {fmtRelative(a.createdAt)}
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                  {a.description || `Z-score: ${a.metadata?.zScore?.toFixed(2) ?? '—'} | Amount: ${a.metadata?.amount ? `$${a.metadata.amount}` : '—'}`}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!a.acknowledgedAt && (
                    <button className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}
                      onClick={() => handleAck(a._id)}>Mark Seen</button>
                  )}
                  {a.status === 'active' || a.status === 'acknowledged' ? (
                    <button className="btn btn-secondary" style={{ fontSize: '0.8125rem', color: sty.text }}
                      onClick={() => setResolveAlert(a)}>Resolve</button>
                  ) : null}
                  <button className="btn btn-ghost" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}
                    onClick={() => handleDismiss(a._id)}>Dismiss</button>
                </div>
                {a.status === 'resolved' && a.feedback && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
                    Resolved: {a.feedback.replace(/_/g, ' ')} · {fmtDate(a.resolvedAt)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {resolveAlert && (
        <ResolveModal
          alert={resolveAlert}
          onResolve={resolve}
          onClose={() => setResolveAlert(null)}
        />
      )}
    </div>
  );
}
