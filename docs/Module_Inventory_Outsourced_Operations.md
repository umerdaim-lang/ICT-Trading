# Module: Inventory Management for Outsourced Operations

## Overview

This module manages the complete lifecycle of outsourced/subcontracted manufacturing operations where raw materials or semi-finished goods are sent to external vendors (subcontractors) for processing, and finished goods are received back.

### Key Business Scenarios

1. **Toll Manufacturing**: Send raw materials to subcontractor, receive processed/finished goods
2. **Job Work**: Send semi-finished goods for specific operations (coating, plating, machining)
3. **Assembly Outsourcing**: Send components to vendor for assembly into finished products
4. **Surface Treatment**: Send parts for painting, powder coating, chrome plating, etc.

---

## Core Concepts

### Subcontractor
An external vendor who performs manufacturing operations on materials provided by the company.

### Subcontracting Order (SCO)
A formal order placed with a subcontractor specifying:
- Materials to be sent
- Expected output products
- Processing charges
- Delivery timeline

### Bill of Materials for Subcontracting (BOM-SC)
Defines the input-output relationship:
- Input materials (sent to subcontractor)
- Output products (received from subcontractor)
- Expected yield/conversion ratio
- Processing cost per unit

### Subcontractor Location
A virtual warehouse location representing materials held at the subcontractor's premises.

---

## Database Schema

### Tables

```sql
-- Subcontractors (extends Customers with subcontractor flag)
CREATE TABLE subcontractor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    specialization TEXT,  -- e.g., "Chrome Plating, Powder Coating"
    lead_time_days INT DEFAULT 7,
    quality_rating DECIMAL(3,2),  -- 0.00 to 5.00
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- Subcontractor Location (virtual warehouse at subcontractor)
CREATE TABLE subcontractor_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    subcontractor_id UUID NOT NULL REFERENCES subcontractor(id),
    warehouse_id UUID NOT NULL REFERENCES warehouse(id),  -- Links to virtual warehouse
    location_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, subcontractor_id)
);

-- Bill of Materials for Subcontracting
CREATE TABLE bom_subcontracting (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    name VARCHAR(200) NOT NULL,
    subcontractor_id UUID REFERENCES subcontractor(id),  -- Optional: preferred subcontractor
    output_product_id UUID NOT NULL REFERENCES product(id),
    output_quantity DECIMAL(18,4) NOT NULL DEFAULT 1,
    output_uom_id UUID NOT NULL REFERENCES uom(id),
    processing_cost_per_unit DECIMAL(18,2) DEFAULT 0,
    expected_yield_percent DECIMAL(5,2) DEFAULT 100.00,  -- Expected yield percentage
    lead_time_days INT DEFAULT 7,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- BOM Subcontracting Input Lines (materials to send)
CREATE TABLE bom_subcontracting_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID NOT NULL REFERENCES bom_subcontracting(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES product(id),
    quantity DECIMAL(18,4) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uom(id),
    is_consumed BOOLEAN DEFAULT true,  -- false = returnable (e.g., packaging)
    sort_order INT DEFAULT 0
);

-- Subcontracting Order
CREATE TYPE sco_status AS ENUM ('Draft', 'Confirmed', 'InProgress', 'PartiallyReceived', 'Completed', 'Cancelled');

CREATE TABLE subcontracting_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    sco_no VARCHAR(50) NOT NULL,
    subcontractor_id UUID NOT NULL REFERENCES subcontractor(id),
    bom_id UUID REFERENCES bom_subcontracting(id),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE NOT NULL,

    -- Output expectations
    output_product_id UUID NOT NULL REFERENCES product(id),
    ordered_quantity DECIMAL(18,4) NOT NULL,
    output_uom_id UUID NOT NULL REFERENCES uom(id),
    received_quantity DECIMAL(18,4) DEFAULT 0,

    -- Costs
    processing_rate DECIMAL(18,2) NOT NULL,  -- Per unit processing charge
    total_processing_cost DECIMAL(18,2) GENERATED ALWAYS AS (ordered_quantity * processing_rate) STORED,

    status sco_status DEFAULT 'Draft',
    notes TEXT,

    -- Audit
    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, sco_no)
);

-- SCO Input Lines (materials to be sent)
CREATE TABLE sco_input_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sco_id UUID NOT NULL REFERENCES subcontracting_order(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES product(id),
    required_quantity DECIMAL(18,4) NOT NULL,
    sent_quantity DECIMAL(18,4) DEFAULT 0,
    returned_quantity DECIMAL(18,4) DEFAULT 0,  -- Unused materials returned
    uom_id UUID NOT NULL REFERENCES uom(id),
    unit_cost DECIMAL(18,4),  -- Cost of material at time of sending
    sort_order INT DEFAULT 0
);

-- Material Transfer to Subcontractor
CREATE TYPE material_transfer_status AS ENUM ('Draft', 'Confirmed', 'Delivered', 'Cancelled');

CREATE TABLE material_transfer_out (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    transfer_no VARCHAR(50) NOT NULL,
    sco_id UUID NOT NULL REFERENCES subcontracting_order(id),
    subcontractor_id UUID NOT NULL REFERENCES subcontractor(id),
    from_warehouse_id UUID NOT NULL REFERENCES warehouse(id),
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE,
    vehicle_no VARCHAR(50),
    driver_name VARCHAR(100),
    status material_transfer_status DEFAULT 'Draft',
    notes TEXT,
    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, transfer_no)
);

-- Material Transfer Out Lines
CREATE TABLE material_transfer_out_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES material_transfer_out(id) ON DELETE CASCADE,
    sco_input_line_id UUID REFERENCES sco_input_line(id),
    product_id UUID NOT NULL REFERENCES product(id),
    quantity DECIMAL(18,4) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uom(id),
    unit_cost DECIMAL(18,4),  -- FIFO/AVCO cost at transfer time
    batch_no VARCHAR(100),
    sort_order INT DEFAULT 0
);

-- Subcontractor Receipt (receiving finished goods back)
CREATE TYPE sc_receipt_status AS ENUM ('Draft', 'Confirmed', 'Cancelled');

CREATE TABLE subcontractor_receipt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    receipt_no VARCHAR(50) NOT NULL,
    sco_id UUID NOT NULL REFERENCES subcontracting_order(id),
    subcontractor_id UUID NOT NULL REFERENCES subcontractor(id),
    to_warehouse_id UUID NOT NULL REFERENCES warehouse(id),
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Subcontractor's reference
    subcontractor_challan_no VARCHAR(100),
    subcontractor_challan_date DATE,

    status sc_receipt_status DEFAULT 'Draft',
    notes TEXT,

    -- Quality inspection
    inspection_required BOOLEAN DEFAULT false,
    inspection_status VARCHAR(50),  -- Pending, Passed, Failed, PartialPass

    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, receipt_no)
);

-- Subcontractor Receipt Lines
CREATE TABLE subcontractor_receipt_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES subcontractor_receipt(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES product(id),
    quantity DECIMAL(18,4) NOT NULL,
    accepted_quantity DECIMAL(18,4),  -- After inspection
    rejected_quantity DECIMAL(18,4) DEFAULT 0,
    uom_id UUID NOT NULL REFERENCES uom(id),

    -- Cost calculation
    material_cost DECIMAL(18,4),  -- Sum of input material costs
    processing_cost DECIMAL(18,4),  -- Processing charge for this quantity
    total_cost DECIMAL(18,4),  -- material_cost + processing_cost

    batch_no VARCHAR(100),
    rejection_reason TEXT,
    sort_order INT DEFAULT 0
);

-- Unused Material Return (materials returned from subcontractor)
CREATE TABLE material_return (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    return_no VARCHAR(50) NOT NULL,
    sco_id UUID NOT NULL REFERENCES subcontracting_order(id),
    subcontractor_id UUID NOT NULL REFERENCES subcontractor(id),
    to_warehouse_id UUID NOT NULL REFERENCES warehouse(id),
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subcontractor_challan_no VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Draft',
    notes TEXT,
    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, return_no)
);

-- Material Return Lines
CREATE TABLE material_return_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES material_return(id) ON DELETE CASCADE,
    sco_input_line_id UUID REFERENCES sco_input_line(id),
    product_id UUID NOT NULL REFERENCES product(id),
    quantity DECIMAL(18,4) NOT NULL,
    uom_id UUID NOT NULL REFERENCES uom(id),
    unit_cost DECIMAL(18,4),  -- Original cost when sent
    condition VARCHAR(50),  -- Good, Damaged, Scrap
    sort_order INT DEFAULT 0
);

-- Subcontractor Invoice (for processing charges)
CREATE TABLE subcontractor_invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    invoice_no VARCHAR(50) NOT NULL,
    subcontractor_id UUID NOT NULL REFERENCES subcontractor(id),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,

    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(18,2) DEFAULT 0,
    total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,

    status VARCHAR(20) DEFAULT 'Draft',  -- Draft, Posted, Paid, Cancelled
    payment_status VARCHAR(20) DEFAULT 'Unpaid',  -- Unpaid, PartiallyPaid, Paid

    notes TEXT,
    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, invoice_no)
);

-- Subcontractor Invoice Lines
CREATE TABLE subcontractor_invoice_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES subcontractor_invoice(id) ON DELETE CASCADE,
    receipt_id UUID REFERENCES subcontractor_receipt(id),  -- Links to which receipt
    sco_id UUID REFERENCES subcontracting_order(id),
    description TEXT NOT NULL,
    quantity DECIMAL(18,4) NOT NULL,
    rate DECIMAL(18,2) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    sort_order INT DEFAULT 0
);

-- Indexes
CREATE INDEX idx_sco_company_status ON subcontracting_order(company_id, status);
CREATE INDEX idx_sco_subcontractor ON subcontracting_order(subcontractor_id);
CREATE INDEX idx_mto_sco ON material_transfer_out(sco_id);
CREATE INDEX idx_sc_receipt_sco ON subcontractor_receipt(sco_id);
CREATE INDEX idx_bom_sc_output ON bom_subcontracting(output_product_id);
```

---

## Workflows

### 1. Master Data Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    MASTER DATA SETUP                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Create Subcontractors                                    │
│     ├── Name, Contact Details                                │
│     ├── Specialization (e.g., "Chrome Plating")              │
│     └── Lead Time, Quality Rating                            │
│                                                              │
│  2. Create Virtual Warehouses for Subcontractors             │
│     ├── "SC-ABC Plating" (Subcontractor Location)            │
│     └── Link to Subcontractor                                │
│                                                              │
│  3. Create BOM for Subcontracting                            │
│     ├── Output Product: "Chrome Plated Bolt M10"             │
│     ├── Input Materials:                                     │
│     │   └── "Steel Bolt M10" - 1.05 pcs (5% allowance)       │
│     ├── Processing Cost: Rs 15/piece                         │
│     └── Expected Yield: 95%                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Complete Subcontracting Cycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SUBCONTRACTING WORKFLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 1: Create Subcontracting Order (SCO)                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ SCO-2025-0001                                                │    │
│  │ Subcontractor: ABC Chrome Plating                            │    │
│  │ Output: Chrome Plated Bolt M10 × 1000 pcs                    │    │
│  │ Processing Rate: Rs 15/pc = Rs 15,000                        │    │
│  │ Expected Date: 2025-02-20                                    │    │
│  │                                                              │    │
│  │ Input Materials Required:                                    │    │
│  │ - Steel Bolt M10: 1050 pcs (5% allowance for rejection)      │    │
│  │ - Packaging Material: 10 boxes (returnable)                  │    │
│  │                                                              │    │
│  │ Status: Draft → [Confirm] → Confirmed                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  STEP 2: Transfer Materials to Subcontractor                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ MTO-2025-0001 (Material Transfer Out)                        │    │
│  │ SCO: SCO-2025-0001                                           │    │
│  │ From: Main Warehouse → To: SC-ABC Location                   │    │
│  │                                                              │    │
│  │ Items:                                                       │    │
│  │ - Steel Bolt M10: 1050 pcs @ Rs 8.50 = Rs 8,925             │    │
│  │ - Boxes: 10 pcs (returnable)                                 │    │
│  │                                                              │    │
│  │ Vehicle: ABC-1234, Driver: Ali                               │    │
│  │                                                              │    │
│  │ [Print Gate Pass] [Confirm Transfer]                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              │ Stock Movement:                       │
│                              │ Main Warehouse: -1050 Steel Bolts     │
│                              │ SC-ABC Location: +1050 Steel Bolts    │
│                              │ (Materials at subcontractor)          │
│                              ▼                                       │
│  STEP 3: Receive Finished Goods                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ SCR-2025-0001 (Subcontractor Receipt)                        │    │
│  │ SCO: SCO-2025-0001                                           │    │
│  │ To: Main Warehouse                                           │    │
│  │ Subcontractor Challan: DC-5678                               │    │
│  │                                                              │    │
│  │ Received:                                                    │    │
│  │ - Chrome Plated Bolt M10: 980 pcs                            │    │
│  │   Material Cost: Rs 8.50 × 1000 = Rs 8,500                   │    │
│  │   Processing Cost: Rs 15 × 980 = Rs 14,700                   │    │
│  │   Total Unit Cost: Rs 23.67                                  │    │
│  │                                                              │    │
│  │ Quality Inspection: [Required]                               │    │
│  │ - Accepted: 970 pcs                                          │    │
│  │ - Rejected: 10 pcs (surface defects)                         │    │
│  │                                                              │    │
│  │ [Confirm Receipt]                                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              │ Stock Movement:                       │
│                              │ SC-ABC Location: -1000 Steel Bolts    │
│                              │ Main Warehouse: +970 Chrome Bolts     │
│                              │ (Consumed materials, new product)     │
│                              ▼                                       │
│  STEP 4: Material Return (unused materials)                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ MR-2025-0001 (Material Return)                               │    │
│  │ SCO: SCO-2025-0001                                           │    │
│  │                                                              │    │
│  │ Returned:                                                    │    │
│  │ - Steel Bolt M10: 30 pcs (unused) @ Rs 8.50                  │    │
│  │ - Boxes: 10 pcs (returnable packaging)                       │    │
│  │                                                              │    │
│  │ [Confirm Return]                                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              │ Stock Movement:                       │
│                              │ SC-ABC Location: -30 Steel Bolts      │
│                              │ Main Warehouse: +30 Steel Bolts       │
│                              ▼                                       │
│  STEP 5: Process Subcontractor Invoice                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ SCI-2025-0001 (Subcontractor Invoice)                        │    │
│  │ Subcontractor: ABC Chrome Plating                            │    │
│  │                                                              │    │
│  │ Lines:                                                       │    │
│  │ - Chrome Plating Service (SCO-0001): 980 × Rs 15 = Rs 14,700│    │
│  │                                                              │    │
│  │ Subtotal: Rs 14,700                                          │    │
│  │ GST (17%): Rs 2,499                                          │    │
│  │ Total: Rs 17,199                                             │    │
│  │                                                              │    │
│  │ [Post Invoice] → Creates Payable                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Cost Calculation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COST CALCULATION                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Input Materials Sent:                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Steel Bolt M10: 1050 pcs × Rs 8.50 = Rs 8,925               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Materials Consumed (for 980 output):                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Theoretical: 980 × 1.00 = 980 pcs                           │    │
│  │ With 5% allowance: 980 × 1.05 = 1029 pcs                    │    │
│  │ Actual consumed: 1050 - 30 returned = 1020 pcs              │    │
│  │                                                              │    │
│  │ Material Cost: 1020 × Rs 8.50 = Rs 8,670                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Processing Cost:                                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Accepted quantity: 970 pcs                                   │    │
│  │ Processing Rate: Rs 15/pc                                    │    │
│  │ Total Processing: 970 × Rs 15 = Rs 14,550                   │    │
│  │                                                              │    │
│  │ Note: Rejected 10 pcs - processing may/may not be charged   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Final Product Cost:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Chrome Plated Bolt M10 (970 accepted pcs)                    │    │
│  │                                                              │    │
│  │ Material Cost:    Rs 8,670                                   │    │
│  │ Processing Cost:  Rs 14,550                                  │    │
│  │ ─────────────────────────────                                │    │
│  │ Total Cost:       Rs 23,220                                  │    │
│  │                                                              │    │
│  │ Unit Cost: Rs 23,220 / 970 = Rs 23.94 per piece             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Accounting Entries

### 1. Material Transfer to Subcontractor

```
When materials are sent to subcontractor (MTO Confirmed):

Dr. Stock at Subcontractor (Asset)     Rs 8,925
    Cr. Raw Material Stock (Asset)         Rs 8,925

(Movement between warehouse locations - no P&L impact)
```

### 2. Receipt of Finished Goods

```
When finished goods received (SCR Confirmed):

Dr. Finished Goods Stock (Asset)       Rs 23,220
    Cr. Stock at Subcontractor (Asset)     Rs 8,670  (materials consumed)
    Cr. Goods Received Not Invoiced        Rs 14,550 (processing cost accrual)

Note: The GRNI account holds the processing cost until subcontractor invoice is received
```

### 3. Material Return (Unused)

```
When unused materials returned:

Dr. Raw Material Stock (Asset)         Rs 255
    Cr. Stock at Subcontractor (Asset)     Rs 255

(30 pcs × Rs 8.50 = Rs 255 returned to main warehouse)
```

### 4. Subcontractor Invoice Posted

```
When subcontractor invoice is posted:

Dr. Goods Received Not Invoiced        Rs 14,550
Dr. Input GST (Asset)                  Rs 2,474
    Cr. Accounts Payable                   Rs 17,024

(Clears GRNI and creates payable to subcontractor)
```

### 5. Rejection/Scrap Entry

```
For rejected items (10 pcs):

Option A - If subcontractor bears the cost:
(No entry - reduce processing invoice accordingly)

Option B - If company bears the cost:
Dr. Scrap/Rejection Loss (Expense)     Rs 85
    Cr. Stock at Subcontractor (Asset)     Rs 85

(10 pcs × Rs 8.50 material cost written off)
```

---

## API Endpoints

### Subcontractors

```
GET    /api/subcontractors                    - List all subcontractors
GET    /api/subcontractors/{id}               - Get subcontractor details
POST   /api/subcontractors                    - Create subcontractor
PUT    /api/subcontractors/{id}               - Update subcontractor
DELETE /api/subcontractors/{id}               - Deactivate subcontractor

GET    /api/subcontractors/{id}/orders        - Get SCOs for subcontractor
GET    /api/subcontractors/{id}/pending-items - Get pending items at subcontractor
```

### BOM for Subcontracting

```
GET    /api/bom-subcontracting                - List all BOMs
GET    /api/bom-subcontracting/{id}           - Get BOM details with lines
POST   /api/bom-subcontracting                - Create BOM
PUT    /api/bom-subcontracting/{id}           - Update BOM
POST   /api/bom-subcontracting/{id}/copy      - Copy BOM

GET    /api/bom-subcontracting/by-product/{productId} - Get BOMs for output product
```

### Subcontracting Orders

```
GET    /api/subcontracting-orders             - List SCOs with filters
       ?status=InProgress
       ?subcontractorId=xxx
       ?from=2025-01-01&to=2025-01-31

GET    /api/subcontracting-orders/{id}        - Get SCO details
POST   /api/subcontracting-orders             - Create SCO
PUT    /api/subcontracting-orders/{id}        - Update draft SCO
POST   /api/subcontracting-orders/{id}/confirm - Confirm SCO
POST   /api/subcontracting-orders/{id}/cancel  - Cancel SCO

GET    /api/subcontracting-orders/{id}/transfers  - Get material transfers for SCO
GET    /api/subcontracting-orders/{id}/receipts   - Get receipts for SCO
```

### Material Transfers

```
GET    /api/material-transfers-out            - List transfers
GET    /api/material-transfers-out/{id}       - Get transfer details
POST   /api/material-transfers-out            - Create transfer (from SCO)
PUT    /api/material-transfers-out/{id}       - Update draft transfer
POST   /api/material-transfers-out/{id}/confirm - Confirm transfer (moves stock)
POST   /api/material-transfers-out/{id}/print-gate-pass - Generate gate pass PDF
```

### Subcontractor Receipts

```
GET    /api/subcontractor-receipts            - List receipts
GET    /api/subcontractor-receipts/{id}       - Get receipt details
POST   /api/subcontractor-receipts            - Create receipt (from SCO)
PUT    /api/subcontractor-receipts/{id}       - Update draft receipt
POST   /api/subcontractor-receipts/{id}/confirm - Confirm receipt (receives stock)
POST   /api/subcontractor-receipts/{id}/inspect - Record inspection results
```

### Material Returns

```
GET    /api/material-returns                  - List returns
POST   /api/material-returns                  - Create return
POST   /api/material-returns/{id}/confirm     - Confirm return (moves stock back)
```

### Subcontractor Invoices

```
GET    /api/subcontractor-invoices            - List invoices
GET    /api/subcontractor-invoices/{id}       - Get invoice details
POST   /api/subcontractor-invoices            - Create invoice (from receipts)
POST   /api/subcontractor-invoices/{id}/post  - Post invoice (creates payable)
```

### Reports

```
GET    /api/reports/stock-at-subcontractors   - Materials at each subcontractor
GET    /api/reports/sco-status                - SCO status summary
GET    /api/reports/subcontractor-performance - Lead time, quality metrics
GET    /api/reports/processing-cost-analysis  - Cost analysis by product/subcontractor
```

---

## UI Pages

### 1. Subcontractors List (`/subcontractors`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Subcontractors                                    [+ New Subcontractor]│
├─────────────────────────────────────────────────────────────────────┤
│ Search: [________________] Specialization: [All ▼] Status: [Active ▼]│
├─────────────────────────────────────────────────────────────────────┤
│ Name              │ Specialization    │ Contact     │ Rating │ Active│
├───────────────────┼───────────────────┼─────────────┼────────┼───────┤
│ ABC Chrome Plating│ Chrome, Zinc      │ 0300-1234567│ ★★★★☆ │   ✓   │
│ XYZ Powder Coating│ Powder Coating    │ 0321-9876543│ ★★★★★ │   ✓   │
│ Metal Works Ltd   │ Machining, Welding│ 0333-5555555│ ★★★☆☆ │   ✓   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. BOM Subcontracting Form (`/bom-subcontracting/new`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Bill of Materials - Subcontracting                    [Save] [Cancel]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ BOM Name: [Chrome Plating - Bolt M10_________________]               │
│                                                                      │
│ ┌─ Output Product ──────────────────────────────────────────────┐   │
│ │ Product:  [Chrome Plated Bolt M10 ▼]                          │   │
│ │ Quantity: [1________] UOM: [Piece ▼]                          │   │
│ │ Processing Cost/Unit: [Rs 15.00____]                          │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ┌─ Input Materials ─────────────────────────────────────────────┐   │
│ │ Product              │ Quantity │ UOM   │ Consumed │ [+ Add]  │   │
│ ├──────────────────────┼──────────┼───────┼──────────┼──────────┤   │
│ │ Steel Bolt M10       │ 1.05     │ Piece │    ✓     │   [×]    │   │
│ │ Zinc Compound        │ 0.02     │ Kg    │    ✓     │   [×]    │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ Preferred Subcontractor: [ABC Chrome Plating ▼]                      │
│ Expected Yield: [95____]%    Lead Time: [7____] days                 │
│                                                                      │
│ Notes: [________________________________________________________]   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Subcontracting Order Form (`/subcontracting-orders/new`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Subcontracting Order                         [Save Draft] [Confirm]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ SCO No: [Auto-generated]        Order Date: [2025-02-13]            │
│ Subcontractor: [ABC Chrome Plating ▼]                                │
│ BOM: [Chrome Plating - Bolt M10 ▼]  [Auto-fill from BOM]            │
│                                                                      │
│ ┌─ Output ──────────────────────────────────────────────────────┐   │
│ │ Product: Chrome Plated Bolt M10                               │   │
│ │ Quantity: [1000_____] Piece                                   │   │
│ │ Processing Rate: [Rs 15.00___] /piece                         │   │
│ │ Total Processing Cost: Rs 15,000.00                           │   │
│ │ Expected Date: [2025-02-20]                                   │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ┌─ Required Materials (auto-calculated from BOM) ───────────────┐   │
│ │ Product              │ Required │ Available │ Shortage │ Sent │   │
│ ├──────────────────────┼──────────┼───────────┼──────────┼──────┤   │
│ │ Steel Bolt M10       │ 1,050    │ 5,000     │ -        │ 0    │   │
│ │ Zinc Compound        │ 20 Kg    │ 50 Kg     │ -        │ 0    │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ Notes: [________________________________________________________]   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Subcontracting Order Detail (`/subcontracting-orders/{id}`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ SCO-2025-0001                                        Status: InProgress│
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Subcontractor: ABC Chrome Plating                                    │
│ Order Date: 2025-02-13          Expected: 2025-02-20                 │
│                                                                      │
│ ┌─ Output Progress ─────────────────────────────────────────────┐   │
│ │ Chrome Plated Bolt M10                                        │   │
│ │ Ordered: 1000 pcs    Received: 500 pcs    Remaining: 500 pcs  │   │
│ │ ████████████░░░░░░░░░░░░░ 50%                                 │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ┌─ Material Status ─────────────────────────────────────────────┐   │
│ │ Product         │ Required │ Sent  │ At SC │ Consumed│Returned│   │
│ ├─────────────────┼──────────┼───────┼───────┼─────────┼────────┤   │
│ │ Steel Bolt M10  │ 1,050    │ 1,050 │ 525   │ 525     │ 0      │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ─────────────────── Actions ───────────────────                      │
│ [+ Transfer Materials]  [+ Receive Goods]  [+ Record Return]         │
│                                                                      │
│ ─────────────────── Timeline ──────────────────                      │
│ │                                                                    │
│ ├─ 2025-02-13 09:00  SCO Created                                    │
│ ├─ 2025-02-13 10:30  SCO Confirmed                                  │
│ ├─ 2025-02-13 14:00  MTO-0001: Sent 1050 Steel Bolts                │
│ ├─ 2025-02-15 16:00  SCR-0001: Received 500 Chrome Bolts            │
│ └─ ...                                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Material Transfer Form (`/material-transfers-out/new`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Material Transfer to Subcontractor              [Save] [Confirm]     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Transfer No: [Auto]              Date: [2025-02-13]                  │
│ SCO: [SCO-2025-0001 ▼]                                               │
│ Subcontractor: ABC Chrome Plating (auto-filled)                      │
│                                                                      │
│ From Warehouse: [Main Warehouse ▼]                                   │
│                                                                      │
│ ┌─ Items to Transfer ───────────────────────────────────────────┐   │
│ │ Product         │ Required │ Available│ Transfer │ Unit Cost │    │
│ ├─────────────────┼──────────┼──────────┼──────────┼───────────┤    │
│ │ Steel Bolt M10  │ 1,050    │ 5,000    │ [1050__] │ Rs 8.50   │    │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ Vehicle No: [ABC-1234____]    Driver: [Ali Hassan________]           │
│                                                                      │
│ Notes: [For SCO-2025-0001, Chrome plating job___________________]   │
│                                                                      │
│ ─────────────────────────────────────────────────────────────────   │
│ [Print Gate Pass PDF]                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6. Subcontractor Receipt Form (`/subcontractor-receipts/new`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Receive from Subcontractor                      [Save] [Confirm]     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Receipt No: [Auto]               Date: [2025-02-15]                  │
│ SCO: [SCO-2025-0001 ▼]                                               │
│ Subcontractor: ABC Chrome Plating                                    │
│                                                                      │
│ Subcontractor Challan No: [DC-5678_____]  Date: [2025-02-15]        │
│ To Warehouse: [Main Warehouse ▼]                                     │
│                                                                      │
│ ┌─ Items Received ──────────────────────────────────────────────┐   │
│ │ Product              │ Expected │ Received │ Accepted│Rejected│   │
│ ├──────────────────────┼──────────┼──────────┼─────────┼────────┤   │
│ │ Chrome Plated Bolt   │ 1000     │ [980___] │ [970__] │ [10__] │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ☐ Requires Quality Inspection                                        │
│                                                                      │
│ ┌─ Cost Calculation ────────────────────────────────────────────┐   │
│ │ Material Cost (1000 × Rs 8.50):      Rs 8,500.00              │   │
│ │ Processing Cost (970 × Rs 15):       Rs 14,550.00             │   │
│ │ ────────────────────────────────────────────                  │   │
│ │ Total Cost:                          Rs 23,050.00             │   │
│ │ Unit Cost (970 pcs):                 Rs 23.76                 │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ Rejection Reason: [Surface defects - 10 pcs__________________]       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7. Stock at Subcontractors Report (`/reports/stock-at-subcontractors`)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Stock at Subcontractors                              [Export Excel]  │
├─────────────────────────────────────────────────────────────────────┤
│ As of: 2025-02-13                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌─ ABC Chrome Plating ──────────────────────────────────────────┐   │
│ │ Product              │ Quantity │ Value     │ Since      │ SCO │   │
│ ├──────────────────────┼──────────┼───────────┼────────────┼─────┤   │
│ │ Steel Bolt M10       │ 525 pcs  │ Rs 4,462  │ 2025-02-13 │ 0001│   │
│ │ Steel Bolt M8        │ 200 pcs  │ Rs 1,400  │ 2025-02-10 │ 0002│   │
│ └──────────────────────┴──────────┴───────────┴────────────┴─────┘   │
│                                     Subtotal: Rs 5,862               │
│                                                                      │
│ ┌─ XYZ Powder Coating ──────────────────────────────────────────┐   │
│ │ Product              │ Quantity │ Value     │ Since      │ SCO │   │
│ ├──────────────────────┼──────────┼───────────┼────────────┼─────┤   │
│ │ Sheet Metal Panel    │ 50 pcs   │ Rs 25,000 │ 2025-02-11 │ 0003│   │
│ └──────────────────────┴──────────┴───────────┴────────────┴─────┘   │
│                                     Subtotal: Rs 25,000              │
│                                                                      │
│ ═══════════════════════════════════════════════════════════════════ │
│                              TOTAL STOCK AT SUBCONTRACTORS: Rs 30,862│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (2-3 weeks)

1. **Database Setup**
   - Create all tables with proper constraints
   - Set up enum types
   - Create indexes

2. **Subcontractor Management**
   - CRUD for subcontractors
   - Subcontractor location (virtual warehouse) setup
   - API endpoints

3. **BOM Subcontracting**
   - CRUD for BOM with input lines
   - Copy BOM functionality
   - UI forms

### Phase 2: Order & Transfer (2-3 weeks)

1. **Subcontracting Orders**
   - Create SCO from BOM
   - Auto-calculate material requirements
   - SCO workflow (Draft → Confirm → Complete)

2. **Material Transfer Out**
   - Create transfer from SCO
   - Stock movement logic
   - Gate pass PDF generation

3. **Integration**
   - Link SCO with material transfers
   - Update SCO status based on transfers

### Phase 3: Receipt & Returns (2-3 weeks)

1. **Subcontractor Receipt**
   - Create receipt from SCO
   - Cost calculation (material + processing)
   - Quality inspection workflow
   - Stock movement (consume materials, receive finished goods)

2. **Material Returns**
   - Return unused materials
   - Stock movement back to main warehouse
   - Link with SCO for tracking

3. **SCO Completion**
   - Auto-complete SCO when fully received
   - Handle partial receipts

### Phase 4: Financial Integration (1-2 weeks)

1. **Subcontractor Invoice**
   - Create invoice from receipts
   - Link with accounting (Accounts Payable)
   - Tax handling (Input GST)

2. **Cost Analysis**
   - Processing cost per product
   - Subcontractor-wise analysis
   - Rejection/yield analysis

### Phase 5: Reports & Analytics (1 week)

1. **Operational Reports**
   - Stock at subcontractors
   - SCO status/aging
   - Material movement history

2. **Performance Reports**
   - Subcontractor performance (lead time, quality)
   - Processing cost trends
   - Yield analysis

---

## Business Rules & Validations

### Subcontracting Order
- Cannot confirm SCO if insufficient stock in source warehouse
- Expected date must be >= order date
- Processing rate must be > 0
- Cannot cancel if materials already transferred

### Material Transfer
- Cannot transfer more than required by SCO
- Cannot transfer if stock not available
- Must have confirmed SCO before creating transfer
- Vehicle/driver info required for confirmation

### Subcontractor Receipt
- Cannot receive more than ordered quantity
- Accepted + Rejected = Received quantity
- Cannot confirm if SCO is cancelled
- Material cost calculated from FIFO/AVCO at transfer time

### Material Return
- Cannot return more than stock at subcontractor location
- Only materials from the linked SCO can be returned
- Returns update SCO input line tracking

### Cost Calculation
- Unit cost = (Total Material Cost + Total Processing Cost) / Accepted Quantity
- Material cost uses the cost at time of transfer (FIFO/AVCO)
- Processing cost based on accepted quantity only

---

## Integration Points

### With Inventory Module
- Uses warehouse locations for stock tracking
- Uses FIFO/AVCO for material costing
- Creates stock movements on transfer/receipt

### With Accounting Module
- Creates journal entries for stock movements
- Creates payables for subcontractor invoices
- Tracks GRNI (Goods Received Not Invoiced)

### With Purchase Module
- Subcontractor invoices create purchase payables
- Links with vendor payment system

### With Production Module
- Can trigger SCO from production planning
- Output products feed into production pipeline

---

## Future Enhancements

1. **Quality Management Integration**
   - Formal inspection checklists
   - Quality rejection tracking
   - Supplier quality scores

2. **Multi-level Subcontracting**
   - Subcontractor sends to another subcontractor
   - Track materials through multiple locations

3. **Mobile App for Gate Pass**
   - Security guard app for verifying transfers
   - Barcode/QR scanning

4. **Automatic Reorder**
   - Auto-create SCO based on production demand
   - MRP integration

5. **Subcontractor Portal**
   - Subcontractors view their orders online
   - Submit delivery notifications
   - Upload quality reports
