import React from 'react';
export default function FlaggedTransactionBadge({ isFlagged }) {
  if (!isFlagged) return null;
  return (
    <span title="Flagged as suspicious" aria-label="Flagged transaction"
      style={{ color:'var(--red)', marginRight:6, fontSize:'0.875rem' }}>⚑</span>
  );
}
