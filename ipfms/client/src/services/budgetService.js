import api from './apiClient';

export const budgetService = {
  /** List all budgets for current period */
  list: async (params = {}) => {
    const { data } = await api.get('/budgets', { params });
    return data; // { budgets }
  },

  /** Get a single budget */
  getOne: async (id) => {
    const { data } = await api.get(`/budgets/${id}`);
    return data;
  },

  /** Create a new budget */
  create: async (payload) => {
    const { data } = await api.post('/budgets', payload);
    return data;
  },

  /** Update a budget */
  update: async (id, payload) => {
    const { data } = await api.put(`/budgets/${id}`, payload);
    return data;
  },

  /** Soft-delete a budget */
  remove: async (id) => {
    const { data } = await api.delete(`/budgets/${id}`);
    return data;
  },

  /** Get savings recommendations */
  recommendations: async () => {
    const { data } = await api.get('/budgets/recommendations');
    return data; // { recommendations }
  },
};

export default budgetService;
