import api from './apiClient';

export const alertService = {
  /** List anomaly alerts */
  list: async (params = {}) => {
    const { data } = await api.get('/alerts', { params });
    return data; // { alerts, pagination }
  },

  /** Get a single alert */
  getOne: async (id) => {
    const { data } = await api.get(`/alerts/${id}`);
    return data;
  },

  /** Trigger an anomaly scan for recent transactions */
  scan: async (lookbackHours = 24) => {
    const { data } = await api.post('/alerts/scan', { lookbackHours });
    return data; // { created, total }
  },

  /** Acknowledge an alert (mark as seen) */
  acknowledge: async (id) => {
    const { data } = await api.patch(`/alerts/${id}/acknowledge`);
    return data;
  },

  /** Resolve an alert with feedback */
  resolve: async (id, { feedback, notes }) => {
    const { data } = await api.patch(`/alerts/${id}/resolve`, { feedback, notes });
    return data;
  },

  /** Dismiss an alert */
  dismiss: async (id) => {
    const { data } = await api.patch(`/alerts/${id}/dismiss`);
    return data;
  },
};

export default alertService;
