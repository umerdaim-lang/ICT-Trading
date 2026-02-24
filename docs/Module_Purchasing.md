# Module: Raw Material & Product Purchasing

## Overview

The Purchasing module manages the complete procurement cycle from requisition to payment. It handles vendor management, purchase orders, goods receipt, quality inspection, vendor bills, and landed cost allocation.

### Key Features

1. **Vendor Management** - Supplier master data, pricing, lead times
2. **Purchase Requisitions** - Internal requests for materials
3. **Request for Quotation (RFQ)** - Get quotes from vendors
4. **Purchase Orders** - Formal orders to suppliers
5. **Goods Receipt** - Receive materials into inventory
6. **Quality Inspection** - Check received goods quality
7. **Vendor Bills** - Process supplier invoices
8. **Three-Way Matching** - PO ↔ Receipt ↔ Bill matching
9. **Landed Costs** - Allocate freight, customs to product cost
10. **Returns to Vendor** - Handle defective goods returns

---

## Core Concepts

### Product Types for Purchasing

| Type | Stock Impact | Costing | Example |
|------|--------------|---------|---------|
| **Raw Material** | ✔ Tracked | FIFO/AVCO | Steel sheets, bolts |
| **Trading Goods** | ✔ Tracked | FIFO/AVCO | Resale items |
| **Consumables** | Optional | Expense | Office supplies |
| **Services** | None | Expense | Freight, labor |

### Purchase Document Flow

```
Requisition → RFQ → Purchase Order → Goods Receipt → Vendor Bill → Payment
     ↓           ↓          ↓              ↓              ↓
  (Request)   (Quote)   (Commit)      (Inventory)    (Accounting)
```

### Costing Methods

| Method | Description | When to Use |
|--------|-------------|-------------|
| **FIFO** | First In First Out | Default for most businesses |
| **AVCO** | Weighted Average | High volume, similar items |
| **Standard** | Fixed cost | Manufacturing with tight control |

### Three-Way Matching

| Document | Qty | Price | Who Creates |
|----------|-----|-------|-------------|
| Purchase Order | Ordered | Agreed | Purchasing |
| Goods Receipt | Received | N/A | Warehouse |
| Vendor Bill | Billed | Invoiced | Accounting |

All three must match (within tolerance) before payment.

---

## Database Schema

### Core Tables

```sql
-- Vendor/Supplier Master
CREATE TABLE vendor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    vendor_code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,

    -- Tax identifiers
    ntn VARCHAR(50),
    strn VARCHAR(50),

    -- Contact info
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    website VARCHAR(200),

    -- Address
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(50) DEFAULT 'Pakistan',

    -- Banking
    bank_name VARCHAR(100),
    bank_account VARCHAR(50),
    iban VARCHAR(50),

    -- Terms
    payment_terms_days INT DEFAULT 30,
    credit_limit DECIMAL(18,2),

    -- Classification
    vendor_type VARCHAR(50),  -- 'RawMaterial', 'Services', 'Trading'
    is_active BOOLEAN DEFAULT true,

    -- Performance
    rating DECIMAL(3,2),  -- 0.00 to 5.00

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, vendor_code)
);

-- Vendor Addresses (multiple per vendor)
CREATE TABLE vendor_address (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
    address_type VARCHAR(20) NOT NULL,  -- 'Main', 'Warehouse', 'Billing'
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'Pakistan',
    is_default BOOLEAN DEFAULT false
);

-- Vendor Price List (agreed prices)
CREATE TABLE vendor_pricelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    vendor_id UUID NOT NULL REFERENCES vendor(id),
    product_id UUID NOT NULL REFERENCES product(id),

    min_qty DECIMAL(18,4) DEFAULT 1,  -- Minimum order qty for this price
    unit_price DECIMAL(18,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'PKR',

    lead_time_days INT,  -- Vendor's lead time for this product

    effective_from DATE NOT NULL,
    effective_to DATE,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(vendor_id, product_id, min_qty, effective_from)
);

-- Purchase Requisition (Internal request)
CREATE TYPE pr_status AS ENUM ('Draft', 'Submitted', 'Approved', 'Rejected', 'Ordered', 'Cancelled');

CREATE TABLE purchase_requisition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    pr_no VARCHAR(50),
    pr_date DATE NOT NULL DEFAULT CURRENT_DATE,

    requested_by UUID NOT NULL REFERENCES app_user(id),
    department VARCHAR(100),

    required_date DATE,
    priority VARCHAR(20) DEFAULT 'Normal',  -- 'Low', 'Normal', 'High', 'Urgent'

    status pr_status DEFAULT 'Draft',
    notes TEXT,

    -- Approval
    approved_by UUID REFERENCES app_user(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, pr_no)
);

-- Purchase Requisition Lines
CREATE TABLE purchase_requisition_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID NOT NULL REFERENCES purchase_requisition(id) ON DELETE CASCADE,

    product_id UUID NOT NULL REFERENCES product(id),
    description TEXT,
    qty DECIMAL(18,4) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uom(id),

    estimated_price DECIMAL(18,4),  -- For budgeting

    -- Suggested vendor (optional)
    suggested_vendor_id UUID REFERENCES vendor(id),

    -- Link to PO when ordered
    po_line_id UUID,

    sort_order INT DEFAULT 0
);

-- Request for Quotation
CREATE TYPE rfq_status AS ENUM ('Draft', 'Sent', 'Received', 'Closed', 'Cancelled');

CREATE TABLE rfq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    rfq_no VARCHAR(50),
    rfq_date DATE NOT NULL DEFAULT CURRENT_DATE,

    vendor_id UUID NOT NULL REFERENCES vendor(id),

    -- From requisition (optional)
    pr_id UUID REFERENCES purchase_requisition(id),

    valid_until DATE,

    status rfq_status DEFAULT 'Draft',
    notes TEXT,

    -- Vendor response
    vendor_quote_ref VARCHAR(100),
    vendor_quote_date DATE,

    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, rfq_no)
);

-- RFQ Lines
CREATE TABLE rfq_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,

    product_id UUID NOT NULL REFERENCES product(id),
    description TEXT,
    qty DECIMAL(18,4) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uom(id),

    -- Vendor's response
    quoted_price DECIMAL(18,4),
    quoted_lead_days INT,

    sort_order INT DEFAULT 0
);

-- Purchase Order
CREATE TYPE po_status AS ENUM ('Draft', 'Confirmed', 'PartiallyReceived', 'Received', 'Billed', 'Closed', 'Cancelled');

CREATE TABLE purchase_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    po_no VARCHAR(50),
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,

    vendor_id UUID NOT NULL REFERENCES vendor(id),
    vendor_address_id UUID REFERENCES vendor_address(id),

    -- From RFQ or PR (optional)
    rfq_id UUID REFERENCES rfq(id),
    pr_id UUID REFERENCES purchase_requisition(id),

    -- Delivery
    ship_to_location_id UUID REFERENCES warehouse(id),
    expected_date DATE,

    -- Terms
    payment_terms VARCHAR(100),
    incoterm VARCHAR(50),  -- 'FOB', 'CIF', 'EXW', etc.

    -- Amounts
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(18,2) DEFAULT 0,
    tax_amount DECIMAL(18,2) DEFAULT 0,
    total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,

    -- Currency (for imports)
    currency VARCHAR(3) DEFAULT 'PKR',
    exchange_rate DECIMAL(18,6) DEFAULT 1,

    status po_status DEFAULT 'Draft',
    notes TEXT,

    -- Approval
    approved_by UUID REFERENCES app_user(id),
    approved_at TIMESTAMPTZ,

    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, po_no)
);

-- Purchase Order Lines
CREATE TABLE purchase_order_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,

    product_id UUID NOT NULL REFERENCES product(id),
    description TEXT NOT NULL,
    qty DECIMAL(18,4) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uom(id),

    unit_price DECIMAL(18,4) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    line_amount DECIMAL(18,2) NOT NULL,

    -- Tax
    tax_id UUID REFERENCES tax(id),
    tax_amount DECIMAL(18,2) DEFAULT 0,

    -- Delivery tracking
    qty_received DECIMAL(18,4) DEFAULT 0,
    qty_billed DECIMAL(18,4) DEFAULT 0,
    qty_returned DECIMAL(18,4) DEFAULT 0,

    -- Expected delivery
    expected_date DATE,

    -- Cost center
    analytic_account_id UUID,

    sort_order INT DEFAULT 0
);

-- Goods Receipt (Purchase Receipt)
CREATE TYPE gr_status AS ENUM ('Draft', 'Posted', 'Cancelled');

CREATE TABLE goods_receipt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    receipt_no VARCHAR(50),
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,

    vendor_id UUID NOT NULL REFERENCES vendor(id),
    po_id UUID REFERENCES purchase_order(id),

    -- Location
    to_location_id UUID NOT NULL REFERENCES warehouse(id),

    -- Vendor delivery note
    vendor_challan_no VARCHAR(100),
    vendor_challan_date DATE,

    -- Transport
    vehicle_no VARCHAR(50),
    transporter_name VARCHAR(100),

    status gr_status DEFAULT 'Draft',
    notes TEXT,

    -- Quality inspection
    inspection_required BOOLEAN DEFAULT false,
    inspection_status VARCHAR(50),  -- 'Pending', 'Passed', 'Failed', 'Partial'

    -- Audit
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES app_user(id),
    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, receipt_no)
);

-- Goods Receipt Lines
CREATE TABLE goods_receipt_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES goods_receipt(id) ON DELETE CASCADE,
    po_line_id UUID REFERENCES purchase_order_line(id),

    product_id UUID NOT NULL REFERENCES product(id),
    description TEXT,

    -- Quantities
    qty_ordered DECIMAL(18,4),  -- From PO line
    qty_received DECIMAL(18,4) NOT NULL,
    qty_accepted DECIMAL(18,4),  -- After inspection
    qty_rejected DECIMAL(18,4) DEFAULT 0,

    uom_id UUID NOT NULL REFERENCES uom(id),

    -- Costing
    unit_cost DECIMAL(18,4),  -- PO price or manual
    line_cost DECIMAL(18,2),

    -- Quality
    rejection_reason TEXT,

    -- Batch/Lot tracking
    batch_no VARCHAR(100),
    expiry_date DATE,

    sort_order INT DEFAULT 0
);

-- Quality Inspection
CREATE TYPE inspection_result AS ENUM ('Pending', 'Passed', 'Failed', 'Conditional');

CREATE TABLE quality_inspection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    inspection_no VARCHAR(50),
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Source document
    receipt_id UUID REFERENCES goods_receipt(id),
    receipt_line_id UUID REFERENCES goods_receipt_line(id),

    product_id UUID NOT NULL REFERENCES product(id),
    qty_inspected DECIMAL(18,4) NOT NULL,
    qty_passed DECIMAL(18,4),
    qty_failed DECIMAL(18,4),

    result inspection_result DEFAULT 'Pending',

    -- Inspection details
    inspection_criteria TEXT,
    findings TEXT,

    inspected_by UUID REFERENCES app_user(id),
    inspected_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, inspection_no)
);

-- Vendor Return (Return to Supplier)
CREATE TYPE vr_status AS ENUM ('Draft', 'Confirmed', 'Shipped', 'Completed', 'Cancelled');

CREATE TABLE vendor_return (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    return_no VARCHAR(50),
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,

    vendor_id UUID NOT NULL REFERENCES vendor(id),
    receipt_id UUID REFERENCES goods_receipt(id),  -- Original receipt

    from_location_id UUID NOT NULL REFERENCES warehouse(id),

    reason VARCHAR(200),

    -- Amounts
    total_value DECIMAL(18,2) DEFAULT 0,

    status vr_status DEFAULT 'Draft',
    notes TEXT,

    -- Vendor acknowledgment
    vendor_credit_note_ref VARCHAR(100),

    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, return_no)
);

-- Vendor Return Lines
CREATE TABLE vendor_return_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES vendor_return(id) ON DELETE CASCADE,
    receipt_line_id UUID REFERENCES goods_receipt_line(id),

    product_id UUID NOT NULL REFERENCES product(id),
    qty DECIMAL(18,4) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uom(id),
    unit_cost DECIMAL(18,4),
    line_value DECIMAL(18,2),

    reason TEXT,

    sort_order INT DEFAULT 0
);

-- Landed Costs
CREATE TABLE landed_cost (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    lc_no VARCHAR(50),
    lc_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Source receipts
    description TEXT,

    -- Total additional costs
    total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,

    status VARCHAR(20) DEFAULT 'Draft',

    -- Journal entry when posted
    journal_entry_id UUID,

    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES app_user(id),
    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, lc_no)
);

-- Landed Cost Lines (the costs to allocate)
CREATE TYPE lc_allocation_method AS ENUM ('ByValue', 'ByQuantity', 'ByWeight', 'ByVolume', 'Equal');

CREATE TABLE landed_cost_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landed_cost_id UUID NOT NULL REFERENCES landed_cost(id) ON DELETE CASCADE,

    cost_type VARCHAR(100) NOT NULL,  -- 'Freight', 'Customs', 'Insurance', 'Handling'
    vendor_id UUID REFERENCES vendor(id),  -- Who charged this cost
    bill_id UUID,  -- Link to vendor bill if exists

    amount DECIMAL(18,2) NOT NULL,

    account_id UUID REFERENCES account(id),  -- Expense account

    allocation_method lc_allocation_method DEFAULT 'ByValue',

    sort_order INT DEFAULT 0
);

-- Landed Cost Allocations (distribution to receipt lines)
CREATE TABLE landed_cost_allocation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landed_cost_id UUID NOT NULL REFERENCES landed_cost(id) ON DELETE CASCADE,
    cost_line_id UUID NOT NULL REFERENCES landed_cost_line(id),

    receipt_line_id UUID NOT NULL REFERENCES goods_receipt_line(id),

    allocated_amount DECIMAL(18,2) NOT NULL,

    -- Adjustment to inventory value
    original_cost DECIMAL(18,2),
    adjusted_cost DECIMAL(18,2)
);

-- Indexes
CREATE INDEX idx_vendor_company ON vendor(company_id, is_active);
CREATE INDEX idx_po_company_status ON purchase_order(company_id, status);
CREATE INDEX idx_po_vendor ON purchase_order(vendor_id);
CREATE INDEX idx_gr_po ON goods_receipt(po_id);
CREATE INDEX idx_gr_vendor ON goods_receipt(vendor_id);
CREATE INDEX idx_vendor_pricelist ON vendor_pricelist(vendor_id, product_id);
```

---

## Workflows

### 1. Standard Purchase Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STANDARD PURCHASE WORKFLOW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 1: Purchase Requisition (Optional)                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Department user creates request:                             │    │
│  │ - Products needed                                            │    │
│  │ - Quantities                                                 │    │
│  │ - Required date                                              │    │
│  │                                                              │    │
│  │ PR-2025-0001 → [Submit] → [Approve] ✓                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  STEP 2: Request for Quotation (Optional)                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Send RFQ to multiple vendors:                                │    │
│  │ - Vendor A: Rs 100/kg                                        │    │
│  │ - Vendor B: Rs 95/kg  ← Best price                           │    │
│  │ - Vendor C: Rs 105/kg                                        │    │
│  │                                                              │    │
│  │ Select best vendor → Create PO                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  STEP 3: Purchase Order                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ PO-2025-0001                                                 │    │
│  │ Vendor: Steel Suppliers Ltd                                  │    │
│  │                                                              │    │
│  │ Lines:                                                       │    │
│  │ - Steel Sheet 2mm: 100 kg × Rs 95 = Rs 9,500                │    │
│  │ - Steel Sheet 3mm: 50 kg × Rs 110 = Rs 5,500                │    │
│  │                                                              │    │
│  │ Subtotal: Rs 15,000                                          │    │
│  │ GST 17%: Rs 2,550                                            │    │
│  │ Total: Rs 17,550                                             │    │
│  │                                                              │    │
│  │ [Save Draft] → [Confirm] → Sent to vendor                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              │ Vendor delivers goods                 │
│                              ▼                                       │
│  STEP 4: Goods Receipt                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ GR-2025-0001                                                 │    │
│  │ PO: PO-2025-0001                                             │    │
│  │ Vendor Challan: DC-12345                                     │    │
│  │                                                              │    │
│  │ Lines:                                                       │    │
│  │ - Steel Sheet 2mm: Ordered 100 kg, Received 100 kg ✓         │    │
│  │ - Steel Sheet 3mm: Ordered 50 kg, Received 48 kg (Short 2kg) │    │
│  │                                                              │    │
│  │ [Post Receipt]                                               │    │
│  │                                                              │    │
│  │ ═══════════════════════════════════════════════════════════ │    │
│  │ Accounting Entry (Perpetual):                                │    │
│  │ Dr. Raw Materials (1310)     Rs 14,780                       │    │
│  │ Cr. GRNI (2121)                        Rs 14,780             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              │ Vendor sends invoice                  │
│                              ▼                                       │
│  STEP 5: Vendor Bill                                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ BILL-2025-0001                                               │    │
│  │ Vendor: Steel Suppliers Ltd                                  │    │
│  │ Vendor Invoice: INV-67890                                    │    │
│  │                                                              │    │
│  │ Lines: (Match with receipt)                                  │    │
│  │ - Steel Sheet 2mm: 100 kg × Rs 95 = Rs 9,500                │    │
│  │ - Steel Sheet 3mm: 48 kg × Rs 110 = Rs 5,280                │    │
│  │                                                              │    │
│  │ Subtotal: Rs 14,780                                          │    │
│  │ GST 17%: Rs 2,513                                            │    │
│  │ Total: Rs 17,293                                             │    │
│  │                                                              │    │
│  │ THREE-WAY MATCH:                                             │    │
│  │ ✓ PO Qty matches Receipt Qty                                 │    │
│  │ ✓ Receipt Qty matches Bill Qty                               │    │
│  │ ✓ PO Price matches Bill Price                                │    │
│  │                                                              │    │
│  │ [Post Bill]                                                  │    │
│  │                                                              │    │
│  │ ═══════════════════════════════════════════════════════════ │    │
│  │ Accounting Entry:                                            │    │
│  │ Dr. GRNI (2121)              Rs 14,780                       │    │
│  │ Dr. Input GST (1430)         Rs 2,513                        │    │
│  │ Cr. Accounts Payable (2111)            Rs 17,293             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  STEP 6: Vendor Payment                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ PAY-2025-0001                                                │    │
│  │ Vendor: Steel Suppliers Ltd                                  │    │
│  │ Amount: Rs 17,293                                            │    │
│  │                                                              │    │
│  │ [Post Payment]                                               │    │
│  │                                                              │    │
│  │ Accounting Entry:                                            │    │
│  │ Dr. Accounts Payable (2111)  Rs 17,293                       │    │
│  │ Cr. Bank (1121)                        Rs 17,293             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Landed Cost Allocation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LANDED COST WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SCENARIO: Import purchase with freight and customs                  │
│                                                                      │
│  Original Receipt:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ GR-2025-0010                                                 │    │
│  │ Product          │ Qty    │ Unit Cost │ Total Cost          │    │
│  │ ──────────────────┼────────┼───────────┼────────────         │    │
│  │ Bearing 6205      │ 1000   │ Rs 50     │ Rs 50,000           │    │
│  │ Bearing 6206      │ 500    │ Rs 70     │ Rs 35,000           │    │
│  │ ─────────────────────────────────────────────────────────   │    │
│  │ Total Receipt Value:                    Rs 85,000            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Additional Costs to Allocate:                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Cost Type       │ Amount    │ Allocation Method              │    │
│  │ ─────────────────┼───────────┼─────────────────────────────  │    │
│  │ Sea Freight      │ Rs 8,500  │ By Value                      │    │
│  │ Customs Duty     │ Rs 4,250  │ By Value (5% of value)        │    │
│  │ Clearing Charges │ Rs 3,000  │ Equal                         │    │
│  │ ─────────────────────────────────────────────────────────   │    │
│  │ Total Additional Costs:       Rs 15,750                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Allocation Calculation (By Value):                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Product      │ Original │ % Share │ Freight │ Customs │ New  │    │
│  │ ──────────────┼──────────┼─────────┼─────────┼─────────┼───── │    │
│  │ Bearing 6205  │ 50,000   │ 58.8%   │ 5,000   │ 2,500   │57,500│    │
│  │ Bearing 6206  │ 35,000   │ 41.2%   │ 3,500   │ 1,750   │40,250│    │
│  │ ─────────────────────────────────────────────────────────   │    │
│  │ Total         │ 85,000   │ 100%    │ 8,500   │ 4,250   │97,750│    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Equal Allocation (Clearing Rs 3,000 / 2 items):                    │
│  - Bearing 6205: +Rs 1,500 → Final: Rs 59,000 (Rs 59/pc)            │
│  - Bearing 6206: +Rs 1,500 → Final: Rs 41,750 (Rs 83.50/pc)         │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════════│
│  Accounting Entry (Landed Cost Posted):                              │
│  Dr. Raw Materials (1310)       Rs 15,750  (inventory value ↑)      │
│  Cr. GRNI/Clearing Account (2121)         Rs 15,750                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Quality Inspection Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    QUALITY INSPECTION WORKFLOW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Receipt with Inspection Required:                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ GR-2025-0015                                                 │    │
│  │ Product: Critical Raw Material                               │    │
│  │ Qty Received: 100 units                                      │    │
│  │ Inspection Required: ✓                                       │    │
│  │                                                              │    │
│  │ Status: PENDING INSPECTION                                   │    │
│  │ Stock Location: QC Hold Area                                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  Quality Inspection:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ QI-2025-0001                                                 │    │
│  │                                                              │    │
│  │ Inspection Criteria:                                         │    │
│  │ ☑ Visual inspection - No defects                            │    │
│  │ ☑ Dimensional check - Within tolerance                      │    │
│  │ ☐ Material certificate verified                              │    │
│  │                                                              │    │
│  │ Results:                                                     │    │
│  │ - Qty Inspected: 100 units                                   │    │
│  │ - Qty Passed: 95 units                                       │    │
│  │ - Qty Failed: 5 units (surface defects)                      │    │
│  │                                                              │    │
│  │ [Complete Inspection]                                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│              ┌───────────────┴───────────────┐                      │
│              ▼                               ▼                       │
│  ┌─────────────────────┐        ┌─────────────────────┐             │
│  │ PASSED (95 units)   │        │ FAILED (5 units)    │             │
│  │                     │        │                     │             │
│  │ Move to:            │        │ Options:            │             │
│  │ Main Warehouse      │        │ - Return to Vendor  │             │
│  │                     │        │ - Scrap             │             │
│  │ Available for use   │        │ - Rework            │             │
│  └─────────────────────┘        └─────────────────────┘             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Vendors

```
GET    /api/vendors                       - List vendors
       ?search=xxx
       ?vendorType=RawMaterial
       ?isActive=true

GET    /api/vendors/{id}                  - Get vendor details
POST   /api/vendors                       - Create vendor
PUT    /api/vendors/{id}                  - Update vendor
POST   /api/vendors/{id}/activate         - Activate vendor
POST   /api/vendors/{id}/deactivate       - Deactivate vendor

GET    /api/vendors/{id}/pricelists       - Get vendor price list
POST   /api/vendors/{id}/pricelists       - Add price list item
PUT    /api/vendor-pricelists/{id}        - Update price
DELETE /api/vendor-pricelists/{id}        - Remove price

GET    /api/vendors/{id}/purchase-history - Purchase history
GET    /api/vendors/{id}/open-orders      - Open POs
GET    /api/vendors/{id}/open-bills       - Unpaid bills
```

### Purchase Requisitions

```
GET    /api/purchase-requisitions         - List PRs
       ?status=Approved
       ?requestedBy=xxx

GET    /api/purchase-requisitions/{id}    - Get PR details
POST   /api/purchase-requisitions         - Create PR
PUT    /api/purchase-requisitions/{id}    - Update draft PR
POST   /api/purchase-requisitions/{id}/submit  - Submit for approval
POST   /api/purchase-requisitions/{id}/approve - Approve PR
POST   /api/purchase-requisitions/{id}/reject  - Reject PR
POST   /api/purchase-requisitions/{id}/create-po - Create PO from PR
```

### Request for Quotations

```
GET    /api/rfqs                          - List RFQs
GET    /api/rfqs/{id}                     - Get RFQ details
POST   /api/rfqs                          - Create RFQ
PUT    /api/rfqs/{id}                     - Update RFQ
POST   /api/rfqs/{id}/send                - Send to vendor
POST   /api/rfqs/{id}/receive-quote       - Record vendor quote
POST   /api/rfqs/{id}/create-po           - Create PO from RFQ
```

### Purchase Orders

```
GET    /api/purchase-orders               - List POs
       ?vendorId=xxx
       ?status=Confirmed
       ?from=2025-01-01&to=2025-01-31

GET    /api/purchase-orders/{id}          - Get PO details
POST   /api/purchase-orders               - Create PO
PUT    /api/purchase-orders/{id}          - Update draft PO
POST   /api/purchase-orders/{id}/confirm  - Confirm PO
POST   /api/purchase-orders/{id}/cancel   - Cancel PO
POST   /api/purchase-orders/{id}/close    - Close PO (no more receipts)

GET    /api/purchase-orders/{id}/receipts - Get receipts for PO
GET    /api/purchase-orders/{id}/bills    - Get bills for PO

POST   /api/purchase-orders/{id}/create-receipt - Create receipt from PO
```

### Goods Receipts

```
GET    /api/goods-receipts                - List receipts
       ?vendorId=xxx
       ?poId=xxx
       ?status=Posted

GET    /api/goods-receipts/{id}           - Get receipt details
POST   /api/goods-receipts                - Create receipt
PUT    /api/goods-receipts/{id}           - Update draft receipt
POST   /api/goods-receipts/{id}/post      - Post receipt (inventory ↑)
POST   /api/goods-receipts/{id}/cancel    - Cancel receipt

GET    /api/goods-receipts/{id}/inspections - Get inspections
POST   /api/goods-receipts/{id}/create-inspection - Create QC inspection
```

### Quality Inspections

```
GET    /api/quality-inspections           - List inspections
       ?result=Pending

GET    /api/quality-inspections/{id}      - Get inspection details
POST   /api/quality-inspections/{id}/complete - Complete inspection
```

### Vendor Returns

```
GET    /api/vendor-returns                - List returns
POST   /api/vendor-returns                - Create return
POST   /api/vendor-returns/{id}/confirm   - Confirm return
POST   /api/vendor-returns/{id}/ship      - Mark as shipped
POST   /api/vendor-returns/{id}/complete  - Complete (credit received)
```

### Landed Costs

```
GET    /api/landed-costs                  - List landed costs
GET    /api/landed-costs/{id}             - Get LC details
POST   /api/landed-costs                  - Create LC
PUT    /api/landed-costs/{id}             - Update draft LC
POST   /api/landed-costs/{id}/compute     - Calculate allocations
POST   /api/landed-costs/{id}/post        - Post LC (adjust inventory)
```

### Reports

```
GET    /api/reports/purchase-register     - Purchase register
       ?from=2025-01-01&to=2025-01-31
       ?vendorId=xxx

GET    /api/reports/vendor-aging          - Vendor aging report
       ?asOfDate=2025-01-31

GET    /api/reports/pending-receipts      - POs pending receipt

GET    /api/reports/grni-report           - GRNI aging report

GET    /api/reports/vendor-performance    - Vendor performance metrics
```

---

## UI Pages

### 1. Vendors List (`/purchasing/vendors`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Vendors                                              [+ New Vendor]  │
├─────────────────────────────────────────────────────────────────────┤
│ Search: [________________] Type: [All ▼] Status: [Active ▼]         │
├─────────────────────────────────────────────────────────────────────┤
│ Code   │ Name                  │ Type        │ Phone      │ Balance │
│ ───────┼───────────────────────┼─────────────┼────────────┼─────────│
│ V001   │ Steel Suppliers Ltd   │ Raw Material│ 021-111111 │ 125,000 │
│ V002   │ Bolt & Nut Trading    │ Raw Material│ 042-222222 │ 45,000  │
│ V003   │ Express Logistics     │ Services    │ 051-333333 │ 12,000  │
│ V004   │ Import House          │ Trading     │ 021-444444 │ 280,000 │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Purchase Order Form (`/purchasing/orders/new`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ New Purchase Order                            [Save Draft] [Confirm] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ PO No: [Auto-generated]           Date: [2025-02-13]                │
│ Vendor: [Steel Suppliers Ltd ▼]                                      │
│ Ship To: [Main Warehouse ▼]       Expected: [2025-02-20]            │
│                                                                      │
│ ┌─ Order Lines ─────────────────────────────────────────────────┐   │
│ │ Product        │ Description    │ Qty   │ UOM │ Price  │ Total │   │
│ ├────────────────┼────────────────┼───────┼─────┼────────┼───────┤   │
│ │ [Steel 2mm  ▼] │ [Steel Sheet  ]│ [100 ]│ Kg  │ [95   ]│ 9,500 │   │
│ │ [Steel 3mm  ▼] │ [Steel Sheet  ]│ [50  ]│ Kg  │ [110  ]│ 5,500 │   │
│ │ [+ Add Line]                                                   │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ Payment Terms: [Net 30 ▼]         Currency: [PKR ▼]                 │
│                                                                      │
│ ┌─ Summary ─────────────────────────────────────────────────────┐   │
│ │                              Subtotal:           Rs 15,000    │   │
│ │                              Discount (0%):      Rs 0         │   │
│ │                              GST (17%):          Rs 2,550     │   │
│ │                              ─────────────────────────────    │   │
│ │                              TOTAL:              Rs 17,550    │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ Notes: [________________________________________________________]   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Goods Receipt Form (`/purchasing/receipts/new`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Goods Receipt                                    [Save Draft] [Post] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Receipt No: [Auto]               Date: [2025-02-13]                 │
│ PO: [PO-2025-0001 ▼]             Vendor: Steel Suppliers Ltd        │
│                                                                      │
│ Vendor Challan No: [DC-12345____]  Date: [2025-02-13]               │
│ Location: [Main Warehouse ▼]                                         │
│                                                                      │
│ ┌─ Receipt Lines ───────────────────────────────────────────────┐   │
│ │ Product      │ Ordered │ Previously │ Receiving │ Unit Cost   │   │
│ │              │         │ Received   │           │             │   │
│ ├──────────────┼─────────┼────────────┼───────────┼─────────────┤   │
│ │ Steel 2mm    │ 100 Kg  │ 0          │ [100    ] │ Rs 95.00    │   │
│ │ Steel 3mm    │ 50 Kg   │ 0          │ [48     ] │ Rs 110.00   │   │
│ │                                       Short: 2 Kg              │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ☑ Inspection Required                                                │
│                                                                      │
│ Vehicle No: [ABC-1234____]  Transporter: [Fast Cargo_________]      │
│                                                                      │
│ Notes: [________________________________________________________]   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Landed Cost Form (`/purchasing/landed-costs/new`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Landed Cost Allocation                      [Save] [Compute] [Post]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ LC No: [Auto]                    Date: [2025-02-13]                 │
│                                                                      │
│ ┌─ Select Receipts to Adjust ───────────────────────────────────┐   │
│ │ ☑ GR-2025-0010 - Import Bearings (Rs 85,000)                  │   │
│ │ ☐ GR-2025-0011 - Local Steel (Rs 50,000)                      │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ┌─ Additional Costs ────────────────────────────────────────────┐   │
│ │ Type           │ Vendor         │ Amount   │ Allocation      │   │
│ ├────────────────┼────────────────┼──────────┼─────────────────┤   │
│ │ [Freight    ▼] │ [Express Log▼] │ [8,500 ] │ [By Value    ▼] │   │
│ │ [Customs    ▼] │ [Customs Agt▼] │ [4,250 ] │ [By Value    ▼] │   │
│ │ [Clearing   ▼] │ [Clearing Co▼] │ [3,000 ] │ [Equal       ▼] │   │
│ │ [+ Add Cost]                                                  │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ Total Additional Costs: Rs 15,750                                    │
│                                                                      │
│ ┌─ Allocation Preview (after Compute) ──────────────────────────┐   │
│ │ Product       │ Original Cost │ + Freight │ + Others │ Final  │   │
│ ├───────────────┼───────────────┼───────────┼──────────┼────────┤   │
│ │ Bearing 6205  │ Rs 50.00/pc   │ +Rs 5.00  │ +Rs 4.00 │ Rs 59  │   │
│ │ Bearing 6206  │ Rs 70.00/pc   │ +Rs 7.00  │ +Rs 6.50 │ Rs 83.5│   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Accounting Entries Summary

| Event | Debit | Credit |
|-------|-------|--------|
| **Goods Receipt** | Raw Materials (1310) | GRNI (2121) |
| **Bill Posted** | GRNI (2121) + Input GST (1430) | Accounts Payable (2111) |
| **Vendor Payment** | Accounts Payable (2111) | Bank (1121) |
| **Landed Cost** | Raw Materials (1310) | GRNI/Clearing (2121) |
| **Vendor Return** | Accounts Payable (2111) | Raw Materials (1310) |

---

## Integration Points

### With Inventory Module
- Goods receipts create stock movements
- Returns reduce stock
- Landed costs adjust valuation

### With Accounting Module
- Receipts create GRNI entries
- Bills clear GRNI, create payables
- Payments clear payables

### With Manufacturing Module
- PRs can be auto-generated from MRP
- Raw materials feed into production

### With Sales Module
- Purchase prices affect margin analysis
- Trading goods become sellable inventory

---

## Implementation Phases

### Phase 1: Foundation (2 weeks)
- Vendor master CRUD
- Vendor price lists
- Purchase Order CRUD
- PO workflow (Draft → Confirm)

### Phase 2: Receiving (2 weeks)
- Goods Receipt from PO
- Stock movements
- GRNI entries
- Partial receipts

### Phase 3: Bills & Payments (1-2 weeks)
- Vendor bills from receipt
- Three-way matching
- Bill posting
- Vendor payments

### Phase 4: Advanced (2 weeks)
- Purchase Requisitions
- RFQ workflow
- Landed costs
- Quality inspection
- Vendor returns

### Phase 5: Reports (1 week)
- Purchase register
- Vendor aging
- GRNI aging
- Vendor performance

---

## Business Rules

1. **PO Required**: Goods cannot be received without a confirmed PO (configurable)
2. **Over-Receipt Prevention**: Cannot receive more than ordered (configurable tolerance)
3. **Three-Way Match**: Bill amount must match PO × Receipt within tolerance
4. **GRNI Aging**: Alert if GRNI not cleared within X days
5. **Vendor Rating**: Auto-calculate based on delivery, quality, pricing
6. **Price Validation**: Alert if bill price differs from PO price
7. **Budget Control**: PR approval based on department budget (optional)
