import axios from 'axios';

// In production REACT_APP_API_URL points to the Render backend.
// Locally, CRA proxy (package.json "proxy") forwards /api to localhost:5000.
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api/v1`
    : '/api/v1',
  timeout: 60000, // 60s — Render free tier can take ~30-50s to cold-start
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach JWT + strip empty query params ──────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ipfms_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Strip empty-string / null / undefined params so they don't fail backend validation
    if (config.params) {
      config.params = Object.fromEntries(
        Object.entries(config.params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      );
    }
    return config;
  },
  (err) => Promise.reject(err),
);

// ── Response interceptor — unwrap envelope + normalise errors ───────────────
api.interceptors.response.use(
  (res) => {
    // Unwrap standard { success: true, data: ... } envelope
    if (res.data && res.data.success === true && 'data' in res.data) {
      return { ...res, data: res.data.data };
    }
    return res;
  },
  (err) => {
    const status = err.response?.status;
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Unknown error';

    if (status === 401) {
      // Token expired / invalid — clear local storage and redirect to login
      localStorage.removeItem('ipfms_token');
      localStorage.removeItem('ipfms_user');
      window.location.href = '/login';
    }

    const normalised = new Error(message);
    normalised.status = status;
    normalised.data   = err.response?.data;
    return Promise.reject(normalised);
  },
);

export default api;
