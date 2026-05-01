import api from './apiClient';

export const accountService = {
  /** List all active accounts for the current user */
  list: async () => {
    const { data } = await api.get('/accounts');
    return data; // { accounts }
  },
};

export default accountService;
