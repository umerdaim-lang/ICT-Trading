# Change Log: Production Receipt - Product Name Display Fix

**Date**: 2025-02-13
**Issue**: Production Receipt detail page showing UUID instead of product name
**Affected Page**: Dashboard → Production → PR/2026/000010

---

## Problem Description

In the Production Receipt detail page, the Line Items table was displaying:
- **Product column**: `9f2cf65b-fa52-41fd-a701-02d5d55d0200` (UUID)
- **Expected**: Product SKU and Name (e.g., "BRK-001 - Brake Pad")

---

## Root Cause

The backend API was not including the `Product` navigation property when fetching Production Receipt data. The controller only had:
```csharp
.Include(r => r.Lines)
```

But was missing:
```csharp
.ThenInclude(l => l.Product)
```

---

## Changes Made

### Step 1: Backend Controller - Add Product Include

**File**: `AutoPartsERP/src/AutoPartsERP.Api/Controllers/ProductionReceiptsController.cs`

#### Change 1.1: List Method (Line 33-35)

**Before**:
```csharp
var q = _db.ProductionReceipts.Include(r => r.Lines).Where(r => r.CompanyId == companyId);
```

**After**:
```csharp
var q = _db.ProductionReceipts
    .Include(r => r.Lines).ThenInclude(l => l.Product)
    .Include(r => r.Lines).ThenInclude(l => l.Uom)
    .Where(r => r.CompanyId == companyId);
```

#### Change 1.2: Get Method (Line 52-54)

**Before**:
```csharp
var r = await _db.ProductionReceipts.Include(x => x.Lines).SingleOrDefaultAsync(x => x.CompanyId == companyId && x.Id == id, ct);
```

**After**:
```csharp
var r = await _db.ProductionReceipts
    .Include(x => x.Lines).ThenInclude(l => l.Product)
    .Include(x => x.Lines).ThenInclude(l => l.Uom)
    .SingleOrDefaultAsync(x => x.CompanyId == companyId && x.Id == id, ct);
```

---

### Step 2: Add Uom Navigation Property to Entity

**File**: `AutoPartsERP/src/AutoPartsERP.Domain/Entities/ProductionReceiptLine.cs`

**Before**:
```csharp
public class ProductionReceiptLine
{
    public Guid Id { get; set; }
    public Guid ReceiptId { get; set; }
    [JsonIgnore]
    public ProductionReceipt Receipt { get; set; } = default!;
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public string Description { get; set; } = "";
    public decimal Qty { get; set; }
    public Guid UomId { get; set; }
    public Guid ToLocationId { get; set; }
}
```

**After**:
```csharp
public class ProductionReceiptLine
{
    public Guid Id { get; set; }
    public Guid ReceiptId { get; set; }
    [JsonIgnore]
    public ProductionReceipt Receipt { get; set; } = default!;
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;
    public string Description { get; set; } = "";
    public decimal Qty { get; set; }
    public Guid UomId { get; set; }
    public Uom Uom { get; set; } = default!;  // <-- ADDED
    public Guid ToLocationId { get; set; }
}
```

---

### Step 3: Update Frontend to Use Line's Uom

**File**: `ReactUI/app/src/pages/production/ProductionReceiptDetailPage.tsx`

**Before** (Line 228):
```tsx
<TableCell>{line.product?.uom?.code || '-'}</TableCell>
```

**After**:
```tsx
<TableCell>{line.uom?.code || '-'}</TableCell>
```

---

### Step 4: Update TypeScript Types

**File**: `ReactUI/app/src/types/index.ts`

**Before**:
```typescript
export interface ProductionReceiptLine {
  id: string;
  productId: string;
  product?: Product;
  description: string;
  qty: number;
  uomId?: string;
  toLocationId?: string;
  remarks?: string;
}
```

**After**:
```typescript
export interface ProductionReceiptLine {
  id: string;
  productId: string;
  product?: Product;
  description: string;
  qty: number;
  uomId?: string;
  uom?: Uom;  // <-- ADDED
  toLocationId?: string;
  remarks?: string;
}
```

---

## Database Changes

**No database schema changes required** - The `Uom` navigation property uses the existing `uom_id` foreign key column.

---

## Testing Steps

1. Restart the backend API server
2. Refresh the browser
3. Navigate to: Dashboard → Production → Select any Production Receipt
4. Verify the Line Items table shows:
   - **Product**: SKU - Name (e.g., "BRK-001 - Brake Pad")
   - **UoM**: Code (e.g., "PCS", "KG")

---

## Files Modified

| File | Type | Change |
|------|------|--------|
| `ProductionReceiptsController.cs` | Backend | Added Product and Uom includes |
| `ProductionReceiptLine.cs` | Entity | Added Uom navigation property |
| `ProductionReceiptDetailPage.tsx` | Frontend | Changed to use line.uom |
| `types/index.ts` | Frontend | Added uom to interface |
