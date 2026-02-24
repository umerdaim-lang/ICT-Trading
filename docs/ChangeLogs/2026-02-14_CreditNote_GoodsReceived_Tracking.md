# Credit Note Goods Received Tracking with Pending Returns Report

**Date:** 2026-02-14
**Feature:** Credit Note Goods Received Tracking
**Type:** Enhancement

## Overview

Added "Goods Received" tracking to Credit Notes so that stock movements only occur when physical goods are actually returned. Includes a "Pending Returns" report to track credit notes awaiting goods receipt.

**Workflow:**
1. Customer raises Debit Note for rejected goods
2. Create Credit Note (type: SALES_RETURN) -> POST
   - Customer credit balance updated
   - NO stock movement yet
   - Shows in "Pending Returns" report
3. When physical goods arrive:
   - Open Credit Note detail
   - Click "Mark Goods Received"
   - Stock moves to REJECTION_STORE
   - Removed from "Pending Returns" report

---

## Database Changes

### File: `DB/phase2c_credit_note_goods_received.sql`

**Action:** CREATE

**Changes:**
- Added `goods_received` (boolean, default false) column to `credit_note` table
- Added `goods_received_at` (timestamptz, nullable) column to `credit_note` table
- Added `goods_received_by` (uuid, references app_user) column to `credit_note` table
- Created partial index `idx_credit_note_goods_pending` for efficient pending returns query
- Added `CREDIT_NOTE_RECEIVE_GOODS` permission
- Assigned permission to Admin role

**SQL Script:**
```sql
ALTER TABLE credit_note
ADD COLUMN IF NOT EXISTS goods_received boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS goods_received_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS goods_received_by uuid NULL REFERENCES app_user(id);

CREATE INDEX IF NOT EXISTS idx_credit_note_goods_pending
  ON credit_note(company_id, status, goods_received, type)
  WHERE status = 'POSTED' AND goods_received = false AND type = 'SALES_RETURN';

INSERT INTO permission (id, code, description)
VALUES (gen_random_uuid(), 'CREDIT_NOTE_RECEIVE_GOODS', 'Mark credit note goods as received')
ON CONFLICT (code) DO NOTHING;
```

---

## Backend Changes

### File: `AutoPartsERP.Domain/Entities/CreditNote.cs`

**Action:** MODIFY

**Before:**
```csharp
public DateTimeOffset? CancelledAt { get; set; }
public Guid? CancelledBy { get; set; }
public string? CancelReason { get; set; }

public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
```

**After:**
```csharp
public DateTimeOffset? CancelledAt { get; set; }
public Guid? CancelledBy { get; set; }
public string? CancelReason { get; set; }

// Goods received tracking (for SALES_RETURN type)
public bool GoodsReceived { get; set; } = false;
public DateTimeOffset? GoodsReceivedAt { get; set; }
public Guid? GoodsReceivedBy { get; set; }

public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
```

---

### File: `AutoPartsERP.Infrastructure/Persistence/AppDbContext.cs`

**Action:** MODIFY

**Changes:** Added column mappings for new goods_received fields in CreditNote entity configuration.

**Added:**
```csharp
e.Property(x => x.GoodsReceived).HasColumnName("goods_received");
e.Property(x => x.GoodsReceivedAt).HasColumnName("goods_received_at");
e.Property(x => x.GoodsReceivedBy).HasColumnName("goods_received_by");
```

---

### File: `AutoPartsERP.Infrastructure/Services/CreditNoteService.cs`

**Action:** MODIFY

**Changes:**
1. Added `InventoryService` dependency to constructor
2. Added `ReceiveGoodsAsync` method

**Constructor (Before):**
```csharp
public CreditNoteService(AppDbContext db, SequenceService seq, AuditService audit)
```

**Constructor (After):**
```csharp
public CreditNoteService(AppDbContext db, SequenceService seq, InventoryService inv, AuditService audit)
```

**New Method:**
```csharp
public async Task ReceiveGoodsAsync(Guid companyId, Guid creditNoteId, Guid userId, CancellationToken ct)
{
    // Validates: credit note is POSTED, type is SALES_RETURN, not already received
    // Gets REJECTION_STORE location
    // Creates StockMove (IN) for each line with productId
    // Updates goods_received fields
    // Logs audit entry
}
```

---

### File: `AutoPartsERP.Api/Controllers/CreditNotesController.cs`

**Action:** MODIFY

**Changes:**
1. Added `GoodsReceived`, `GoodsReceivedAt`, `GoodsReceivedBy` to Get response
2. Added new endpoint `POST /api/credit-notes/{id}/receive-goods`

**New Endpoint:**
```csharp
[HttpPost("{id:guid}/receive-goods")]
[RequirePermission("CREDIT_NOTE_RECEIVE_GOODS")]
public async Task<IActionResult> ReceiveGoods(Guid id, CancellationToken ct)
```

---

### File: `AutoPartsERP.Api/Controllers/ReportsController.cs`

**Action:** MODIFY

**Changes:** Added new endpoint `GET /api/reports/pending-returns`

**New Endpoint:**
```csharp
[HttpGet("pending-returns")]
[RequirePermission("REPORT_VIEW")]
public async Task<IActionResult> PendingReturns([FromQuery] Guid? customerId, CancellationToken ct)
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "pendingCount": 5,
    "totalCreditValue": 50000.00,
    "totalQty": 100.0,
    "uniqueCustomers": 3
  },
  "data": [
    {
      "creditNoteId": "...",
      "creditNoteNo": "CN-0001",
      "creditNoteDate": "2026-02-14",
      "customerId": "...",
      "customerName": "ABC Corp",
      "invoiceId": "...",
      "invoiceNo": "INV-0123",
      "totalAmount": 10000.00,
      "lineCount": 2,
      "totalQty": 20.0,
      "daysPending": 5
    }
  ]
}
```

---

## Frontend Changes

### File: `ReactUI/app/src/types/index.ts`

**Action:** MODIFY

**Changes:**
1. Added `goodsReceived`, `goodsReceivedAt`, `goodsReceivedBy` to CreditNote interface
2. Added new `PendingReturnItem` interface

---

### File: `ReactUI/app/src/lib/api.ts`

**Action:** MODIFY

**Changes:**
1. Added `receiveGoods` method to `creditNotesApi`
2. Added `pendingReturns` method to `reportsApi`

**Added:**
```typescript
// creditNotesApi
receiveGoods: (id: string) => api.post(`/credit-notes/${id}/receive-goods`),

// reportsApi
pendingReturns: (params?: { customerId?: string }) => api.get('/reports/pending-returns', { params }),
```

---

### File: `ReactUI/app/src/pages/credit-notes/CreditNoteDetailPage.tsx`

**Action:** MODIFY

**Changes:**
1. Added `PackageCheck` and `AlertTriangle` icon imports
2. Added `receivingGoods` state
3. Added `handleReceiveGoods` function with confirmation dialog
4. Added "Goods not yet received" warning for pending SALES_RETURN credit notes
5. Added "Goods Received At" date display for received credit notes
6. Added "Mark Goods Received" button (teal color) for eligible credit notes

---

### File: `ReactUI/app/src/pages/reports/PendingReturnsReport.tsx`

**Action:** CREATE

**Features:**
- Summary cards: Pending Count, Total Credit Value, Total Qty, Customers
- Table: Credit Note, Date, Customer, Invoice, Qty, Amount, Days Pending, Action
- Days Pending color-coded: green (<7 days), yellow (7-30 days), red (>30 days)
- "Receive" button navigates to credit note detail

---

### File: `ReactUI/app/src/pages/reports/ReportsPage.tsx`

**Action:** MODIFY

**Changes:** Added "Pending Returns" card to reports grid

---

### File: `ReactUI/app/src/App.tsx`

**Action:** MODIFY

**Changes:**
1. Added `PendingReturnsReport` import
2. Added route `/reports/pending-returns`
3. Uncommented credit-notes routes

---

### File: `ReactUI/app/src/pages/index.ts`

**Action:** MODIFY

**Changes:** Added `PendingReturnsReport` export

---

## Files Summary

| File | Action |
|------|--------|
| `DB/phase2c_credit_note_goods_received.sql` | CREATE |
| `Domain/Entities/CreditNote.cs` | MODIFY |
| `Infrastructure/Persistence/AppDbContext.cs` | MODIFY |
| `Infrastructure/Services/CreditNoteService.cs` | MODIFY |
| `Api/Controllers/CreditNotesController.cs` | MODIFY |
| `Api/Controllers/ReportsController.cs` | MODIFY |
| `ReactUI/app/src/lib/api.ts` | MODIFY |
| `ReactUI/app/src/types/index.ts` | MODIFY |
| `ReactUI/app/src/pages/credit-notes/CreditNoteDetailPage.tsx` | MODIFY |
| `ReactUI/app/src/pages/reports/PendingReturnsReport.tsx` | CREATE |
| `ReactUI/app/src/pages/reports/ReportsPage.tsx` | MODIFY |
| `ReactUI/app/src/App.tsx` | MODIFY |
| `ReactUI/app/src/pages/index.ts` | MODIFY |

---

## Verification Steps

1. Run database migration script: `psql -f DB/phase2c_credit_note_goods_received.sql`
2. Restart backend API
3. Create a test SALES_RETURN credit note and post it
4. Verify credit note detail shows "Goods not yet received" warning
5. Verify "Mark Goods Received" button appears
6. Click button and confirm stock movement created in StockMoves table
7. Navigate to Reports -> Pending Returns
8. Verify pending credit notes appear with correct data
9. After marking received, verify credit note no longer appears in report

---

## API Endpoints

### Mark Goods Received
```
POST /api/credit-notes/{id}/receive-goods
Authorization: Bearer {token}
Permission: CREDIT_NOTE_RECEIVE_GOODS

Response: { "success": true }
```

### Pending Returns Report
```
GET /api/reports/pending-returns?customerId={optional}
Authorization: Bearer {token}
Permission: REPORT_VIEW

Response: {
  "success": true,
  "summary": { ... },
  "data": [ ... ]
}
```
