# Change Log: Invoice Deduction Line Items with Auto Credit Note Creation

**Date:** 2026-02-14
**Phase:** 2D
**Feature:** Enhanced Invoice Deductions with Line Items and Auto Credit Note Creation

---

## Overview

Enhanced the existing Invoice Deductions system to support:
- Line items (product, qty, unit price, reason per item)
- Status workflow (DRAFT → POSTED)
- Automatic Credit Note creation when a deduction is posted

---

## Workflow After Implementation

```
1. Customer sends Debit Note (physical/email document)
        ↓
2. User creates Invoice Deduction (DRAFT)
   - Links to Invoice
   - Adds line items (product, qty, unit price per item)
   - Enters customer's Debit Note reference
        ↓
3. User posts the Deduction
        ↓
4. System AUTO-CREATES Credit Note (DRAFT)
   - Type: SALES_RETURN
   - Copies line items from Deduction
   - Links to same Invoice
   - Links Deduction to Credit Note (deduction.credit_note_id)
        ↓
5. User reviews Credit Note → Posts it
   - Customer credit balance updated
        ↓
6. When physical goods arrive:
   - Open Credit Note detail
   - Click "Mark Goods Received"
   - Stock moves to REJECTION_STORE
```

---

## Database Changes

**File:** `F:\SMEERP\AP\DB\phase2d_invoice_deduction_enhancement.sql`

### New Columns on `invoice_deduction`

| Column | Type | Description |
|--------|------|-------------|
| `status` | varchar(20) | DRAFT or POSTED (default: DRAFT) |
| `credit_note_id` | uuid | FK to credit_note table |
| `posted_at` | timestamptz | When the deduction was posted |
| `posted_by` | uuid | User who posted the deduction |

### New Table: `invoice_deduction_line`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `deduction_id` | uuid | FK to invoice_deduction |
| `invoice_line_id` | uuid | Optional FK to original invoice_line |
| `product_id` | uuid | FK to product |
| `description` | text | Line description |
| `qty` | numeric(18,3) | Quantity |
| `uom_id` | uuid | FK to uom |
| `unit_price_pkr` | numeric(18,2) | Unit price |
| `line_amount` | numeric(18,2) | Computed line amount |
| `reason` | text | Reason for this line item |
| `created_at` | timestamptz | Creation timestamp |

### New Permission

- `INVOICE_DEDUCTION_POST` - Permission to post invoice deductions (assigned to Admin role)

### Execution Order

Run `phase2d_invoice_deduction_enhancement.sql` **AFTER** `phase2b_credit_notes.sql` due to FK dependency on `credit_note` table.

---

## Backend Changes

### New Entity: `InvoiceDeductionLine.cs`

**File:** `AutoPartsERP/src/AutoPartsERP.Domain/Entities/InvoiceDeductionLine.cs`

```csharp
public class InvoiceDeductionLine
{
    public Guid Id { get; set; }
    public Guid DeductionId { get; set; }
    public InvoiceDeduction Deduction { get; set; }
    public Guid? InvoiceLineId { get; set; }
    public Guid ProductId { get; set; }
    public Product Product { get; set; }
    public string Description { get; set; }
    public decimal Qty { get; set; }
    public Guid? UomId { get; set; }
    public decimal UnitPricePkr { get; set; }
    public decimal LineAmount { get; set; }
    public string? Reason { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

### Updated Entity: `InvoiceDeduction.cs`

**File:** `AutoPartsERP/src/AutoPartsERP.Domain/Entities/InvoiceDeduction.cs`

Added properties:
- `Status` (string) - DRAFT or POSTED
- `CreditNoteId` (Guid?) - Link to auto-created credit note
- `CreditNote` (CreditNote?) - Navigation property
- `PostedAt` (DateTimeOffset?) - When posted
- `PostedBy` (Guid?) - Who posted
- `Lines` (List<InvoiceDeductionLine>) - Line items

### New Service: `InvoiceDeductionService.cs`

**File:** `AutoPartsERP/src/AutoPartsERP.Infrastructure/Services/InvoiceDeductionService.cs`

Methods:
- `CreateAsync()` - Creates draft deduction with line items
- `UpdateAsync()` - Updates draft deduction
- `PostAsync()` - Posts deduction and auto-creates draft Credit Note
- `DeleteAsync()` - Deletes draft deduction (blocks if POSTED)

### Updated Controller: `InvoicesController.cs`

**File:** `AutoPartsERP/src/AutoPartsERP.Api/Controllers/InvoicesController.cs`

#### Updated Endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| GET | `/api/invoices/{id}/deductions` | Now includes lines, status, creditNoteId |
| POST | `/api/invoices/{id}/deductions` | Now accepts `lines` array instead of `amount` |
| DELETE | `/api/invoices/deductions/{id}` | Now validates status (only DRAFT can be deleted) |

#### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices/deductions/{id}` | Get single deduction with lines |
| PUT | `/api/invoices/deductions/{id}` | Update draft deduction |
| POST | `/api/invoices/deductions/{id}/post` | Post deduction, creates Credit Note |

### Updated `AppDbContext.cs`

- Added `DbSet<InvoiceDeductionLine> InvoiceDeductionLines`
- Added entity configuration for `InvoiceDeductionLine`
- Updated `InvoiceDeduction` mapping with new columns and relationships

### Updated `Program.cs`

- Registered `InvoiceDeductionService` in DI container

---

## Frontend Changes

### Updated Types: `index.ts`

**File:** `ReactUI/app/src/types/index.ts`

Added:
```typescript
export type InvoiceDeductionStatus = 'DRAFT' | 'POSTED';

export interface InvoiceDeductionLine {
  id: string;
  deductionId: string;
  invoiceLineId?: string;
  productId: string;
  productSku?: string;
  productName?: string;
  description: string;
  qty: number;
  uomId?: string;
  unitPricePkr: number;
  lineAmount: number;
  reason?: string;
}

export interface InvoiceDeduction {
  id: string;
  invoiceId: string;
  deductionDate: string;
  debitNoteRef: string;
  reason?: string;
  amount: number;
  status: InvoiceDeductionStatus;
  creditNoteId?: string;
  creditNoteNo?: string;
  postedAt?: string;
  lineCount: number;
  lines: InvoiceDeductionLine[];
  createdAt: string;
}
```

### Updated API: `api.ts`

**File:** `ReactUI/app/src/lib/api.ts`

Added/Updated in `invoicesApi`:
- `getDeduction(deductionId)` - Get single deduction
- `addDeduction()` - Updated to accept `lines` array
- `updateDeduction(deductionId, data)` - Update draft
- `postDeduction(deductionId)` - Post deduction

### Updated Page: `InvoiceDetailPage.tsx`

**File:** `ReactUI/app/src/pages/invoices/InvoiceDetailPage.tsx`

Changes:
1. **Deductions Table:**
   - Added expand/collapse for line item details
   - Added Status badge (DRAFT/POSTED)
   - Added Items count column
   - Added Credit Note link column (for POSTED)
   - Added Post button for DRAFT deductions
   - Delete only shown for DRAFT deductions

2. **Add Deduction Modal:**
   - Now shows invoice line items to select from
   - Supports adding multiple line items
   - Each line has qty, unit price, reason
   - Auto-calculates total amount
   - Creates DRAFT deduction (user must Post separately)

---

## Files Modified/Created Summary

| File | Action |
|------|--------|
| `DB/phase2d_invoice_deduction_enhancement.sql` | CREATED |
| `DB/invoice_deductions.sql` | UPDATED (added note about Phase 2D) |
| `Domain/Entities/InvoiceDeductionLine.cs` | CREATED |
| `Domain/Entities/InvoiceDeduction.cs` | MODIFIED |
| `Infrastructure/Persistence/AppDbContext.cs` | MODIFIED |
| `Infrastructure/Services/InvoiceDeductionService.cs` | CREATED |
| `Api/Controllers/InvoicesController.cs` | MODIFIED |
| `Api/Program.cs` | MODIFIED |
| `ReactUI/app/src/types/index.ts` | MODIFIED |
| `ReactUI/app/src/lib/api.ts` | MODIFIED |
| `ReactUI/app/src/pages/invoices/InvoiceDetailPage.tsx` | MODIFIED |

---

## Verification Steps

1. Run database migration: `phase2d_invoice_deduction_enhancement.sql`
2. Restart backend API
3. Open a posted invoice
4. Click "Add Deduction"
5. Select items from invoice lines
6. Adjust quantities/prices as needed
7. Enter Debit Note reference
8. Save deduction (creates as DRAFT)
9. Click Post (green checkmark) on the deduction
10. Verify Credit Note was auto-created (DRAFT, type: SALES_RETURN)
11. Navigate to Credit Notes, find the new one
12. Post the Credit Note
13. Verify "Mark Goods Received" still works

---

## Backward Compatibility

- Existing deductions without lines are marked as POSTED with their existing amount
- The `amount` field is now computed from line totals for new deductions
- Old deductions will display but won't have expandable line details
