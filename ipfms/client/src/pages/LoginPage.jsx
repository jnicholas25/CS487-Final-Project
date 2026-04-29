import React, { useState } from 'react';
import { useNavigate }   from 'react-router-dom';
import { toast }         from 'react-toastify';
import { useAuth }       from '../context/AuthContext';
import { ROUTES }        from '../constants/routes';
import { isEmail, isStrongPassword } from '../utils/validators';

export default function LoginPage() {
  const { login, verify2FA, register } = useAuth();
  const navigate = useNavigate();

  // 'login' | 'register' | '2fa'
  const [mode,      setMode]      = useState('login');
  const [loading,   setLoading]   = useState(false);
  const [tempToken, setTempToken] = useState('');

  // Form fields
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [code2FA,  setCode2FA]  = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!isEmail(email))    { toast.error('Enter a valid email'); return; }
    if (!password.trim())   { toast.error('Password is required'); return; }
    setLoading(true);
    try {
      const result = await login({ email, password });
      if (result.requires2FA) {
        setTempToken(result.tempToken);
        setMode('2fa');
        toast.info('Enter your authenticator code');
      } else {
        navigate(ROUTES.DASHBOARD, { replace: true });
      }
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
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
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 20, textAlign: 'center' }}>
              Enter the 6-digit code from your authenticator app.
            </p>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" htmlFor="code2fa">Authenticator Code</label>
              <input
                id="code2fa"
                type="text"
                className="form-input"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code2FA}
                onChange={(e) => setCode2FA(e.target.value)}
                autoComplete="one-time-code"
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.25rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Verifying…</> : 'Verify'}
            </button>
            <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }}
              onClick={() => { setMode('login'); setCode2FA(''); }}>
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
                placeholder="you@example.com"
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
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Signing in…</> : 'Sign In'}
            </button>
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
              <label className="form-label" htmlFor="email-reg">Email</label>
              <input id="email-reg" type="email" className="form-input" placeholder="you@example.com"
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
