'use strict';
const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../validators/authValidator');
const {
  createPaymentRules,
  updatePaymentRules,
  listPaymentRules,
  pausePaymentRules,
  executePaymentRules,
  idParamRules,
} = require('../validators/paymentValidator');

router.use(protect);

router.get('/',  listPaymentRules, validate, paymentController.list);
router.post('/', createPaymentRules, validate, paymentController.create);

// Static routes BEFORE /:id
// POST /process  (frontend) + GET /process (cron ping)
router.post('/process', paymentController.processDue);
router.get('/process',  paymentController.processDue);

router.get('/:id',    idParamRules, validate, paymentController.getOne);
router.patch('/:id',  updatePaymentRules, validate, paymentController.update);
router.delete('/:id', idParamRules, validate, paymentController.remove);
router.post('/:id/execute', executePaymentRules, validate, paymentController.execute);
router.patch('/:id/pause',  pausePaymentRules, validate, paymentController.pause);
router.patch('/:id/resume', idParamRules, validate, paymentController.resume);

module.exports = router;
