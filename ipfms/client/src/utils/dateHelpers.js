import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

/** Parse a date value that may be string or Date */
function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isValid(val) ? val : null;
  const parsed = parseISO(String(val));
  return isValid(parsed) ? parsed : null;
}

/** "Jan 15, 2024" */
export function fmtDate(val) {
  const d = toDate(val);
  return d ? format(d, 'MMM d, yyyy') : '—';
}

/** "Jan 15" */
export function fmtShortDate(val) {
  const d = toDate(val);
  return d ? format(d, 'MMM d') : '—';
}

/** "01/15/2024" */
export function fmtDateUS(val) {
  const d = toDate(val);
  return d ? format(d, 'MM/dd/yyyy') : '—';
}

/** "2024-01-15" */
export function fmtDateISO(val) {
  const d = toDate(val);
  return d ? format(d, 'yyyy-MM-dd') : '—';
}

/** "3 days ago", "about 2 hours ago" */
export function fmtRelative(val) {
  const d = toDate(val);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : '—';
}

/** "Jan 2024" — for chart axis labels */
export function fmtMonthYear(val) {
  const d = toDate(val);
  return d ? format(d, 'MMM yyyy') : '—';
}

/** Start of current month in ISO format for filter defaults */
export function startOfCurrentMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

/** End of current month in ISO format */
export function endOfCurrentMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
}
