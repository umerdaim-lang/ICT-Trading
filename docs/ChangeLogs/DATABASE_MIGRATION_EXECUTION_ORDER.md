# Database Migration Scripts - Execution Order

**Document Purpose**: This document lists all database migration scripts in the correct execution sequence for new customer deployments.

**Last Updated**: 2026-02-14

---

## Prerequisites

1. **PostgreSQL 15+** installed
2. **Database Created**: `AP_ERP`
3. **Initial Schema**: Auto-created by EF Core on first API startup

---

## Execution Sequence

### Step 0: Initial Schema (Automatic)

**Method**: Entity Framework Core Code-First

The base schema is automatically created when the backend API starts for the first time. This includes core tables:
- `company`, `app_user`, `role`, `permission`, `role_permission`
- `customer`, `product`, `uom`, `location`, `warehouse`
- `delivery_challan`, `delivery_challan_line`
- `invoice`, `invoice_line`, `invoice_tax_line`
- `payment`, `payment_allocation`
- `production_receipt`, `production_receipt_line`
- `stock_move`
- `sequence`
- And other base tables...

**Action**: Start the backend API once to create schema, then proceed with migration scripts.

---

### Step 1: Base Permissions (Optional)

**Script**: `MyQuery.sql`
**Location**: `F:\SMEERP\AP\DB\MyQuery.sql`

**Purpose**: Adds basic permissions if missing

**Tables/Objects Modified**:
- `permission` (INSERT)
- `role_permission` (INSERT)

**SQL Preview**:
```sql
INSERT INTO PERMISSION (ID, CODE, NAME)
VALUES (GEN_RANDOM_UUID(), 'CHALLAN_CREATE', 'Master data edit')
ON CONFLICT (CODE) DO NOTHING;

INSERT INTO ROLE_PERMISSION (ROLE_ID, PERMISSION_ID)
SELECT R.ID, P.ID
FROM ROLE R
JOIN PERMISSION P ON P.CODE = 'CHALLAN_CREATE'
WHERE R.CODE = 'ADMIN'
ON CONFLICT DO NOTHING;
```

**Dependencies**: Base schema must exist
**Idempotent**: Yes (uses ON CONFLICT DO NOTHING)

---

### Step 2: Inventory, Rejections & Transfers

**Script**: `phase2_inventory_rejections_transfers.sql`
**Location**: `F:\SMEERP\AP\DB\phase2_inventory_rejections_transfers.sql`

**Purpose**: Phase 2 features - Inventory OUT, Rejections, Internal Transfers

**Tables/Objects Created**:
| Object | Type | Description |
|--------|------|-------------|
| `challan_line_rejection` | TABLE | Tracks rejected quantities per challan line |
| `doc_status` | ENUM | DRAFT, POSTED, CANCELLED |
| `inventory_transfer` | TABLE | Internal stock transfer header |
| `inventory_transfer_line` | TABLE | Transfer line items |

**Enums Modified**:
| Enum | New Values Added |
|------|------------------|
| `challan_status` | PARTIALLY_REJECTED, FULLY_REJECTED |
| `seq_doc_type` | TRANSFER |

**Seed Data**:
- Creates `REJECTION_STORE` location for all companies

**SQL Key Sections**:
```sql
-- Create rejection tracking table
CREATE TABLE IF NOT EXISTS challan_line_rejection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_line_id uuid NOT NULL REFERENCES delivery_challan_line(id),
  qty_rejected numeric(18,3) NOT NULL,
  rejection_reason text NULL,
  ...
);

-- Create inventory transfer tables
CREATE TABLE IF NOT EXISTS inventory_transfer (...);
CREATE TABLE IF NOT EXISTS inventory_transfer_line (...);
```

**Dependencies**: Base schema, `delivery_challan_line` table
**Idempotent**: Yes (uses IF NOT EXISTS, IF EXISTS checks)

---

### Step 3: Credit Notes

**Script**: `phase2b_credit_notes.sql`
**Location**: `F:\SMEERP\AP\DB\phase2b_credit_notes.sql`

**Purpose**: Credit note functionality for sales returns and adjustments

**Tables/Objects Created**:
| Object | Type | Description |
|--------|------|-------------|
| `customer_credit_balance` | TABLE | Customer credit/overpayment tracking |
| `credit_note` | TABLE | Credit note header |
| `credit_note_line` | TABLE | Credit note line items |
| `credit_note_tax_line` | TABLE | Tax breakdown per credit note |

**Seed Data**:
- Creates `CREDIT_NOTE` sequence for all companies
- Adds permissions: `CREDIT_NOTE_CREATE`, `CREDIT_NOTE_POST`
- Assigns permissions to Admin role

**SQL Key Sections**:
```sql
-- Customer credit balance
CREATE TABLE IF NOT EXISTS customer_credit_balance (
  customer_id uuid PRIMARY KEY REFERENCES customer(id),
  company_id uuid NOT NULL REFERENCES company(id),
  credit_amount numeric(18,2) NOT NULL DEFAULT 0,
  ...
);

-- Credit note tables
CREATE TABLE IF NOT EXISTS credit_note (...);
CREATE TABLE IF NOT EXISTS credit_note_line (...);
CREATE TABLE IF NOT EXISTS credit_note_tax_line (...);

-- Sequence for credit note numbering
INSERT INTO sequence (id, company_id, doc_type, prefix, padding, next_number, ...)
SELECT gen_random_uuid(), c.id, 'CREDIT_NOTE', 'CN-', 6, 1, true, now()
FROM company c
WHERE NOT EXISTS (...);
```

**Dependencies**: Base schema, `customer`, `invoice`, `invoice_line` tables
**Idempotent**: Yes

---

### Step 4: Invoice Deductions

**Script**: `invoice_deductions.sql`
**Location**: `F:\SMEERP\AP\DB\invoice_deductions.sql`

**Purpose**: Track customer debit note deductions against invoices

**Tables/Objects Created**:
| Object | Type | Description |
|--------|------|-------------|
| `invoice_deduction` | TABLE | Deduction records against invoices |

**SQL Content**:
```sql
CREATE TABLE IF NOT EXISTS invoice_deduction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id),
  invoice_id uuid NOT NULL REFERENCES invoice(id),
  deduction_date date NOT NULL,
  amount numeric(18,2) NOT NULL,
  debit_note_ref text NOT NULL,  -- Customer's Debit Note number
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES app_user(id),
  CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_invoice_deduction_invoice ON invoice_deduction(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_deduction_company ON invoice_deduction(company_id, deduction_date DESC);
```

**Dependencies**: Base schema, `invoice` table
**Idempotent**: Yes

---

### Step 5: Tax Deducted By Customer

**Script**: `add_tax_deducted_by_customer.sql`
**Location**: `F:\SMEERP\AP\DB\add_tax_deducted_by_customer.sql`

**Purpose**: Add field for WHT deducted by customer at source

**Tables/Objects Modified**:
| Object | Change | Description |
|--------|--------|-------------|
| `invoice` | ADD COLUMN | `tax_deducted_by_customer` |

**SQL Content**:
```sql
ALTER TABLE invoice
ADD COLUMN IF NOT EXISTS tax_deducted_by_customer numeric(18,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN invoice.tax_deducted_by_customer IS
  'Tax deducted by customer at source (e.g., WHT deducted when paying). Reduces the amount customer needs to pay.';
```

**Dependencies**: `invoice` table
**Idempotent**: Yes (uses IF NOT EXISTS)

---

### Step 6: Payment Invoice Link

**Script**: `update_payment_for_invoice_link.sql`
**Location**: `F:\SMEERP\AP\DB\update_payment_for_invoice_link.sql`

**Purpose**: Update payment system for new invoice-linked workflow

**Tables/Objects Modified**:
| Object | Change | Description |
|--------|--------|-------------|
| `payment_status` | ADD VALUES | PENDING, RECEIVED |
| `payment` | ADD COLUMNS | invoice_id, due_date, received_date, received_at, received_by, receipt_no |
| `payment` | ALTER COLUMN | method (make nullable) |

**SQL Key Sections**:
```sql
-- Add new payment statuses
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PENDING' ...) THEN
        ALTER TYPE payment_status ADD VALUE 'PENDING';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RECEIVED' ...) THEN
        ALTER TYPE payment_status ADD VALUE 'RECEIVED';
    END IF;
END $$;

-- Add new columns
ALTER TABLE payment ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoice(id);
ALTER TABLE payment ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS received_date date;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS received_at timestamptz;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS received_by uuid REFERENCES app_user(id);
ALTER TABLE payment ADD COLUMN IF NOT EXISTS receipt_no varchar(20);

-- Make method nullable
ALTER TABLE payment ALTER COLUMN method DROP NOT NULL;

-- Set due_date for existing records
UPDATE payment SET due_date = payment_date WHERE due_date IS NULL;
ALTER TABLE payment ALTER COLUMN due_date SET NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_invoice_id ON payment(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_status_due_date ON payment(company_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_payment_receipt_no ON payment(company_id, receipt_no);
```

**Dependencies**: `invoice` table, `payment` table
**Idempotent**: Yes (mostly, but UPDATE statement will run each time)

---

### Step 7: Credit Note Goods Received Tracking

**Script**: `phase2c_credit_note_goods_received.sql`
**Location**: `F:\SMEERP\AP\DB\phase2c_credit_note_goods_received.sql`

**Purpose**: Track when physical goods are received for SALES_RETURN credit notes

**Tables/Objects Modified**:
| Object | Change | Description |
|--------|--------|-------------|
| `credit_note` | ADD COLUMNS | `goods_received`, `goods_received_at`, `goods_received_by` |
| `idx_credit_note_goods_pending` | CREATE INDEX | Partial index for pending returns report |
| `permission` | INSERT | `CREDIT_NOTE_RECEIVE_GOODS` permission |
| `role_permission` | INSERT | Assign permission to Admin role |

**SQL Content**:
```sql
-- Add goods_received tracking columns
ALTER TABLE credit_note
ADD COLUMN IF NOT EXISTS goods_received boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS goods_received_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS goods_received_by uuid NULL REFERENCES app_user(id);

-- Index for pending returns report
CREATE INDEX IF NOT EXISTS idx_credit_note_goods_pending
  ON credit_note(company_id, status, goods_received, type)
  WHERE status = 'POSTED' AND goods_received = false AND type = 'SALES_RETURN';

-- Permission for receiving goods
INSERT INTO permission (id, code, description)
VALUES (gen_random_uuid(), 'CREDIT_NOTE_RECEIVE_GOODS', 'Mark credit note goods as received')
ON CONFLICT (code) DO NOTHING;

-- Assign to Admin role
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r, permission p
WHERE r.name = 'Admin' AND p.code = 'CREDIT_NOTE_RECEIVE_GOODS'
  AND NOT EXISTS (SELECT 1 FROM role_permission rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
```

**Rollback Script**: `phase2c_credit_note_goods_received_ROLLBACK.sql`

**Dependencies**: `credit_note` table (from Step 3)
**Idempotent**: Yes

---

### Step 8: Invoice Deduction Line Items & Auto Credit Note

**Script**: `phase2d_invoice_deduction_enhancement.sql`
**Location**: `F:\SMEERP\AP\DB\phase2d_invoice_deduction_enhancement.sql`

**Purpose**: Enhance deductions with line items and auto-create Credit Notes when posted

**Tables/Objects Modified**:
| Object | Change | Description |
|--------|--------|-------------|
| `invoice_deduction` | ADD COLUMNS | `status`, `credit_note_id`, `posted_at`, `posted_by` |
| `invoice_deduction_line` | CREATE TABLE | Line items for deductions |
| `idx_invoice_deduction_status` | CREATE INDEX | Status lookup index |
| `permission` | INSERT | `INVOICE_DEDUCTION_POST` permission |
| `role_permission` | INSERT | Assign permission to Admin role |

**SQL Key Sections**:
```sql
-- Add status and credit_note_id to invoice_deduction
ALTER TABLE invoice_deduction
ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS credit_note_id uuid NULL REFERENCES credit_note(id),
ADD COLUMN IF NOT EXISTS posted_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS posted_by uuid NULL REFERENCES app_user(id);

-- Create invoice_deduction_line table
CREATE TABLE IF NOT EXISTS invoice_deduction_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deduction_id uuid NOT NULL REFERENCES invoice_deduction(id) ON DELETE CASCADE,
  invoice_line_id uuid NULL REFERENCES invoice_line(id),
  product_id uuid NOT NULL REFERENCES product(id),
  description text NOT NULL DEFAULT '',
  qty numeric(18,3) NOT NULL,
  uom_id uuid NULL REFERENCES uom(id),
  unit_price_pkr numeric(18,2) NOT NULL,
  line_amount numeric(18,2) NOT NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (qty > 0),
  CHECK (line_amount >= 0)
);

-- Update existing deductions to POSTED (backward compatibility)
UPDATE invoice_deduction SET status = 'POSTED' WHERE status = 'DRAFT' AND amount > 0;
```

**Dependencies**: `invoice_deduction` table (from Step 4), `credit_note` table (from Step 3)
**Idempotent**: Yes

---

## Quick Reference - Execution Order

| Order | Script File | Purpose |
|-------|-------------|---------|
| 0 | (Auto) EF Core | Base schema creation |
| 1 | `MyQuery.sql` | Base permissions (optional) |
| 2 | `phase2_inventory_rejections_transfers.sql` | Rejections + Transfers |
| 3 | `phase2b_credit_notes.sql` | Credit Notes |
| 4 | `invoice_deductions.sql` | Invoice Deductions |
| 5 | `add_tax_deducted_by_customer.sql` | WHT by Customer |
| 6 | `update_payment_for_invoice_link.sql` | Payment-Invoice Link |
| 7 | `phase2c_credit_note_goods_received.sql` | Credit Note Goods Received |
| 8 | `phase2d_invoice_deduction_enhancement.sql` | Deduction Lines + Auto Credit Note |

---

## Execution Commands

### Using psql (Command Line)

```bash
# Connect to database
psql -U postgres -d AP_ERP

# Run scripts in order
\i 'F:/SMEERP/AP/DB/MyQuery.sql'
\i 'F:/SMEERP/AP/DB/phase2_inventory_rejections_transfers.sql'
\i 'F:/SMEERP/AP/DB/phase2b_credit_notes.sql'
\i 'F:/SMEERP/AP/DB/invoice_deductions.sql'
\i 'F:/SMEERP/AP/DB/add_tax_deducted_by_customer.sql'
\i 'F:/SMEERP/AP/DB/update_payment_for_invoice_link.sql'
\i 'F:/SMEERP/AP/DB/phase2c_credit_note_goods_received.sql'
\i 'F:/SMEERP/AP/DB/phase2d_invoice_deduction_enhancement.sql'
```

### Using pgAdmin

1. Connect to `AP_ERP` database
2. Open Query Tool (Tools > Query Tool)
3. Open each script file in order (File > Open)
4. Execute each script (F5)
5. Verify no errors before proceeding to next script

---

## Verification Queries

After running all scripts, verify with these queries:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check credit_note table
SELECT COUNT(*) FROM credit_note;

-- Check invoice has tax_deducted_by_customer column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'invoice' AND column_name = 'tax_deducted_by_customer';

-- Check payment has new columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'payment'
ORDER BY ordinal_position;

-- Check enum values
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'payment_status'::regtype;
```

---

## Script File Locations

| Environment | Path |
|-------------|------|
| Development | `F:\SMEERP\AP\DB\` |
| Deployment Package | `F:\SMEERP\AP\Deploy\Package\Database\` |

**Note**: Both locations contain identical scripts. Use `Deploy\Package\Database\` for customer deployments.

---

## Rollback Notes

Most scripts use `IF NOT EXISTS` and are idempotent. However, if rollback is needed:

```sql
-- Rollback Step 8: Invoice Deduction Enhancement
DROP TABLE IF EXISTS invoice_deduction_line;
ALTER TABLE invoice_deduction DROP COLUMN IF EXISTS status;
ALTER TABLE invoice_deduction DROP COLUMN IF EXISTS credit_note_id;
ALTER TABLE invoice_deduction DROP COLUMN IF EXISTS posted_at;
ALTER TABLE invoice_deduction DROP COLUMN IF EXISTS posted_by;
DROP INDEX IF EXISTS idx_invoice_deduction_status;
DELETE FROM role_permission WHERE permission_id IN (SELECT id FROM permission WHERE code = 'INVOICE_DEDUCTION_POST');
DELETE FROM permission WHERE code = 'INVOICE_DEDUCTION_POST';

-- Rollback Step 7: Credit Note Goods Received
DROP INDEX IF EXISTS idx_credit_note_goods_pending;
ALTER TABLE credit_note DROP COLUMN IF EXISTS goods_received;
ALTER TABLE credit_note DROP COLUMN IF EXISTS goods_received_at;
ALTER TABLE credit_note DROP COLUMN IF EXISTS goods_received_by;
DELETE FROM role_permission WHERE permission_id IN (SELECT id FROM permission WHERE code = 'CREDIT_NOTE_RECEIVE_GOODS');
DELETE FROM permission WHERE code = 'CREDIT_NOTE_RECEIVE_GOODS';

-- Rollback Step 6: Payment changes
ALTER TABLE payment DROP COLUMN IF EXISTS invoice_id;
ALTER TABLE payment DROP COLUMN IF EXISTS due_date;
ALTER TABLE payment DROP COLUMN IF EXISTS received_date;
ALTER TABLE payment DROP COLUMN IF EXISTS received_at;
ALTER TABLE payment DROP COLUMN IF EXISTS received_by;
ALTER TABLE payment DROP COLUMN IF EXISTS receipt_no;

-- Rollback Step 5: Tax deducted
ALTER TABLE invoice DROP COLUMN IF EXISTS tax_deducted_by_customer;

-- Rollback Step 4: Invoice deductions
DROP TABLE IF EXISTS invoice_deduction;

-- Rollback Step 3: Credit notes
DROP TABLE IF EXISTS credit_note_tax_line;
DROP TABLE IF EXISTS credit_note_line;
DROP TABLE IF EXISTS credit_note;
DROP TABLE IF EXISTS customer_credit_balance;

-- Rollback Step 2: Inventory/Rejections
DROP TABLE IF EXISTS inventory_transfer_line;
DROP TABLE IF EXISTS inventory_transfer;
DROP TABLE IF EXISTS challan_line_rejection;
```

**WARNING**: Rollback will cause data loss. Only use on fresh installations or with proper backups.
