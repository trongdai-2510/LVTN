# Module convention

Future business ports should live under `src/modules/<domain>/`.

Each module should keep the same boundary shape unless a slice specifies otherwise:
- `<domain>.module.ts`
- `<domain>.controller.ts`
- `<domain>.service.ts`
- optional repository/data-access files that use `KnexService`
- DTOs only after the route contract is confirmed

Do not add business route placeholders before the related vertical slice is approved.
