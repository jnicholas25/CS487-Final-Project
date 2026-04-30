/**
 * IPFMS Seed Script — Demo data for karlmax@gmail.com
 * Run: node scripts/seed.js   (from the server/ directory)
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('../node_modules/mongoose');

const rnd  = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[Seed] Connected to MongoDB');

  const User             = require('../src/models/User');
  const Account          = require('../src/models/Account');
  const Transaction      = require('../src/models/Transaction');
  const Budget           = require('../src/models/Budget');
  const Investment       = require('../src/models/Investment');
  const ScheduledPayment = require('../src/models/ScheduledPayment');
  const AnomalyAlert     = require('../src/models/AnomalyAlert');

  // ── 1. User ───────────────────────────────────────────────────────────────
  let user = await User.findOne({ email: 'karlmax@gmail.com' });
  if (!user) {
    user = new User({
      firstName: 'Karl', lastName: 'Max',
      email: 'karlmax@gmail.com',
      passwordHash: 'MyPass1!',
      isActive: true,
    });
    await user.save();
    console.log('[Seed] Created user karlmax@gmail.com');
  } else {
    console.log('[Seed] Found user:', user._id.toString());
  }
  const userId = user._id;

  // ── 2. Accounts ───────────────────────────────────────────────────────────
  let accounts = await Account.find({ userId, deletedAt: null });
  if (accounts.length === 0) {
    accounts = await Account.insertMany([
      { userId, name: 'Chase Checking', institutionName: 'Chase Bank',    accountType: 'checking', currentBalance: 4250.80,  currency: 'USD', isActive: true },
      { userId, name: 'Chase Savings',  institutionName: 'Chase Bank',    accountType: 'savings',  currentBalance: 12800.00, currency: 'USD', isActive: true },
      { userId, name: 'Visa Credit',    institutionName: 'Chase Bank',    accountType: 'credit',   currentBalance: -1340.55, currency: 'USD', isActive: true, creditLimit: 8000 },
    ]);
    console.log('[Seed] Created 3 accounts');
  }
  const checking = accounts.find(a => a.accountType === 'checking') || accounts[0];
  const credit   = accounts.find(a => a.accountType === 'credit')   || accounts[0];

  // ── 3. Transactions ───────────────────────────────────────────────────────
  const txCount = await Transaction.countDocuments({ userId, deletedAt: null });
  if (txCount < 20) {
    const txDocs = [];

    // Monthly salary (3 months)
    for (let m = 0; m < 3; m++) {
      txDocs.push({ userId, accountId: checking._id, description: 'Payroll Deposit - ACME Corp', category: 'income', type: 'credit', amount: 4800, date: daysAgo(m * 30 + 2), isPending: false, isDuplicate: false, descriptionFingerprint: `payroll-${m}` });
    }
    // Rent
    for (let m = 0; m < 3; m++) {
      txDocs.push({ userId, accountId: checking._id, description: 'Rent - Westside Apartments', category: 'housing', type: 'debit', amount: 1350, date: daysAgo(m * 30 + 1), isPending: false, isDuplicate: false, descriptionFingerprint: `rent-${m}` });
    }
    // Recurring bills
    const bills = [
      { desc: 'Netflix',           cat: 'entertainment', amt: 15.99 },
      { desc: 'Spotify',           cat: 'entertainment', amt: 9.99  },
      { desc: 'Electricity Bill',  cat: 'utilities',     amt: 87.50 },
      { desc: 'Internet Comcast',  cat: 'utilities',     amt: 59.99 },
      { desc: 'Gym Membership',    cat: 'health',        amt: 45.00 },
    ];
    for (const b of bills) {
      for (let m = 0; m < 3; m++) {
        txDocs.push({ userId, accountId: credit._id, description: b.desc, category: b.cat, type: 'debit', amount: b.amt, date: daysAgo(m * 30 + 5), isPending: false, isDuplicate: false, descriptionFingerprint: `${b.desc.replace(/\s/g,'-')}-${m}` });
      }
    }
    // Random daily spending
    const spends = [
      { desc: 'Whole Foods Market', cat: 'groceries',     min: 45,  max: 120 },
      { desc: 'Starbucks',          cat: 'dining',         min: 5,   max: 12  },
      { desc: 'Uber',               cat: 'transport',      min: 8,   max: 25  },
      { desc: 'Amazon.com',         cat: 'shopping',       min: 15,  max: 180 },
      { desc: 'Chipotle',           cat: 'dining',         min: 10,  max: 18  },
      { desc: 'Shell Gas Station',  cat: 'transport',      min: 45,  max: 70  },
      { desc: 'CVS Pharmacy',       cat: 'health',         min: 12,  max: 55  },
      { desc: 'Target',             cat: 'shopping',       min: 30,  max: 90  },
      { desc: 'Trader Joes',        cat: 'groceries',      min: 40,  max: 100 },
    ];
    for (let i = 0; i < 60; i++) {
      const s = pick(spends);
      txDocs.push({ userId, accountId: pick([checking._id, credit._id]), description: s.desc, category: s.cat, type: 'debit', amount: rnd(s.min, s.max), date: daysAgo(Math.floor(Math.random() * 60)), isPending: false, isDuplicate: false, descriptionFingerprint: `${s.desc.replace(/\s/g,'-')}-rnd-${i}` });
    }
    await Transaction.insertMany(txDocs);
    console.log(`[Seed] Created ${txDocs.length} transactions`);
  } else {
    console.log(`[Seed] Transactions exist (${txCount}), skipping`);
  }

  // ── 4. Budget ─────────────────────────────────────────────────────────────
  const budgetCount = await Budget.countDocuments({ userId, deletedAt: null });
  if (budgetCount === 0) {
    const now = new Date();
    await Budget.create({
      userId, name: 'Monthly Budget', period: 'monthly', isActive: true,
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate:   new Date(now.getFullYear(), now.getMonth() + 1, 0),
      categories: [
        { category: 'groceries',     limit: 400, spent: 287.50, alertThreshold: 80 },
        { category: 'dining',        limit: 200, spent: 168.40, alertThreshold: 80 },
        { category: 'transport',     limit: 150, spent: 122.00, alertThreshold: 80 },
        { category: 'utilities',     limit: 200, spent: 147.49, alertThreshold: 80 },
        { category: 'entertainment', limit: 100, spent: 105.97, alertThreshold: 80 },
        { category: 'shopping',      limit: 300, spent: 241.00, alertThreshold: 80 },
        { category: 'health',        limit: 150, spent: 90.00,  alertThreshold: 80 },
      ],
    });
    console.log('[Seed] Created budget');
  }

  // ── 5. Investments ────────────────────────────────────────────────────────
  const invCount = await Investment.countDocuments({ userId, deletedAt: null });
  if (invCount === 0) {
    await Investment.insertMany([
      { userId, symbol: 'AAPL', name: 'Apple Inc.',                         assetType: 'stock',  quantity: 15,   averageCostBasis: 145.00,  currentPrice: 182.50,  purchaseDate: daysAgo(400), currency: 'USD' },
      { userId, symbol: 'MSFT', name: 'Microsoft Corp.',                    assetType: 'stock',  quantity: 8,    averageCostBasis: 280.00,  currentPrice: 415.20,  purchaseDate: daysAgo(350), currency: 'USD' },
      { userId, symbol: 'VTI',  name: 'Vanguard Total Stock Market ETF',    assetType: 'etf',    quantity: 25,   averageCostBasis: 195.00,  currentPrice: 238.80,  purchaseDate: daysAgo(500), currency: 'USD' },
      { userId, symbol: 'BTC',  name: 'Bitcoin',                            assetType: 'crypto', quantity: 0.15, averageCostBasis: 28000.0, currentPrice: 62500.0, purchaseDate: daysAgo(300), currency: 'USD' },
    ]);
    console.log('[Seed] Created 4 investment holdings');
  }

  // ── 6. Scheduled Payments ─────────────────────────────────────────────────
  const payCount = await ScheduledPayment.countDocuments({ userId, deletedAt: null });
  if (payCount === 0) {
    const n = new Date();
    const next = (d) => new Date(n.getFullYear(), n.getMonth() + 1, d);
    await ScheduledPayment.insertMany([
      { userId, accountId: checking._id, name: 'Rent',     payeeName: 'Westside Apartments', description: 'Monthly rent',         amount: 1350.00, frequency: 'monthly', startDate: daysAgo(180), nextDueDate: next(1),  status: 'active', category: 'housing',       isAutoPay: true  },
      { userId, accountId: credit._id,   name: 'Netflix',  payeeName: 'Netflix',             description: 'Netflix subscription', amount: 15.99,   frequency: 'monthly', startDate: daysAgo(180), nextDueDate: next(5),  status: 'active', category: 'entertainment', isAutoPay: true  },
      { userId, accountId: credit._id,   name: 'Gym',      payeeName: 'Planet Fitness',      description: 'Gym membership',       amount: 45.00,   frequency: 'monthly', startDate: daysAgo(180), nextDueDate: next(10), status: 'active', category: 'health',        isAutoPay: false },
      { userId, accountId: credit._id,   name: 'Internet', payeeName: 'Comcast',             description: 'Internet service',     amount: 59.99,   frequency: 'monthly', startDate: daysAgo(180), nextDueDate: next(15), status: 'active', category: 'utilities',     isAutoPay: true  },
    ]);
    console.log('[Seed] Created 4 scheduled payments');
  }

  // ── 7. Anomaly Alert ──────────────────────────────────────────────────────
  const alertCount = await AnomalyAlert.countDocuments({ userId });
  if (alertCount === 0) {
    await AnomalyAlert.create({
      userId, accountId: checking._id,
      alertType: 'unusual_amount', severity: 'medium',
      title: 'Unusual spending detected',
      description: 'A $241 purchase at Amazon.com is 2.3x higher than your typical shopping spend.',
      status: 'open',
      detectedAt: daysAgo(3),
    });
    console.log('[Seed] Created anomaly alert');
  }

  console.log('[Seed] Done! Ready to login as karlmax@gmail.com / MyPass1!');
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error('[Seed] FAILED:', err.message, err.stack);
  process.exit(1);
});
