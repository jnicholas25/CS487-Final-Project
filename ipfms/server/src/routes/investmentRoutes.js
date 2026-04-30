'use strict';
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

// Static/aggregate routes BEFORE /:id
router.get('/portfolio',         investmentController.portfolio);
router.get('/performance',       investmentController.performance);
router.get('/dividends/summary', investmentController.dividendSummary);
router.get('/dividends/history', investmentController.dividendHistory);

// Collection
router.get('/',  listInvestmentRules, validate, investmentController.list);
router.post('/', createInvestmentRules, validate, investmentController.create);

// Per-resource
router.get('/:id',    idParamRules, validate, investmentController.getOne);
// PATCH (canonical) + PUT (frontend alias)
router.patch('/:id',  updateInvestmentRules, validate, investmentController.update);
router.put('/:id',    updateInvestmentRules, validate, investmentController.update);
router.delete('/:id', idParamRules, validate, investmentController.remove);
router.post('/:id/dividends', addDividendRules, validate, investmentController.addDividendHandler);

module.exports = router;
