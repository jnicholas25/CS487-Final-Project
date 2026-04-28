/**
 * Investment Routes — Step 7 (Investment Tracker & Financial Reports)
 *
 * All routes require authentication.
 *
 * Route ordering note: static multi-segment paths (portfolio, performance,
 * dividends/summary, dividends/history) are registered BEFORE /:id to prevent
 * Express treating those literal segments as a MongoId parameter.
 */

const express = require('express');
const router  = express.Router();

const investmentController = require('../controllers/investmentController');
const { protect }          = require('../middleware/authMiddleware');
const { validate }         = require('../validators/authValidator');
const {
  idParamRules,
  createInvestmentRules,
  updateInvestmentRules,
  addDividendRules,
  listInvestmentRules,
} = require('../validators/investmentValidator');

router.use(protect);

// ── Static / aggregate routes (must be before /:id) ──────────────────────────

/**
 * GET /api/v1/investments/portfolio
 * Full portfolio summary with per-holding metrics.
 */
router.get('/portfolio', investmentController.portfolio);

/**
 * GET /api/v1/investments/performance
 * Per-holding and portfolio return calculations (total return, CAGR).
 */
router.get('/performance', investmentController.performance);

/**
 * GET /api/v1/investments/dividends/summary
 * All-time and YTD dividend totals by holding.
 */
router.get('/dividends/summary', investmentController.dividendSummary);

/**
 * GET /api/v1/investments/dividends/history
 * Flat, date-sorted list of all dividend events.
 * Query params: limit, offset
 */
router.get('/dividends/history', investmentController.dividendHistory);

// ── Collection routes ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/investments
 * List the user's holdings with optional assetType filter.
 */
router.get('/', listInvestmentRules, validate, investmentController.list);

/**
 * POST /api/v1/investments
 * Add a new investment holding.
 */
router.post('/', createInvestmentRules, validate, investmentController.create);

// ── Per-resource routes ───────────────────────────────────────────────────────

/**
 * GET /api/v1/investments/:id
 */
router.get('/:id', idParamRules, validate, investmentController.getOne);

/**
 * PATCH /api/v1/investments/:id
 * Update price, quantity, or metadata on a holding.
 */
router.patch('/:id', updateInvestmentRules, validate, investmentController.update);

/**
 * DELETE /api/v1/investments/:id
 * Soft-delete a holding.
 */
router.delete('/:id', idParamRules, validate, investmentController.remove);

/**
 * POST /api/v1/investments/:id/dividends
 * Record a dividend payment against a holding.
 */
router.post('/:id/dividends', addDividendRules, validate, investmentController.addDividendHandler);

module.exports = router;
