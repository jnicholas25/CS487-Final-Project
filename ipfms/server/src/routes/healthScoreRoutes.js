'use strict';
/**
 * Health Score Routes — Step 8
 * All routes require JWT authentication (applied at the API router level).
 *
 *   GET  /api/health-score           → current score + components + advice
 *   GET  /api/health-score/history   → historical monthly scores
 */

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/healthScoreController');
const { protect } = require('../middleware/authMiddleware');

// All health score routes require authentication
router.use(protect);

// Static route registered BEFORE any parameterised routes
router.get('/history', ctrl.getHistory);
router.get('/',        ctrl.getScore);

module.exports = router;
