# 🚀 Enterprise Telegram Finance Tracking Bot (Phases 1 – 12)

A production-ready, enterprise-grade Telegram Bot built with **Node.js**, **Telegraf**, **Prisma ORM**, **MySQL**, **Winston**, and **Zod**. Features full Role-Based Access Control (RBAC), Audit Logging, Receipt Upload with OCR Extraction, Founder Dashboard, Burn Rate & Runway Calculation, Department Budgets, Vendor Analytics, Automated Schedules & Reports, and Anomaly Smart Alerts.

---

## 🏗️ Architecture & Component Design

```text
finance-bot/
│
├── prisma/
│   ├── schema.prisma                      # Expanded Prisma Schema (Users, Roles, Expenses, Receipts, Vendors, Budgets, AuditLogs, Notifications, CashBalance)
│   └── migrations/
│       ├── 20260828000000_init/           # Phase 1 Migration SQL
│       └── 20260828100000_phase2_upgrade/ # Phase 2-12 Upgrade Migration SQL
│
├── src/
│   ├── bot/
│   │   ├── commands/
│   │   │   ├── start.command.js           # /start handler
│   │   │   ├── expense.command.js         # /expense handler
│   │   │   ├── editDeleteExpense.command.js # /editexpense & /deleteexpense handlers
│   │   │   ├── history.command.js         # /history filter handler
│   │   │   ├── daily.command.js           # /daily handler
│   │   │   ├── monthly.command.js         # /monthly handler
│   │   │   ├── budget.command.js          # /budget & /setbudget handlers
│   │   │   ├── departmentBudget.command.js# /setdepartmentbudget & /departmentbudget
│   │   │   ├── categories.command.js      # /categories handler
│   │   │   ├── receipt.command.js         # Photo listener & OCR confirmation handler
│   │   │   ├── vendor.command.js          # /vendor, /vendors, /vendorreport
│   │   │   ├── advancedReports.command.js # /weekly, /topspenders, /department, /categoryreport
│   │   │   ├── founder.command.js         # /founder, /burnrate, /runway, /setcash, /forecast
│   │   │   ├── recurring.command.js       # /recurring scheduled expense handler
│   │   │   ├── rbac.command.js            # /users, /addadmin, /addmanager, /grant, /revoke
│   │   │   ├── audit.command.js           # /auditlogs handler
│   │   │   └── help.command.js            # Master /help directory
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js         # Auto registration & Super Admin bootstrap
│   │   │   ├── permission.middleware.js   # Granular RBAC permission check
│   │   │   └── error.middleware.js        # Global error catcher
│   │   ├── handlers/
│   │   │   └── command.handler.js         # Command router registry
│   │   └── index.js                       # Bot initialization & notification attachment
│   │
│   ├── config/
│   │   └── env.js                         # Zod-validated environment config
│   ├── database/
│   │   └── prisma.js                      # Prisma client singleton
│   ├── services/
│   │   ├── user.service.js                # User & RBAC service
│   │   ├── permission.service.js          # Role permission matrix
│   │   ├── audit.service.js               # Audit log recorder
│   │   ├── expense.service.js             # Expense recording, edit, soft delete & history
│   │   ├── budget.service.js              # Company & department budget threshold alerts
│   │   ├── notification.service.js        # Direct Telegram alert dispatcher
│   │   ├── receipt.service.js             # Receipt storage & OCR extraction link
│   │   ├── vendor.service.js              # Vendor tracking & reports
│   │   ├── reporting.service.js           # Analytics, Runway, Forecast & Founder Dashboard
│   │   ├── recurring.service.js           # Automated recurring expense processor
│   │   ├── smartAlert.service.js          # Anomaly detection (spikes, duplicates, missing receipts)
│   │   ├── scheduler.service.js           # Cron background scheduler
│   │   └── ocr/
│   │       └── ocr.provider.js            # OCR Provider interface & regex/pattern implementation
│   ├── utils/
│   │   └── logger.js                      # Winston logger
│   └── index.js                           # Entrypoint & shutdown lifecycle
│
├── .env.example                           # Environment variable template
├── package.json                           # Dependencies & package scripts
└── README.md                              # System documentation
```

---

## 🔑 Role-Based Access Control (RBAC) Matrix

| Role | Permissions & Access Scope |
| :--- | :--- |
| **SUPER_ADMIN** | Full system access. Create/Remove Admins & Managers, Grant/Revoke Custom Permissions, View Audit Logs, Manage Cash, Executive Reports. |
| **ADMIN** | Manage Budgets, Department Budgets, Edit & Soft Delete Expenses, View All Expenses, Manage Categories & Vendors, Manage Recurring Expenses. |
| **MANAGER** | View Team & Department Reports, Add Expenses, Upload Receipts, View Analytics. |
| **EMPLOYEE** | Add Expense, View Own Expenses, Upload Receipts. |

---

## 📜 Full Command Reference

### 1️⃣ Expense & Receipt Management
- `/expense <amount> <category> <note>` — Record new expense.
- Upload Photo — Trigger OCR extraction & store receipt file.
- `/editexpense <id> <amount|category|note> <value>` — Edit existing expense.
- `/deleteexpense <id>` — Soft delete expense (maintains audit history).
- `/history [category|30days]` — Filtered history with pagination.

### 2️⃣ Budgets & Department Allocations
- `/budget` — Check monthly budget status, spending, and % usage.
- `/setbudget <amount>` — Set monthly budget target.
- `/departmentbudget` — View department budget allocations.
- `/setdepartmentbudget <dept> <amount>` — Set budget for Marketing, Operations, Software, Travel, Admin.

### 3️⃣ Vendors & Recurring Schedules
- `/vendors` — List registered vendors & transaction count.
- `/vendor <name>` — View spend summary & recent transactions for a vendor (e.g. AWS, Google, OpenAI).
- `/vendorreport` — Monthly vendor spending report.
- `/recurring <amount> <category> <frequency> <note>` — Schedule recurring expenses (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`).

### 4️⃣ Advanced Analytics & Reports
- `/daily` — Today's total spend & category breakdown.
- `/weekly` — Last 7 days spending summary.
- `/monthly` — Current month spend, breakdown & top category.
- `/topspenders` / `/leaderboard` — Team member spending rankings.
- `/department` — Department spending breakdown.
- `/categoryreport` — Category spending percentage analysis.

### 5️⃣ Founder Dashboard & Financial Runway
- `/founder` — Executive dashboard overview (Yesterday spend, 7-day, monthly, projected, cash, runway, top spenders).
- `/burnrate` — 3-month average monthly cash burn.
- `/runway` — Months of remaining cash runway (`Cash Balance / Monthly Burn`).
- `/setcash <amount>` — Update bank cash balance.
- `/forecast` — Month-end projected spend (`(Current Spend / Days Passed) * Total Days`).

### 6️⃣ Security, Users & Audit Logs
- `/users` — List registered team members and roles.
- `/addadmin <username|telegramId>` — Promote user to Admin.
- `/removeadmin <username|telegramId>` — Demote user to Employee.
- `/addmanager <username|telegramId>` — Promote user to Manager.
- `/removemanager <username|telegramId>` — Demote user to Employee.
- `/permissions` — List available permissions.
- `/grant <username|telegramId> <PERMISSION>` — Grant custom permission.
- `/revoke <username|telegramId> <PERMISSION>` — Revoke custom permission.
- `/auditlogs` — View system audit log events.

---

## ⚡ Smart Alerts & Automated Notifications

1. **Automated Budget Threshold Alerts:** Dispatched automatically to Admins and Managers when monthly spending crosses **50%**, **75%**, **90%**, and **100%**.
2. **Duplicate Expense Alert:** Detects duplicate transactions (same user, amount, category) logged within 1 hour.
3. **Spending Spike Alert:** Detects single large expenses exceeding threshold.
4. **Missing Receipt Alert:** Flags large expenses (> $100) missing receipts.
5. **Scheduled Daily Summary:** Dispatched every morning at 9 AM to leadership.

---

## 🚀 Execution & Setup

### Local Development (Polling Mode)
```bash
# 1. Update database schema in MySQL
npm run db:push

# 2. Launch the bot in local polling mode
npm run dev
```

---

## ⚡ Deploy to Vercel (Serverless Mode)

The application is 100% **Vercel Serverless Ready** with automatic Webhook routing, Vercel Crons, and an interactive status dashboard.

1. **Deploy to Vercel**: Push to GitHub and import in the [Vercel Dashboard](https://vercel.com/new).
2. **Add Environment Variables** in Vercel (`BOT_TOKEN`, `DATABASE_URL`, `GROQ_API_KEY`, `SUPER_ADMIN_IDS`, `APP_URL`).
3. **Register Webhook**: Visit `https://your-app.vercel.app/api/set-webhook` or run:
   ```bash
   npm run webhook:set https://your-app.vercel.app
   ```
4. **Check Health**: Visit `https://your-app.vercel.app/` for the real-time status dashboard.

📖 **For complete step-by-step instructions, see the [Vercel Deployment Guide](VERCEL_DEPLOYMENT.md).**

