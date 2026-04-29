/** Transaction categories — must match server autoCategorizer labels */
export const CATEGORIES = [
  'food_dining',
  'shopping',
  'transportation',
  'utilities',
  'entertainment',
  'healthcare',
  'travel',
  'education',
  'rent_mortgage',
  'insurance',
  'subscriptions',
  'income',
  'transfer',
  'investments',
  'other',
];

/** Human-readable labels for categories */
export const CATEGORY_LABELS = {
  food_dining:    'Food & Dining',
  shopping:       'Shopping',
  transportation: 'Transportation',
  utilities:      'Utilities',
  entertainment:  'Entertainment',
  healthcare:     'Healthcare',
  travel:         'Travel',
  education:      'Education',
  rent_mortgage:  'Rent / Mortgage',
  insurance:      'Insurance',
  subscriptions:  'Subscriptions',
  income:         'Income',
  transfer:       'Transfer',
  investments:    'Investments',
  other:          'Other',
};

/** Emoji icons for categories */
export const CATEGORY_ICONS = {
  food_dining:    '🍽️',
  shopping:       '🛍️',
  transportation: '🚗',
  utilities:      '💡',
  entertainment:  '🎬',
  healthcare:     '🏥',
  travel:         '✈️',
  education:      '📚',
  rent_mortgage:  '🏠',
  insurance:      '🛡️',
  subscriptions:  '📱',
  income:         '💰',
  transfer:       '↔️',
  investments:    '📈',
  other:          '📦',
};

/** CSS variable colour names for chart rendering */
export const CATEGORY_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444',
  '#8B5CF6', '#14B8A6', '#06B6D4', '#EC4899',
  '#F97316', '#84CC16', '#A78BFA', '#34D399',
  '#60A5FA', '#FBBF24', '#94A3B8',
];
