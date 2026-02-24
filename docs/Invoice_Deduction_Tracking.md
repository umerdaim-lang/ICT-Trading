# Invoice Deduction Tracking

## Overview

Simple system to record deductions made by customers against invoices when they send a Debit Note.

## Business Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Invoice        │ ──► │ Customer sends  │ ──► │ Record          │
│  Rs 100,000     │     │ Debit Note      │     │ Deduction       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Invoice: Rs 100,000                                            │
│  Deduction: Rs 10,000 (DN-000791)                              │
│  Net Receivable: Rs 90,000                                      │
│  Customer Pays: Rs 90,000 ✓                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. Database

```sql
-- Invoice Deduction table
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

CREATE INDEX idx_invoice_deduction_invoice ON invoice_deduction(invoice_id);
CREATE INDEX idx_invoice_deduction_company ON invoice_deduction(company_id, deduction_date DESC);
```

### 2. Backend

#### Entity
File: `AutoPartsERP.Domain/Entities/InvoiceDeduction.cs`

```csharp
public class InvoiceDeduction
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public Guid InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;

    public DateOnly DeductionDate { get; set; }
    public decimal Amount { get; set; }
    public string DebitNoteRef { get; set; } = "";  // Customer's DN number
    public string? Reason { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? CreatedBy { get; set; }
}
```

#### API Endpoints
File: `AutoPartsERP.Api/Controllers/InvoicesController.cs`

```csharp
// GET api/invoices/{id}/deductions - List deductions for an invoice
[HttpGet("{id:guid}/deductions")]
public async Task<IActionResult> GetDeductions(Guid id);

// POST api/invoices/{id}/deductions - Add a deduction
[HttpPost("{id:guid}/deductions")]
public async Task<IActionResult> AddDeduction(Guid id, [FromBody] AddDeductionRequest req);

// DELETE api/invoices/deductions/{deductionId} - Remove a deduction
[HttpDelete("deductions/{deductionId:guid}")]
public async Task<IActionResult> DeleteDeduction(Guid deductionId);
```

#### Request DTO
```csharp
public record AddDeductionRequest(
    DateOnly DeductionDate,
    decimal Amount,
    string DebitNoteRef,
    string? Reason
);
```

### 3. Frontend

#### API
File: `ReactUI/app/src/lib/api.ts`

```typescript
export const invoicesApi = {
  // ... existing methods

  getDeductions: (invoiceId: string) =>
    api.get(`/invoices/${invoiceId}/deductions`),

  addDeduction: (invoiceId: string, data: {
    deductionDate: string;
    amount: number;
    debitNoteRef: string;
    reason?: string;
  }) =>
    api.post(`/invoices/${invoiceId}/deductions`, data),

  deleteDeduction: (deductionId: string) =>
    api.delete(`/invoices/deductions/${deductionId}`),
};
```

#### UI Changes

**Invoice Details Page** - Add Deductions section:

```
┌─────────────────────────────────────────────────────────────────┐
│ Invoice #INV-000001                                    [POSTED] │
├─────────────────────────────────────────────────────────────────┤
│ Customer: ABC Company                                           │
│ Invoice Date: 2026-01-15                                        │
│ Invoice Amount: Rs 100,000.00                                   │
├─────────────────────────────────────────────────────────────────┤
│ DEDUCTIONS                                    [+ Add Deduction] │
│ ┌─────────────┬────────────────┬──────────────┬───────────────┐ │
│ │ Date        │ Debit Note #   │ Amount       │ Actions       │ │
│ ├─────────────┼────────────────┼──────────────┼───────────────┤ │
│ │ 2026-01-20  │ DN-000791      │ Rs 10,000.00 │ [Delete]      │ │
│ └─────────────┴────────────────┴──────────────┴───────────────┘ │
│                                                                 │
│ Total Deductions: Rs 10,000.00                                  │
│ Net Receivable: Rs 90,000.00                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Add Deduction Modal:**
- Deduction Date (date picker)
- Debit Note # (text input, required)
- Amount (number input, required)
- Reason (text input, optional)

---

## Invoice Balance Calculation

```
Net Receivable = Invoice Total - Total Deductions - Total Payments
```

Update invoice queries to include deduction totals.

---

## Files to Create/Modify

### New Files
- `AutoPartsERP.Domain/Entities/InvoiceDeduction.cs`
- `DB/invoice_deductions.sql`

### Modify
- `AutoPartsERP.Infrastructure/Persistence/AppDbContext.cs` - Add DbSet and mapping
- `AutoPartsERP.Api/Controllers/InvoicesController.cs` - Add deduction endpoints
- `ReactUI/app/src/lib/api.ts` - Add deduction API methods
- `ReactUI/app/src/pages/invoices/InvoiceDetailsPage.tsx` - Add deductions section

---

## Permissions

Use existing `INVOICE_EDIT_DRAFT` or create new `INVOICE_DEDUCTION` permission.

---

*Document created: 2026-02-12*
*Status: Pending Implementation*
