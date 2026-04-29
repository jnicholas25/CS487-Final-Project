import React, { useEffect, useState } from 'react';
import { toast }      from 'react-toastify';
import useAlerts      from '../hooks/useAlerts';
import { fmtDate, fmtRelative } from '../utils/dateHelpers';
import ErrorMessage   from '../components/common/ErrorMessage';

const SEVERITY_CONFIG = {
  critical: { border: 'var(--red)',    badge: 'badge-danger',  label: 'CRITICAL', statusLabel: 'HIGH' },
  high:     { border: 'var(--red)',    badge: 'badge-danger',  label: 'HIGH',     statusLabel: 'HIGH' },
  medium:   { border: 'var(--orange)', badge: 'badge-warning', label: 'MEDIUM',   statusLabel: 'MEDIUM' },
  low:      { border: '#3B82F6',       badge: 'badge-info',    label: 'LOW',      statusLabel: 'LOW' },
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
      {/* Header */}
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Anomaly Alerts</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="form-select" style={{ width: 140 }} value={statusFilter}
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
            const cfg     = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.low;
            const statusBadge = a.status === 'resolved'   ? { cls: 'badge-success', text: 'RESOLVED' }
                              : a.status === 'dismissed'  ? { cls: 'badge-neutral',  text: 'DISMISSED' }
                              : a.acknowledgedAt          ? { cls: 'badge-info',     text: 'ACKNOWLEDGED' }
                              :                             { cls: 'badge-warning',   text: 'OPEN' };
            return (
              <div key={a._id} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${cfg.border}`,
                borderRadius: 'var(--radius-lg)',
                padding: '16px 20px',
              }}>
                {/* Top row: badges + title + date */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`badge ${cfg.badge}`} style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                      {cfg.label}
                    </span>
                    <span className={`badge ${statusBadge.cls}`} style={{ fontSize: '0.7rem' }}>
                      {statusBadge.text}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                      {a.alertType?.replace(/_/g, ' ') || 'Anomaly'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {fmtRelative(a.createdAt)}
                  </span>
                </div>

                {/* Description */}
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {a.description || `Z-score: ${a.metadata?.zScore?.toFixed(2) ?? '—'} | Amount: ${a.metadata?.amount ? `$${a.metadata.amount}` : '—'}`}
                </p>

                {/* Recommendation */}
                {a.recommendation && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: 10 }}>
                    {a.recommendation}
                  </p>
                )}

                {/* Actions row */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {!a.acknowledgedAt && (
                    <button className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}
                      onClick={() => handleAck(a._id)}>Mark Seen</button>
                  )}
                  {(a.status === 'active' || a.status === 'acknowledged') && (
                    <button className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}
                      onClick={() => setResolveAlert(a)}>Resolve</button>
                  )}
                  <div style={{ flex: 1 }} />
                  <button className="btn btn-ghost" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}
                    onClick={() => handleDismiss(a._id)}>Dismiss</button>
                </div>

                {/* Resolved info */}
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
