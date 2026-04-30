'use strict';
const Budget = require('../models/Budget');
const { AppError } = require('../middleware/errorHandler');
const { syncBudgetSpending } = require('../services/budgets/budgetMonitor');
const { generateRecommendations, getSavingsScore } = require('../services/budgets/savingsRecommender');
const logger = require('../utils/logger');

// ── List ──────────────────────────────────────────────────────────────────────

exports.list = async (req, res, next) => {
  try {
    const { isActive, isTemplate, page = 1, limit = 20 } = req.query;
    const query = { userId: req.user._id, deletedAt: null };
    if (isActive !== undefined)   query.isActive   = isActive   === 'true';
    if (isTemplate !== undefined) query.isTemplate = isTemplate === 'true';
    const skip = (Number(page) - 1) * Number(limit);
    const [budgets, total] = await Promise.all([
      Budget.find(query).sort({ startDate: -1 }).skip(skip).limit(Number(limit)),
      Budget.countDocuments(query),
    ]);
    res.status(200).json({
      success: true,
      data: { budgets, total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
};

// ── Create ────────────────────────────────────────────────────────────────────

exports.create = async (req, res, next) => {
  try {
    const { name, period, startDate, endDate, categories, rolloverEnabled, savingsGoal, isTemplate } = req.body;
    const budget = await Budget.create({
      userId: req.user._id,
      name: name || null,
      period: period || 'monthly',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      categories: (categories || []).map((c) => ({
        category: c.category,
        limit: c.limit,
        alertThreshold: c.alertThreshold || 80,
        color: c.color || null,
        icon: c.icon || null,
        notes: c.notes || null,
      })),
      rolloverEnabled: rolloverEnabled || false,
      savingsGoal: savingsGoal || null,
      isTemplate: isTemplate || false,
    });
    res.status(201).json({ success: true, message: 'Budget created', data: { budget } });
  } catch (err) { next(err); }
};

// ── Get single ────────────────────────────────────────────────────────────────

exports.getOne = async (req, res, next) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
    if (!budget) return next(new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND'));
    res.status(200).json({ success: true, data: { budget } });
  } catch (err) { next(err); }
};

// ── Update ────────────────────────────────────────────────────────────────────

exports.update = async (req, res, next) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
    if (!budget) return next(new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND'));
    const editableFields = ['name', 'period', 'startDate', 'endDate', 'categories', 'rolloverEnabled', 'savingsGoal', 'isActive'];
    for (const field of editableFields) {
      if (req.body[field] !== undefined) {
        budget[field] = (field === 'startDate' || field === 'endDate') ? new Date(req.body[field]) : req.body[field];
      }
    }
    await budget.save();
    res.status(200).json({ success: true, message: 'Budget updated', data: { budget } });
  } catch (err) { next(err); }
};

// ── Delete (soft) ─────────────────────────────────────────────────────────────

exports.remove = async (req, res, next) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
    if (!budget) return next(new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND'));
    budget.deletedAt = new Date();
    await budget.save();
    res.status(200).json({ success: true, message: 'Budget deleted' });
  } catch (err) { next(err); }
};

// ── Sync spending ─────────────────────────────────────────────────────────────

exports.sync = async (req, res, next) => {
  try {
    const { budget, alerts } = await syncBudgetSpending(req.params.id, req.user._id.toString());
    res.status(200).json({
      success: true,
      message: `Budget synced — ${alerts.length} alert(s) triggered`,
      data: { budget, alerts },
    });
  } catch (err) {
    if (err.code === 'BUDGET_NOT_FOUND') return next(new AppError(err.message, 404, 'BUDGET_NOT_FOUND'));
    next(err);
  }
};

// ── Global recommendations (no ID — for /budgets/recommendations) ─────────────

exports.allRecommendations = async (req, res, next) => {
  try {
    const budgets = await Budget.find({ userId: req.user._id, deletedAt: null, isActive: true }).lean();
    if (!budgets.length) {
      return res.status(200).json({ success: true, data: { recommendations: [], savingsScore: null } });
    }
    const recs = [];
    for (const budget of budgets.slice(0, 3)) {
      const r = await generateRecommendations(req.user._id.toString(), budget);
      recs.push(...r);
    }
    const savingsScore = getSavingsScore(budgets[0]);
    res.status(200).json({ success: true, data: { recommendations: recs, savingsScore } });
  } catch (err) { next(err); }
};

// ── Per-budget recommendations ────────────────────────────────────────────────

exports.recommendations = async (req, res, next) => {
  try {
    const budget = await Budget.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
    if (!budget) return next(new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND'));
    const [recommendations, savingsScore] = await Promise.all([
      generateRecommendations(req.user._id.toString(), budget),
      Promise.resolve(getSavingsScore(budget)),
    ]);
    res.status(200).json({ success: true, data: { recommendations, savingsScore } });
  } catch (err) { next(err); }
};
