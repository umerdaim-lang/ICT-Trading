# Inventory (Stock) Module - Complete Documentation

## 1. Module Overview

The Inventory module controls:
- **Stock quantities** across locations
- **Stock movements** (IN, OUT, ADJUST, TRANSFER)
- **Stock valuation** for accounting
- **Reorder management**
- **Lot/Serial tracking** (optional)

### Integration with Existing Modules

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Production │────▶│  Inventory  │◀────│   Sales     │
│  (Receipt)  │     │   (Stock)   │     │  (Challan)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌──────────┐  ┌──────────┐
              │ Accounts │  │ Reports  │
              └──────────┘  └──────────┘
```

---

## 2. Core Concepts

### 2.1 Product Types

| Type | Stock Tracked | Valuation | Use Case |
|------|--------------|-----------|----------|
| **Storable** | ✔ Yes | ✔ Yes | Auto parts, raw materials |
| **Consumable** | ✔ Optional | ✖ Expense | Office supplies, packaging |
| **Service** | ✖ No | ✖ No | Labor, installation |

### 2.2 Location Types

| Location Type | Physical | Examples | Balance Sheet |
|--------------|----------|----------|---------------|
| **Internal** | ✔ | Warehouse, Rack A1, Bin 5 | ✔ Asset |
| **Supplier** | Virtual | Vendor Location | ✖ |
| **Customer** | Virtual | Customer Location | ✖ |
| **Production** | Virtual | WIP Location | ✔ Asset |
| **Adjustment** | Virtual | Inventory Loss/Gain | ✖ |
| **Transit** | Virtual | Inter-warehouse transfer | ✔ Asset |
| **Subcontractor** | Virtual | External processor | ✔ Asset |

### 2.3 Stock Move Types

| Move Type | From → To | Accounting Impact |
|-----------|-----------|-------------------|
| **IN** | Supplier → Stock | Debit: Stock, Credit: GRNI |
| **OUT** | Stock → Customer | Debit: COGS, Credit: Stock |
| **ADJUST** | Adjustment → Stock | Debit/Credit: Adjustment Account |
| **TRANSFER** | Stock → Stock | No P&L impact |
| **PRODUCTION_IN** | Production → Stock | Debit: FG Stock, Credit: WIP |
| **PRODUCTION_OUT** | Stock → Production | Debit: WIP, Credit: RM Stock |

---

## 3. Database Schema

### 3.1 Locations Table

```sql
CREATE TABLE location (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES company(id),
    code varchar(20) NOT NULL,
    name varchar(100) NOT NULL,
    location_type location_type NOT NULL, -- INTERNAL, SUPPLIER, CUSTOMER, PRODUCTION, ADJUSTMENT, TRANSIT, SUBCONTRACTOR
    parent_id uuid REFERENCES location(id),
    is_active boolean NOT NULL DEFAULT true,

    -- For internal locations
    warehouse_id uuid REFERENCES warehouse(id),
    aisle varchar(10),
    rack varchar(10),
    bin varchar(10),

    -- Accounting
    stock_valuation_account_id uuid REFERENCES account(id),
    stock_input_account_id uuid REFERENCES account(id),
    stock_output_account_id uuid REFERENCES account(id),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

CREATE TYPE location_type AS ENUM (
    'INTERNAL', 'SUPPLIER', 'CUSTOMER', 'PRODUCTION',
    'ADJUSTMENT', 'TRANSIT', 'SUBCONTRACTOR'
);
```

### 3.2 Stock Quant Table (Current Stock)

```sql
CREATE TABLE stock_quant (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES company(id),
    product_id uuid NOT NULL REFERENCES product(id),
    location_id uuid NOT NULL REFERENCES location(id),
    uom_id uuid NOT NULL REFERENCES uom(id),

    qty_on_hand numeric(18,3) NOT NULL DEFAULT 0,
    qty_reserved numeric(18,3) NOT NULL DEFAULT 0,  -- Reserved for orders
    qty_available numeric(18,3) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,

    -- Lot/Serial (optional)
    lot_id uuid REFERENCES stock_lot(id),

    -- Valuation
    unit_cost numeric(18,4) NOT NULL DEFAULT 0,
    total_value numeric(18,2) GENERATED ALWAYS AS (qty_on_hand * unit_cost) STORED,

    last_count_date date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,

    UNIQUE(company_id, product_id, location_id, lot_id)
);
```

### 3.3 Stock Move Table (All Movements)

```sql
CREATE TABLE stock_move (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES company(id),
    move_no varchar(30),
    move_date date NOT NULL,
    move_type stock_move_type NOT NULL, -- IN, OUT, ADJUST, TRANSFER

    product_id uuid NOT NULL REFERENCES product(id),
    uom_id uuid NOT NULL REFERENCES uom(id),
    qty numeric(18,3) NOT NULL,

    from_location_id uuid NOT NULL REFERENCES location(id),
    to_location_id uuid NOT NULL REFERENCES location(id),

    -- Valuation
    unit_cost numeric(18,4) NOT NULL,
    total_cost numeric(18,2) NOT NULL,

    -- Source document
    source_type varchar(30), -- CHALLAN, PRODUCTION_RECEIPT, PURCHASE, ADJUSTMENT, TRANSFER
    source_id uuid,

    -- Lot/Serial
    lot_id uuid REFERENCES stock_lot(id),

    -- Status
    status stock_move_status NOT NULL DEFAULT 'DRAFT', -- DRAFT, DONE, CANCELLED

    -- Audit
    posted_at timestamptz,
    posted_by uuid REFERENCES app_user(id),
    reason text,

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE stock_move_status AS ENUM ('DRAFT', 'DONE', 'CANCELLED');
```

### 3.4 Stock Valuation Layer (FIFO/AVCO Tracking)

```sql
CREATE TABLE stock_valuation_layer (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES company(id),
    product_id uuid NOT NULL REFERENCES product(id),

    stock_move_id uuid REFERENCES stock_move(id),

    qty numeric(18,3) NOT NULL,
    remaining_qty numeric(18,3) NOT NULL,
    unit_cost numeric(18,4) NOT NULL,
    total_value numeric(18,2) NOT NULL,

    -- For FIFO consumption tracking
    consumed_by jsonb, -- Array of {move_id, qty}

    created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.5 Stock Lot Table (Batch/Serial Tracking)

```sql
CREATE TABLE stock_lot (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES company(id),
    product_id uuid NOT NULL REFERENCES product(id),

    lot_no varchar(50) NOT NULL,
    serial_no varchar(50), -- For unique serial numbers

    manufacturing_date date,
    expiry_date date,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(company_id, product_id, lot_no)
);
```

### 3.6 Inventory Adjustment Table

```sql
CREATE TABLE inventory_adjustment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES company(id),
    adjustment_no varchar(30) NOT NULL,
    adjustment_date date NOT NULL,

    location_id uuid NOT NULL REFERENCES location(id),
    reason text,

    status adjustment_status NOT NULL DEFAULT 'DRAFT', -- DRAFT, POSTED, CANCELLED

    posted_at timestamptz,
    posted_by uuid REFERENCES app_user(id),

    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_adjustment_line (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id uuid NOT NULL REFERENCES inventory_adjustment(id),

    product_id uuid NOT NULL REFERENCES product(id),
    uom_id uuid NOT NULL REFERENCES uom(id),
    lot_id uuid REFERENCES stock_lot(id),

    system_qty numeric(18,3) NOT NULL,
    counted_qty numeric(18,3) NOT NULL,
    difference_qty numeric(18,3) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,

    unit_cost numeric(18,4) NOT NULL,
    adjustment_value numeric(18,2) GENERATED ALWAYS AS ((counted_qty - system_qty) * unit_cost) STORED
);
```

### 3.7 Reorder Rules

```sql
CREATE TABLE reorder_rule (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES company(id),
    product_id uuid NOT NULL REFERENCES product(id),
    location_id uuid NOT NULL REFERENCES location(id),

    min_qty numeric(18,3) NOT NULL,
    max_qty numeric(18,3) NOT NULL,
    reorder_qty numeric(18,3), -- If null, order (max - current)

    lead_time_days int NOT NULL DEFAULT 0,

    is_active boolean NOT NULL DEFAULT true,

    UNIQUE(company_id, product_id, location_id)
);
```

---

## 4. Stock Valuation Methods

### 4.1 FIFO (First In, First Out)

```
Purchase 1: 100 units @ Rs.50 = Rs.5,000
Purchase 2: 100 units @ Rs.60 = Rs.6,000

Sell 150 units:
  - 100 from Purchase 1 @ Rs.50 = Rs.5,000
  - 50 from Purchase 2 @ Rs.60 = Rs.3,000
  - Total COGS = Rs.8,000

Remaining: 50 units @ Rs.60 = Rs.3,000
```

### 4.2 AVCO (Average Cost)

```
Purchase 1: 100 units @ Rs.50 = Rs.5,000
Purchase 2: 100 units @ Rs.60 = Rs.6,000
Average Cost = Rs.11,000 / 200 = Rs.55

Sell 150 units:
  - COGS = 150 × Rs.55 = Rs.8,250

Remaining: 50 units @ Rs.55 = Rs.2,750
```

### 4.3 Standard Cost

```
Standard Cost set: Rs.52 per unit

Purchase 1: 100 units @ Rs.50
  - Stock: 100 × Rs.52 = Rs.5,200
  - Price Variance: Rs.200 (favorable)

Purchase 2: 100 units @ Rs.60
  - Stock: 100 × Rs.52 = Rs.5,200
  - Price Variance: Rs.800 (unfavorable)

Sell 150 units:
  - COGS = 150 × Rs.52 = Rs.7,800
```

---

## 5. Accounting Entries

### 5.1 Stock Receipt (Purchase/Production)

```
┌─────────────────────────────────────────────────┐
│ Goods Receipt - 100 units @ Rs.50               │
├─────────────────────────────────────────────────┤
│ Account                    │ Debit   │ Credit   │
├────────────────────────────┼─────────┼──────────┤
│ Stock Valuation (Asset)    │ 5,000   │          │
│ GRNI / Stock Input         │         │ 5,000    │
└─────────────────────────────────────────────────┘
```

### 5.2 Stock Issue (Sales Delivery)

```
┌─────────────────────────────────────────────────┐
│ Delivery - 100 units @ Rs.50                    │
├─────────────────────────────────────────────────┤
│ Account                    │ Debit   │ Credit   │
├────────────────────────────┼─────────┼──────────┤
│ COGS / Stock Output        │ 5,000   │          │
│ Stock Valuation (Asset)    │         │ 5,000    │
└─────────────────────────────────────────────────┘
```

### 5.3 Inventory Adjustment (Loss)

```
┌─────────────────────────────────────────────────┐
│ Adjustment - 10 units lost @ Rs.50              │
├─────────────────────────────────────────────────┤
│ Account                    │ Debit   │ Credit   │
├────────────────────────────┼─────────┼──────────┤
│ Inventory Loss (Expense)   │ 500     │          │
│ Stock Valuation (Asset)    │         │ 500      │
└─────────────────────────────────────────────────┘
```

### 5.4 Internal Transfer

```
┌─────────────────────────────────────────────────┐
│ Transfer - WH1 to WH2 (Same company)            │
├─────────────────────────────────────────────────┤
│ NO ACCOUNTING ENTRY - Quantity movement only    │
└─────────────────────────────────────────────────┘
```

---

## 6. Workflow Diagrams

### 6.1 Production Receipt Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Production  │────▶│ Stock Move   │────▶│ Stock Quant  │
│   Receipt    │     │  (Type: IN)  │     │   Updated    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Valuation   │
                     │    Layer     │
                     └──────────────┘
```

### 6.2 Sales Delivery Flow (Challan)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Challan    │────▶│ Stock Move   │────▶│ Stock Quant  │
│   Posted     │     │  (Type: OUT) │     │   Reduced    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │    FIFO      │
                     │  Consumed    │
                     └──────────────┘
```

### 6.3 Inventory Adjustment Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Physical   │────▶│  Adjustment  │────▶│ Stock Move   │
│    Count     │     │   Created    │     │   (ADJUST)   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                │
                     ┌──────────────────────────┤
                     ▼                          ▼
              ┌──────────────┐          ┌──────────────┐
              │ Stock Quant  │          │  Accounting  │
              │   Updated    │          │    Entry     │
              └──────────────┘          └──────────────┘
```

---

## 7. API Endpoints

### 7.1 Stock Quants

```
GET    /api/inventory/quants                    # List stock on hand
GET    /api/inventory/quants/product/{id}       # Stock by product
GET    /api/inventory/quants/location/{id}      # Stock by location
```

### 7.2 Stock Moves

```
GET    /api/inventory/moves                     # List moves
POST   /api/inventory/moves                     # Create move
GET    /api/inventory/moves/{id}                # Get move details
POST   /api/inventory/moves/{id}/validate       # Validate/post move
POST   /api/inventory/moves/{id}/cancel         # Cancel move
```

### 7.3 Adjustments

```
GET    /api/inventory/adjustments               # List adjustments
POST   /api/inventory/adjustments               # Create adjustment
GET    /api/inventory/adjustments/{id}          # Get adjustment
PUT    /api/inventory/adjustments/{id}          # Update draft
POST   /api/inventory/adjustments/{id}/post     # Post adjustment
POST   /api/inventory/adjustments/{id}/cancel   # Cancel
```

### 7.4 Transfers

```
GET    /api/inventory/transfers                 # List transfers
POST   /api/inventory/transfers                 # Create transfer
GET    /api/inventory/transfers/{id}            # Get transfer
POST   /api/inventory/transfers/{id}/post       # Post transfer
```

### 7.5 Reports

```
GET    /api/reports/stock-valuation             # Current valuation
GET    /api/reports/stock-movement              # Movement history
GET    /api/reports/stock-aging                 # Aging analysis
GET    /api/reports/reorder-report              # Items to reorder
```

---

## 8. UI Pages

### 8.1 Stock On Hand

```
┌─────────────────────────────────────────────────────────────┐
│ Inventory > Stock On Hand                                   │
├─────────────────────────────────────────────────────────────┤
│ [Location: All ▼] [Product: ____] [Search]                  │
├─────────────────────────────────────────────────────────────┤
│ Product      │ Location  │ On Hand │ Reserved │ Available  │
├──────────────┼───────────┼─────────┼──────────┼────────────┤
│ BRK-PAD-001  │ WH/Main   │ 500     │ 50       │ 450        │
│ OIL-FLT-002  │ WH/Main   │ 200     │ 0        │ 200        │
│ SPK-PLG-003  │ WH/Main   │ 1000    │ 100      │ 900        │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Stock Movements

```
┌─────────────────────────────────────────────────────────────┐
│ Inventory > Stock Movements                                 │
├─────────────────────────────────────────────────────────────┤
│ [Type: All ▼] [From: ____] [To: ____] [Search]              │
├─────────────────────────────────────────────────────────────┤
│ Date       │ Type │ Product     │ Qty  │ From    │ To      │
├────────────┼──────┼─────────────┼──────┼─────────┼─────────┤
│ 2026-02-13 │ OUT  │ BRK-PAD-001 │ -50  │ WH/Main │ Customer│
│ 2026-02-12 │ IN   │ OIL-FLT-002 │ +100 │ Prod    │ WH/Main │
│ 2026-02-11 │ ADJ  │ SPK-PLG-003 │ -5   │ WH/Main │ Loss    │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Inventory Adjustment

```
┌─────────────────────────────────────────────────────────────┐
│ Inventory > New Adjustment                                  │
├─────────────────────────────────────────────────────────────┤
│ Adjustment No: ADJ/2026/0001     Date: [2026-02-13]         │
│ Location: [WH/Main ▼]            Reason: [Physical Count]   │
├─────────────────────────────────────────────────────────────┤
│ Product      │ System Qty │ Counted Qty │ Difference │ Value│
├──────────────┼────────────┼─────────────┼────────────┼──────┤
│ BRK-PAD-001  │ 500        │ [495    ]   │ -5         │ -250 │
│ OIL-FLT-002  │ 200        │ [202    ]   │ +2         │ +100 │
├──────────────┼────────────┼─────────────┼────────────┼──────┤
│                           │ Net Adjustment:          │ -150 │
└─────────────────────────────────────────────────────────────┘
│ [Save Draft]                           [Post Adjustment]    │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Business Rules

### 9.1 Stock Validation

- Cannot deliver more than available quantity
- Cannot adjust to negative stock
- Reserved stock cannot be used for other orders

### 9.2 Valuation Rules

- Valuation method set at product category level
- Cannot change method after stock exists
- Cost updates only through proper transactions

### 9.3 Location Rules

- Every move has source and destination
- Internal locations affect balance sheet
- Virtual locations don't hold physical stock

---

## 10. Reports

### 10.1 Stock Valuation Report

| Product | Location | Qty | Unit Cost | Total Value |
|---------|----------|-----|-----------|-------------|
| BRK-PAD-001 | WH/Main | 500 | 50.00 | 25,000.00 |
| OIL-FLT-002 | WH/Main | 200 | 75.00 | 15,000.00 |
| **Total** | | | | **40,000.00** |

### 10.2 Stock Movement Report

| Date | Product | Type | Qty | From | To | Value |
|------|---------|------|-----|------|------|-------|
| 2026-02-13 | BRK-PAD-001 | OUT | -50 | WH | Customer | -2,500 |
| 2026-02-12 | BRK-PAD-001 | IN | +100 | Production | WH | +5,000 |

### 10.3 Reorder Report

| Product | Location | On Hand | Min | Max | To Order |
|---------|----------|---------|-----|-----|----------|
| BRK-PAD-001 | WH/Main | 50 | 100 | 500 | 450 |
| OIL-FLT-002 | WH/Main | 20 | 50 | 200 | 180 |

---

## 11. Implementation Phases

### Phase 1: Core Stock Tracking
- [ ] Location management
- [ ] Stock quants
- [ ] Basic stock moves (IN/OUT)
- [ ] Integration with existing Production module
- [ ] Integration with existing Challan module

### Phase 2: Valuation & Costing
- [ ] FIFO valuation
- [ ] AVCO valuation
- [ ] Valuation layers
- [ ] Accounting integration

### Phase 3: Advanced Features
- [ ] Inventory adjustments
- [ ] Internal transfers
- [ ] Lot/Serial tracking
- [ ] Reorder rules
- [ ] Barcode support

### Phase 4: Reporting
- [ ] Stock valuation report
- [ ] Movement history
- [ ] Aging analysis
- [ ] Reorder alerts

---

## 12. Integration Points

### 12.1 With Production Module

```csharp
// When Production Receipt is posted
public async Task PostProductionReceipt(...)
{
    // Create stock move: Production → Stock
    var stockMove = new StockMove
    {
        MoveType = StockMoveType.In,
        FromLocationId = productionLocationId,
        ToLocationId = stockLocationId,
        SourceType = "PRODUCTION_RECEIPT",
        SourceId = receiptId
    };

    // Update stock quant
    await UpdateStockQuant(productId, stockLocationId, qty, cost);

    // Create valuation layer (FIFO)
    await CreateValuationLayer(productId, qty, cost);
}
```

### 12.2 With Challan Module

```csharp
// When Challan is posted
public async Task PostChallan(...)
{
    foreach (var line in challan.Lines)
    {
        // Check availability
        var available = await GetAvailableQty(line.ProductId, locationId);
        if (available < line.Qty)
            throw new Exception("Insufficient stock");

        // Create stock move: Stock → Customer
        var stockMove = new StockMove
        {
            MoveType = StockMoveType.Out,
            FromLocationId = stockLocationId,
            ToLocationId = customerLocationId,
            SourceType = "CHALLAN",
            SourceId = challan.Id
        };

        // Consume FIFO layers
        var cost = await ConsumeFifoLayers(line.ProductId, line.Qty);

        // Update stock quant
        await UpdateStockQuant(line.ProductId, stockLocationId, -line.Qty, cost);
    }
}
```
