# Phase 3: Module Integration & Refinements

> Execution reference for safe delivery: `docs/Phase_3_4_Module_Blueprint_No_Override.md`

## Overview

This document addresses integration gaps, unifications, and missing workflows identified during the review of the 4 core modules:
- Module_Accounting.md
- Module_Purchasing.md
- Module_Inventory_Outsourced_Operations.md
- Module_Inventory_Stock.md

---

## 1. Unified Vendor/Subcontractor Schema

### Problem
Purchasing module has `vendor` table while Outsourced Operations has separate `subcontractor` table. This creates:
- Data duplication
- Separate payment workflows
- Inconsistent reporting

### Solution: Unified Vendor Table

```sql
-- Drop separate subcontractor table, use unified vendor
-- Add category and capabilities to existing vendor table

CREATE TYPE vendor_category AS ENUM (
    'Supplier',           -- Raw material suppliers
    'Subcontractor',      -- Processing/job work vendors
    'ServiceProvider',    -- Freight, utilities, professional services
    'Both'                -- Can supply materials AND do processing
);

-- Extend vendor table (from Purchasing module)
ALTER TABLE vendor ADD COLUMN IF NOT EXISTS vendor_category vendor_category DEFAULT 'Supplier';
ALTER TABLE vendor ADD COLUMN IF NOT EXISTS specializations TEXT[];  -- e.g., ['Chrome Plating', 'Powder Coating']
ALTER TABLE vendor ADD COLUMN IF NOT EXISTS quality_rating DECIMAL(3,2);  -- 0.00 to 5.00
ALTER TABLE vendor ADD COLUMN IF NOT EXISTS default_lead_time_days INT DEFAULT 7;
ALTER TABLE vendor ADD COLUMN IF NOT EXISTS can_hold_stock BOOLEAN DEFAULT false;  -- For subcontractors

-- Vendor capabilities (for subcontractors)
CREATE TABLE vendor_capability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
    capability_name VARCHAR(100) NOT NULL,  -- 'Chrome Plating', 'CNC Machining'
    capacity_per_day DECIMAL(18,2),
    min_order_qty DECIMAL(18,4),
    processing_rate DECIMAL(18,4),  -- Default rate per unit
    lead_time_days INT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(vendor_id, capability_name)
);

-- Virtual location for vendors who hold stock (subcontractors)
-- Links to existing location table from Inventory module
CREATE TABLE vendor_stock_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendor(id),
    location_id UUID NOT NULL REFERENCES location(id),  -- Virtual location in Inventory
    is_default BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(vendor_id, location_id)
);

-- Migration: Move subcontractor data to vendor
-- INSERT INTO vendor (name, contact_person, phone, email, address, city, vendor_category, specializations, quality_rating, default_lead_time_days, can_hold_stock)
-- SELECT name, contact_person, phone, email, address, city, 'Subcontractor', ARRAY[specialization], quality_rating, lead_time_days, true
-- FROM subcontractor;
```

### Updated References

All modules should now reference `vendor` table:

| Old Reference | New Reference |
|---------------|---------------|
| `subcontractor_id` | `vendor_id` (where `vendor_category IN ('Subcontractor', 'Both')`) |
| `subcontractor_location` | `vendor_stock_location` |

---

## 2. Standardized Location Hierarchy

### Problem
Confusion between `warehouse` and `location` across modules.

### Solution: Clear Hierarchy

```
COMPANY
└── WAREHOUSE (Physical Building)
    └── LOCATION (Specific Spots/Areas)
        ├── INTERNAL (Racks, Bins, Zones)
        ├── RECEIVING (Goods receipt area)
        ├── SHIPPING (Dispatch area)
        ├── QC_HOLD (Quality inspection hold)
        └── PRODUCTION (WIP area)

VIRTUAL LOCATIONS (No warehouse_id)
├── VENDOR (Supplier location for PO tracking)
├── CUSTOMER (Customer location for delivery tracking)
├── SUBCONTRACTOR (Stock at processing vendor)
├── TRANSIT (In-between transfers)
└── ADJUSTMENT (Inventory gains/losses)
```

### Updated Location Schema

```sql
-- Enhanced location types
CREATE TYPE location_type AS ENUM (
    -- Physical locations (have warehouse_id)
    'INTERNAL',      -- General storage
    'RECEIVING',     -- Goods receipt area
    'SHIPPING',      -- Dispatch area
    'QC_HOLD',       -- Quality inspection hold area
    'PRODUCTION',    -- WIP/Manufacturing area

    -- Virtual locations (no warehouse_id)
    'VENDOR',        -- Supplier's premises (for PO tracking)
    'CUSTOMER',      -- Customer's premises (after delivery)
    'SUBCONTRACTOR', -- At processing vendor
    'TRANSIT',       -- In-transit between locations
    'ADJUSTMENT',    -- Virtual for inventory adjustments
    'SCRAP'          -- Virtual for scrapped items
);

-- Updated location table
CREATE TABLE location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    location_type location_type NOT NULL,

    -- Physical location hierarchy
    warehouse_id UUID REFERENCES warehouse(id),  -- NULL for virtual locations
    parent_location_id UUID REFERENCES location(id),

    -- Physical address details (for internal locations)
    aisle VARCHAR(10),
    rack VARCHAR(10),
    bin VARCHAR(10),

    -- For virtual locations
    partner_type VARCHAR(20),  -- 'Vendor', 'Customer'
    partner_id UUID,           -- References vendor or customer

    -- Accounting links
    stock_valuation_account_id UUID REFERENCES account(id),
    stock_input_account_id UUID REFERENCES account(id),
    stock_output_account_id UUID REFERENCES account(id),

    -- Control flags
    is_scrap_location BOOLEAN DEFAULT false,
    is_return_location BOOLEAN DEFAULT false,
    allow_negative_stock BOOLEAN DEFAULT false,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    UNIQUE(company_id, code)
);

-- Indexes
CREATE INDEX idx_location_warehouse ON location(warehouse_id) WHERE warehouse_id IS NOT NULL;
CREATE INDEX idx_location_partner ON location(partner_type, partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_location_type ON location(company_id, location_type);
```

### Standard Locations Setup

```sql
-- System should auto-create these virtual locations
INSERT INTO location (company_id, code, name, location_type) VALUES
-- Virtual locations (no warehouse)
('{company_id}', 'VENDOR', 'Supplier Location', 'VENDOR'),
('{company_id}', 'CUSTOMER', 'Customer Location', 'CUSTOMER'),
('{company_id}', 'TRANSIT', 'In-Transit', 'TRANSIT'),
('{company_id}', 'ADJ-GAIN', 'Inventory Gain', 'ADJUSTMENT'),
('{company_id}', 'ADJ-LOSS', 'Inventory Loss', 'ADJUSTMENT'),
('{company_id}', 'SCRAP', 'Scrap Location', 'SCRAP');

-- Per warehouse locations (created when warehouse is added)
-- WH/RECV - Receiving area
-- WH/SHIP - Shipping area
-- WH/QC - Quality hold
-- WH/STOCK - Main storage
```

---

## 3. Unified Stock Movement Integration

### Problem
Each module creates its own movement records without using central `stock_move` table.

### Solution: All Movements Flow Through stock_move

```sql
-- Enhanced stock_move_type
CREATE TYPE stock_move_type AS ENUM (
    -- Basic moves
    'IN',           -- Stock coming in (purchase, production, return)
    'OUT',          -- Stock going out (sales, consumption)
    'TRANSFER',     -- Between internal locations
    'ADJUST',       -- Inventory adjustment

    -- Specific subtypes (for filtering/reporting)
    'PURCHASE_RECEIPT',    -- From purchase order
    'PRODUCTION_RECEIPT',  -- From production
    'SALES_DELIVERY',      -- Delivery challan
    'CUSTOMER_RETURN',     -- Return from customer
    'VENDOR_RETURN',       -- Return to vendor
    'SUBCONTRACT_OUT',     -- Send to subcontractor
    'SUBCONTRACT_IN',      -- Receive from subcontractor
    'MATERIAL_RETURN',     -- Unused material from subcontractor
    'SCRAP',               -- Write-off
    'INTERNAL_TRANSFER'    -- Between warehouses
);

-- Source document types
CREATE TYPE stock_move_source AS ENUM (
    'MANUAL',
    'PURCHASE_ORDER',
    'GOODS_RECEIPT',
    'PRODUCTION_RECEIPT',
    'DELIVERY_CHALLAN',
    'SALES_RETURN',
    'VENDOR_RETURN',
    'SUBCONTRACTING_ORDER',
    'MATERIAL_TRANSFER',
    'SUBCONTRACTOR_RECEIPT',
    'INVENTORY_ADJUSTMENT',
    'INTERNAL_TRANSFER'
);

-- Updated stock_move table
CREATE TABLE stock_move (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    move_no VARCHAR(30),
    move_date DATE NOT NULL,
    move_type stock_move_type NOT NULL,

    -- Product
    product_id UUID NOT NULL REFERENCES product(id),
    uom_id UUID NOT NULL REFERENCES uom(id),
    qty DECIMAL(18,4) NOT NULL,  -- Always positive

    -- Locations
    from_location_id UUID NOT NULL REFERENCES location(id),
    to_location_id UUID NOT NULL REFERENCES location(id),

    -- Valuation
    unit_cost DECIMAL(18,4) NOT NULL,
    total_cost DECIMAL(18,2) NOT NULL,

    -- Source document
    source_type stock_move_source NOT NULL,
    source_id UUID NOT NULL,
    source_line_id UUID,  -- Specific line in source document

    -- Lot/Batch tracking
    lot_id UUID REFERENCES stock_lot(id),
    batch_no VARCHAR(100),
    expiry_date DATE,

    -- Status
    status stock_move_status NOT NULL DEFAULT 'DRAFT',

    -- Audit
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES app_user(id),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES app_user(id),
    reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, move_no)
);

CREATE TYPE stock_move_status AS ENUM ('DRAFT', 'WAITING', 'DONE', 'CANCELLED');
```

### Integration Service

```csharp
// Central service for stock movements - all modules call this
public interface IStockMoveService
{
    Task<StockMove> CreateMoveAsync(CreateStockMoveRequest request);
    Task<StockMove> PostMoveAsync(Guid moveId);
    Task CancelMoveAsync(Guid moveId, string reason);
    Task<decimal> GetAvailableQtyAsync(Guid productId, Guid locationId);
    Task ReserveStockAsync(Guid productId, Guid locationId, decimal qty, Guid orderId);
    Task ReleaseReservationAsync(Guid orderId);
}

public class CreateStockMoveRequest
{
    public StockMoveType MoveType { get; set; }
    public Guid ProductId { get; set; }
    public Guid UomId { get; set; }
    public decimal Qty { get; set; }
    public Guid FromLocationId { get; set; }
    public Guid ToLocationId { get; set; }
    public StockMoveSource SourceType { get; set; }
    public Guid SourceId { get; set; }
    public Guid? SourceLineId { get; set; }
    public Guid? LotId { get; set; }
    public decimal? UnitCost { get; set; }  // If null, calculated from FIFO/AVCO
}
```

### Module Integration Examples

#### Purchasing: Goods Receipt Posted
```csharp
public async Task PostGoodsReceiptAsync(Guid receiptId)
{
    var receipt = await _receiptRepo.GetWithLinesAsync(receiptId);

    foreach (var line in receipt.Lines)
    {
        // Create stock move: VENDOR → RECEIVING/STOCK
        var move = await _stockMoveService.CreateMoveAsync(new CreateStockMoveRequest
        {
            MoveType = StockMoveType.PURCHASE_RECEIPT,
            ProductId = line.ProductId,
            UomId = line.UomId,
            Qty = line.QtyReceived,
            FromLocationId = _vendorLocationId,  // Virtual vendor location
            ToLocationId = receipt.ToLocationId,  // Warehouse receiving location
            SourceType = StockMoveSource.GOODS_RECEIPT,
            SourceId = receiptId,
            SourceLineId = line.Id,
            UnitCost = line.UnitCost,
            LotId = line.LotId
        });

        await _stockMoveService.PostMoveAsync(move.Id);

        // Create GRNI entry
        await _grniService.CreateAsync(line, move.Id);
    }

    // Update receipt status
    receipt.Status = GoodsReceiptStatus.Posted;
    await _receiptRepo.UpdateAsync(receipt);

    // Update PO received quantities
    await _purchaseOrderService.UpdateReceivedQtysAsync(receipt.PoId);
}
```

#### Outsourced Operations: Material Transfer Out
```csharp
public async Task ConfirmMaterialTransferOutAsync(Guid transferId)
{
    var transfer = await _transferRepo.GetWithLinesAsync(transferId);
    var subcontractorLocation = await _vendorService.GetStockLocationAsync(transfer.VendorId);

    foreach (var line in transfer.Lines)
    {
        // Create stock move: INTERNAL → SUBCONTRACTOR
        var move = await _stockMoveService.CreateMoveAsync(new CreateStockMoveRequest
        {
            MoveType = StockMoveType.SUBCONTRACT_OUT,
            ProductId = line.ProductId,
            UomId = line.UomId,
            Qty = line.Quantity,
            FromLocationId = transfer.FromLocationId,
            ToLocationId = subcontractorLocation.LocationId,
            SourceType = StockMoveSource.MATERIAL_TRANSFER,
            SourceId = transferId,
            SourceLineId = line.Id
            // UnitCost will be calculated from FIFO/AVCO
        });

        await _stockMoveService.PostMoveAsync(move.Id);

        // Update SCO sent quantities
        line.UnitCost = move.UnitCost;  // Store cost at time of transfer
    }

    transfer.Status = MaterialTransferStatus.Confirmed;
    await _transferRepo.UpdateAsync(transfer);
}
```

#### Outsourced Operations: Subcontractor Receipt
```csharp
public async Task ConfirmSubcontractorReceiptAsync(Guid receiptId)
{
    var receipt = await _receiptRepo.GetWithLinesAsync(receiptId);
    var sco = await _scoRepo.GetAsync(receipt.ScoId);
    var subcontractorLocation = await _vendorService.GetStockLocationAsync(receipt.VendorId);

    foreach (var line in receipt.Lines)
    {
        // Calculate costs
        var materialCost = await CalculateMaterialCostAsync(sco.Id, line.Quantity);
        var processingCost = line.Quantity * sco.ProcessingRate;
        var totalUnitCost = (materialCost + processingCost) / line.AcceptedQuantity;

        // Move 1: Consume raw materials at subcontractor (OUT)
        var consumeMove = await _stockMoveService.CreateMoveAsync(new CreateStockMoveRequest
        {
            MoveType = StockMoveType.OUT,
            ProductId = sco.InputProductId,  // Raw material
            UomId = sco.InputUomId,
            Qty = line.MaterialQtyConsumed,
            FromLocationId = subcontractorLocation.LocationId,
            ToLocationId = _productionLocationId,  // Virtual production/consumption
            SourceType = StockMoveSource.SUBCONTRACTOR_RECEIPT,
            SourceId = receiptId,
            SourceLineId = line.Id
        });
        await _stockMoveService.PostMoveAsync(consumeMove.Id);

        // Move 2: Receive finished goods (IN)
        var receiveMove = await _stockMoveService.CreateMoveAsync(new CreateStockMoveRequest
        {
            MoveType = StockMoveType.SUBCONTRACT_IN,
            ProductId = line.ProductId,  // Finished product
            UomId = line.UomId,
            Qty = line.AcceptedQuantity,
            FromLocationId = subcontractorLocation.LocationId,
            ToLocationId = receipt.ToLocationId,
            SourceType = StockMoveSource.SUBCONTRACTOR_RECEIPT,
            SourceId = receiptId,
            SourceLineId = line.Id,
            UnitCost = totalUnitCost
        });
        await _stockMoveService.PostMoveAsync(receiveMove.Id);

        // Create GRNI for processing cost
        await _grniService.CreateProcessingCostAsync(receipt.VendorId, processingCost, receiveMove.Id);
    }

    receipt.Status = SubcontractorReceiptStatus.Confirmed;
    await _receiptRepo.UpdateAsync(receipt);
}
```

#### Sales: Delivery Challan Posted
```csharp
public async Task PostChallanAsync(Guid challanId)
{
    var challan = await _challanRepo.GetWithLinesAsync(challanId);

    foreach (var line in challan.Lines)
    {
        // Check availability
        var available = await _stockMoveService.GetAvailableQtyAsync(
            line.ProductId, challan.FromLocationId);

        if (available < line.Quantity)
            throw new InsufficientStockException(line.ProductId, line.Quantity, available);

        // Create stock move: STOCK → CUSTOMER
        var move = await _stockMoveService.CreateMoveAsync(new CreateStockMoveRequest
        {
            MoveType = StockMoveType.SALES_DELIVERY,
            ProductId = line.ProductId,
            UomId = line.UomId,
            Qty = line.Quantity,
            FromLocationId = challan.FromLocationId,
            ToLocationId = _customerLocationId,  // Virtual customer location
            SourceType = StockMoveSource.DELIVERY_CHALLAN,
            SourceId = challanId,
            SourceLineId = line.Id
            // UnitCost calculated from FIFO/AVCO for COGS
        });

        await _stockMoveService.PostMoveAsync(move.Id);

        // Store COGS for invoice
        line.UnitCost = move.UnitCost;
    }

    // Release any reservations
    await _stockMoveService.ReleaseReservationAsync(challan.SalesOrderId);

    challan.Status = ChallanStatus.Posted;
    await _challanRepo.UpdateAsync(challan);
}
```

---

## 4. Unified Quality Inspection

### Problem
Quality inspection is defined separately in Purchasing and Outsourced Operations modules.

### Solution: Central Quality Management

```sql
-- Quality inspection applicable to all receipts
CREATE TYPE inspection_source AS ENUM (
    'GOODS_RECEIPT',        -- From purchase
    'SUBCONTRACTOR_RECEIPT', -- From subcontractor
    'PRODUCTION_RECEIPT',   -- From production
    'CUSTOMER_RETURN'       -- Returned goods
);

CREATE TYPE inspection_result AS ENUM (
    'PENDING',
    'PASSED',
    'FAILED',
    'CONDITIONAL',  -- Passed with notes/restrictions
    'PARTIAL'       -- Some passed, some failed
);

CREATE TABLE quality_inspection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    inspection_no VARCHAR(50) NOT NULL,
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Source
    source_type inspection_source NOT NULL,
    source_id UUID NOT NULL,
    source_line_id UUID,

    -- Product
    product_id UUID NOT NULL REFERENCES product(id),
    lot_id UUID REFERENCES stock_lot(id),

    -- Quantities
    qty_to_inspect DECIMAL(18,4) NOT NULL,
    qty_inspected DECIMAL(18,4),
    qty_passed DECIMAL(18,4),
    qty_failed DECIMAL(18,4),

    -- Location
    inspection_location_id UUID REFERENCES location(id),  -- QC Hold area
    pass_location_id UUID REFERENCES location(id),        -- Where passed items go
    fail_location_id UUID REFERENCES location(id),        -- Where failed items go (scrap/return)

    -- Result
    result inspection_result DEFAULT 'PENDING',

    -- Details
    inspection_template_id UUID REFERENCES quality_template(id),
    findings TEXT,

    -- Audit
    inspected_by UUID REFERENCES app_user(id),
    inspected_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, inspection_no)
);

-- Inspection criteria/checklist
CREATE TABLE quality_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    name VARCHAR(100) NOT NULL,
    product_category_id UUID,  -- Apply to category
    product_id UUID,           -- Or specific product
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, name)
);

CREATE TABLE quality_template_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES quality_template(id) ON DELETE CASCADE,
    check_name VARCHAR(200) NOT NULL,
    check_type VARCHAR(50) NOT NULL,  -- 'Visual', 'Dimensional', 'Functional', 'Documentation'
    specification TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0
);

-- Inspection results per check item
CREATE TABLE quality_inspection_result (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES quality_inspection(id) ON DELETE CASCADE,
    template_item_id UUID REFERENCES quality_template_item(id),
    check_name VARCHAR(200) NOT NULL,

    passed BOOLEAN,
    actual_value VARCHAR(200),
    notes TEXT,

    sort_order INT DEFAULT 0
);

-- Indexes
CREATE INDEX idx_qi_source ON quality_inspection(source_type, source_id);
CREATE INDEX idx_qi_product ON quality_inspection(product_id);
CREATE INDEX idx_qi_result ON quality_inspection(result) WHERE result = 'PENDING';
```

### Quality Inspection Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    QUALITY INSPECTION WORKFLOW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Receipt Created (GR/SCR/PR)                                     │
│     │                                                                │
│     ├── Product requires inspection? ──No──▶ Direct to Stock        │
│     │                                                                │
│     Yes                                                              │
│     ▼                                                                │
│  2. Stock moved to QC_HOLD location                                 │
│     │                                                                │
│     ▼                                                                │
│  3. Quality Inspection Created (PENDING)                            │
│     │                                                                │
│     ▼                                                                │
│  4. Inspector performs checks                                        │
│     ├── Load template checklist                                      │
│     ├── Record results per item                                      │
│     └── Enter passed/failed quantities                               │
│     │                                                                │
│     ▼                                                                │
│  5. Complete Inspection                                              │
│     │                                                                │
│     ├── PASSED qty ──▶ Move to pass_location (Stock)                │
│     │                                                                │
│     └── FAILED qty ──▶ Move to fail_location                        │
│                        │                                             │
│                        ├── SCRAP ──▶ Write-off entry                │
│                        ├── RETURN ──▶ Vendor return created         │
│                        └── REWORK ──▶ Back to production/SC         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Customer Returns (Missing Workflow)

### Problem
No documentation for handling goods returned by customers.

### Solution: Customer Return Module

```sql
-- Customer Return Request
CREATE TYPE customer_return_status AS ENUM (
    'Draft',
    'Approved',
    'Received',
    'Inspected',
    'Completed',
    'Rejected',
    'Cancelled'
);

CREATE TYPE return_reason AS ENUM (
    'Defective',
    'WrongItem',
    'Damaged',
    'NotAsDescribed',
    'OrderCancelled',
    'ExcessQuantity',
    'Other'
);

CREATE TYPE return_action AS ENUM (
    'Refund',
    'Replacement',
    'CreditNote',
    'Repair',
    'NoAction'
);

CREATE TABLE customer_return (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),
    return_no VARCHAR(50) NOT NULL,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,

    customer_id UUID NOT NULL REFERENCES customer(id),

    -- Original sale reference
    invoice_id UUID REFERENCES invoice(id),
    challan_id UUID REFERENCES challan(id),

    -- Location
    receive_location_id UUID NOT NULL REFERENCES location(id),

    return_reason return_reason NOT NULL,
    reason_details TEXT,

    -- Totals
    total_qty DECIMAL(18,4) DEFAULT 0,
    total_value DECIMAL(18,2) DEFAULT 0,

    status customer_return_status DEFAULT 'Draft',

    -- Approval
    approved_by UUID REFERENCES app_user(id),
    approved_at TIMESTAMPTZ,

    -- Receipt
    received_by UUID REFERENCES app_user(id),
    received_at TIMESTAMPTZ,

    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(company_id, return_no)
);

CREATE TABLE customer_return_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES customer_return(id) ON DELETE CASCADE,

    product_id UUID NOT NULL REFERENCES product(id),
    uom_id UUID NOT NULL REFERENCES uom(id),

    -- Original sale line
    invoice_line_id UUID,
    challan_line_id UUID,

    -- Quantities
    qty_returned DECIMAL(18,4) NOT NULL,
    qty_received DECIMAL(18,4) DEFAULT 0,
    qty_accepted DECIMAL(18,4) DEFAULT 0,  -- After inspection
    qty_rejected DECIMAL(18,4) DEFAULT 0,

    -- Value (original sale price)
    unit_price DECIMAL(18,4) NOT NULL,
    line_value DECIMAL(18,2) NOT NULL,

    -- Inspection
    inspection_id UUID REFERENCES quality_inspection(id),

    -- Resolution
    action_taken return_action,
    action_reference VARCHAR(100),  -- Credit note number, replacement order, etc.

    reason_details TEXT,

    sort_order INT DEFAULT 0
);

-- Indexes
CREATE INDEX idx_cr_customer ON customer_return(customer_id);
CREATE INDEX idx_cr_invoice ON customer_return(invoice_id);
CREATE INDEX idx_cr_status ON customer_return(company_id, status);
```

### Customer Return Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER RETURN WORKFLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 1: Create Return Request                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ CR-2025-0001                                                │    │
│  │ Customer: ABC Trading                                        │    │
│  │ Original Invoice: INV-2025-0100                              │    │
│  │ Reason: Defective                                            │    │
│  │                                                              │    │
│  │ Lines:                                                       │    │
│  │ - Brake Pad BRK-001: 10 pcs @ Rs 500 = Rs 5,000             │    │
│  │                                                              │    │
│  │ [Submit for Approval]                                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  STEP 2: Approval                                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Manager reviews return request                               │    │
│  │ - Verifies original sale                                     │    │
│  │ - Checks return policy                                       │    │
│  │                                                              │    │
│  │ [Approve] or [Reject]                                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  STEP 3: Receive Goods                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Warehouse receives returned items                            │    │
│  │                                                              │    │
│  │ Lines:                                                       │    │
│  │ - Brake Pad BRK-001: Returned 10, Received [10]             │    │
│  │                                                              │    │
│  │ [Confirm Receipt]                                            │    │
│  │                                                              │    │
│  │ Stock Move Created:                                          │    │
│  │ CUSTOMER → QC_HOLD (or RETURNS location)                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│  STEP 4: Quality Inspection (if required)                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ QI-2025-0050                                                 │    │
│  │ Source: Customer Return CR-2025-0001                         │    │
│  │                                                              │    │
│  │ Results:                                                     │    │
│  │ - Qty Inspected: 10                                          │    │
│  │ - Qty Good (resaleable): 7                                   │    │
│  │ - Qty Damaged (scrap): 3                                     │    │
│  │                                                              │    │
│  │ [Complete Inspection]                                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│              ┌───────────────┴───────────────┐                      │
│              ▼                               ▼                       │
│  ┌─────────────────────┐        ┌─────────────────────┐             │
│  │ GOOD (7 pcs)        │        │ DAMAGED (3 pcs)     │             │
│  │                     │        │                     │             │
│  │ Move to Stock       │        │ Move to Scrap       │             │
│  │ Available for sale  │        │ Write-off entry     │             │
│  └─────────────────────┘        └─────────────────────┘             │
│                              │                                       │
│                              ▼                                       │
│  STEP 5: Resolution                                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Action for Customer:                                         │    │
│  │                                                              │    │
│  │ ○ Credit Note (CN-2025-0020) - Rs 5,000                      │    │
│  │ ○ Replacement Order (SO-2025-0150)                           │    │
│  │ ○ Refund (via payment)                                       │    │
│  │                                                              │    │
│  │ [Complete Return]                                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Accounting Entries for Customer Return

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER RETURN ACCOUNTING                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Goods Received Back (Stock increases):                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ Stock Valuation (Asset)    │ 2,500      │            │ 7 pcs  │  │
│  │ Sales Returns (Revenue)    │            │ 2,500      │ @Rs357 │  │
│  └─────────────────────────────────────────────────────────────┘    │
│  Note: Returned at lower of original cost or NRV                    │
│                                                                      │
│  2. Scrap Write-off (3 damaged units):                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ Scrap/Return Loss (Expense)│ 1,071      │            │ 3 pcs  │  │
│  │ Stock Valuation (Asset)    │            │ 1,071      │ @Rs357 │  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  3. Credit Note Issued:                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Account                    │ Debit      │ Credit     │        │  │
│  ├────────────────────────────┼────────────┼────────────┤        │  │
│  │ Sales Returns (Revenue)    │ 5,000      │            │        │  │
│  │ Output GST Payable         │ 850        │            │ 17%    │  │
│  │ Accounts Receivable        │            │ 5,850      │        │  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### API Endpoints for Customer Returns

```
GET    /api/customer-returns              - List returns
       ?customerId=xxx
       ?status=Pending
       ?from=2025-01-01&to=2025-01-31

GET    /api/customer-returns/{id}         - Get return details
POST   /api/customer-returns              - Create return request
PUT    /api/customer-returns/{id}         - Update draft return

POST   /api/customer-returns/{id}/submit  - Submit for approval
POST   /api/customer-returns/{id}/approve - Approve return
POST   /api/customer-returns/{id}/reject  - Reject return
POST   /api/customer-returns/{id}/receive - Receive returned goods
POST   /api/customer-returns/{id}/complete - Complete return process

GET    /api/customer-returns/{id}/inspection - Get inspection result
POST   /api/customer-returns/{id}/create-credit-note - Create credit note
```

---

## 6. GRNI Consolidation

### Problem
GRNI (Goods Received Not Invoiced) is defined in Accounting but used by Purchasing and Outsourced Operations.

### Solution: Move GRNI to Purchasing, Shared by All

```sql
-- GRNI belongs in Purchasing module, referenced by others
CREATE TYPE grni_source AS ENUM (
    'GOODS_RECEIPT',        -- Purchase receipt
    'SUBCONTRACTOR_RECEIPT', -- Subcontractor processing
    'LANDED_COST'           -- Additional costs on receipts
);

CREATE TABLE grni (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),

    -- Source
    source_type grni_source NOT NULL,
    source_id UUID NOT NULL,
    source_line_id UUID,

    -- Vendor
    vendor_id UUID NOT NULL REFERENCES vendor(id),

    -- Product (if applicable)
    product_id UUID REFERENCES product(id),

    -- Amounts
    quantity DECIMAL(18,4),
    unit_cost DECIMAL(18,4),
    total_amount DECIMAL(18,2) NOT NULL,

    -- Description (for non-product GRNI like processing costs)
    description TEXT,

    -- Clearing
    is_cleared BOOLEAN DEFAULT false,
    cleared_by_bill_id UUID REFERENCES vendor_bill(id),
    cleared_at TIMESTAMPTZ,
    cleared_amount DECIMAL(18,2),

    -- Accounting
    account_id UUID NOT NULL REFERENCES account(id),  -- GRNI account (2121)
    journal_entry_id UUID REFERENCES journal_entry(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Partial clearing support
    remaining_amount DECIMAL(18,2) GENERATED ALWAYS AS (total_amount - COALESCE(cleared_amount, 0)) STORED
);

CREATE INDEX idx_grni_vendor ON grni(vendor_id, is_cleared);
CREATE INDEX idx_grni_source ON grni(source_type, source_id);
CREATE INDEX idx_grni_pending ON grni(company_id, is_cleared) WHERE is_cleared = false;
```

### GRNI Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GRNI LIFECYCLE                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CREATION (Multiple Sources):                                        │
│                                                                      │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐│
│  │ Goods Receipt   │     │ Subcontractor   │     │ Landed Cost     ││
│  │ Posted          │     │ Receipt Posted  │     │ Posted          ││
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘│
│           │                       │                       │         │
│           └───────────────────────┼───────────────────────┘         │
│                                   ▼                                  │
│                          ┌─────────────────┐                        │
│                          │ GRNI Created    │                        │
│                          │ (Liability ↑)   │                        │
│                          └────────┬────────┘                        │
│                                   │                                  │
│  AGING REPORT:                    │                                  │
│  ┌────────────────────────────────┴─────────────────────────────┐   │
│  │ Vendor           │ Receipt      │ Amount    │ Days │ Alert   │   │
│  ├───────────────────┼──────────────┼───────────┼──────┼─────────┤   │
│  │ Steel Suppliers   │ GR-2025-0001 │ Rs 50,000 │ 15   │         │   │
│  │ ABC Plating       │ SCR-2025-001 │ Rs 14,700 │ 25   │ ⚠️      │   │
│  │ Import Freight    │ LC-2025-0001 │ Rs 8,500  │ 30   │ 🔴      │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                   │                                  │
│  CLEARING (Bill Posted):          │                                  │
│                                   ▼                                  │
│                          ┌─────────────────┐                        │
│                          │ Vendor Bill     │                        │
│                          │ Posted          │                        │
│                          └────────┬────────┘                        │
│                                   │                                  │
│                                   ▼                                  │
│                          ┌─────────────────┐                        │
│                          │ GRNI Cleared    │                        │
│                          │ AP Created      │                        │
│                          └─────────────────┘                        │
│                                                                      │
│  Journal Entry:                                                      │
│  Dr. GRNI (2121)              Rs 50,000                             │
│  Dr. Input GST (1430)         Rs 8,500                              │
│      Cr. Accounts Payable (2111)        Rs 58,500                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Stock Reservation System

### Problem
No mechanism to reserve stock for sales orders before delivery.

### Solution: Stock Reservation

```sql
CREATE TYPE reservation_source AS ENUM (
    'SALES_ORDER',
    'PRODUCTION_ORDER',
    'TRANSFER_ORDER',
    'MANUAL'
);

CREATE TYPE reservation_status AS ENUM (
    'ACTIVE',
    'PARTIAL',
    'FULFILLED',
    'CANCELLED',
    'EXPIRED'
);

CREATE TABLE stock_reservation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES company(id),

    product_id UUID NOT NULL REFERENCES product(id),
    location_id UUID NOT NULL REFERENCES location(id),
    lot_id UUID REFERENCES stock_lot(id),

    qty_reserved DECIMAL(18,4) NOT NULL,
    qty_fulfilled DECIMAL(18,4) DEFAULT 0,
    qty_remaining DECIMAL(18,4) GENERATED ALWAYS AS (qty_reserved - qty_fulfilled) STORED,

    -- Source
    source_type reservation_source NOT NULL,
    source_id UUID NOT NULL,
    source_line_id UUID,

    -- Timing
    reserved_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- Auto-release if not fulfilled

    status reservation_status DEFAULT 'ACTIVE',

    -- Audit
    reserved_by UUID REFERENCES app_user(id),
    released_at TIMESTAMPTZ,
    released_by UUID REFERENCES app_user(id),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservation_product_location ON stock_reservation(product_id, location_id, status);
CREATE INDEX idx_reservation_source ON stock_reservation(source_type, source_id);
CREATE INDEX idx_reservation_expiry ON stock_reservation(expires_at) WHERE status = 'ACTIVE';
```

### Reservation Logic in stock_quant

```sql
-- Update stock_quant to track reservations
ALTER TABLE stock_quant ADD COLUMN qty_reserved DECIMAL(18,4) DEFAULT 0;

-- Available = On Hand - Reserved
ALTER TABLE stock_quant ADD COLUMN qty_available DECIMAL(18,4)
    GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED;

-- Trigger to update quant when reservation changes
CREATE OR REPLACE FUNCTION update_quant_reservation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE stock_quant
        SET qty_reserved = qty_reserved + NEW.qty_reserved
        WHERE product_id = NEW.product_id
          AND location_id = NEW.location_id
          AND (lot_id = NEW.lot_id OR (lot_id IS NULL AND NEW.lot_id IS NULL));
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE stock_quant
        SET qty_reserved = qty_reserved - OLD.qty_reserved + NEW.qty_reserved
        WHERE product_id = NEW.product_id
          AND location_id = NEW.location_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE stock_quant
        SET qty_reserved = qty_reserved - OLD.qty_reserved
        WHERE product_id = OLD.product_id
          AND location_id = OLD.location_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_update
AFTER INSERT OR UPDATE OR DELETE ON stock_reservation
FOR EACH ROW EXECUTE FUNCTION update_quant_reservation();
```

---

## 8. Implementation Checklist

### Phase 3A: Schema Updates (1 week)
- [ ] Unify vendor/subcontractor tables
- [ ] Standardize location hierarchy
- [ ] Add unified stock_move integration
- [ ] Create central quality_inspection table
- [ ] Add customer_return tables
- [ ] Consolidate GRNI to purchasing
- [ ] Add stock_reservation system

### Phase 3B: Service Layer (2 weeks)
- [ ] IStockMoveService implementation
- [ ] IGrniService implementation
- [ ] IQualityInspectionService implementation
- [ ] IReservationService implementation
- [ ] ICustomerReturnService implementation

### Phase 3C: Module Integration (2 weeks)
- [ ] Update Purchasing to use stock_move service
- [ ] Update Outsourced Operations to use stock_move service
- [ ] Update Sales/Challan to use stock_move service
- [ ] Integrate quality inspection across all receipt types
- [ ] Connect GRNI creation/clearing

### Phase 3D: UI Updates (1 week)
- [ ] Unified vendor/subcontractor forms
- [ ] Quality inspection screens
- [ ] Customer return workflow screens
- [ ] GRNI aging report
- [ ] Stock reservation visibility

### Phase 3E: Reports (1 week)
- [ ] GRNI Aging Report
- [ ] Stock Movement Traceability
- [ ] Quality Inspection Summary
- [ ] Customer Return Analysis
- [ ] Reservation Status Report

---

## 9. API Endpoints Summary (New/Modified)

### Stock Movements (Central)
```
POST   /api/stock-moves                    - Create move
GET    /api/stock-moves/{id}               - Get move details
POST   /api/stock-moves/{id}/post          - Post move
POST   /api/stock-moves/{id}/cancel        - Cancel move
GET    /api/stock-moves/by-source/{type}/{id} - Get moves by source document
```

### Stock Reservations
```
GET    /api/stock-reservations             - List reservations
POST   /api/stock-reservations             - Create reservation
DELETE /api/stock-reservations/{id}        - Release reservation
GET    /api/stock-reservations/by-order/{orderId} - Get by sales order
POST   /api/stock-reservations/cleanup     - Release expired reservations
```

### Quality Inspections (Central)
```
GET    /api/quality-inspections            - List all inspections
GET    /api/quality-inspections/pending    - Pending inspections
POST   /api/quality-inspections/{id}/complete - Complete inspection
GET    /api/quality-templates              - List templates
POST   /api/quality-templates              - Create template
```

### GRNI
```
GET    /api/grni                           - List all GRNI
GET    /api/grni/pending                   - Pending GRNI
GET    /api/grni/by-vendor/{vendorId}      - GRNI by vendor
GET    /api/grni/aging                     - GRNI aging report
POST   /api/grni/clear                     - Clear GRNI with bill
```

### Customer Returns
```
GET    /api/customer-returns               - List returns
POST   /api/customer-returns               - Create return
POST   /api/customer-returns/{id}/approve  - Approve
POST   /api/customer-returns/{id}/receive  - Receive goods
POST   /api/customer-returns/{id}/complete - Complete
```

---

## 10. Migration Notes

### Data Migration Steps

1. **Vendor/Subcontractor Unification**
   ```sql
   -- Add new columns to vendor
   ALTER TABLE vendor ADD COLUMN vendor_category vendor_category DEFAULT 'Supplier';

   -- Migrate subcontractor data
   INSERT INTO vendor (...)
   SELECT ... FROM subcontractor;

   -- Update foreign keys in subcontracting_order
   UPDATE subcontracting_order
   SET vendor_id = (SELECT v.id FROM vendor v
                    JOIN subcontractor s ON s.name = v.name
                    WHERE s.id = subcontracting_order.subcontractor_id);

   -- Drop old table after verification
   -- DROP TABLE subcontractor;
   ```

2. **Location Standardization**
   ```sql
   -- Create virtual locations if not exist
   INSERT INTO location (company_id, code, name, location_type)
   SELECT id, 'VENDOR', 'Vendor Location', 'VENDOR' FROM company
   WHERE NOT EXISTS (SELECT 1 FROM location WHERE code = 'VENDOR' AND company_id = company.id);

   -- Similar for CUSTOMER, TRANSIT, ADJUSTMENT, SCRAP
   ```

3. **Stock Move History**
   ```sql
   -- Backfill stock_move from existing transactions
   INSERT INTO stock_move (...)
   SELECT ... FROM goods_receipt_line grl
   JOIN goods_receipt gr ON grl.receipt_id = gr.id
   WHERE gr.status = 'Posted';

   -- Similar for challans, adjustments, transfers
   ```

---

This Phase 3 document provides the integration layer that connects all 4 modules into a cohesive system with proper data flow, unified concepts, and complete workflows.
