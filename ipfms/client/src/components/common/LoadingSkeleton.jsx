import React from 'react';
import './LoadingSkeleton.css';

/** Animated shimmer placeholder block */
export function Skeleton({ width = '100%', height = '16px', radius = 'var(--radius-sm)', style = {} }) {
  return (
    <span
      className="skeleton"
      style={{ width, height, borderRadius: radius, display: 'block', ...style }}
      aria-hidden="true"
    />
  );
}

/** A card-shaped loading placeholder */
export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="card" aria-busy="true" aria-label="Loading…">
      <Skeleton height="18px" width="40%" style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="13px" width={i === lines - 1 ? '60%' : '100%'} style={{ marginBottom: 8 }} />
      ))}
    </div>
  );
}

/** Row-shaped skeleton for tables */
export function RowSkeleton({ cols = 4 }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <Skeleton height="13px" width={i === 0 ? '70%' : '50%'} />
        </td>
      ))}
    </tr>
  );
}

export default Skeleton;
