import api from './apiClient';

export const healthService = {
  /** Get the current financial health score + sub-metrics */
  getScore: async () => {
    const { data } = await api.get('/health-score');
    return data; // { score, label, components, trend[], advice[] }
  },

  /** Get historical health score over last N months */
  history: async (months = 6) => {
    const { data } = await api.get('/health-score/history', { params: { months } });
    return data; // { history[] }
  },
};

export default healthService;
