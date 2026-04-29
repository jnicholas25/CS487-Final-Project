import React from 'react';
/** Compact unread-count badge for sidebar */
export default function AlertBadge({ count }) {
  if (!count) return null;
  return (
    <span className="sidebar__badge" aria-label={`${count} unread alerts`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
