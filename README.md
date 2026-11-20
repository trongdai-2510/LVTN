# Web Song Thanh

Website giới thiệu sản phẩm, thương hiệu, dịch vụ và dự án của Song Thanh, kèm giao diện quản trị nội dung và API riêng. Đây là repository phục vụ LVTN; hành vi đang chạy và kiểm thử hiện tại là cơ sở để đối chiếu, không dùng tài liệu cũ đã bị xóa làm đặc tả.

Bắt đầu từ [AUDIT.md](AUDIT.md) để xem đánh giá hiện trạng, mức độ chứng cứ và việc cần làm, rồi [PROJECT.md](PROJECT.md) để đọc bản đồ hệ thống ở mốc ghi cũ. Đây là tài liệu hiện trạng, chưa phải đặc tả nghiệp vụ được duyệt. Tài liệu trong `docs/` và `tasks/` chỉ là bản thảo hoặc biên bản theo thời điểm ghi; luôn đối chiếu lại code và runtime hiện tại.

## Mã nguồn nằm ở đâu?

| Thư mục | Vai trò | Điểm bắt đầu |
| --- | --- | --- |
| `frontend/` | Website công khai, Next.js | `frontend/src/app/` (route), `frontend/src/features/` (giao diện/nghiệp vụ) |
| `admin/` | Website quản trị, Next.js | `admin/src/app/`, `admin/src/features/` |
| `api/` | API hiện hành, NestJS + Knex | `api/src/modules/`, `api/src/main.ts` |
| `database/` | Dữ liệu/schema hỗ trợ; migration chạy từ API | `api/migrations/`, `api/seeds/` |
| `scripts/dev/` | Lệnh tiện ích chạy local | `scripts/dev/README.md` |
| `scripts/qa/` | Kiểm thử tích hợp và kiểm tra dữ liệu | `scripts/qa/run-current-suite.ps1` |

Các thư mục `.next/`, `dist/`, `node_modules/`, báo cáo Playwright và `tmp/` là đầu ra sinh tự động, không phải mã nguồn.

### Tìm code trong các module lớn

| Luồng | File bắt đầu | Phần liên quan |
| --- | --- | --- |
| Danh sách và chi tiết sản phẩm trong admin | `admin/src/features/product-domain/ProductDomainPages.tsx` | `ProductBusinessListPage.tsx`, `ProductBusinessDetailPage.tsx`, `ProductGroupWorkspace.tsx`; phần hiển thị và xử lý riêng nằm cùng thư mục |
| Menu, trang nội dung và kho tệp | `admin/src/features/website-content/WebsiteContentPages.tsx` | `MenuWorkspacePage.tsx`, `MenuDetailWorkspacePage.tsx`, `WebsiteContentListPage.tsx`, `WebsiteContentDetailPage.tsx`, `FileManagerPage.tsx` |
| Không gian import | `admin/src/features/import-workspace/ImportWorkspacePage.tsx`, `ImportDetailPage.tsx` | `ImportExportPanel.tsx`, `ImportDetailPanels.tsx`, `ImportReadinessPanels.tsx` và các file helper cùng thư mục |
| Chỉnh sửa trang thương hiệu, trang nội dung, banner | `BrandPageManager.tsx`, `PageContentEditor.tsx`, `BannerDetailPage.tsx` trong `admin/src/features/website-content/` | Các component và helper có tên cùng tiền tố trong từng thư mục |
| Bộ chọn biến thể website | `frontend/src/features/product-detail/variant-config.ts` | `variantFacts.ts`, `variantCodeHints.ts`, `variantDerivedValues.ts`, `variantGroups.ts` |
| API công khai | `api/src/modules/public/public.service.ts` | `publicFacetHelpers.ts`, `publicContentHelpers.ts`; truy vấn nằm ở `public.repository.ts` |

## Chạy trên Windows

Cần Node.js và npm, PostgreSQL đang chạy, và ba cổng local trống: API `4000`, website `3000`, admin `3001`. Phiên bản Node.js đang dùng để kiểm tra repository là 24.11.0.

1. Tạo database PostgreSQL và người dùng tương ứng. Sao chép `.env.example` thành `api/.env`, sau đó điền `DATABASE_*`, JWT secrets và tài khoản quản trị của riêng môi trường. Không đưa `api/.env` vào Git. API đọc file này từ thư mục `api/`.
2. Cài dependency riêng cho từng ứng dụng:

   ```powershell
   cd D:\WebSongThanh\api; npm.cmd ci
   cd D:\WebSongThanh\admin; npm.cmd ci
   cd D:\WebSongThanh\frontend; npm.cmd ci
   ```

3. Với **database mới**, chạy migration rồi seed theo hướng dẫn tại [API README](api/README.md). Với database đang có dữ liệu, kiểm tra migration trước khi chạy; không chạy seed/import/backfill tùy tiện.
4. Mở ba terminal riêng:

   ```powershell
   cd D:\WebSongThanh\api; npm.cmd run dev
   cd D:\WebSongThanh\admin; npm.cmd run dev
   cd D:\WebSongThanh\frontend; npm.cmd run dev
   ```

Hoặc dùng `scripts\dev\start-api-admin.bat` cho API + admin + AI cục bộ, rồi chạy frontend ở terminal khác. Nếu mở terminal riêng, chạy thêm `powershell -ExecutionPolicy Bypass -File api/scripts/startLocalAi.ps1` từ gốc repository để dùng trợ lý ảnh/PDF. AI cần model `qwen3-vl:2b-instruct` cài sẵn trên máy chạy API. Kiểm tra `http://localhost:4000/health`, `http://localhost:3001/admin/login` và `http://localhost:3000`.

## Kiểm tra trước khi bàn giao

Chạy `npm.cmd run typecheck` trong cả `frontend/`, `admin/`, `api/`; API có `npm.cmd run test:unit`; frontend và admin có `npm.cmd run build`. Các bài Playwright nằm ở `admin/tests/e2e/`. Cấu hình `admin/tests/readonly.config.ts` không chạy teardown của bộ E2E mặc định, nhưng trang công khai có thể ghi nhận lượt xem; dùng dữ liệu kiểm thử khi cần môi trường hoàn toàn không thay đổi.

`scripts/qa/` vẫn được nhiều lệnh smoke, kiểm tra hợp đồng API và `admin/scripts/qa-admin.mjs` sử dụng. Trước khi chạy toàn bộ `run-current-suite.ps1`, đọc từng bước vì một số bài kiểm thử cần database riêng và có thể tạo dữ liệu.

## Ghi chú nội dung

Route `/san-pham` hiện trả 404 khi bản ghi “Trang nội dung” tương ứng không công khai. Các route con như `/san-pham/danh-sach` và dữ liệu sản phẩm có điều kiện hiển thị riêng. Quy trình duyệt nội bộ và trạng thái hiển thị công khai là hai trạng thái riêng.
