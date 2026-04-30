import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth }     from '../../context/AuthContext';
import './Navbar.css';

const PAGE_TITLES = {
  '/':             'Dashboard',
  '/transactions': 'Transactions',
  '/budgets':      'Budgets',
  '/investments':  'Investments',
  '/payments':     'Payments',
  '/reports':      'Reports',
  '/alerts':       'Alerts',
  '/settings':     'Settings',
};

export default function TopBar() {
  const location = useLocation();
  const { user } = useAuth();

  const title = PAGE_TITLES[location.pathname] || 'IPFMS';
  const now   = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  });

  return (
    <header className="topbar" role="banner">
      <div className="topbar__left">
        <h1 className="topbar__title">{title}</h1>
        <span className="topbar__date hide-mobile" aria-label={`Today is ${now}`}>{now}</span>
      </div>
      <div className="topbar__right">
        <span className="topbar__greeting hide-mobile">
          Welcome back, <strong>{user?.firstName || user?.fullName?.split(' ')[0] || user?.name?.split(' ')[0] || 'User'}</strong>
        </span>
      </div>
    </header>
  );
}
