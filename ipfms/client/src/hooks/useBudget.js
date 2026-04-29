import { useState, useCallback } from 'react';
import budgetService from '../services/budgetService';

export function useBudget() {
  const [budgets,         setBudgets]         = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);

  const fetch = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await budgetService.list(params);
      setBudgets(result.budgets || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      const result = await budgetService.recommendations();
      setRecommendations(result.recommendations || []);
    } catch (err) {
      console.error('useBudget: recommendations error', err);
    }
  }, []);

  const create = useCallback(async (payload) => {
    const result = await budgetService.create(payload);
    setBudgets((prev) => [...prev, result.budget]);
    return result;
  }, []);

  const update = useCallback(async (id, payload) => {
    const result = await budgetService.update(id, payload);
    setBudgets((prev) => prev.map((b) => (b._id === id ? result.budget : b)));
    return result;
  }, []);

  const remove = useCallback(async (id) => {
    await budgetService.remove(id);
    setBudgets((prev) => prev.filter((b) => b._id !== id));
  }, []);

  return { budgets, recommendations, loading, error, fetch, fetchRecommendations, create, update, remove };
}

export default useBudget;
