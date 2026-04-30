import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth }         from '../../context/AuthContext';
import { useAlertContext } from '../../context/AlertContext';
import { useTheme }        from '../../context/ThemeContext';
import { ROUTES }          from '../../constants/routes';
import './Sidebar.css';

const NAV_ITEMS = [
  { path: ROUTES.DASHBOARD,    label: 'Dashboard',     icon: '⬡' },
  { path: ROUTES.TRANSACTIONS, label: 'Transactions',   icon: '↕' },
  { path: ROUTES.BUDGETS,      label: 'Budgets',        icon: '◎' },
  { path: ROUTES.INVESTMENTS,  label: 'Investments',    icon: '▲' },
  { path: ROUTES.PAYMENTS,     label: 'Payments',       icon: '⟳' },
  { path: ROUTES.REPORTS,      label: 'Reports',        icon: '☰' },
  { path: ROUTES.ALERTS,       label: 'Alerts',         icon: '◈', badge: true },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout }          = useAuth();
  const { unreadCount }           = useAlertContext();
  const { theme, toggleTheme }    = useTheme();
  const navigate                  = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <aside
      className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">⬡</span>
        {!collapsed && <span className="sidebar__brand-name">IPFMS</span>}
        <button
          className="sidebar__toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar__nav" aria-label="App sections">
        {NAV_ITEMS.map(({ path, label, icon, badge }) => (
          <NavLink
            key={path}
            to={path}
            end={path === ROUTES.DASHBOARD}
            className={({ isActive }) =>
              `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <span className="sidebar__icon" aria-hidden="true">{icon}</span>
            {!collapsed && <span className="sidebar__label">{label}</span>}
            {badge && unreadCount > 0 && (
              <span className="sidebar__badge" aria-label={`${unreadCount} unread alerts`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: theme toggle + settings + user */}
      <div className="sidebar__footer">
        <button
          className="sidebar__link sidebar__link--icon-only"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
        >
          <span className="sidebar__icon" aria-hidden="true">
            {theme === 'dark' ? '☀' : '☾'}
          </span>
          {!collapsed && (
            <span className="sidebar__label">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          )}
        </button>

        <NavLink
          to={ROUTES.SETTINGS}
          className={({ isActive }) =>
            `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
          }
          title={collapsed ? 'Settings' : undefined}
        >
          <span className="sidebar__icon" aria-hidden="true">⚙</span>
          {!collapsed && <span className="sidebar__label">Settings</span>}
        </NavLink>

        {/* User avatar */}
        <div className="sidebar__user" title={user?.email}>
          <span className="sidebar__avatar" aria-hidden="true">
            {(user?.fullName || user?.firstName || user?.name || '?')[0]?.toUpperCase()}
          </span>
          {!collapsed && (
            <div className="sidebar__user-info">
              <span className="sidebar__user-name truncate">{user?.fullName || user?.firstName || user?.name || 'User'}</span>
              <span className="sidebar__user-email truncate">{user?.email || ''}</span>
            </div>
          )}
          <button
            className="sidebar__logout"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}
