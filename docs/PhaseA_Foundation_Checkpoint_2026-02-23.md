# Phase A Foundation Checkpoint (2026-02-23)

## Objective
Implement the first additive foundation step from `docs/Phase_3_4_Module_Blueprint_No_Override.md` without disturbing existing modules.

## Scope Delivered
1. Company feature flags (all default `false`):
   - `enable_accounting_v2`
   - `enable_purchasing_v2`
   - `enable_inventory_v2`
   - `enable_outsource_v2`
2. Vendor master table:
   - new `vendor` table with unique `(company_id, vendor_code)`
   - category support (`SUPPLIER`, `SUBCONTRACTOR`, `BOTH`, `SERVICE_PROVIDER`)
3. Location extension:
   - `location_type`, `parent_location_id`, `warehouse_id`, `partner_vendor_id`, `is_virtual`, `is_active`
4. Stock movement source traceability:
   - `source_type`, `source_id`, `source_line_id` on `stock_move`
5. DB script sequencing:
   - added `DB/23_phaseA_foundation_vendor_location_stockmove.sql`
   - updated both execution sequence files.

## Files Updated
- `AutoPartsERP/src/AutoPartsERP.Domain/Entities/Company.cs`
- `AutoPartsERP/src/AutoPartsERP.Domain/Entities/Location.cs`
- `AutoPartsERP/src/AutoPartsERP.Domain/Entities/StockMove.cs`
- `AutoPartsERP/src/AutoPartsERP.Domain/Entities/Vendor.cs` (new)
- `AutoPartsERP/src/AutoPartsERP.Infrastructure/Persistence/AppDbContext.cs`
- `AutoPartsERP/src/AutoPartsERP.Api/Controllers/CompanyController.cs`
- `ReactUI/app/src/types/index.ts`
- `ReactUI/app/src/lib/api.ts`
- `ReactUI/app/src/pages/settings/CompanySettingsPage.tsx`
- `DB/23_phaseA_foundation_vendor_location_stockmove.sql` (new)
- `DB/00_DATABASE_SCRIPT_EXECUTION_SEQUENCE.md`
- `DB/00_DATABASE_SCRIPT_EXECUTION_SEQUENCE.txt`

## Execution Order Addition
- Track A: run step `23_phaseA_foundation_vendor_location_stockmove.sql` after step 22.
- Track B: run step `23_phaseA_foundation_vendor_location_stockmove.sql` after step 22.

## Rollback Note (Phase A)
If rollback is needed:
1. Disable feature flags at company level (set all new flags to false).
2. Stop writing to new columns/tables.
3. Keep schema in place (non-destructive rollback policy) and revert app usage only.

## Validation Checklist
1. Existing consumables flow still works.
2. Existing direct invoicing flow still works.
3. Company settings save does not lose existing values.
4. DB script runs idempotently on local/staging.
