import api from './apiClient';

export const investmentService = {
  /** List holdings */
  list: async (params = {}) => {
    const { data } = await api.get('/investments', { params });
    return data; // { investments }
  },

  /** Portfolio summary (totals, allocation) */
  portfolio: async () => {
    const { data } = await api.get('/investments/portfolio');
    return data; // { holdings, summary }
  },

  /** Performance metrics for all holdings */
  performance: async () => {
    const { data } = await api.get('/investments/performance');
    return data; // { performance[] }
  },

  /** Dividend summary (all-time + YTD) */
  dividendSummary: async () => {
    const { data } = await api.get('/investments/dividends/summary');
    return data;
  },

  /** Flat dividend history list */
  dividendHistory: async (params = {}) => {
    const { data } = await api.get('/investments/dividends/history', { params });
    return data;
  },

  /** Get a single holding */
  getOne: async (id) => {
    const { data } = await api.get(`/investments/${id}`);
    return data;
  },

  /** Create a new holding */
  create: async (payload) => {
    const { data } = await api.post('/investments', payload);
    return data;
  },

  /** Update a holding */
  update: async (id, payload) => {
    const { data } = await api.put(`/investments/${id}`, payload);
    return data;
  },

  /** Soft-delete a holding */
  remove: async (id) => {
    const { data } = await api.delete(`/investments/${id}`);
    return data;
  },

  /** Add a dividend to a holding */
  addDividend: async (id, payload) => {
    const { data } = await api.post(`/investments/${id}/dividends`, payload);
    return data;
  },
};

export default investmentService;
