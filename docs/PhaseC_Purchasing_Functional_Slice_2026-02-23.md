# Phase C Purchasing Functional Slice (2026-02-23)

## Scope Implemented
Functional APIs and basic UI for PR->RFQ->PO, extended with Receipt and Vendor Bill posting baseline.

## Backend
- Added controller: `AutoPartsERP/src/AutoPartsERP.Api/Controllers/PurchasingController.cs`
  - Vendors:
    - `GET /api/purchasing/vendors`
  - Purchase Requests:
    - `GET /api/purchasing/pr`
    - `POST /api/purchasing/pr`
    - `POST /api/purchasing/pr/{id}/approve`
    - `POST /api/purchasing/pr/{id}/reject`
  - RFQ:
    - `GET /api/purchasing/rfq`
    - `POST /api/purchasing/rfq`
    - `POST /api/purchasing/rfq/{id}/send`
  - Purchase Orders:
    - `GET /api/purchasing/po`
    - `POST /api/purchasing/po`
    - `POST /api/purchasing/po/{id}/approve`
  - Receipts:
    - `GET /api/purchasing/receipts`
    - `POST /api/purchasing/receipts`
  - Vendor Bills:
    - `GET /api/purchasing/vendor-bills`
    - `POST /api/purchasing/vendor-bills`

- Added DTOs: `AutoPartsERP/src/AutoPartsERP.Api/DTOs/PurchasingDtos.cs`
- Registered purchasing permission policies in `Program.cs` (future fine-grained rollout)
- Added seed permission catalog entries in `SeedController.cs`

## Frontend
- Added workspace page:
  - `ReactUI/app/src/pages/purchasing/PurchasingWorkspacePage.tsx`
- Route wired:
  - `/purchasing` in `ReactUI/app/src/App.tsx`
- Sidebar entry added:
  - `Purchasing` in `ReactUI/app/src/components/layout/Sidebar.tsx`
- Export wired:
  - `ReactUI/app/src/pages/index.ts`
- API client methods added:
  - `purchasingApi` in `ReactUI/app/src/lib/api.ts`
- Types added:
  - purchasing types in `ReactUI/app/src/types/index.ts`

## Database/Migration Impact
- No new DB schema script in this functional slice.
- Uses previously added scaffolding scripts:
  - `25_phaseC_purchasing_core_scaffolding.sql`

## Validation
- Backend build passed (warnings only).
- Frontend build passed.
