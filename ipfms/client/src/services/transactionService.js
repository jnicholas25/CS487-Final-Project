import api from './apiClient';

export const transactionService = {
  /** List transactions with optional filters */
  list: async (params = {}) => {
    const { data } = await api.get('/transactions', { params });
    return data; // { transactions, pagination }
  },

  /** Get a single transaction */
  getOne: async (id) => {
    const { data } = await api.get(`/transactions/${id}`);
    return data; // { transaction }
  },

  /** Create a new transaction */
  create: async (payload) => {
    const { data } = await api.post('/transactions', payload);
    return data; // { transaction }
  },

  /** Update a transaction */
  update: async (id, payload) => {
    const { data } = await api.patch(`/transactions/${id}`, payload);
    return data;
  },

  /** Soft-delete a transaction */
  remove: async (id) => {
    const { data } = await api.delete(`/transactions/${id}`);
    return data;
  },

  /** Re-run categorisation on a transaction */
  categorise: async (id) => {
    const { data } = await api.post(`/transactions/${id}/categorise`);
    return data;
  },
};

export default transactionService;
