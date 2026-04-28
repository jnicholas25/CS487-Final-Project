const express = require('express');
const router = express.Router();

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes        = require('./authRoutes');         // Step 2
const transactionRoutes = require('./transactionRoutes');  // Step 3
const budgetRoutes      = require('./budgetRoutes');       // Step 4
// Step 5+: uncomment as each feature is built
// const alertRoutes       = require('./alertRoutes');
// const paymentRoutes     = require('./paymentRoutes');
// const investmentRoutes  = require('./investmentRoutes');
// const reportRoutes      = require('./reportRoutes');
// const healthScoreRoutes = require('./healthScoreRoutes');

// ── Mount routes ──────────────────────────────────────────────────────────────
router.use('/auth',         authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/budgets',      budgetRoutes);
// router.use('/alerts',       alertRoutes);
// router.use('/payments',     paymentRoutes);
// router.use('/investments',  investmentRoutes);
// router.use('/reports',      reportRoutes);
// router.use('/health-score', healthScoreRoutes);

module.exports = router;
