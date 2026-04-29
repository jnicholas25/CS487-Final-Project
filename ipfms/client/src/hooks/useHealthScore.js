import { useState, useCallback } from 'react';
import healthService from '../services/healthService';

export function useHealthScore() {
  const [scoreData, setScoreData] = useState(null);
  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const fetchScore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await healthService.getScore();
      setScoreData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (months = 6) => {
    try {
      const result = await healthService.history(months);
      setHistory(result.history || []);
    } catch (err) {
      console.error('useHealthScore: history error', err);
    }
  }, []);

  return { scoreData, history, loading, error, fetchScore, fetchHistory };
}

export default useHealthScore;
