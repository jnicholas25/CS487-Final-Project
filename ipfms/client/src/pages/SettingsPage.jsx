import React, { useState } from 'react';
import { toast }          from 'react-toastify';
import { useAuth }        from '../context/AuthContext';
import authService        from '../services/authService';

const TABS = ['Profile', 'Security', 'Notifications'];

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('Profile');

  // Profile
  const [name,  setName]  = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  // Security
  const [currPwd, setCurrPwd] = useState('');
  const [newPwd,  setNewPwd]  = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // Notifications (local state only — extend with real API as needed)
  const [notifs, setNotifs] = useState({ email: true, budgetAlerts: true, anomalyAlerts: true, weeklyReport: false });

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const result = await authService.updateProfile({ name, email });
      updateUser(result.user || { name, email });
      toast.success('Profile updated');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currPwd) { toast.error('Current password required'); return; }
    if (newPwd.length < 8) { toast.error('New password must be 8+ characters'); return; }
    if (newPwd !== confPwd) { toast.error('Passwords do not match'); return; }
    setPwdSaving(true);
    try {
      await authService.changePassword({ currentPassword: currPwd, newPassword: newPwd });
      toast.success('Password changed successfully');
      setCurrPwd(''); setNewPwd(''); setConfPwd('');
    } catch (err) { toast.error(err.message); }
    finally { setPwdSaving(false); }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 20 }}>Settings</h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius)', padding: 4 }}>
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '8px 12px', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500,
              background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === tab ? 'var(--shadow-sm)' : 'none',
              transition: 'background 0.15s, color 0.15s',
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === 'Profile' && (
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 20 }}>Profile Information</h3>
          <form onSubmit={handleProfileSave}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="s-name">Full Name</label>
                <input id="s-name" type="text" className="form-input" value={name}
                  onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="s-email">Email Address</label>
                <input id="s-email" type="email" className="form-input" value={email}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Security tab */}
      {activeTab === 'Security' && (
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 20 }}>Change Password</h3>
          <form onSubmit={handlePasswordChange}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="curr-pwd">Current Password</label>
                <input id="curr-pwd" type="password" className="form-input" value={currPwd}
                  onChange={(e) => setCurrPwd(e.target.value)} autoComplete="current-password" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="new-pwd">New Password</label>
                <input id="new-pwd" type="password" className="form-input" value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password" placeholder="Min 8 characters" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="conf-pwd">Confirm New Password</label>
                <input id="conf-pwd" type="password" className="form-input" value={confPwd}
                  onChange={(e) => setConfPwd(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={pwdSaving}>
              {pwdSaving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Updating…</> : 'Update Password'}
            </button>
          </form>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />

          <div>
            <h4 style={{ fontWeight: 600, marginBottom: 8 }}>Two-Factor Authentication</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              {user?.twoFactorEnabled
                ? '2FA is currently enabled on your account.'
                : 'Add an extra layer of security with a TOTP authenticator app.'}
            </p>
            <span className={`badge ${user?.twoFactorEnabled ? 'badge-success' : 'badge-neutral'}`}>
              {user?.twoFactorEnabled ? '✓ Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      )}

      {/* Notifications tab */}
      {activeTab === 'Notifications' && (
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 20 }}>Notification Preferences</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { key: 'email',         label: 'Email notifications',     desc: 'Receive summary emails' },
              { key: 'budgetAlerts',  label: 'Budget alerts',           desc: 'Notify when spending exceeds 80% of budget' },
              { key: 'anomalyAlerts', label: 'Anomaly alerts',          desc: 'Notify on suspicious transaction detection' },
              { key: 'weeklyReport',  label: 'Weekly spending report',  desc: 'Receive a weekly digest every Monday' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex-between gap-8">
                <div>
                  <p style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{label}</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifs[key]}
                  onClick={() => setNotifs((n) => ({ ...n, [key]: !n[key] }))}
                  style={{
                    width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: notifs[key] ? 'var(--accent)' : 'var(--bg-elevated)',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}
                  aria-label={label}
                >
                  <span style={{
                    position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    left: notifs[key] ? 23 : 3,
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={() => toast.success('Preferences saved')}>
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
