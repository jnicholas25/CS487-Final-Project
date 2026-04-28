/**
 * Investment Controller — Step 7 (Investment Tracker & Financial Reports)
 *
 * Routes:
 *   GET    /api/v1/investments                    list holdings
 *   GET    /api/v1/investments/portfolio           portfolio summary
 *   GET    /api/v1/investments/performance         per-holding & portfolio returns
 *   GET    /api/v1/investments/dividends/summary   dividend income summary
 *   GET    /api/v1/investments/dividends/history   flat dividend event list
 *   POST   /api/v1/investments                    add a holding
 *   GET    /api/v1/investments/:id                single holding
 *   PATCH  /api/v1/investments/:id                update price / quantity / metadata
 *   DELETE /api/v1/investments/:id                soft delete
 *   POST   /api/v1/investments/:id/dividends       add a dividend record
 */

const Investment    = require('../models/Investment');
const { AppError }  = require('../middleware/errorHandler');
const { getPortfolioSummary }           = require('../services/investments/portfolioAggregator');
const { calculatePortfolioPerformance } = require('../services/investments/performanceCalculator');
const { addDividend, getDividendSummary, getDividendHistory } = require('../services/investments/dividendTracker');
const logger = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _findHolding(id, userId) {
  const h = await Investment.findOne({ _id: id, userId, deletedAt: null });
  if (!h) throw new AppError('Investment holding not found', 404, 'INVESTMENT_NOT_FOUND');
  return h;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/investments
 */
async function list(req, res, next) {
  try {
    const userId = req.user._id;
    const {
      assetType,
      page  = 1,
      limit = 20,
    } = req.query;

    const filter = { userId, isActive: true, deletedAt: null };
    if (assetType) filter.assetType = assetType;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [investments, total] = await Promise.all([
      Investment.find(filter).sort({ symbol: 1 }).skip(skip).limit(parseInt(limit, 10)),
      Investment.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        investments,
        total,
        page:  parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/investments/portfolio
 */
async function portfolio(req, res, next) {
  try {
    const result = await getPortfolioSummary(req.user._id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/investments/performance
 */
async function performance(req, res, next) {
  try {
    const result = await calculatePortfolioPerformance(req.user._id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/investments/dividends/summary
 */
async function dividendSummary(req, res, next) {
  try {
    const result = await getDividendSummary(req.user._id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/investments/dividends/history
 */
async function dividendHistory(req, res, next) {
  try {
    const limit  = parseInt(req.query.limit, 10)  || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const result = await getDividendHistory(req.user._id, { limit, offset });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/investments
 */
async function create(req, res, next) {
  try {
    const {
      symbol, name, assetType, exchange, quantity,
      averageCostBasis, currentPrice, accountId,
      currency, purchaseDate, notes, tags,
    } = req.body;

    const investment = await Investment.create({
      userId:           req.user._id,
      accountId:        accountId   || null,
      symbol,
      name,
      assetType:        assetType   || 'stock',
      exchange:         exchange    || null,
      quantity,
      averageCostBasis,
      currentPrice:     currentPrice != null ? currentPrice : null,
      priceUpdatedAt:   currentPrice != null ? new Date() : null,
      currency:         currency    || 'USD',
      purchaseDate:     purchaseDate ? new Date(purchaseDate) : null,
      notes:            notes       || null,
      tags:             tags        || [],
    });

    logger.info(`[InvestmentController] Created holding ${investment._id} (${symbol}) for user ${req.user._id}`);
    res.status(201).json({ success: true, data: { investment } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/investments/:id
 */
async function getOne(req, res, next) {
  try {
    const investment = await _findHolding(req.params.id, req.user._id);
    res.json({ success: true, data: { investment } });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/investments/:id
 * Editable fields: quantity, averageCostBasis, currentPrice, name,
 *                  exchange, purchaseDate, notes, tags
 */
async function update(req, res, next) {
  try {
    const investment = await _findHolding(req.params.id, req.user._id);

    const EDITABLE = [
      'quantity', 'averageCostBasis', 'name',
      'exchange', 'purchaseDate', 'notes', 'tags',
    ];
    for (const field of EDITABLE) {
      if (req.body[field] !== undefined) {
        investment[field] = req.body[field];
      }
    }

    // currentPrice update also stamps priceUpdatedAt
    if (req.body.currentPrice !== undefined) {
      investment.currentPrice    = req.body.currentPrice;
      investment.priceUpdatedAt  = new Date();
    }

    await investment.save();
    res.json({ success: true, data: { investment } });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/investments/:id  (soft delete)
 */
async function remove(req, res, next) {
  try {
    const investment = await _findHolding(req.params.id, req.user._id);
    investment.isActive  = false;
    investment.deletedAt = new Date();
    await investment.save();

    logger.info(`[InvestmentController] Soft-deleted holding ${investment._id}`);
    res.json({ success: true, data: { message: 'Investment holding removed.' } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/investments/:id/dividends
 */
async function addDividendHandler(req, res, next) {
  try {
    const investment = await addDividend(
      req.params.id,
      req.user._id,
      req.body
    );
    res.status(201).json({ success: true, data: { investment } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  portfolio,
  performance,
  dividendSummary,
  dividendHistory,
  create,
  getOne,
  update,
  remove,
  addDividendHandler,
};
