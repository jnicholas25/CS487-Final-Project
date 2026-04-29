import axios from 'axios';

// Base URL comes from CRA proxy (package.json "proxy": "http://localhost:5000")
// so we only need the API path prefix here.
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach JWT ──────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ipfms_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err),
);

// ── Response interceptor — normalise errors ───────────────────────────────
api.interceptors.response.use(
  (res) => res,
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
