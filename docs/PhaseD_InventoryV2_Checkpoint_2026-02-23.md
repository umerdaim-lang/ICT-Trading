# Phase D Inventory V2 Checkpoint (2026-02-23)

## Objective
Add inventory-v2 scaffolding as additive schema/services without altering existing inventory module behavior.

## Delivered (Additive)
1. Inventory-v2 entities:
   - `stock_quant`
   - `stock_valuation_layer`
   - `inventory_reservation`
   - `inventory_adjustment`
   - `inventory_adjustment_line`
2. Service scaffold:
   - `InventoryV2Service`
   - quant recalculation helper (`on_hand`, `reserved`, `available`)
3. DB script:
   - `DB/26_phaseD_inventory_v2_scaffolding.sql`

## Files Added
- `AutoPartsERP/src/AutoPartsERP.Domain/Entities/StockQuant.cs`
- `AutoPartsERP/src/AutoPartsERP.Domain/Entities/StockValuationLayer.cs`
- `AutoPartsERP/src/AutoPartsERP.Domain/Entities/InventoryReservation.cs`
- `AutoPartsERP/src/AutoPartsERP.Domain/Entities/InventoryAdjustment.cs`
- `AutoPartsERP/src/AutoPartsERP.Domain/Entities/InventoryAdjustmentLine.cs`
- `AutoPartsERP/src/AutoPartsERP.Infrastructure/Services/InventoryV2Service.cs`
- `DB/26_phaseD_inventory_v2_scaffolding.sql`

## Files Updated
- `AutoPartsERP/src/AutoPartsERP.Infrastructure/Persistence/AppDbContext.cs`
- `AutoPartsERP/src/AutoPartsERP.Api/Program.cs`
- `DB/00_DATABASE_SCRIPT_EXECUTION_SEQUENCE.md`
- `DB/00_DATABASE_SCRIPT_EXECUTION_SEQUENCE.txt`

## Rollback Note
- Non-destructive: disable v2 usage paths; keep schema additive.
