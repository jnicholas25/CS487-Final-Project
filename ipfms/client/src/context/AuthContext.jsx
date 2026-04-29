import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // true while we hydrate from localStorage

  // ── Hydrate from local storage on mount ──────────────────────────────
  useEffect(() => {
    const session = authService.loadSession();
    if (session) setUser(session.user);
    setLoading(false);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    const result = await authService.login({ email, password });
    if (result.requires2FA) return result; // caller handles 2FA flow
    authService.saveSession(result.token, result.user);
    setUser(result.user);
    return result;
  }, []);

  const verify2FA = useCallback(async ({ tempToken, code }) => {
    const result = await authService.verify2FA({ tempToken, code });
    authService.saveSession(result.token, result.user);
    setUser(result.user);
    return result;
  }, []);

  const register = useCallback(async (payload) => {
    const result = await authService.register(payload);
    authService.saveSession(result.token, result.user);
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(() => {
    authService.clearSession();
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem('ipfms_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    verify2FA,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
