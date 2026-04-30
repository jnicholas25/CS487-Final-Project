'use strict';
const express = require('express');
const router = express.Router();

const budgetController = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../validators/authValidator');
const {
  createBudgetRules,
  updateBudgetRules,
  idParamRules,
} = require('../validators/budgetValidator');

router.use(protect);

router.get('/', budgetController.list);
router.post('/', createBudgetRules, validate, budgetController.create);

// Static route BEFORE /:id — returns recommendations across all active budgets
router.get('/recommendations', budgetController.allRecommendations);

router.get('/:id', idParamRules, validate, budgetController.getOne);
router.patch('/:id', updateBudgetRules, validate, budgetController.update);
router.delete('/:id', idParamRules, validate, budgetController.remove);
router.post('/:id/sync', idParamRules, validate, budgetController.sync);
router.get('/:id/recommendations', idParamRules, validate, budgetController.recommendations);

module.exports = router;
