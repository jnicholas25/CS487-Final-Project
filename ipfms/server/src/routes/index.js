'use strict';
const express = require('express');
const router = express.Router();

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes        = require('./authRoutes');         // Step 2
const transactionRoutes = require('./transactionRoutes');  // Step 3
const budgetRoutes      = require('./budgetRoutes');       // Step 4
const paymentRoutes     = require('./paymentRoutes');      // Step 6
const alertRoutes       = require('./alertRoutes');        // Step 5
const investmentRoutes  = require('./investmentRoutes');   // Step 7
const reportRoutes      = require('./reportRoutes');       // Step 7
const healthScoreRoutes = require('./healthScoreRoutes');  // Step 8
const accountRoutes     = require('./accountRoutes');      // Accounts list

// ── Mount routes ──────────────────────────────────────────────────────────────
router.use('/auth',         authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/budgets',      budgetRoutes);
router.use('/payments',     paymentRoutes);
router.use('/alerts',       alertRoutes);
router.use('/investments',  investmentRoutes);
router.use('/reports',      reportRoutes);
router.use('/health-score', healthScoreRoutes);
router.use('/accounts',    accountRoutes);

module.exports = router;
