import React, { useState } from 'react';
import { toast }          from 'react-toastify';
import { useAuth }        from '../context/AuthContext';
import authService        from '../services/authService';

const TABS = [
  { key: 'Profile',         icon: '👤' },
  { key: 'Security',        icon: '🔒' },
  { key: 'Notifications',   icon: '🔔' },
  { key: 'Linked Accounts', icon: '🔗' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'CHF', 'CNY', 'MXN'];
const TIMEZONES  = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
];

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('Profile');

  // Parse first/last from name
  const nameParts  = (user?.name || '').trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName,  setLastName]  = useState(nameParts.slice(1).join(' ') || '');
  const [email,     setEmail]     = useState(user?.email || '');
  const [phone,     setPhone]     = useState(user?.phone || '');
  const [currency,  setCurrency]  = useState(user?.currency || 'USD');
  const [timezone,  setTimezone]  = useState(user?.timezone || 'America/New_York');
  const [saving,    setSaving]    = useState(false);

  // Security
  const [currPwd,  setCurrPwd]  = useState('');
  const [newPwd,   setNewPwd]   = useState('');
  const [confPwd,  setConfPwd]  = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // Notifications
  const [notifs, setNotifs] = useState({ email: true, budgetAlerts: true, anomalyAlerts: true, weeklyReport: false });

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) { toast.error('First name is required'); return; }
    setSaving(true);
    try {
      const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      const result = await authService.updateProfile({ name, email, phone, currency, timezone });
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
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Left Sidebar */}
      <div className="card" style={{ width: 200, flexShrink: 0, padding: '8px 0' }}>
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '0.875rem', fontWeight: activeTab === tab.key ? 600 : 400,
              borderLeft: activeTab === tab.key ? '3px solid var(--accent)' : '3px solid transparent',
              textAlign: 'left', transition: 'background 0.15s, color 0.15s',
            }}>
            <span style={{ fontSize: '1rem' }}>{tab.icon}</span>
            {tab.key}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Profile Tab */}
        {activeTab === 'Profile' && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Profile Information</h3>
            <form onSubmit={handleProfileSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="s-first">First Name *</label>
                  <input id="s-first" type="text" className="form-input" value={firstName}
                    onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="s-last">Last Name</label>
                  <input id="s-last" type="text" className="form-input" value={lastName}
                    onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="s-email">Email Address</label>
                  <input id="s-email" type="email" className="form-input" value={email}
                    onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="s-phone">Phone</label>
                  <input id="s-phone" type="tel" className="form-input" value={phone}
                    onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="s-currency">Currency</label>
                    <select id="s-currency" className="form-select" value={currency}
                      onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="s-tz">Timezone</label>
                    <select id="s-tz" className="form-select" value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}>
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'Security' && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Change Password</h3>
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

        {/* Notifications Tab */}
        {activeTab === 'Notifications' && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Notification Preferences</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { key: 'email',         label: 'Email notifications',    desc: 'Receive summary emails' },
                { key: 'budgetAlerts',  label: 'Budget alerts',          desc: 'Notify when spending exceeds 80% of budget' },
                { key: 'anomalyAlerts', label: 'Anomaly alerts',         desc: 'Notify on suspicious transaction detection' },
                { key: 'weeklyReport',  label: 'Weekly spending report', desc: 'Receive a weekly digest every Monday' },
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

        {/* Linked Accounts Tab */}
        {activeTab === 'Linked Accounts' && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Linked Accounts</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Connect external bank accounts and financial institutions to automatically import transactions.
            </p>
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <p style={{ fontSize: '0.875rem' }}>No linked accounts yet.</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => toast.info('Coming soon')}>
                + Link Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
