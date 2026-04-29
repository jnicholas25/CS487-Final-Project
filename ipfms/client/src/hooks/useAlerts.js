import { useState, useCallback } from 'react';
import alertService from '../services/alertService';

/**
 * Standalone hook for pages that need full alert management
 * (e.g., AlertsPage) without the global AlertContext.
 */
export function useAlerts() {
  const [alerts,     setAlerts]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const fetch = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await alertService.list(params);
      setAlerts(result.alerts || []);
      setPagination(result.pagination || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const acknowledge = useCallback(async (id) => {
    await alertService.acknowledge(id);
    setAlerts((prev) =>
      prev.map((a) => (a._id === id ? { ...a, acknowledgedAt: new Date() } : a)),
    );
  }, []);

  const resolve = useCallback(async (id, feedback) => {
    await alertService.resolve(id, feedback);
    setAlerts((prev) => prev.filter((a) => a._id !== id));
  }, []);

  const dismiss = useCallback(async (id) => {
    await alertService.dismiss(id);
    setAlerts((prev) => prev.filter((a) => a._id !== id));
  }, []);

  const scan = useCallback(async (hours = 24) => {
    setLoading(true);
    try {
      const result = await alertService.scan(hours);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { alerts, pagination, loading, error, fetch, acknowledge, resolve, dismiss, scan };
}

export default useAlerts;
