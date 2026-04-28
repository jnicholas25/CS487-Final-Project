/**
 * Auto-Categorizer — Algorithm 5.2
 *
 * Assigns a spending category (and optional subcategory) to a transaction
 * based on a priority-ordered rule set:
 *   1. Exact merchant-name match
 *   2. Keyword match in description (case-insensitive)
 *   3. MCC (Merchant Category Code) lookup
 *   4. Fallback → 'Uncategorized'
 *
 * The result includes a confidence score (0–1) and the source rule used,
 * which is stored in Transaction.categorySource = 'auto'.
 */

// ── Category rule definitions ─────────────────────────────────────────────────

/**
 * Keyword rules: each entry maps an array of keywords to a category.
 * Ordered from most-specific to most-general — first match wins.
 */
const KEYWORD_RULES = [
  // ── Housing ───────────────────────────────────────────────────────────────
  {
    category: 'Housing',
    subcategory: 'Rent',
    keywords: ['rent', 'lease', 'landlord', 'property management'],
    confidence: 0.9,
  },
  {
    category: 'Housing',
    subcategory: 'Mortgage',
    keywords: ['mortgage', 'home loan', 'housing loan'],
    confidence: 0.95,
  },
  {
    category: 'Housing',
    subcategory: 'Utilities',
    keywords: ['electric', 'electricity', 'water bill', 'gas bill', 'utility', 'utilities', 'sewage', 'waste management'],
    confidence: 0.9,
  },

  // ── Food & Dining ─────────────────────────────────────────────────────────
  {
    category: 'Food & Dining',
    subcategory: 'Groceries',
    keywords: ['grocery', 'groceries', 'supermarket', 'whole foods', 'trader joe', 'safeway', 'kroger', 'publix', 'aldi', 'lidl', 'costco', 'walmart grocery', 'target grocery'],
    confidence: 0.92,
  },
  {
    category: 'Food & Dining',
    subcategory: 'Restaurants',
    keywords: ['restaurant', 'diner', 'bistro', 'cafe', 'coffee', 'starbucks', 'dunkin', 'mcdonald', 'subway', 'chipotle', 'panera', 'domino', 'pizza', 'burger', 'taco', 'sushi', 'thai', 'chinese food', 'takeout', 'take-out', 'food delivery', 'doordash', 'uber eats', 'grubhub', 'instacart food'],
    confidence: 0.88,
  },

  // ── Transportation ────────────────────────────────────────────────────────
  {
    category: 'Transportation',
    subcategory: 'Gas',
    keywords: ['shell', 'chevron', 'bp gas', 'exxon', 'mobil', 'sunoco', 'citgo', 'gas station', 'fuel', 'gasoline', 'petrol'],
    confidence: 0.93,
  },
  {
    category: 'Transportation',
    subcategory: 'Rideshare',
    keywords: ['uber', 'lyft', 'rideshare', 'taxi', 'cab service'],
    confidence: 0.95,
  },
  {
    category: 'Transportation',
    subcategory: 'Public Transit',
    keywords: ['metro', 'subway fare', 'bus fare', 'transit', 'mta', 'bart', 'cta', 'wmata', 'commuter rail', 'train ticket', 'amtrak'],
    confidence: 0.9,
  },
  {
    category: 'Transportation',
    subcategory: 'Parking',
    keywords: ['parking', 'park meter', 'garage fee', 'valet'],
    confidence: 0.9,
  },
  {
    category: 'Transportation',
    subcategory: 'Auto',
    keywords: ['auto repair', 'car wash', 'jiffy lube', 'oil change', 'tire', 'mechanic', 'dealership', 'dmv', 'car insurance'],
    confidence: 0.85,
  },

  // ── Shopping ──────────────────────────────────────────────────────────────
  {
    category: 'Shopping',
    subcategory: 'Online',
    keywords: ['amazon', 'ebay', 'etsy', 'shopify', 'wayfair', 'overstock', 'zappos', 'online purchase'],
    confidence: 0.88,
  },
  {
    category: 'Shopping',
    subcategory: 'Clothing',
    keywords: ['clothing', 'apparel', 'zara', 'h&m', 'gap', 'old navy', 'banana republic', 'nordstrom', 'macy', 'tj maxx', 'marshalls', 'ross store', 'nike', 'adidas', 'fashion'],
    confidence: 0.87,
  },
  {
    category: 'Shopping',
    subcategory: 'Electronics',
    keywords: ['best buy', 'apple store', 'microsoft store', 'electronics', 'newegg', 'b&h photo'],
    confidence: 0.9,
  },

  // ── Entertainment ─────────────────────────────────────────────────────────
  {
    category: 'Entertainment',
    subcategory: 'Streaming',
    keywords: ['netflix', 'hulu', 'disney+', 'disney plus', 'hbo max', 'amazon prime video', 'apple tv', 'peacock', 'paramount+', 'streaming'],
    confidence: 0.97,
  },
  {
    category: 'Entertainment',
    subcategory: 'Music',
    keywords: ['spotify', 'apple music', 'tidal', 'amazon music', 'pandora', 'soundcloud'],
    confidence: 0.97,
  },
  {
    category: 'Entertainment',
    subcategory: 'Gaming',
    keywords: ['steam', 'playstation', 'xbox', 'nintendo', 'game', 'gaming', 'twitch', 'epic games'],
    confidence: 0.92,
  },
  {
    category: 'Entertainment',
    subcategory: 'Movies & Events',
    keywords: ['cinema', 'movie theater', 'amc theater', 'regal', 'concert', 'ticketmaster', 'stubhub', 'eventbrite', 'sports ticket'],
    confidence: 0.9,
  },

  // ── Health & Fitness ──────────────────────────────────────────────────────
  {
    category: 'Health & Fitness',
    subcategory: 'Medical',
    keywords: ['hospital', 'clinic', 'urgent care', 'doctor', 'physician', 'dental', 'dentist', 'optometrist', 'pharmacy', 'cvs', 'walgreens', 'rite aid', 'prescription', 'medical'],
    confidence: 0.9,
  },
  {
    category: 'Health & Fitness',
    subcategory: 'Gym',
    keywords: ['gym', 'fitness', 'planet fitness', 'equinox', 'la fitness', 'peloton', 'yoga', 'crossfit', 'membership'],
    confidence: 0.88,
  },

  // ── Bills & Utilities ─────────────────────────────────────────────────────
  {
    category: 'Bills & Utilities',
    subcategory: 'Phone',
    keywords: ['verizon', 'at&t', 'tmobile', 't-mobile', 'sprint', 'boost mobile', 'metro pcs', 'phone bill', 'wireless'],
    confidence: 0.93,
  },
  {
    category: 'Bills & Utilities',
    subcategory: 'Internet',
    keywords: ['comcast', 'xfinity', 'spectrum', 'cox', 'at&t internet', 'verizon fios', 'internet bill', 'broadband'],
    confidence: 0.93,
  },
  {
    category: 'Bills & Utilities',
    subcategory: 'Insurance',
    keywords: ['insurance', 'geico', 'state farm', 'allstate', 'progressive', 'farmers', 'liberty mutual', 'premium'],
    confidence: 0.88,
  },
  {
    category: 'Bills & Utilities',
    subcategory: 'Subscriptions',
    keywords: ['subscription', 'monthly fee', 'annual fee', 'membership fee'],
    confidence: 0.75,
  },

  // ── Travel ────────────────────────────────────────────────────────────────
  {
    category: 'Travel',
    subcategory: 'Flights',
    keywords: ['airline', 'delta', 'united airlines', 'american airlines', 'southwest', 'jetblue', 'spirit airlines', 'flight', 'airfare'],
    confidence: 0.95,
  },
  {
    category: 'Travel',
    subcategory: 'Hotels',
    keywords: ['hotel', 'marriott', 'hilton', 'hyatt', 'airbnb', 'vrbo', 'motel', 'inn', 'resort', 'lodging'],
    confidence: 0.92,
  },
  {
    category: 'Travel',
    subcategory: 'Car Rental',
    keywords: ['hertz', 'enterprise', 'avis', 'budget car', 'national car', 'alamo', 'dollar rental', 'car rental'],
    confidence: 0.95,
  },

  // ── Education ─────────────────────────────────────────────────────────────
  {
    category: 'Education',
    subcategory: 'Tuition',
    keywords: ['tuition', 'university', 'college', 'student loan', 'financial aid'],
    confidence: 0.9,
  },
  {
    category: 'Education',
    subcategory: 'Online Learning',
    keywords: ['coursera', 'udemy', 'skillshare', 'linkedin learning', 'masterclass', 'pluralsight', 'edx', 'online course'],
    confidence: 0.93,
  },
  {
    category: 'Education',
    subcategory: 'Books',
    keywords: ['bookstore', 'amazon books', 'barnes & noble', 'textbook', 'kindle'],
    confidence: 0.85,
  },

  // ── Personal Care ─────────────────────────────────────────────────────────
  {
    category: 'Personal Care',
    subcategory: 'Hair & Beauty',
    keywords: ['salon', 'barber', 'haircut', 'spa', 'nail salon', 'beauty supply'],
    confidence: 0.88,
  },

  // ── Investments ───────────────────────────────────────────────────────────
  {
    category: 'Investments',
    subcategory: 'Brokerage',
    keywords: ['robinhood', 'fidelity', 'schwab', 'etrade', 'vanguard', 'merrill lynch', 'td ameritrade', 'wealthfront', 'betterment', 'coinbase', 'crypto', 'bitcoin', 'stock purchase'],
    confidence: 0.9,
  },

  // ── Transfers ─────────────────────────────────────────────────────────────
  {
    category: 'Transfers',
    subcategory: 'Bank Transfer',
    keywords: ['transfer to', 'transfer from', 'wire transfer', 'ach transfer', 'bank transfer', 'zelle', 'venmo', 'paypal', 'cashapp', 'cash app'],
    confidence: 0.85,
  },

  // ── Income ────────────────────────────────────────────────────────────────
  {
    category: 'Income',
    subcategory: 'Payroll',
    keywords: ['payroll', 'direct deposit', 'salary', 'wages', 'paycheck'],
    confidence: 0.95,
  },
  {
    category: 'Income',
    subcategory: 'Refund',
    keywords: ['refund', 'reimbursement', 'rebate', 'cashback', 'credit adjustment'],
    confidence: 0.88,
  },

  // ── ATM / Cash ────────────────────────────────────────────────────────────
  {
    category: 'Cash & ATM',
    subcategory: 'ATM Withdrawal',
    keywords: ['atm', 'cash withdrawal', 'atm fee', 'cash advance'],
    confidence: 0.92,
  },

  // ── Fees ──────────────────────────────────────────────────────────────────
  {
    category: 'Fees & Charges',
    subcategory: 'Bank Fees',
    keywords: ['overdraft fee', 'service charge', 'bank fee', 'late fee', 'penalty fee'],
    confidence: 0.88,
  },
];

/**
 * MCC (Merchant Category Code) → category mapping.
 * Common MCC ranges for quick fallback classification.
 */
const MCC_MAP = {
  // Airlines
  '3000-3299': { category: 'Travel', subcategory: 'Flights' },
  // Hotels
  '3500-3999': { category: 'Travel', subcategory: 'Hotels' },
  // Car rental
  '7512': { category: 'Travel', subcategory: 'Car Rental' },
  // Restaurants
  '5812': { category: 'Food & Dining', subcategory: 'Restaurants' },
  '5813': { category: 'Food & Dining', subcategory: 'Restaurants' },
  // Grocery stores
  '5411': { category: 'Food & Dining', subcategory: 'Groceries' },
  '5412': { category: 'Food & Dining', subcategory: 'Groceries' },
  // Gas
  '5541': { category: 'Transportation', subcategory: 'Gas' },
  '5542': { category: 'Transportation', subcategory: 'Gas' },
  // Pharmacies
  '5912': { category: 'Health & Fitness', subcategory: 'Medical' },
  // Clothing
  '5600': { category: 'Shopping', subcategory: 'Clothing' },
  '5699': { category: 'Shopping', subcategory: 'Clothing' },
  // Electronics
  '5732': { category: 'Shopping', subcategory: 'Electronics' },
  '5734': { category: 'Shopping', subcategory: 'Electronics' },
  // ATM
  '6011': { category: 'Cash & ATM', subcategory: 'ATM Withdrawal' },
  // Insurance
  '6300': { category: 'Bills & Utilities', subcategory: 'Insurance' },
};

// ── Core categorisation logic ─────────────────────────────────────────────────

/**
 * Categorise a transaction automatically.
 *
 * @param {object} params
 * @param {string}  params.description        Transaction description (required)
 * @param {string}  [params.merchantName]     Merchant name if available
 * @param {string}  [params.merchantCategory] MCC category string
 * @param {string}  [params.categoryCode]     Numeric MCC code
 * @param {number}  [params.amount]           Transaction amount (+ = debit)
 * @param {string}  [params.type]             'debit' | 'credit' | etc.
 *
 * @returns {{ category: string, subcategory: string|null, confidence: number, source: string }}
 */
function categorise({ description, merchantName, merchantCategory, categoryCode, amount, type }) {
  const text = buildSearchText(description, merchantName, merchantCategory);

  // ── 1. Keyword match ──────────────────────────────────────────────────────
  const keywordMatch = matchByKeyword(text);
  if (keywordMatch) return keywordMatch;

  // ── 2. MCC lookup ─────────────────────────────────────────────────────────
  if (categoryCode) {
    const mccMatch = matchByMcc(categoryCode);
    if (mccMatch) return mccMatch;
  }

  // ── 3. Heuristics based on amount/type ───────────────────────────────────
  if (type === 'credit' && amount < 0) {
    if (description.toLowerCase().includes('payroll') || description.toLowerCase().includes('deposit')) {
      return { category: 'Income', subcategory: 'Payroll', confidence: 0.7, source: 'heuristic' };
    }
    return { category: 'Income', subcategory: null, confidence: 0.5, source: 'heuristic' };
  }

  // ── 4. Fallback ───────────────────────────────────────────────────────────
  return { category: 'Uncategorized', subcategory: null, confidence: 0, source: 'fallback' };
}

/**
 * Build a normalised search string from all available text signals.
 */
function buildSearchText(...parts) {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s&+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Run keyword rules against a normalised text string.
 * @param {string} text
 * @returns {object|null}
 */
function matchByKeyword(text) {
  for (const rule of KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return {
          category: rule.category,
          subcategory: rule.subcategory || null,
          confidence: rule.confidence,
          source: 'keyword',
        };
      }
    }
  }
  return null;
}

/**
 * Look up a category by MCC code.
 * @param {string} mcc  Numeric MCC string
 * @returns {object|null}
 */
function matchByMcc(mcc) {
  const direct = MCC_MAP[mcc];
  if (direct) {
    return { ...direct, confidence: 0.85, source: 'mcc' };
  }
  // Range check
  const code = parseInt(mcc, 10);
  for (const [range, cat] of Object.entries(MCC_MAP)) {
    if (range.includes('-')) {
      const [min, max] = range.split('-').map(Number);
      if (code >= min && code <= max) {
        return { ...cat, confidence: 0.8, source: 'mcc_range' };
      }
    }
  }
  return null;
}

/**
 * Re-categorise a set of transactions in bulk.
 * Useful when rules are updated and existing records need refreshing.
 * @param {Array<object>} transactions  Array of plain objects with description, merchant etc.
 * @returns {Array<object>}  Same array with category/subcategory/confidence appended
 */
function categoriseBatch(transactions) {
  return transactions.map((t) => ({
    ...t,
    ...categorise(t),
  }));
}

module.exports = { categorise, categoriseBatch, KEYWORD_RULES, buildSearchText };
