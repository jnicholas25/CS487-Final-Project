'use strict';
const express        = require('express');
const { protect }    = require('../middleware/authMiddleware');
const accountCtrl    = require('../controllers/accountController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET  /api/v1/accounts              — list user's accounts
router.get('/', accountCtrl.list);

// PATCH /api/v1/accounts/:id/balance — directly set a balance (for seeding/corrections)
router.patch('/:id/balance', accountCtrl.setBalance);

module.exports = router;
