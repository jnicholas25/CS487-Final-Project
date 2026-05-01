/**
 * IPFMS Demo Seeding Script
 * ─────────────────────────
 * Paste this entire script into the browser console while logged into the app.
 * It will:
 *  1. Fix account balance to a realistic figure
 *  2. Create 4 May 2026 budgets
 *  3. Add 8 anomalous May transactions that trigger AI Insights
 */
(async () => {
  const BASE   = '/api/v1';
  const token  = localStorage.getItem('ipfms_token');
  if (!token) { console.error('❌  Not logged in — no token in localStorage.'); return; }

  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const api = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    if (!r.ok) { console.error(`API ${method} ${path} →`, j); throw new Error(j.message || 'API error'); }
    // Unwrap { success, data } envelope
    return j.data !== undefined ? j.data : j;
  };

  console.log('🚀  Starting seed…');

  // ── 1. Get accounts ──────────────────────────────────────────────────────────
  const { accounts } = await api('GET', '/accounts');
  if (!accounts || !accounts.length) { console.error('❌  No accounts found.'); return; }
  const account = accounts[0];
  console.log(`✅  Account: "${account.name}" (${account._id}), current balance: ${account.currentBalance}`);

  // ── 2. Recalculate correct balance from all transactions ─────────────────────
  // Fetch all transactions (multiple pages, limit 100)
  let allTxs = [], page = 1;
  while (true) {
    const { transactions } = await api('GET', `/transactions?limit=100&page=${page}&startDate=2020-01-01&endDate=2027-01-01`);
    if (!transactions || !transactions.length) break;
    allTxs.push(...transactions);
    if (transactions.length < 100) break;
    page++;
  }
  console.log(`📊  Loaded ${allTxs.length} transactions for balance recalc`);

  // Starting balance assumed $35,000 for demo
  const START_BALANCE = 35000;
  let balance = START_BALANCE;
  for (const tx of allTxs) {
    const amt = Math.abs(tx.amount);
    if (['credit', 'refund'].includes(tx.type)) balance += amt;
    else balance -= amt;
  }
  const roundedBalance = Math.round(balance * 100) / 100;
  console.log(`💰  Calculated correct balance: $${roundedBalance}`);

  await api('PATCH', `/accounts/${account._id}/balance`, { balance: roundedBalance });
  console.log('✅  Account balance updated');

  // ── 3. Create budgets for May 2026 ──────────────────────────────────────────
  const budgetStart = '2026-05-01';
  const budgetEnd   = '2026-05-31';

  const budgets = [
    {
      name: 'Monthly Living Budget',
      period: 'monthly',
      startDate: budgetStart,
      endDate: budgetEnd,
      categories: [
        { category: 'housing',        limit: 2500, alertThreshold: 90 },
        { category: 'food_dining',    limit: 600,  alertThreshold: 80 },
        { category: 'transportation', limit: 400,  alertThreshold: 80 },
        { category: 'utilities',      limit: 300,  alertThreshold: 85 },
      ],
    },
    {
      name: 'Lifestyle & Leisure',
      period: 'monthly',
      startDate: budgetStart,
      endDate: budgetEnd,
      categories: [
        { category: 'entertainment',  limit: 200,  alertThreshold: 80 },
        { category: 'personal_care',  limit: 150,  alertThreshold: 90 },
        { category: 'shopping',       limit: 350,  alertThreshold: 80 },
        { category: 'health_fitness', limit: 120,  alertThreshold: 90 },
      ],
    },
    {
      name: 'Savings & Goals',
      period: 'monthly',
      startDate: budgetStart,
      endDate: budgetEnd,
      categories: [
        { category: 'savings',        limit: 1000, alertThreshold: 0  },
        { category: 'investments',    limit: 500,  alertThreshold: 0  },
      ],
      savingsGoal: 1500,
    },
    {
      name: 'Travel Fund',
      period: 'monthly',
      startDate: budgetStart,
      endDate: budgetEnd,
      categories: [
        { category: 'travel',         limit: 500,  alertThreshold: 80 },
      ],
    },
  ];

  let budgetsCreated = 0;
  for (const b of budgets) {
    try {
      await api('POST', '/budgets', b);
      budgetsCreated++;
      console.log(`✅  Budget created: "${b.name}"`);
    } catch (e) {
      console.warn(`⚠️  Budget "${b.name}" skipped:`, e.message);
    }
  }

  // ── 4. Add anomalous May 2026 transactions ───────────────────────────────────
  // These are intentionally high vs Jan–Apr averages to trigger AI anomalies
  const accountId = account._id;
  const anomalyTxs = [
    // food_dining — normally ~$250/mo, this month spiked to ~$720 → 2.9x anomaly
    { description: 'Fancy Restaurant Dinner x4', amount: 185,  type: 'debit',  category: 'food_dining',    date: '2026-05-02', accountId },
    { description: 'Weekend Brunch Outing',       amount: 92,   type: 'debit',  category: 'food_dining',    date: '2026-05-03', accountId },
    { description: 'Office Team Lunch (paid)',     amount: 145,  type: 'debit',  category: 'food_dining',    date: '2026-05-04', accountId },
    { description: 'Meal Delivery Subscriptions', amount: 78,   type: 'debit',  category: 'food_dining',    date: '2026-05-05', accountId },
    // entertainment — normally ~$80/mo, this month ~$320 → 4x anomaly
    { description: 'Music Festival Tickets',      amount: 180,  type: 'debit',  category: 'entertainment',  date: '2026-05-03', accountId },
    { description: 'Streaming Services Bundle',   amount: 65,   type: 'debit',  category: 'entertainment',  date: '2026-05-04', accountId },
    { description: 'Concert Merchandise',         amount: 75,   type: 'debit',  category: 'entertainment',  date: '2026-05-05', accountId },
    // shopping — normally ~$120/mo, this month ~$480 → 4x anomaly
    { description: 'Electronics Purchase',        amount: 320,  type: 'debit',  category: 'shopping',       date: '2026-05-03', accountId },
    { description: 'Online Fashion Haul',         amount: 160,  type: 'debit',  category: 'shopping',       date: '2026-05-05', accountId },
    // Additional regular May income to make income_expense summary richer
    { description: 'Freelance Project Payment',   amount: 1500, type: 'credit', category: 'income',         date: '2026-05-04', accountId },
  ];

  let txCreated = 0;
  for (let i = 0; i < anomalyTxs.length; i++) {
    const tx = { ...anomalyTxs[i], externalId: `seed-anomaly-${Date.now()}-${i}` };
    try {
      await api('POST', '/transactions', tx);
      txCreated++;
      await new Promise(r => setTimeout(r, 80)); // small delay to avoid duplicates
    } catch (e) {
      console.warn(`⚠️  Transaction "${tx.description}" skipped:`, e.message);
    }
  }
  console.log(`✅  Created ${txCreated}/${anomalyTxs.length} anomaly transactions`);

  console.log(`\n🎉  Seed complete!`);
  console.log(`   • Account balance set to $${roundedBalance}`);
  console.log(`   • ${budgetsCreated} budgets created`);
  console.log(`   • ${txCreated} anomaly transactions added`);
  console.log(`\nRefresh the page to see all changes.`);
})();
