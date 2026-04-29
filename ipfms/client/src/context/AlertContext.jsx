import React, { createContext, useContext, useState, useCallback } from 'react';
import alertService from '../services/alertService';

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [alerts,      setAlerts]      = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading,     setLoading]     = useState(false);

  const fetchAlerts = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const result = await alertService.list({ status: 'active', ...params });
      const list = result.alerts || [];
      setAlerts(list);
      setUnreadCount(list.filter((a) => !a.acknowledgedAt).length);
    } catch (err) {
      console.error('AlertContext: fetchAlerts error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const acknowledge = useCallback(async (id) => {
    try {
      await alertService.acknowledge(id);
      setAlerts((prev) =>
        prev.map((a) => (a._id === id ? { ...a, acknowledgedAt: new Date() } : a)),
      );
      setUnreadCount((n) => Math.max(0, n - 1));
    } catch (err) {
      console.error('AlertContext: acknowledge error', err);
    }
  }, []);

  const dismiss = useCallback(async (id) => {
    try {
      await alertService.dismiss(id);
      setAlerts((prev) => prev.filter((a) => a._id !== id));
      setUnreadCount((prev) => {
        const wasSeen = alerts.find((a) => a._id === id)?.acknowledgedAt;
        return wasSeen ? prev : Math.max(0, prev - 1);
      });
    } catch (err) {
      console.error('AlertContext: dismiss error', err);
    }
  }, [alerts]);

  const resolve = useCallback(async (id, feedback) => {
    try {
      await alertService.resolve(id, feedback);
      setAlerts((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      console.error('AlertContext: resolve error', err);
    }
  }, []);

  return (
    <AlertContext.Provider
      value={{ alerts, unreadCount, loading, fetchAlerts, acknowledge, dismiss, resolve }}
    >
      {children}
    </AlertContext.Provider>
  );
}

export function useAlertContext() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlertContext must be used inside <AlertProvider>');
  return ctx;
}

export default AlertContext;
