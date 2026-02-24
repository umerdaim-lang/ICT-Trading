# Module: Accounting

## Overview

The Accounting module provides a complete double-entry bookkeeping system integrated with all other modules (Sales, Purchases, Inventory, Payments). It handles journal entries, chart of accounts, financial reporting, tax management, and reconciliation.

### Key Features

1. **Chart of Accounts** - Configurable account structure
2. **Journal Entries** - Manual and automatic journal entries
3. **General Ledger** - Complete transaction history
4. **Accounts Payable** - Vendor bill management and payments
5. **Accounts Receivable** - Customer invoices and collections
6. **Tax Management** - GST/Sales Tax, WHT, Input/Output tax tracking
7. **Bank Reconciliation** - Match bank statements with transactions
8. **Financial Reports** - Trial Balance, P&L, Balance Sheet
9. **Period Management** - Fiscal years and period closing

---

## Core Concepts

### Account Types

| Type | Normal Balance | Purpose |
|------|----------------|---------|
| Asset | Debit | Cash, Bank, Inventory, Receivables, Fixed Assets |
| Liability | Credit | Payables, Loans, Accrued Expenses |
| Equity | Credit | Capital, Retained Earnings |
| Revenue | Credit | Sales, Service Income |
| Expense | Debit | COGS, Operating Expenses, Taxes |

### Journal Types

| Journal | Purpose |
|---------|---------|
| Sales | Customer Invoices |
| Purchase | Vendor Bills |
| Cash | Cash transactions |
| Bank | Bank transactions |
| Stock | Inventory movements |
| General | Manual adjustments |

### Accounting Methods

| Method | When Recorded | Used For |
|--------|---------------|----------|
| Accrual | When earned/incurred | Standard business |
| Cash | When paid/received | Small businesses |

---

## Database Schema

### Core Tables

```sql
-- Account Types (Classification)
CREATE TYPE account_type AS ENUM (
    'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'
);

CREATE TYPE account_subtype AS ENUM (
    -- Assets
    'CurrentAsset', 'FixedAsset', 'OtherAsset', 'Bank', 'Cash', 'Receivable', 'Inventory',
    -- Liabilities
    'CurrentLiability', 'LongTermLiability', 'Payable',
    -- Equity
    'Capital', 'RetainedEarnings',
    -- Revenue
    'Income', 'OtherIncome',
    -- Expense
    'DirectCost', 'OperatingExpense', 'OtherExpense'
);

-- Chart of Accounts
CREATE TABLE account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    account_type account_type NOT NULL,
    account_subtype account_subtype NOT NULL,
    parent_id UUID REFERENCES account(id),

    -- Control flags
    is_reconcilable BOOLEAN DEFAULT false,  -- For bank/receivable/payable
    is_deprecated BOOLEAN DEFAULT false,
    allow_posting BOOLEAN DEFAULT true,     -- false = summary account only

    -- Default tax (optional)
    default_tax_id UUID REFERENCES tax(id),

    -- Currency (for multi-currency)
    currency_code VARCHAR(3) DEFAULT 'PKR',

    -- Balances (denormalized for performance)
    current_balance DECIMAL(18,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, code)
);

-- Account Journal (Grouping for entries)
CREATE TYPE journal_type AS ENUM (
    'Sales', 'Purchase', 'Cash', 'Bank', 'Stock', 'General', 'Tax'
);

CREATE TABLE account_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    journal_type journal_type NOT NULL,

    -- Default accounts
    default_debit_account_id UUID REFERENCES account(id),
    default_credit_account_id UUID REFERENCES account(id),

    -- For bank/cash journals
    bank_account_id UUID REFERENCES account(id),

    -- Sequence for entry numbering
    sequence_prefix VARCHAR(20),
    next_number INT DEFAULT 1,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, code)
);

-- Journal Entry Header
CREATE TYPE journal_entry_status AS ENUM ('Draft', 'Posted', 'Cancelled');

CREATE TABLE journal_entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    journal_id UUID NOT NULL REFERENCES account_journal(id),
    entry_no VARCHAR(50),
    entry_date DATE NOT NULL,

    -- Reference to source document
    source_type VARCHAR(50),  -- 'Invoice', 'Payment', 'StockMove', 'Manual'
    source_id UUID,
    reference VARCHAR(200),   -- External reference

    -- Totals (must balance)
    total_debit DECIMAL(18,2) NOT NULL DEFAULT 0,
    total_credit DECIMAL(18,2) NOT NULL DEFAULT 0,

    status journal_entry_status DEFAULT 'Draft',
    narration TEXT,

    -- Audit
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES app_user(id),
    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, entry_no)
);

-- Journal Entry Lines
CREATE TABLE journal_entry_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES journal_entry(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES account(id),

    -- Amounts
    debit DECIMAL(18,2) DEFAULT 0,
    credit DECIMAL(18,2) DEFAULT 0,

    -- Partner (for receivable/payable)
    partner_type VARCHAR(20),  -- 'Customer', 'Vendor', 'Employee'
    partner_id UUID,

    -- Tax tracking
    tax_id UUID REFERENCES tax(id),
    tax_base_amount DECIMAL(18,2),

    -- Analytic (cost center tracking)
    analytic_account_id UUID,

    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT false,
    reconcile_ref VARCHAR(50),

    label VARCHAR(200),
    sort_order INT DEFAULT 0
);

-- Fiscal Year
CREATE TABLE fiscal_year (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    name VARCHAR(50) NOT NULL,  -- e.g., "FY 2024-25"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, name)
);

-- Fiscal Period (Monthly)
CREATE TABLE fiscal_period (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year_id UUID NOT NULL REFERENCES fiscal_year(id),
    name VARCHAR(50) NOT NULL,  -- e.g., "July 2024"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES app_user(id),
    sort_order INT
);

-- Bank Statement (for reconciliation)
CREATE TABLE bank_statement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    journal_id UUID NOT NULL REFERENCES account_journal(id),
    statement_date DATE NOT NULL,
    statement_ref VARCHAR(100),
    opening_balance DECIMAL(18,2) NOT NULL,
    closing_balance DECIMAL(18,2) NOT NULL,
    is_reconciled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank Statement Lines
CREATE TABLE bank_statement_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID NOT NULL REFERENCES bank_statement(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description VARCHAR(500),
    reference VARCHAR(100),
    amount DECIMAL(18,2) NOT NULL,  -- +ve = deposit, -ve = withdrawal

    -- Matching
    matched_entry_line_id UUID REFERENCES journal_entry_line(id),
    is_matched BOOLEAN DEFAULT false,

    sort_order INT DEFAULT 0
);

-- Vendor Bill (Purchase side - separate from customer invoices)
CREATE TYPE vendor_bill_status AS ENUM ('Draft', 'Posted', 'Paid', 'Cancelled');

CREATE TABLE vendor_bill (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    bill_no VARCHAR(50),
    vendor_id UUID NOT NULL,  -- References vendor/supplier table
    vendor_bill_ref VARCHAR(100),  -- Vendor's invoice number
    bill_date DATE NOT NULL,
    due_date DATE,

    -- Purchase Order reference (optional)
    purchase_order_id UUID,

    -- Amounts
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(18,2) DEFAULT 0,
    total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(18,2) DEFAULT 0,
    amount_due DECIMAL(18,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,

    -- Linked journal entry
    journal_entry_id UUID REFERENCES journal_entry(id),

    status vendor_bill_status DEFAULT 'Draft',
    notes TEXT,

    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, bill_no)
);

-- Vendor Bill Lines
CREATE TABLE vendor_bill_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES vendor_bill(id) ON DELETE CASCADE,

    -- Product or expense
    product_id UUID REFERENCES product(id),
    account_id UUID NOT NULL REFERENCES account(id),
    description TEXT NOT NULL,

    quantity DECIMAL(18,4) DEFAULT 1,
    unit_price DECIMAL(18,4) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    line_amount DECIMAL(18,2) NOT NULL,

    -- Tax
    tax_id UUID REFERENCES tax(id),
    tax_amount DECIMAL(18,2) DEFAULT 0,

    -- Purchase order line reference
    po_line_id UUID,

    sort_order INT DEFAULT 0
);

-- Vendor Payment
CREATE TYPE vendor_payment_status AS ENUM ('Draft', 'Posted', 'Cancelled');

CREATE TABLE vendor_payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    payment_no VARCHAR(50),
    vendor_id UUID NOT NULL,
    payment_date DATE NOT NULL,

    journal_id UUID NOT NULL REFERENCES account_journal(id),  -- Bank/Cash journal

    amount DECIMAL(18,2) NOT NULL,
    payment_method VARCHAR(50),  -- 'BankTransfer', 'Cheque', 'Cash'
    reference_no VARCHAR(100),

    -- Linked journal entry
    journal_entry_id UUID REFERENCES journal_entry(id),

    status vendor_payment_status DEFAULT 'Draft',
    notes TEXT,

    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, payment_no)
);

-- Vendor Payment Allocation
CREATE TABLE vendor_payment_allocation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES vendor_payment(id) ON DELETE CASCADE,
    bill_id UUID NOT NULL REFERENCES vendor_bill(id),
    allocated_amount DECIMAL(18,2) NOT NULL
);

-- GRNI - Goods Received Not Invoiced (Accrual)
CREATE TABLE grni (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    receipt_id UUID NOT NULL,  -- Links to purchase receipt
    receipt_line_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES product(id),
    quantity DECIMAL(18,4) NOT NULL,
    unit_cost DECIMAL(18,4) NOT NULL,
    total_amount DECIMAL(18,2) NOT NULL,

    -- Cleared when bill is posted
    bill_id UUID REFERENCES vendor_bill(id),
    is_cleared BOOLEAN DEFAULT false,
    cleared_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_account_company_type ON account(company_id, account_type);
CREATE INDEX idx_journal_entry_company_date ON journal_entry(company_id, entry_date);
CREATE INDEX idx_journal_entry_source ON journal_entry(source_type, source_id);
CREATE INDEX idx_entry_line_account ON journal_entry_line(account_id);
CREATE INDEX idx_entry_line_partner ON journal_entry_line(partner_type, partner_id);
CREATE INDEX idx_vendor_bill_status ON vendor_bill(company_id, status);
CREATE INDEX idx_grni_receipt ON grni(receipt_id, is_cleared);
```

---

## Chart of Accounts (Standard Pakistan)

```
1000 - ASSETS
├── 1100 - Current Assets
│   ├── 1110 - Cash in Hand
│   ├── 1120 - Bank Accounts
│   │   ├── 1121 - HBL Current Account
│   │   ├── 1122 - MCB Current Account
│   │   └── 1123 - UBL Current Account
│   ├── 1200 - Accounts Receivable
│   │   └── 1201 - Trade Receivables
│   ├── 1300 - Inventory
│   │   ├── 1310 - Raw Materials
│   │   ├── 1320 - Work in Progress
│   │   ├── 1330 - Finished Goods
│   │   └── 1340 - Goods in Transit
│   ├── 1400 - Advances & Prepayments
│   │   ├── 1410 - Advance to Suppliers
│   │   ├── 1420 - Prepaid Expenses
│   │   └── 1430 - Input GST Receivable
│   └── 1500 - Other Current Assets
│       └── 1510 - Stock at Subcontractors
│
├── 1600 - Fixed Assets
│   ├── 1610 - Land & Building
│   ├── 1620 - Plant & Machinery
│   ├── 1630 - Vehicles
│   ├── 1640 - Furniture & Fixtures
│   ├── 1650 - Computer Equipment
│   └── 1690 - Accumulated Depreciation
│
2000 - LIABILITIES
├── 2100 - Current Liabilities
│   ├── 2110 - Accounts Payable
│   │   └── 2111 - Trade Payables
│   ├── 2120 - Accrued Expenses
│   │   └── 2121 - GRNI (Goods Received Not Invoiced)
│   ├── 2130 - Tax Liabilities
│   │   ├── 2131 - Output GST Payable
│   │   ├── 2132 - WHT Payable
│   │   └── 2133 - Income Tax Payable
│   ├── 2140 - Employee Liabilities
│   │   ├── 2141 - Salaries Payable
│   │   └── 2142 - Employee Reimbursables
│   └── 2150 - Advances from Customers
│
├── 2200 - Long-Term Liabilities
│   ├── 2210 - Bank Loans
│   └── 2220 - Deferred Tax Liability
│
3000 - EQUITY
├── 3100 - Capital
│   └── 3110 - Owner's Capital
├── 3200 - Retained Earnings
│   ├── 3210 - Prior Year Retained Earnings
│   └── 3220 - Current Year P&L
│
4000 - REVENUE
├── 4100 - Sales Revenue
│   ├── 4110 - Product Sales
│   └── 4120 - Service Revenue
├── 4200 - Other Income
│   ├── 4210 - Interest Income
│   └── 4220 - Miscellaneous Income
│
5000 - COST OF GOODS SOLD
├── 5100 - Direct Costs
│   ├── 5110 - Raw Material Consumed
│   ├── 5120 - Direct Labor
│   ├── 5130 - Subcontracting Costs
│   └── 5140 - Manufacturing Overhead
│
6000 - OPERATING EXPENSES
├── 6100 - Administrative Expenses
│   ├── 6110 - Salaries & Wages
│   ├── 6120 - Rent
│   ├── 6130 - Utilities
│   ├── 6140 - Office Supplies
│   └── 6150 - Professional Fees
├── 6200 - Selling Expenses
│   ├── 6210 - Sales Commission
│   ├── 6220 - Marketing & Advertising
│   └── 6230 - Freight & Delivery
├── 6300 - Depreciation & Amortization
│   └── 6310 - Depreciation Expense
├── 6400 - Financial Expenses
│   ├── 6410 - Bank Charges
│   └── 6420 - Interest Expense
├── 6500 - Tax Expenses
│   └── 6510 - Income Tax Expense
```

---

## Accounting Flows

### 1. Sales Invoice Posting

When customer invoice is posted:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SALES INVOICE POSTING                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Invoice: INV-2025-0001                                              │
│  Customer: ABC Trading                                               │
│  Subtotal: Rs 100,000                                                │
│  GST (17%): Rs 17,000                                                │
│  WHT (4%): Rs (4,000)                                                │
│  Net Due: Rs 113,000                                                 │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════════ │
│                                                                      │
│  Journal Entry (Auto-created):                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ Accounts Receivable (1201) │ 113,000    │            │        │  │
│  │ WHT Receivable (1430)      │ 4,000      │            │        │  │
│  │ Sales Revenue (4110)       │            │ 100,000    │        │  │
│  │ Output GST Payable (2131)  │            │ 17,000     │        │  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Effect:                                                             │
│  - Receivable increases (asset ↑)                                   │
│  - Revenue recorded (equity ↑ via P&L)                              │
│  - GST liability created (liability ↑)                              │
│  - WHT receivable for future offset (asset ↑)                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Customer Payment Received

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PAYMENT RECEIPT                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Payment: RCP-2025-0001                                              │
│  Customer: ABC Trading                                               │
│  Amount: Rs 113,000                                                  │
│  Method: Bank Transfer                                               │
│                                                                      │
│  Journal Entry:                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ Bank - HBL (1121)          │ 113,000    │            │        │  │
│  │ Accounts Receivable (1201) │            │ 113,000    │        │  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Effect:                                                             │
│  - Bank balance increases (asset ↑)                                 │
│  - Receivable cleared (asset ↓)                                     │
│  - Invoice marked as paid                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Vendor Bill Posting

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VENDOR BILL POSTING                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Bill: BILL-2025-0001                                                │
│  Vendor: Steel Suppliers Ltd                                         │
│  Products: Raw Materials                                             │
│  Subtotal: Rs 50,000                                                 │
│  Input GST (17%): Rs 8,500                                           │
│  Total: Rs 58,500                                                    │
│                                                                      │
│  Step 1: Goods Receipt (when materials received)                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ Raw Materials (1310)       │ 50,000     │            │        │  │
│  │ GRNI (2121)                │            │ 50,000     │        │  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Step 2: Bill Posted (when bill entered)                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ GRNI (2121)                │ 50,000     │            │        │  │
│  │ Input GST Receivable (1430)│ 8,500      │            │        │  │
│  │ Accounts Payable (2111)    │            │ 58,500     │        │  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Effect:                                                             │
│  - GRNI cleared                                                     │
│  - Input GST recorded for credit                                    │
│  - Payable created to vendor                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Vendor Payment

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VENDOR PAYMENT                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Payment: PAY-2025-0001                                              │
│  Vendor: Steel Suppliers Ltd                                         │
│  Amount: Rs 58,500                                                   │
│                                                                      │
│  Journal Entry:                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ Accounts Payable (2111)    │ 58,500     │            │        │  │
│  │ Bank - HBL (1121)          │            │ 58,500     │        │  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Inventory Valuation (Stock Movement)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STOCK MOVEMENT ENTRIES                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  A. Production Receipt (Finished Goods In):                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ Finished Goods (1330)      │ XXX        │            │        │  │
│  │ Raw Materials (1310)       │            │ XXX        │ Consumed│  │
│  │ WIP (1320)                 │            │ XXX        │ Optional│  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  B. Sales Delivery (COGS):                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ Cost of Goods Sold (5110)  │ XXX        │            │        │  │
│  │ Finished Goods (1330)      │            │ XXX        │        │  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  C. Inventory Adjustment (Write-off):                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ Inventory Loss (5140)      │ XXX        │            │        │  │
│  │ Inventory (1330)           │            │ XXX        │        │  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Chart of Accounts

```
GET    /api/accounts                      - List accounts with balances
GET    /api/accounts/{id}                 - Get account details
POST   /api/accounts                      - Create account
PUT    /api/accounts/{id}                 - Update account
POST   /api/accounts/{id}/deprecate       - Mark account as deprecated

GET    /api/accounts/{id}/ledger          - Get account ledger
       ?from=2025-01-01&to=2025-01-31
```

### Journals

```
GET    /api/journals                      - List journals
GET    /api/journals/{id}                 - Get journal with config
POST   /api/journals                      - Create journal
PUT    /api/journals/{id}                 - Update journal
```

### Journal Entries

```
GET    /api/journal-entries               - List entries
       ?journalId=xxx
       ?from=2025-01-01&to=2025-01-31
       ?status=Posted

GET    /api/journal-entries/{id}          - Get entry with lines
POST   /api/journal-entries               - Create manual entry
PUT    /api/journal-entries/{id}          - Update draft entry
POST   /api/journal-entries/{id}/post     - Post entry
POST   /api/journal-entries/{id}/reverse  - Create reversal entry
```

### Vendor Bills

```
GET    /api/vendor-bills                  - List bills
       ?vendorId=xxx
       ?status=Posted

GET    /api/vendor-bills/{id}             - Get bill details
POST   /api/vendor-bills                  - Create bill
PUT    /api/vendor-bills/{id}             - Update draft bill
POST   /api/vendor-bills/{id}/post        - Post bill (creates JE)
POST   /api/vendor-bills/{id}/cancel      - Cancel bill
```

### Vendor Payments

```
GET    /api/vendor-payments               - List payments
POST   /api/vendor-payments               - Create payment
POST   /api/vendor-payments/{id}/post     - Post payment
GET    /api/vendor-payments/open-bills    - Get unpaid bills for vendor
       ?vendorId=xxx
```

### Bank Reconciliation

```
GET    /api/bank-statements               - List statements
POST   /api/bank-statements               - Create statement
POST   /api/bank-statements/import        - Import from CSV/OFX
POST   /api/bank-statements/{id}/reconcile - Auto-match transactions
PUT    /api/bank-statement-lines/{id}/match - Manual match
```

### Reports

```
GET    /api/reports/trial-balance         - Trial balance
       ?asOfDate=2025-01-31

GET    /api/reports/profit-loss           - P&L statement
       ?from=2025-01-01&to=2025-01-31

GET    /api/reports/balance-sheet         - Balance sheet
       ?asOfDate=2025-01-31

GET    /api/reports/general-ledger        - General ledger
       ?accountId=xxx
       ?from=2025-01-01&to=2025-01-31

GET    /api/reports/aged-payables         - Vendor aging
       ?asOfDate=2025-01-31

GET    /api/reports/gst-summary           - GST return data
       ?from=2025-01-01&to=2025-01-31
```

### Fiscal Periods

```
GET    /api/fiscal-years                  - List fiscal years
POST   /api/fiscal-years                  - Create fiscal year
POST   /api/fiscal-periods/{id}/close     - Close period
POST   /api/fiscal-years/{id}/close       - Close year (year-end)
```

---

## UI Pages

### 1. Chart of Accounts (`/accounting/accounts`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Chart of Accounts                               [+ Add Account]      │
├─────────────────────────────────────────────────────────────────────┤
│ Type: [All Types ▼]  Search: [_________________]  [Show Inactive]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ▼ 1000 - ASSETS                                        Rs 5,450,000 │
│   ▼ 1100 - Current Assets                              Rs 4,200,000 │
│     ├── 1110 - Cash in Hand                              Rs 50,000  │
│     ▼ 1120 - Bank Accounts                            Rs 1,500,000  │
│       ├── 1121 - HBL Current Account                    Rs 800,000  │
│       ├── 1122 - MCB Current Account                    Rs 500,000  │
│       └── 1123 - UBL Current Account                    Rs 200,000  │
│     ├── 1200 - Accounts Receivable                    Rs 1,200,000  │
│     └── 1300 - Inventory                              Rs 1,450,000  │
│   ▼ 1600 - Fixed Assets                                Rs 1,250,000 │
│     ...                                                              │
│                                                                      │
│ ▼ 2000 - LIABILITIES                                    Rs 850,000  │
│   ...                                                                │
│                                                                      │
│ ▼ 3000 - EQUITY                                       Rs 4,600,000  │
│   ...                                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Journal Entry Form (`/accounting/entries/new`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ New Journal Entry                              [Save Draft] [Post]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Journal: [General Journal ▼]    Date: [2025-02-13]                  │
│ Reference: [ADJ-001____________]                                     │
│                                                                      │
│ ┌─ Entry Lines ─────────────────────────────────────────────────┐   │
│ │ Account           │ Partner    │ Label    │ Debit   │ Credit  │   │
│ ├───────────────────┼────────────┼──────────┼─────────┼─────────┤   │
│ │ [Office Supplies▼]│            │ [Jan exp]│ [5,000 ]│         │   │
│ │ [Bank - HBL    ▼] │            │ [Payment]│         │ [5,000 ]│   │
│ │ [+ Add Line]                                                  │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ Narration: [Monthly office supplies expense________________]        │
│                                                                      │
│ ─────────────────────────────────────────────────────────────────   │
│                              Total Debit:  Rs 5,000                  │
│                              Total Credit: Rs 5,000                  │
│                              Difference:   Rs 0 ✓                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Trial Balance Report (`/accounting/reports/trial-balance`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Trial Balance                                     [Export] [Print]   │
├─────────────────────────────────────────────────────────────────────┤
│ As of Date: [2025-01-31]   [Generate]                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Account                              │    Debit    │    Credit      │
│ ─────────────────────────────────────┼─────────────┼────────────────│
│ 1110 - Cash in Hand                  │      50,000 │                │
│ 1121 - HBL Current Account           │     800,000 │                │
│ 1122 - MCB Current Account           │     500,000 │                │
│ 1201 - Trade Receivables             │   1,200,000 │                │
│ 1310 - Raw Materials                 │     450,000 │                │
│ 1330 - Finished Goods                │   1,000,000 │                │
│ 1620 - Plant & Machinery             │   1,250,000 │                │
│ 2111 - Trade Payables                │             │       850,000  │
│ 2131 - Output GST Payable            │             │       120,000  │
│ 3110 - Owner's Capital               │             │     2,000,000  │
│ 3210 - Retained Earnings             │             │     1,500,000  │
│ 4110 - Product Sales                 │             │     2,500,000  │
│ 5110 - Raw Material Consumed         │     980,000 │                │
│ 6110 - Salaries & Wages              │     500,000 │                │
│ 6130 - Utilities                     │      50,000 │                │
│ ...                                  │             │                │
│ ─────────────────────────────────────┼─────────────┼────────────────│
│ TOTAL                                │   6,970,000 │     6,970,000  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### With Sales Module
- Invoice posting creates AR entry + Revenue + Tax
- Payment receipt clears AR

### With Purchase Module
- Goods receipt creates GRNI entry
- Bill posting clears GRNI + creates AP
- Payment clears AP

### With Inventory Module
- Stock movements create valuation entries
- Production receipts adjust WIP/FG accounts

### With Payroll (Future)
- Salary posting creates expense + liability
- Payment clears salary payable

---

## Implementation Phases

### Phase 1: Foundation (2 weeks)
- Chart of Accounts CRUD
- Journal types setup
- Manual journal entries
- Basic posting

### Phase 2: Integration (2 weeks)
- Auto-entries from invoices
- Auto-entries from payments
- GRNI handling
- Vendor bills

### Phase 3: Reports (1 week)
- Trial Balance
- General Ledger
- P&L Statement
- Balance Sheet

### Phase 4: Advanced (2 weeks)
- Bank reconciliation
- Period closing
- Multi-currency (optional)
- Budget tracking (optional)

---

## Business Rules

1. **Balanced Entries**: Total Debit must equal Total Credit
2. **No Posting to Summary Accounts**: Only leaf accounts allow posting
3. **Period Lock**: Cannot post to closed periods
4. **Sequence Control**: Entry numbers are sequential per journal
5. **Audit Trail**: All entries are immutable once posted (reversal only)
6. **Reconciliation**: Bank/Receivable/Payable accounts must reconcile
