import React from 'react';
import { CATEGORIES, CATEGORY_LABELS } from '../../constants/categories';
export default function TransactionFilters({ filters, onChange }) {
  const set = (key, val) => onChange({ ...filters, [key]: val, page: 1 });
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
      <div className="form-group" style={{ minWidth:130 }}>
        <label className="form-label">From</label>
        <input type="date" className="form-input" value={filters.startDate||''} onChange={e=>set('startDate',e.target.value)} />
      </div>
      <div className="form-group" style={{ minWidth:130 }}>
        <label className="form-label">To</label>
        <input type="date" className="form-input" value={filters.endDate||''} onChange={e=>set('endDate',e.target.value)} />
      </div>
      <div className="form-group" style={{ minWidth:120 }}>
        <label className="form-label">Category</label>
        <select className="form-select" value={filters.category||''} onChange={e=>set('category',e.target.value)}>
          <option value="">All</option>
          {CATEGORIES.map(c=><option key={c} value={c}>{CATEGORY_LABELS[c]||c}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ flex:1, minWidth:160 }}>
        <label className="form-label">Search</label>
        <input type="search" className="form-input" placeholder="Description…" value={filters.search||''}
          onChange={e=>set('search',e.target.value)} />
      </div>
    </div>
  );
}
