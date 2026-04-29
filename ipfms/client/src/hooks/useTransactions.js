import { useState, useCallback } from 'react';
import transactionService from '../services/transactionService';

export function useTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [pagination,   setPagination]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  const fetch = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await transactionService.list(params);
      setTransactions(result.transactions || []);
      setPagination(result.pagination || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (payload) => {
    const result = await transactionService.create(payload);
    setTransactions((prev) => [result.transaction, ...prev]);
    return result;
  }, []);

  const update = useCallback(async (id, payload) => {
    const result = await transactionService.update(id, payload);
    setTransactions((prev) =>
      prev.map((t) => (t._id === id ? result.transaction : t)),
    );
    return result;
  }, []);

  const remove = useCallback(async (id) => {
    await transactionService.remove(id);
    setTransactions((prev) => prev.filter((t) => t._id !== id));
  }, []);

  return { transactions, pagination, loading, error, fetch, create, update, remove };
}

export default useTransactions;
