import React from 'react';
/** PDF export button — triggers browser print dialog for the current report view */
export default function PDFExport({ label = 'Export PDF' }) {
  return (
    <button className="btn btn-secondary" onClick={() => window.print()} aria-label="Export report as PDF">
      ⬇ {label}
    </button>
  );
}
