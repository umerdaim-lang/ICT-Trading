# Phase 3 Blueprint v2: 4 Modules (No-Override, Detail-Complete)

## Goal
Build exactly these 4 new modules without disturbing existing modules:
1. Accounting Module
2. Purchasing Module
3. Inventory Management Module
4. Inventory Management for Outsource Operations

This plan is additive, test-gated, and reversible.

---

## Non-Negotiable Safety Rules
1. No destructive schema actions during rollout:
- No table drops
- No column removals
- No enum value removals
2. Additive migrations only:
- New tables, nullable columns, indexes, guarded FKs
3. Existing behavior unchanged by default:
- All new flows behind company-level feature flags
4. Backward compatibility required:
- Legacy endpoints/screens must continue to work
5. Every phase must pass:
- module tests + regression tests + migration verification
6. Never bypass sequence discipline:
- every DB change must be serial-numbered and added to execution sequence doc

---

## Canonical Shared Backbone (Across All 4 Modules)
Use one shared foundation, no duplication:
- Vendor master: `vendor`
- Location master: `location`
- Inventory ledger: `stock_move`, `stock_quant`, `stock_valuation_layer`
- Accounting ledger: `journal_entry`, `journal_entry_line`

Every stock/accounting transaction must keep source traceability:
- `source_type`
- `source_id`
- `source_line_id`

---

## Module 1: Accounting (Scope + Details)

### Functional Scope
- Chart of accounts
- Journals and journal entries
- AP/AR ledgers
- Tax ledgers and reconciliation
- Fiscal period/year close
- Bank/cash reconciliation

### Must-Have Details
1. GRNI lifecycle states (open, partial, cleared)
2. Journal balancing and locked-period posting blocks
3. Auto-reversal support for accrual entries
4. Tax split: input/output/withholding
5. Audit trail: created/posted/reversed by + timestamps + reason
6. Landed cost posting policy: expense vs capitalize

### Contract
- Other modules do not insert accounting lines directly
- All postings go through a single `AccountingPostingService`

---

## Module 2: Purchasing (Scope + Details)

### Functional Scope
- Vendor management
- PR -> RFQ -> PO lifecycle
- Goods receipt
- Vendor bill
- 3-way matching
- Landed cost allocation
- Vendor returns

### Must-Have Details
1. Approval thresholds by value/role
2. Quantity and price tolerance settings
3. Partial receipt and partial billing support
4. Duplicate bill protection (vendor invoice reference rules)
5. Vendor lead-time performance metrics
6. Variance alerts (PO vs GR vs Bill)
7. Service-only purchase lines (no stock movement)

### Accounting/Inventory Integration
- Receipt posts stock movement via stock service
- Bill clears GRNI and creates AP via posting service

---

## Module 3: Inventory Management (Scope + Details)

### Functional Scope
- Location hierarchy and virtual locations
- Stock movement ledger
- On-hand and reservations
- Transfers and adjustments
- FIFO/AVCO valuation
- Lot/serial tracking

### Must-Have Details
1. Reservation engine (reserve/release/reallocate)
2. Negative stock policy by location/category
3. Backdated posting controls with revaluation policy
4. QC hold flow (receiving -> QC -> stock/reject/scrap)
5. Adjustment governance (reason + approval)
6. In-transit transfer confirmation
7. Reorder rules with lead-time coverage
8. Month-end freeze/count controls

---

## Module 4: Inventory for Outsource Operations (Scope + Details)

### Functional Scope
- Subcontracting order lifecycle
- Material issue to vendor
- Process receipt from vendor
- Unused material return
- Process cost integration

### Must-Have Details
1. Unified vendor model (`vendor_category` = Subcontractor/Both)
2. Subcontractor virtual stock locations
3. Yield and variance controls (expected vs actual)
4. Scrap/rejection accounting treatment
5. Cost rollup:
- Material cost
- Process/service cost
- Optional landed costs
6. Critical dual UoM/billing support:
- issued quantity in PCS
- billed/processed quantity in KG
- `rate_per_kg`
- derived amount
7. Mandatory link path with Consumables Service Card:
- `service_card_id` reference
- no duplicate process data entry

---

## Permissions and Role Visibility
1. Owner/Admin:
- full financial and reporting visibility
2. Purchaser/Storekeeper:
- no invoice/credit notes/payments/price lists
- restricted reports (hide sales aging tax payment summary)
3. Route-level guards required (not sidebar-only hiding)
4. Approval permissions by amount threshold and action type

---

## Feature Flags (Company-Level)
Recommended flags:
- `enable_accounting_v2`
- `enable_purchasing_v2`
- `enable_inventory_v2`
- `enable_outsource_v2`

Default all = false.
Roll out per customer explicitly.

---

## Phase Plan (Execution + Tests)

### Phase A: Foundation
Deliver:
- vendor category/capabilities extension
- location standardization extensions
- stock movement source metadata
Tests:
- smoke test existing modules unchanged
- migration idempotency checks

### Phase B: Accounting Core
Deliver:
- posting service + journal controls
- AP/AR + tax core
Tests:
- trial balance parity
- balanced posting tests

### Phase C: Purchasing v2
Deliver:
- PR/RFQ/PO + 3-way match + landed costs
Tests:
- PO -> GR -> Bill -> Payment end-to-end
- GRNI clear behavior tests

### Phase D: Inventory v2
Deliver:
- central movement + valuation + reservation
Tests:
- on-hand and valuation parity
- FIFO/AVCO behavior tests

### Phase E: Outsource v2
Deliver:
- subcontract lifecycle + service card linkage
Tests:
- issue PCS + process KG + receive + cost rollup
- unchanged consumables legacy flow checks

---

## DB Migration Governance
1. Every schema change must be in serial-numbered DB script
2. Update both sequence files every change:
- `DB/00_DATABASE_SCRIPT_EXECUTION_SEQUENCE.md`
- `DB/00_DATABASE_SCRIPT_EXECUTION_SEQUENCE.txt`
3. Scripts must be idempotent
4. Include rollback script per risky phase
5. Run migration dry-run on staging backup before local/prod

---

## Regression Gate (Run Every Phase)
1. Existing invoice/challan/payment flows
2. Existing consumables workflows
3. Existing reports and role access
4. Login/auth/permission routes
5. Stock and accounting reconciliation parity

If any regression fails, block merge.

---

## Deliverable Checklist Per Phase
1. Code change
2. DB script(s) serial-numbered
3. Sequence docs updated
4. Test evidence captured
5. Checkpoint doc created (dated)
6. Rollback note added

No phase is complete unless all 6 are done.