import React from 'react';

export default function ErrorMessage({ message, onRetry }) {
  return (
    <div
      role="alert"
      style={{
        padding: '16px 20px',
        background: 'var(--red-muted)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 'var(--radius)',
        color: 'var(--red)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.875rem',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1.25rem' }}>⚠</span>
      <span style={{ flex: 1 }}>{message || 'Something went wrong.'}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'transparent',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--red)',
            padding: '4px 12px',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 500,
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
