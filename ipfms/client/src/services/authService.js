import api from './apiClient';

// ── Auth service ──────────────────────────────────────────────────────────

export const authService = {
  /** Register a new user */
  register: async ({ name, email, password }) => {
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0] || name.trim();
    const lastName = parts.slice(1).join(' ') || firstName;
    const { data } = await api.post('/auth/register', { firstName, lastName, email, password });
    // After interceptor unwrap: data = { user, tokens: { accessToken, refreshToken } }
    return { user: data.user, token: data.tokens.accessToken };
  },

  /** Login with email + password */
  login: async ({ email, password }) => {
    const { data } = await api.post('/auth/login', { email, password });
    // Server: { requiresTwoFactor, tempToken } or { data: { user, tokens } }
    if (data.requiresTwoFactor) {
      return { requires2FA: true, tempToken: data.tempToken };
    }
    return { user: data.user, token: data.tokens.accessToken };
  },

  /** Verify the email OTP sent during login (mandatory 2FA) */
  verify2FA: async ({ tempToken, code }) => {
    // Send as emailOtp — the backend also accepts totpCode for authenticator-app users
    const { data } = await api.post('/auth/2fa/verify', { tempToken, emailOtp: code });
    // After interceptor unwrap: data = { user, tokens }
    return { user: data.user, token: data.tokens.accessToken };
  },

  /** Setup 2FA — returns QR code URI */
  setup2FA: async () => {
    const { data } = await api.post('/auth/2fa/setup');
    return data; // { otpauthUrl, secret }
  },

  /** Confirm 2FA setup with a TOTP code */
  confirm2FA: async (code) => {
    const { data } = await api.post('/auth/2fa/confirm', { code });
    return data;
  },

  /** Disable 2FA */
  disable2FA: async (code) => {
    const { data } = await api.post('/auth/2fa/disable', { code });
    return data;
  },

  /** Get the current user's profile */
  getProfile: async () => {
    const { data } = await api.get('/auth/me');
    return data; // { user }
  },

  /** Update profile (name, email) */
  updateProfile: async (updates) => {
    const { data } = await api.put('/auth/me', updates);
    return data;
  },

  /** Change password */
  changePassword: async ({ currentPassword, newPassword }) => {
    const { data } = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return data;
  },

  /** Persist token + user to local storage */
  saveSession: (token, user) => {
    localStorage.setItem('ipfms_token', token);
    localStorage.setItem('ipfms_user', JSON.stringify(user));
  },

  /** Clear session */
  clearSession: () => {
    localStorage.removeItem('ipfms_token');
    localStorage.removeItem('ipfms_user');
  },

  /** Read session from local storage */
  loadSession: () => {
    const token = localStorage.getItem('ipfms_token');
    const raw   = localStorage.getItem('ipfms_user');
    if (!token || !raw) return null;
    try {
      return { token, user: JSON.parse(raw) };
    } catch {
      return null;
    }
  },
};

export default authService;
