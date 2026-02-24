# Change Log: Product Detail - Stock & Pricing Integration

**Date**: 2025-02-13
**Issue**: Product detail page showing placeholder text instead of actual stock and pricing data
**Affected Page**: Dashboard -> Products -> [Any Product]

---

## Problem Description

In the Product detail page, the "Stock & Pricing" section showed:
> "Stock levels and pricing information will be shown here once integrated with inventory and price list modules."

Instead of showing actual inventory on-hand and pricing information.

---

## Changes Made

### Step 1: Update Product Detail Page Imports

**File**: `ReactUI/app/src/pages/products/ProductDetailPage.tsx`

**Before** (Lines 1-11):
```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Edit, ArrowLeft, Package, UserX, UserCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loading } from '@/components/ui/Loading';
import { productsApi } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import type { Product } from '@/types';
```

**After**:
```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Edit, ArrowLeft, Package, UserX, UserCheck, Warehouse, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loading } from '@/components/ui/Loading';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/Table';
import { productsApi, inventoryApi, priceListsApi } from '@/lib/api';
import { parseApiError, formatNumber, formatDate } from '@/lib/utils';
import type { Product, InventoryOnHand, PriceList, PriceListItem } from '@/types';
```

**Changes**:
- Added `Warehouse` and `DollarSign` icons from lucide-react
- Added `Table` components for displaying data
- Added `inventoryApi` and `priceListsApi` from api.ts
- Added `formatNumber` and `formatDate` utilities
- Added `InventoryOnHand`, `PriceList`, `PriceListItem` types

---

### Step 2: Add State Variables for Inventory & Pricing

**File**: `ReactUI/app/src/pages/products/ProductDetailPage.tsx`

**Added after existing state declarations**:
```tsx
// Inventory & Pricing state
const [inventory, setInventory] = useState<InventoryOnHand[]>([]);
const [pricingItems, setPricingItems] = useState<(PriceListItem & { priceListName: string })[]>([]);
const [loadingExtras, setLoadingExtras] = useState(false);
```

---

### Step 3: Add fetchExtras Function

**File**: `ReactUI/app/src/pages/products/ProductDetailPage.tsx`

**Added new function**:
```tsx
const fetchExtras = async (productId: string) => {
  try {
    setLoadingExtras(true);

    // Fetch inventory on-hand for this product
    const invResponse = await inventoryApi.getOnHand({ productId });
    setInventory(invResponse.data.data || []);

    // Fetch all price lists and filter items for this product
    const priceListResponse = await priceListsApi.list({ active: 'true' });
    const priceLists: PriceList[] = priceListResponse.data.data || [];

    // For each price list, get items for this product
    const allPricingItems: (PriceListItem & { priceListName: string })[] = [];
    for (const pl of priceLists) {
      const detailResponse = await priceListsApi.get(pl.id);
      const detail: PriceList = detailResponse.data.data;
      const items = detail.items?.filter((item) => item.productId === productId) || [];
      items.forEach((item) => {
        allPricingItems.push({ ...item, priceListName: pl.name });
      });
    }
    setPricingItems(allPricingItems);
  } catch (err) {
    console.error('Failed to fetch extras:', err);
  } finally {
    setLoadingExtras(false);
  }
};
```

---

### Step 4: Update useEffect to Call fetchExtras

**Before**:
```tsx
useEffect(() => {
  if (id) {
    fetchProduct(id);
  }
}, [id]);
```

**After**:
```tsx
useEffect(() => {
  if (id) {
    fetchProduct(id);
    fetchExtras(id);
  }
}, [id]);
```

---

### Step 5: Replace Placeholder with Stock Levels Card

**Before**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Stock & Pricing</CardTitle>
  </CardHeader>
  <CardBody>
    <p className="text-sm text-gray-500">
      Stock levels and pricing information will be shown here once integrated with inventory and price list modules.
    </p>
  </CardBody>
</Card>
```

**After**:
```tsx
{/* Stock Levels Card */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Warehouse className="w-5 h-5" />
      Stock Levels
    </CardTitle>
  </CardHeader>
  <CardBody className="p-0">
    {loadingExtras ? (
      <div className="p-4">
        <Loading size="sm" text="Loading inventory..." />
      </div>
    ) : inventory.length === 0 ? (
      <div className="p-4">
        <p className="text-sm text-gray-500">No stock found for this product.</p>
      </div>
    ) : (
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Location</TableHeader>
            <TableHeader className="text-right">On Hand</TableHeader>
            <TableHeader>UoM</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {inventory.map((inv) => (
            <TableRow key={`${inv.locationId}-${inv.productId}`}>
              <TableCell className="font-medium">{inv.locationName}</TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(inv.onHand, 2)}
              </TableCell>
              <TableCell>{inv.uomCode}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
    {inventory.length > 0 && (
      <div className="p-3 bg-gray-50 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total On Hand</span>
          <span className="font-semibold font-mono">
            {formatNumber(inventory.reduce((sum, inv) => sum + inv.onHand, 0), 2)} {inventory[0]?.uomCode}
          </span>
        </div>
      </div>
    )}
  </CardBody>
</Card>
```

---

### Step 6: Add Pricing Card (Full Width)

**Added after the grid layout**:
```tsx
{/* Pricing Card - Full Width */}
<div className="mt-6">
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <DollarSign className="w-5 h-5" />
        Pricing
      </CardTitle>
    </CardHeader>
    <CardBody className="p-0">
      {loadingExtras ? (
        <div className="p-4">
          <Loading size="sm" text="Loading pricing..." />
        </div>
      ) : pricingItems.length === 0 ? (
        <div className="p-4">
          <p className="text-sm text-gray-500">No pricing found for this product. Add pricing from the Price Lists module.</p>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Price List</TableHeader>
              <TableHeader>UoM</TableHeader>
              <TableHeader className="text-right">Unit Price (PKR)</TableHeader>
              <TableHeader>Effective From</TableHeader>
              <TableHeader>Effective To</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {pricingItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.priceListName}</TableCell>
                <TableCell>{item.uom?.code || '-'}</TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatNumber(item.unitPricePkr, 2)}
                </TableCell>
                <TableCell>{formatDate(item.effectiveFrom)}</TableCell>
                <TableCell>{item.effectiveTo ? formatDate(item.effectiveTo) : 'Open'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardBody>
  </Card>
</div>
```

---

### Step 7: Update API for Active Parameter

**File**: `ReactUI/app/src/lib/api.ts`

**Before** (Line 455):
```typescript
list: (params?: { customerId?: string }) =>
```

**After**:
```typescript
list: (params?: { customerId?: string; active?: string }) =>
```

---

## Database Changes

**No database schema changes required** - Uses existing inventory and price list tables.

---

## Backend Status

The backend already supports all required endpoints:
- `GET /inventory/onhand?productId={id}` - Returns stock levels by location
- `GET /pricelists?active=true` - Returns active price lists
- `GET /pricelists/{id}` - Returns price list with items

No backend changes needed.

---

## Testing Steps

1. Refresh the browser
2. Navigate to: Dashboard -> Products
3. Click on any product (e.g., "Spacer Pinion")
4. Verify the page shows:
   - **Stock Levels** card with:
     - Location name
     - On Hand quantity
     - UoM code
     - Total On Hand at bottom
   - **Pricing** card with:
     - Price List name
     - UoM
     - Unit Price (PKR)
     - Effective From/To dates

---

## Files Modified

| File | Type | Change |
|------|------|--------|
| `ProductDetailPage.tsx` | Frontend | Added inventory & pricing integration |
| `api.ts` | Frontend | Added `active` parameter to priceListsApi.list |

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Product Name                                    [Back] [Edit]│
│ SKU: xxxxx                                                  │
├─────────────────────────────┬───────────────────────────────┤
│ Product Information         │ Stock Levels                  │
│ ─────────────────────────── │ ───────────────────────────── │
│ Status: Active              │ Location    | On Hand | UoM   │
│ SKU: 10030                  │ MAIN-STORE  | 100.00  | PCS   │
│ Name: Spacer Pinion         │ REJECTION   |   5.00  | PCS   │
│ UoM: PCS (Pieces)           │ ───────────────────────────── │
│ HSN Code: 8708.9910         │ Total On Hand: 105.00 PCS     │
├─────────────────────────────┴───────────────────────────────┤
│ Pricing                                                      │
│ ─────────────────────────────────────────────────────────── │
│ Price List   | UoM | Unit Price (PKR) | Effective | To      │
│ Default      | PCS |        1,500.00  | 01/01/26  | Open    │
│ Wholesale    | PCS |        1,350.00  | 01/01/26  | Open    │
└─────────────────────────────────────────────────────────────┘
```

