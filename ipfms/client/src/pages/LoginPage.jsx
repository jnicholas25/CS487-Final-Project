import React, { useState } from 'react';
import { useNavigate }   from 'react-router-dom';
import { toast }         from 'react-toastify';
import { useAuth }       from '../context/AuthContext';
import { ROUTES }        from '../constants/routes';
import { isEmail, isStrongPassword } from '../utils/validators';

/** Only @gmail.com addresses are allowed */
const isGmailAddress = (email) => /^[^\s@]+@gmail\.com$/i.test(email.trim());

export default function LoginPage() {
  const { login, verify2FA, register } = useAuth();
  const navigate = useNavigate();

  // 'login' | 'register' | '2fa'
  const [mode,        setMode]      = useState('login');
  const [loading,     setLoading]   = useState(false);
  const [slowRequest, setSlowRequest] = useState(false);
  const [tempToken,   setTempToken] = useState('');
  const [otpHint,     setOtpHint]   = useState(''); // fallback if email isn't delivered

  // Form fields
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [code2FA,  setCode2FA]  = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isEmail(email))         { toast.error('Enter a valid email'); return; }
    if (!isGmailAddress(email))  { toast.error('Only Gmail addresses (@gmail.com) are allowed'); return; }
    if (!password.trim())        { toast.error('Password is required'); return; }
    setLoading(true);
    setSlowRequest(false);
    // After 5 seconds show a "waking up server…" message (Render free tier cold start)
    const slowTimer = setTimeout(() => setSlowRequest(true), 5000);
    try {
      const result = await login({ email, password });
      if (result.requires2FA) {
        setTempToken(result.tempToken);
        setOtpHint(result.otp || '');
        setMode('2fa');
        toast.info('A verification code has been sent to your Gmail');
      } else {
        navigate(ROUTES.DASHBOARD, { replace: true });
      }
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlowRequest(false);
    }
  };

  const handle2FA = async (e) => {
    e.preventDefault();
    if (!code2FA.trim()) { toast.error('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      await verify2FA({ tempToken, code: code2FA });
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      toast.error(err.message || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim())               { toast.error('Name is required'); return; }
    if (!isEmail(email))            { toast.error('Enter a valid email'); return; }
    if (!isGmailAddress(email))     { toast.error('Only Gmail addresses (@gmail.com) are allowed to register'); return; }
    if (!isStrongPassword(password)){ toast.error('Password must be 8+ chars with uppercase, lowercase, number & special character'); return; }
    setLoading(true);
    try {
      await register({ name, email, password });
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: 40,
        width: '100%',
        maxWidth: 400,
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: '2.5rem', color: 'var(--accent)', lineHeight: 1 }}>⬡</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 8, color: 'var(--text-primary)' }}>
            IPFMS
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Intelligent Personal Finance
          </p>
        </div>

        {/* 2FA Mode */}
        {mode === '2fa' && (
          <form onSubmit={handle2FA} noValidate>
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '1.5rem' }}>📧</span>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                A 6-digit verification code has been sent to your Gmail.
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, var(--text-secondary))', margin: '4px 0 0' }}>
                Check your inbox (and spam folder). Expires in 5 minutes.
              </p>
            </div>
            {otpHint && (
              <div style={{
                background: '#1a1a2e',
                border: '1px solid #4f46e5',
                borderRadius: 8,
                padding: '10px 16px',
                marginBottom: 16,
                textAlign: 'center',
              }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                  📬 Didn't get the email? Your code is:
                </p>
                <span style={{
                  fontSize: '1.75rem', fontWeight: 800, letterSpacing: '0.3em',
                  color: '#818cf8', fontFamily: 'monospace',
                }}>
                  {otpHint}
                </span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" htmlFor="code2fa">Verification Code</label>
              <input
                id="code2fa"
                type="text"
                className="form-input"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code2FA}
                onChange={(e) => setCode2FA(e.target.value.replace(/\D/g, ''))}
                autoComplete="one-time-code"
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.25rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Verifying…</> : 'Verify Code'}
            </button>
            <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }}
              onClick={() => { setMode('login'); setCode2FA(''); setOtpHint(''); }}>
              ← Back to Login
            </button>
          </form>
        )}

        {/* Login Mode */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} noValidate>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="email-login">Email</label>
              <input
                id="email-login"
                type="email"
                className="form-input"
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" htmlFor="password-login">Password</label>
              <input
                id="password-login"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> {slowRequest ? 'Waking up server…' : 'Signing in…'}</>
                : 'Sign In'}
            </button>
            {slowRequest && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8 }}>
                Server is starting up — this may take up to 30 seconds on first load.
              </p>
            )}
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Don't have an account?{' '}
              <button type="button" onClick={() => setMode('register')}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
                Register
              </button>
            </p>
          </form>
        )}

        {/* Register Mode */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} noValidate>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="name-reg">Full Name</label>
              <input id="name-reg" type="text" className="form-input" placeholder="Jane Smith"
                value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="email-reg">Gmail Address</label>
              <input id="email-reg" type="email" className="form-input" placeholder="you@gmail.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" htmlFor="password-reg">Password</label>
              <input id="password-reg" type="password" className="form-input" placeholder="Min 8 chars"
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating account…</> : 'Create Account'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
                Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
