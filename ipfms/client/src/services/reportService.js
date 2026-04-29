import api from './apiClient';

export const reportService = {
  /** Spending report by category */
  spending: async (params = {}) => {
    const { data } = await api.get('/reports/spending', { params });
    return data; // { report, period }
  },

  /** Income report */
  income: async (params = {}) => {
    const { data } = await api.get('/reports/income', { params });
    return data;
  },

  /** Net-worth snapshot */
  netWorth: async () => {
    const { data } = await api.get('/reports/net-worth');
    return data; // { bankTotal, investmentTotal, netWorth, accounts, investments }
  },

  /** Monthly spending trend for chart */
  spendingTrend: async (params = {}) => {
    const { data } = await api.get('/reports/charts/spending-trend', { params });
    return data; // { trend[] }
  },

  /** Category breakdown for pie chart */
  categoryBreakdown: async (params = {}) => {
    const { data } = await api.get('/reports/charts/category-breakdown', { params });
    return data; // { breakdown[] }
  },

  /** Income vs expense for bar chart */
  incomeVsExpense: async (params = {}) => {
    const { data } = await api.get('/reports/charts/income-vs-expense', { params });
    return data; // { monthly[] }
  },
};

export default reportService;
