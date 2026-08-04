# Song Thanh API

Standalone backend API runtime for Song Thanh.

## Stack

- Node.js
- TypeScript
- NestJS
- Knex
- PostgreSQL
- npm

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` when running locally and adjust PostgreSQL settings.

Required auth seed variables:

```env
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
SUPER_ADMIN_EMAIL=admin@songthanh.local
SUPER_ADMIN_PASSWORD=ChangeMe123!
SUPER_ADMIN_NAME=Super Admin
```

## Development

```bash
npm run dev
```

Default port: `4000`.

## Database setup

```bash
npm run migrate:latest
npm run seed:run
```

The seed is idempotent. It creates the base permission codes, the roles
`super_admin`, `content_admin`, `product_admin`, `sales_admin`, `viewer`, and a
Super Admin user from the `SUPER_ADMIN_*` environment variables. If the Super
Admin user already exists, the seed does not overwrite its password.

## Health endpoints

- `GET /health`
- `GET /health/db`

`/health/db` runs a lightweight PostgreSQL reachability check through Knex.

## Auth endpoints

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/change-password`

Refresh tokens are opaque random tokens. The API stores only an HMAC-SHA256
token hash in `admin_refresh_session`. Refresh tokens are not rotated in this
slice; logout and password change revoke stored sessions.

## Permission format

New API permissions use simple codes:

```txt
domain.action
domain.sub_action
```

Strapi action UIDs such as `admin::song-thanh.*` are legacy references only and
are not used by the new API guard.

## Ported business route groups

The first backend modules ported from legacy `cms/` are metadata-only and
admin-protected:

- File metadata:
  - `GET /song-thanh/files`
  - `POST /song-thanh/files`
  - `POST /song-thanh/files/upload`
  - `GET /song-thanh/files/:id`
  - `GET /song-thanh/files/:id/preview`
  - `GET /song-thanh/files/:id/download`
  - `GET /song-thanh/files/:id/usages`
  - `GET /song-thanh/file-usages/:usageId`
  - `POST /song-thanh/files/:id/archive`
  - `POST /song-thanh/files/:id/restore`
- Product Category:
  - `GET /song-thanh/product-categories`
  - `POST /song-thanh/product-categories`
  - `GET /song-thanh/product-categories/:id`
  - `PUT /song-thanh/product-categories/:id`
  - `POST /song-thanh/product-categories/:id/archive`
  - `POST /song-thanh/product-categories/:id/restore`
- Brand:
  - `GET /song-thanh/brands`
  - `POST /song-thanh/brands`
  - `GET /song-thanh/brands/:id`
  - `PUT /song-thanh/brands/:id`
  - `POST /song-thanh/brands/:id/archive`
  - `POST /song-thanh/brands/:id/restore`
- Product Group:
  - `GET /song-thanh/product-groups`
  - `POST /song-thanh/product-groups`
  - `GET /song-thanh/product-groups/:id`
  - `PUT /song-thanh/product-groups/:id`
  - `POST /song-thanh/product-groups/:id/archive`
  - `POST /song-thanh/product-groups/:id/restore`
- Product Variant:
  - `GET /song-thanh/product-variants`
  - `POST /song-thanh/product-variants`
  - `GET /song-thanh/product-variants/:id`
  - `PUT /song-thanh/product-variants/:id`
  - `POST /song-thanh/product-variants/:id/archive`
  - `POST /song-thanh/product-variants/:id/restore`
- Technical Document:
  - `GET /song-thanh/technical-documents`
  - `POST /song-thanh/technical-documents`
  - `GET /song-thanh/technical-documents/:id`
  - `PUT /song-thanh/technical-documents/:id`
  - `POST /song-thanh/technical-documents/:id/archive`
  - `POST /song-thanh/technical-documents/:id/restore`
- Service:
  - `GET /song-thanh/services`
  - `POST /song-thanh/services`
  - `GET /song-thanh/services/:id`
  - `PUT /song-thanh/services/:id`
  - `POST /song-thanh/services/:id/archive`
  - `POST /song-thanh/services/:id/restore`
  - `POST /song-thanh/services/:id/product-groups`
  - `DELETE /song-thanh/services/:id/product-groups/:productGroupId`
  - `POST /song-thanh/services/:id/product-groups/:productGroupId/restore`
- Project:
  - `GET /song-thanh/projects`
  - `POST /song-thanh/projects`
  - `GET /song-thanh/projects/:id`
  - `PUT /song-thanh/projects/:id`
  - `POST /song-thanh/projects/:id/archive`
  - `POST /song-thanh/projects/:id/restore`
  - `POST /song-thanh/projects/:id/product-groups`
  - `DELETE /song-thanh/projects/:id/product-groups/:productGroupId`
  - `POST /song-thanh/projects/:id/product-groups/:productGroupId/restore`
- Contact:
  - `GET /song-thanh/contacts`
  - `GET /song-thanh/contacts/:id`
  - `PUT /song-thanh/contacts/:id/status`
  - `PUT /song-thanh/contacts/:id/assignee`
  - `POST /song-thanh/contacts/:id/internal-notes`
- Quote:
  - `GET /song-thanh/quotes`
  - `GET /song-thanh/quotes/:id`
  - `PUT /song-thanh/quotes/:id/status`
  - `PUT /song-thanh/quotes/:id/assignee`
  - `POST /song-thanh/quotes/:id/internal-notes`
- Website Settings:
  - `GET /song-thanh/website-settings`
  - `PUT /song-thanh/website-settings`
  - `GET /song-thanh/website-settings/social-links`
  - `POST /song-thanh/website-settings/social-links`
  - `PUT /song-thanh/website-settings/social-links/:id`
  - `POST /song-thanh/website-settings/social-links/:id/archive`
  - `POST /song-thanh/website-settings/social-links/:id/restore`
- Menu:
  - `GET /song-thanh/menus`
  - `POST /song-thanh/menus`
  - `GET /song-thanh/menus/:id`
  - `PUT /song-thanh/menus/:id`
  - `POST /song-thanh/menus/:id/archive`
  - `POST /song-thanh/menus/:id/restore`
  - `POST /song-thanh/menus/:id/items`
  - `PUT /song-thanh/menu-items/:itemId`
  - `POST /song-thanh/menus/:id/items/reorder`
  - `POST /song-thanh/menu-items/:itemId/archive`
  - `POST /song-thanh/menu-items/:itemId/restore`
- Page Content:
  - `GET /song-thanh/page-contents`
  - `POST /song-thanh/page-contents`
  - `GET /song-thanh/page-contents/:id`
  - `PUT /song-thanh/page-contents/:id`
  - `POST /song-thanh/page-contents/:id/archive`
  - `POST /song-thanh/page-contents/:id/restore`
- Banner:
  - `GET /song-thanh/banners`
  - `POST /song-thanh/banners`
  - `GET /song-thanh/banners/:id`
  - `PUT /song-thanh/banners/:id`
  - `POST /song-thanh/banners/:id/archive`
  - `POST /song-thanh/banners/:id/restore`
- Redirect:
  - `GET /song-thanh/redirects`
  - `POST /song-thanh/redirects`
  - `GET /song-thanh/redirects/:id`
  - `PUT /song-thanh/redirects/:id`
  - `POST /song-thanh/redirects/:id/archive`
  - `POST /song-thanh/redirects/:id/restore`
- Audit Log:
  - `GET /song-thanh/audit-logs`
  - `GET /song-thanh/audit-logs/:id`
- Import Workspace IMP-A read model:
  - `GET /song-thanh/import-batches`
  - `GET /song-thanh/import-batches/:id`
  - `GET /song-thanh/import-batches/:id/pending-product-groups`
  - `GET /song-thanh/import-batches/:id/pending-variants`
  - `GET /song-thanh/import-batches/:id/conflicts`
  - `GET /song-thanh/import-batches/:id/readiness`

Permission codes used: `file.read`, `file.create`, `file.archive`,
`file.restore`, `product_category.read`, `product_category.create`,
`product_category.update`, `product_category.archive`,
`product_category.restore`, `brand.read`, `brand.create`, `brand.update`,
`brand.archive`, `brand.restore`, `product_group.read`,
`product_group.create`, `product_group.update`, `product_group.archive`,
`product_group.restore`, `product_variant.read`, `product_variant.create`,
`product_variant.update`, `product_variant.archive`, `product_variant.restore`.
`technical_document.read`, `technical_document.create`,
`technical_document.update`, `technical_document.archive`,
`technical_document.restore`, `service.read`, `service.create`,
`service.update`, `service.archive`, `service.restore`,
`service_product_group.update`, `project.read`, `project.create`,
`project.update`, `project.archive`, `project.restore`,
`project_product_group.update`, `contact.read`, `contact.update_status`,
`contact.assign`, `contact_note.create`, `quote.read`,
`quote.update_status`, `quote.assign`, `quote_note.create`,
`website_settings.read`, `website_settings.update`,
`website_settings_social_link.create`,
`website_settings_social_link.update`,
`website_settings_social_link.archive`,
`website_settings_social_link.restore`, `menu.read`, `menu.create`,
`menu.update`, `menu.archive`, `menu.restore`, `menu_item.create`,
`menu_item.update`, `menu_item.reorder`, `menu_item.archive`,
`menu_item.restore`, `page_content.read`, `page_content.create`,
`page_content.update`, `page_content.archive`, `page_content.restore`,
`banner.read`, `banner.create`, `banner.update`, `banner.archive`,
`banner.restore`, `redirect.read`, `redirect.create`, `redirect.update`,
`redirect.archive`, `redirect.restore`, `audit_log.read`, `import.read`,
`import.intake`, `import.taxonomy_bootstrap`, `import.review`,
`import.conflict_resolve`, `import.apply`.

File handling supports metadata intake, local binary upload, authenticated
admin image preview, and authenticated admin download for local file-library
files. R2 storage adapters and signed URLs are not implemented here.
By default local binaries live under `./storage`; for large local product-image
imports, set `API_STORAGE_ROOT` (or the more specific
`FILE_LIBRARY_STORAGE_ROOT` / `IMPORT_WORKBOOK_STORAGE_ROOT`) to a runtime
folder outside the source workspace so repository scans and editors do not walk
thousands of media files.

Product Group does not store writable price data. Its price summary is derived
from active, approved, published Product Variant rows. Stock, inventory, cart,
checkout, and payment behavior are not implemented.

Technical Document handles product-related document metadata only. Binary
upload, file picker, download URL, signed URL, public preview, OCR, and version
history are not implemented.

Service and Project route groups manage admin/API data only. Public
service/project rendering, page builder/layout JSON, booking/payment behavior,
project task management, and dashboard aggregates are not implemented. Product
group relations are stored through the schema-backed relation tables and do not
mutate Product Group records directly.

Contact and Quote route groups are admin workbench APIs only. Public forms,
email sending, CRM pipeline behavior, customer accounts, quote item mutation,
cart, checkout, payment, order, and invoice behavior are not implemented. Quote
items are read-only in this API slice.

Website Settings, Menu, Page Content, and Banner route groups manage
schema-backed content data only. Public rendering, public route resolution, page
builder/layout JSON, menu public renderer, banner carousel rendering,
analytics/tracking, custom CSS/JS settings, file picker, and binary upload are
not implemented.

Redirect route groups manage admin redirect records only. Public redirect
execution, frontend middleware, Nginx/Cloudflare sync, analytics, hit counters,
crawler testing, regex rules, wildcard rules, and bulk import are not
implemented.

Audit Log is read-only. Audit mutation routes, rollback, replay, export, and
audit writer instrumentation are not implemented in this slice.

Import Pipeline routes now include the IMP-A read model plus mutation core:
`POST /song-thanh/import-batches/intake`,
`POST /song-thanh/import-batches/:id/taxonomy-baseline-bootstrap`,
`POST /song-thanh/import-batches/:id/review-transition`,
`POST /song-thanh/import-conflicts/:id/resolve`, and
`POST /song-thanh/import-batches/:id/apply`. Intake supports local XLSX
workbooks with the legacy-style parser plus JSON/CSV regression fixtures. Actor
fields that are legacy integer references are left null from the UUID-based API
auth context.

Import regression cases are tracked in
`docs/migration/IMPORT_PIPELINE_PORT_AUDIT.md`. There is no placeholder
`test:import` command: a test command must execute the HTTP/database assertions
instead of printing a case map and returning success.

## Scope

Dashboard, public rendering, and admin UI are still not ported. The legacy
`cms/` folder remains the reference for porting existing backend behavior into
this API.
