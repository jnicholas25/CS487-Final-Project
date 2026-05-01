'use strict';
const Account = require('../models/Account');

/**
 * GET /api/v1/accounts
 * Returns all active accounts belonging to the authenticated user.
 */
exports.list = async (req, res, next) => {
  try {
    const accounts = await Account.find({
      userId:    req.user._id,
      isActive:  true,
      deletedAt: null,
    })
      .select('name accountType accountSubtype institutionName currentBalance currency isPrimary')
      .sort({ isPrimary: -1, name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: { accounts },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/accounts/:id/balance
 * Directly sets the currentBalance on an account (for seeding / corrections).
 */
exports.setBalance = async (req, res, next) => {
  try {
    const { balance } = req.body;
    if (typeof balance !== 'number') {
      return res.status(400).json({ success: false, message: 'balance must be a number' });
    }
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, deletedAt: null },
      { $set: { currentBalance: balance } },
      { new: true }
    ).select('name currentBalance');
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    res.status(200).json({ success: true, data: { account } });
  } catch (err) {
    next(err);
  }
};
