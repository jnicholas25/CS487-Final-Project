import api from './apiClient';

export const paymentService = {
  /** List scheduled payments */
  list: async (params = {}) => {
    const { data } = await api.get('/payments', { params });
    return data; // { payments }
  },

  /** Get a single scheduled payment */
  getOne: async (id) => {
    const { data } = await api.get(`/payments/${id}`);
    return data;
  },

  /** Create a new scheduled payment */
  create: async (payload) => {
    const { data } = await api.post('/payments', payload);
    return data;
  },

  /** Update a scheduled payment */
  update: async (id, payload) => {
    const { data } = await api.put(`/payments/${id}`, payload);
    return data;
  },

  /** Cancel / soft-delete a scheduled payment */
  cancel: async (id) => {
    const { data } = await api.delete(`/payments/${id}`);
    return data;
  },

  /** Manually trigger processing of due payments */
  process: async () => {
    const { data } = await api.post('/payments/process');
    return data; // { processed, failed, skipped }
  },
};

export default paymentService;
