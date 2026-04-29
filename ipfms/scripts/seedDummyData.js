/**
 * seedDummyData.js
 * ─────────────────
 * Populates the database with dummy transactions, budgets, and accounts
 * for an EXISTING user account.
 *
 * Usage:
 *   node scripts/seedDummyData.js <email>
 *
 * Example:
 *   node scripts/seedDummyData.js jane@example.com
 */

const path = require('path');

const serverModules = path.join(__dirname, '../server/node_modules');
require(path.join(serverModules, 'dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const mongoose = require(path.join(serverModules, 'mongoose'));

const User        = require(path.join(__dirname, '../server/src/models/User'));
const Account     = require(path.join(__dirname, '../server/src/models/Account'));
const Transaction = require(path.join(__dirname, '../server/src/models/Transaction'));
const Budget      = require(path.join(__dirname, '../server/src/models/Budget'));

const MONGODB_URI = process.env.MONGODB_URI;
const email       = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/seedDummyData.js <email>');
  process.exit(1);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  console.log(`Seeding data for: ${user.email} (${user._id})`);

  // ── Accounts ─────────────────────────────────────────────────────────────────

  await Account.deleteMany({ userId: user._id });

  const checking = await Account.create({
    userId:           user._id,
    name:             'Chase Checking',
    institutionName:  'Chase Bank',
    accountType:      'checking',
    mask:             '4242',
    currentBalance:   8340.50,
    availableBalance: 8340.50,
    currency:         'USD',
    isActive:         true,
  });

  const credit = await Account.create({
    userId:           user._id,
    name:             'Amex Platinum',
    institutionName:  'American Express',
    accountType:      'credit',
    mask:             '1009',
    currentBalance:   -1247.80,
    availableBalance: 8752.20,
    currency:         'USD',
    isActive:         true,
  });

  console.log(`Created accounts: ${checking.name}, ${credit.name}`);

  // ── Transactions ──────────────────────────────────────────────────────────────

  await Transaction.deleteMany({ userId: user._id });

  // Each entry: description, category, amount (positive=debit, negative=credit),
  //             daysAgo, account ('checking'|'credit'), isRecurring, isFlagged, isPending
  const txData = [
    // Recent — April
    { description: 'Whole Foods Market',          category: 'food_dining',    amount: 67.43,    daysAgo: 2,  account: 'checking' },
    { description: 'Spotify Premium',             category: 'subscriptions',  amount: 15.99,    daysAgo: 3,  account: 'credit',   isRecurring: true },
    { description: 'Uber Ride - Downtown',        category: 'transportation', amount: 24.50,    daysAgo: 3,  account: 'checking' },
    { description: 'Amazon Electronics Purchase', category: 'shopping',       amount: 847.00,   daysAgo: 4,  account: 'credit',   isFlagged: true },
    { description: 'Monthly Salary - Tech Corp',  category: 'income',         amount: -5200.00, daysAgo: 4,  account: 'checking', isRecurring: true },
    { description: 'Chipotle Mexican Grill',      category: 'food_dining',    amount: 14.25,    daysAgo: 5,  account: 'checking' },
    { description: 'Shell Gas Station',           category: 'transportation', amount: 52.80,    daysAgo: 5,  account: 'checking', isPending: true },
    { description: 'Netflix Subscription',        category: 'subscriptions',  amount: 22.99,    daysAgo: 6,  account: 'credit',   isRecurring: true },
    { description: 'Trader Joes',                 category: 'food_dining',    amount: 43.12,    daysAgo: 6,  account: 'checking' },
    { description: 'Planet Fitness Membership',   category: 'healthcare',     amount: 24.99,    daysAgo: 7,  account: 'checking', isRecurring: true },
    { description: 'Electric Bill - ConEd',       category: 'utilities',      amount: 134.50,   daysAgo: 8,  account: 'checking' },
    { description: 'Freelance Payment - Design',  category: 'income',         amount: -850.00,  daysAgo: 9,  account: 'checking' },
    { description: 'Target',                      category: 'shopping',       amount: 78.34,    daysAgo: 10, account: 'credit' },
    { description: 'CVS Pharmacy',                category: 'healthcare',     amount: 32.15,    daysAgo: 10, account: 'checking' },
    { description: 'Starbucks',                   category: 'food_dining',    amount: 8.75,     daysAgo: 11, account: 'credit' },
    { description: 'Amazon Prime Subscription',   category: 'subscriptions',  amount: 14.99,    daysAgo: 11, account: 'credit',   isRecurring: true },
    { description: 'Rent Payment - April',        category: 'rent_mortgage',  amount: 2100.00,  daysAgo: 12, account: 'checking', isRecurring: true },
    { description: 'Internet - Comcast',          category: 'utilities',      amount: 79.99,    daysAgo: 13, account: 'checking', isRecurring: true },
    { description: 'Apple App Store',             category: 'entertainment',  amount: 9.99,     daysAgo: 14, account: 'credit' },
    { description: 'Costco Wholesale',            category: 'food_dining',    amount: 112.40,   daysAgo: 15, account: 'checking' },

    // Mid-month
    { description: 'Lyft Ride',                   category: 'transportation', amount: 18.75,    daysAgo: 16, account: 'checking' },
    { description: 'Best Buy',                    category: 'shopping',       amount: 249.99,   daysAgo: 17, account: 'credit' },
    { description: 'McDonald\'s',                 category: 'food_dining',    amount: 11.50,    daysAgo: 18, account: 'checking' },
    { description: 'Verizon Wireless',            category: 'utilities',      amount: 85.00,    daysAgo: 19, account: 'checking', isRecurring: true },
    { description: 'Walgreens',                   category: 'healthcare',     amount: 27.89,    daysAgo: 20, account: 'checking' },
    { description: 'Dividend - AAPL',             category: 'income',         amount: -42.50,   daysAgo: 20, account: 'checking' },
    { description: 'Hulu Subscription',           category: 'subscriptions',  amount: 17.99,    daysAgo: 21, account: 'credit',   isRecurring: true },
    { description: 'Kroger',                      category: 'food_dining',    amount: 58.20,    daysAgo: 22, account: 'checking' },
    { description: 'Gas Station - BP',            category: 'transportation', amount: 48.60,    daysAgo: 23, account: 'checking' },
    { description: 'Nike.com',                    category: 'shopping',       amount: 129.00,   daysAgo: 24, account: 'credit' },

    // Previous month
    { description: 'Whole Foods Market',          category: 'food_dining',    amount: 71.30,    daysAgo: 32, account: 'checking' },
    { description: 'Monthly Salary - Tech Corp',  category: 'income',         amount: -5200.00, daysAgo: 34, account: 'checking', isRecurring: true },
    { description: 'Netflix Subscription',        category: 'subscriptions',  amount: 22.99,    daysAgo: 36, account: 'credit',   isRecurring: true },
    { description: 'Rent Payment - March',        category: 'rent_mortgage',  amount: 2100.00,  daysAgo: 43, account: 'checking', isRecurring: true },
    { description: 'Spotify Premium',             category: 'subscriptions',  amount: 15.99,    daysAgo: 33, account: 'credit',   isRecurring: true },
    { description: 'Electric Bill - ConEd',       category: 'utilities',      amount: 128.00,   daysAgo: 38, account: 'checking', isRecurring: true },
    { description: 'Amazon Order',                category: 'shopping',       amount: 63.95,    daysAgo: 40, account: 'credit' },
    { description: 'Trader Joes',                 category: 'food_dining',    amount: 49.80,    daysAgo: 42, account: 'checking' },
    { description: 'Internet - Comcast',          category: 'utilities',      amount: 79.99,    daysAgo: 43, account: 'checking', isRecurring: true },
    { description: 'Planet Fitness Membership',   category: 'healthcare',     amount: 24.99,    daysAgo: 37, account: 'checking', isRecurring: true },

    // Older (2 months back)
    { description: 'Monthly Salary - Tech Corp',  category: 'income',         amount: -5200.00, daysAgo: 64, account: 'checking', isRecurring: true },
    { description: 'Rent Payment - February',     category: 'rent_mortgage',  amount: 2100.00,  daysAgo: 73, account: 'checking', isRecurring: true },
    { description: 'Netflix Subscription',        category: 'subscriptions',  amount: 22.99,    daysAgo: 66, account: 'credit',   isRecurring: true },
    { description: 'Electric Bill - ConEd',       category: 'utilities',      amount: 142.00,   daysAgo: 68, account: 'checking', isRecurring: true },
    { description: 'Costco Wholesale',            category: 'food_dining',    amount: 98.75,    daysAgo: 65, account: 'checking' },
    { description: 'Uber Ride',                   category: 'transportation', amount: 19.40,    daysAgo: 67, account: 'checking' },
    { description: 'Apple App Store',             category: 'entertainment',  amount: 9.99,     daysAgo: 74, account: 'credit' },
    { description: 'Amazon Prime Subscription',   category: 'subscriptions',  amount: 14.99,    daysAgo: 71, account: 'credit',   isRecurring: true },
  ];

  const transactions = txData.map((t, i) => {
    const acct = t.account === 'credit' ? credit : checking;
    return {
      userId:      user._id,
      accountId:   acct._id,
      amount:      Math.abs(t.amount),
      currency:    'USD',
      description: t.description,
      category:    t.category,
      type:        t.amount < 0 ? 'credit' : 'debit',
      isPending:   t.isPending || false,
      isFlagged:   t.isFlagged || false,
      isRecurring: t.isRecurring || false,
      date:        daysAgo(t.daysAgo),
      externalId:  `seed-${acct._id}-${i}`,
      merchant:    { name: t.description },
    };
  });

  await Transaction.insertMany(transactions);
  console.log(`Inserted ${transactions.length} transactions`);

  // ── Monthly Budget ────────────────────────────────────────────────────────────

  await Budget.deleteMany({ userId: user._id });

  const now = new Date();
  await Budget.create({
    userId:    user._id,
    name:      'April 2026 Budget',
    period:    'monthly',
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate:   new Date(now.getFullYear(), now.getMonth() + 1, 0),
    isActive:  true,
    savingsGoal: 1000,
    categories: [
      { category: 'food_dining',    limit: 600,  spent: 386,  alertThreshold: 80, color: '#10B981' },
      { category: 'transportation', limit: 300,  spent: 145,  alertThreshold: 80, color: '#3B82F6' },
      { category: 'utilities',      limit: 400,  spent: 299,  alertThreshold: 80, color: '#8B5CF6' },
      { category: 'subscriptions',  limit: 150,  spent: 101,  alertThreshold: 80, color: '#F59E0B' },
      { category: 'rent_mortgage',  limit: 2200, spent: 2100, alertThreshold: 90, color: '#EF4444' },
      { category: 'entertainment',  limit: 100,  spent: 30,   alertThreshold: 80, color: '#EC4899' },
      { category: 'shopping',       limit: 500,  spent: 405,  alertThreshold: 80, color: '#06B6D4' },
      { category: 'healthcare',     limit: 200,  spent: 85,   alertThreshold: 80, color: '#84CC16' },
    ],
  });
  console.log('Created monthly budget');

  console.log('\nDone! Refresh the app to see your data.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  mongoose.disconnect();
  process.exit(1);
});
