import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { useAuth }        from './context/AuthContext';
import { useAlertContext } from './context/AlertContext';
import { ROUTES }         from './constants/routes';

import Sidebar      from './components/common/Sidebar';
import TopBar       from './components/common/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';

// Pages
import LoginPage        from './pages/LoginPage';
import DashboardPage    from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import BudgetPage       from './pages/BudgetPage';
import InvestmentsPage  from './pages/InvestmentsPage';
import AutopaymentsPage from './pages/AutopaymentsPage';
import ReportsPage      from './pages/ReportsPage';
import AlertsPage       from './pages/AlertsPage';  // new in Step 8
import SettingsPage     from './pages/SettingsPage';

export default function App() {
  const { isAuthenticated, loading } = useAuth();
  const { fetchAlerts }              = useAlertContext();
  const location                     = useLocation();

  // Refresh alert badge on every navigation when logged in
  useEffect(() => {
    if (isAuthenticated) fetchAlerts();
  }, [isAuthenticated, location.pathname, fetchAlerts]);

  if (loading) {
    return (
      <div className="loading-center" style={{ height: '100vh' }}>
        <span className="spinner" />
        <span>Loading IPFMS…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <TopBar />
        <main id="main" className="page-body" role="main" tabIndex={-1}>
          <Routes>
            <Route path={ROUTES.DASHBOARD}    element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path={ROUTES.TRANSACTIONS} element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
            <Route path={ROUTES.BUDGETS}      element={<ProtectedRoute><BudgetPage /></ProtectedRoute>} />
            <Route path={ROUTES.INVESTMENTS}  element={<ProtectedRoute><InvestmentsPage /></ProtectedRoute>} />
            <Route path={ROUTES.PAYMENTS}     element={<ProtectedRoute><AutopaymentsPage /></ProtectedRoute>} />
            <Route path={ROUTES.REPORTS}      element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path={ROUTES.ALERTS}       element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
            <Route path={ROUTES.SETTINGS}     element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path={ROUTES.LOGIN}        element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            <Route path="*"                   element={<Navigate to={ROUTES.DASHBOARD} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
