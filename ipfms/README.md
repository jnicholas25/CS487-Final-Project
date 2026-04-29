# IPFMS — Intelligent Personal Financial Management System

A full-stack personal finance application built with Node.js/Express (backend) and React 18 (frontend). The system implements five proprietary algorithms for financial intelligence: anomaly detection, autopayment management, budget monitoring, financial health scoring, and investment tracking.

---

## Architecture Overview

```
ipfms/
├── server/          Node.js + Express REST API
│   ├── src/
│   │   ├── models/          Mongoose schemas (7 models)
│   │   ├── services/        Business logic (algorithms)
│   │   ├── controllers/     HTTP request handlers
│   │   ├── routes/          Express routers
│   │   ├── middleware/       Auth, error handling, validation
│   │   └── config/          Database, logger
│   └── tests/
│       ├── unit/            Jest unit tests (mocked DB)
│       └── integration/     Jest integration tests (mongodb-memory-server)
│
└── client/          React 18 SPA (Create React App)
    ├── public/
    └── src/
        ├── pages/           Full-page route components
        ├── components/      Reusable UI components
        ├── context/         React Context providers
        ├── hooks/           Custom data-fetching hooks
        ├── services/        Axios API client wrappers
        ├── utils/           Formatters, validators, date helpers
        ├── constants/       Routes, categories, roles
        └── styles/          CSS design system (variables + globals)
```

---

## Features by Step

| Step | Feature | Algorithms / Key Files |
|------|---------|------------------------|
| 1 | Project scaffolding, models, config | 7 Mongoose schemas |
| 2 | Authentication — JWT, 2FA (TOTP), account lockout | `authService.js`, `authController.js` |
| 3 | Transaction tracking — auto-categorisation, duplicate detection | `autoCategorizer.js`, `duplicateDetector.js` |
| 4 | Budget management — spending sync, savings recommendations | `budgetMonitor.js`, `savingsRecommender.js` |
| 5 | Anomaly detection (Algorithm 5.3) | `zScoreDetector.js`, `anomalyEngine.js` |
| 6 | Autopayment manager (Algorithm 5.4) | `paymentScheduler.js` |
| 7 | Investment tracker + financial reports | `portfolioAggregator.js`, `reportGenerator.js`, `chartDataBuilder.js` |
| 8 | Financial Health Score (Algorithm 5.6) | `healthScoreCalculator.js` |
| 9 | React frontend — all pages, design system, accessibility | `client/src/` |

---

## Algorithm 5.6 — Financial Health Score

Composite weighted score (0–100) across five components:

| Component | Weight | Method |
|-----------|--------|--------|
| Savings Rate | 25% | `(income − expenses) / income` over 30 days |
| Budget Adherence | 25% | Fraction of budget categories within limit |
| Payment History | 20% | Successful payments / total attempts (90 days) |
| Debt-to-Income | 15% | `1 − min(1, totalDebt / monthlyIncome / 0.36)` |
| Emergency Fund | 15% | `min(1, liquidSavings / (3 × avgMonthlyExpense))` |

Score bands: **Excellent** ≥ 80 · **Good** ≥ 65 · **Fair** ≥ 50 · **Needs Work** ≥ 35 · **Poor** < 35

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB 6+ (local or Atlas URI)
- npm 9+

### Environment Setup

```bash
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

Key environment variables:
```
MONGODB_URI=mongodb://localhost:27017/ipfms
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
```

### Backend

```bash
cd server
npm install
npm run dev          # nodemon — auto-restarts on change
npm test             # all tests (unit + integration)
npm run test:unit    # unit tests only
```

### Frontend

```bash
cd client
npm install
npm start            # CRA dev server on http://localhost:3000
npm run build        # production build → client/build/
```

The CRA dev server proxies `/api/*` requests to `http://localhost:5000` (configured in `client/package.json`).

---

## API Reference

All endpoints require `Authorization: Bearer <token>` except auth routes.

### Authentication — `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create account |
| POST | `/login` | Login, returns JWT or 2FA challenge |
| POST | `/2fa/verify` | Complete 2FA login |
| POST | `/2fa/setup` | Generate TOTP QR code |
| POST | `/2fa/confirm` | Enable 2FA |
| GET  | `/me` | Get current user |
| PUT  | `/me` | Update profile |

### Transactions — `/api/transactions`
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/` | List with filters (date, category, type, search) |
| POST | `/` | Create transaction |
| GET  | `/:id` | Get single |
| PUT  | `/:id` | Update |
| DELETE | `/:id` | Soft delete |

### Budgets — `/api/budgets`
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/` | List budgets |
| POST | `/` | Create budget |
| GET  | `/recommendations` | Savings recommendations |
| PUT  | `/:id` | Update |
| DELETE | `/:id` | Soft delete |

### Alerts — `/api/alerts`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/scan` | Trigger anomaly scan |
| GET  | `/` | List alerts |
| PATCH | `/:id/acknowledge` | Mark as seen |
| PATCH | `/:id/resolve` | Resolve with feedback |
| PATCH | `/:id/dismiss` | Dismiss |

### Investments — `/api/investments`
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/portfolio` | Portfolio summary + holdings |
| GET  | `/performance` | Annualised returns |
| GET  | `/dividends/summary` | All-time + YTD dividends |
| POST | `/` | Add holding |
| PUT  | `/:id` | Update holding / price |
| POST | `/:id/dividends` | Record dividend |

### Reports — `/api/reports`
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/spending` | Spending by category |
| GET  | `/income` | Income summary |
| GET  | `/net-worth` | Net worth snapshot |
| GET  | `/charts/spending-trend` | Monthly bar chart data |
| GET  | `/charts/category-breakdown` | Pie chart data |
| GET  | `/charts/income-vs-expense` | Side-by-side bar chart |

### Health Score — `/api/health-score`
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/` | Current score + components + advice |
| GET  | `/history` | Monthly score history (up to 12 months) |

### Payments — `/api/payments`
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/` | List scheduled payments |
| POST | `/` | Create |
| POST | `/process` | Trigger payment processing |
| PUT  | `/:id` | Update |
| DELETE | `/:id` | Cancel |

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Login / Register | `/login` | Auth with 2FA support |
| Dashboard | `/` | KPIs, health score ring, spending trend chart |
| Transactions | `/transactions` | Full CRUD with filters and pagination |
| Budgets | `/budgets` | Progress bars, create/edit/delete, recommendations |
| Investments | `/investments` | Holdings table, portfolio summary |
| Payments | `/payments` | Scheduled payment management |
| Reports | `/reports` | Category doughnut, income vs expense chart, net worth |
| Alerts | `/alerts` | Anomaly alerts with resolve/dismiss workflow |
| Settings | `/settings` | Profile, security (password + 2FA), notifications |

### Design System
- **DM Sans** (UI) + **JetBrains Mono** (numbers)
- CSS custom properties for dark/light theming (`[data-theme="light"]`)
- Accent colour: `#10B981` (emerald green)
- Responsive grid layouts — mobile breakpoint at 768px
- WCAG 2.1 AA: skip-nav link, `aria-label` on all interactive elements, `role` attributes, focus-visible styles

---

## Testing

```bash
# Run all unit tests (no DB required — uses Jest mocks)
npm run test:unit

# Run integration tests (spins up mongodb-memory-server)
npm run test:integration
```

Test coverage includes:
- Auth flow (registration, login, 2FA, lockout)
- Transaction processing (deduplication, categorisation)
- Budget monitoring (spending sync, alert thresholds)
- Anomaly detection Z-score engine
- Autopayment scheduler (due-date logic, retry policy)
- Investment portfolio (performance calculations, CAGR)
- Financial health score (Algorithm 5.6 — all five components)

---

## Project Structure (key files)

```
server/src/
  services/
    anomaly/
      zScoreDetector.js        Z-score computation (Algorithm 5.3)
      anomalyEngine.js         3-rule detection + deduplication
    autopayments/
      paymentScheduler.js      Due-date calc + balance pre-check (Algorithm 5.4)
    budget/
      budgetMonitor.js         Spending aggregation + alerts (Algorithm 5.5)
      savingsRecommender.js    Personalised savings tips
    health-score/
      healthScoreCalculator.js Composite 5-component score (Algorithm 5.6)
    investments/
      portfolioAggregator.js   Holdings + summary totals
      performanceCalculator.js CAGR / total return
      dividendTracker.js       Dividend history + YTD
    reports/
      reportGenerator.js       Spending / income / net-worth
      chartDataBuilder.js      Chart-ready data series
    transactions/
      transactionProcessor.js  Validation + dedup pipeline
      autoCategorizer.js       Rule-based auto-categorisation
      duplicateDetector.js     Fingerprint-based dedup
```
