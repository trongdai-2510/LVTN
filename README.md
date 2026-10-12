# Web Song Thanh

Website giới thiệu sản phẩm, thương hiệu, dịch vụ và dự án của Song Thanh, kèm giao diện quản trị nội dung và API riêng. Đây là repository phục vụ LVTN; hành vi đang chạy và kiểm thử hiện tại là cơ sở để đối chiếu, không dùng tài liệu cũ đã bị xóa làm đặc tả.

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

Hoặc dùng `scripts\dev\start-api-admin.bat` cho API + admin, rồi chạy frontend ở terminal khác. Kiểm tra `http://localhost:4000/health`, `http://localhost:3001/admin/login` và `http://localhost:3000`.

## Kiểm tra trước khi bàn giao

Chạy `npm.cmd run typecheck` trong cả `frontend/`, `admin/`, `api/`; API có `npm.cmd run test:unit`; frontend và admin có `npm.cmd run build`. Các bài Playwright nằm ở `admin/tests/e2e/`. Cấu hình `admin/tests/readonly.config.ts` không chạy teardown của bộ E2E mặc định, nhưng trang công khai có thể ghi nhận lượt xem; dùng dữ liệu kiểm thử khi cần môi trường hoàn toàn không thay đổi.

`scripts/qa/` vẫn được nhiều lệnh smoke, kiểm tra hợp đồng API và `admin/scripts/qa-admin.mjs` sử dụng. Trước khi chạy toàn bộ `run-current-suite.ps1`, đọc từng bước vì một số bài kiểm thử cần database riêng và có thể tạo dữ liệu.

## Ghi chú nội dung

Trang công khai như `/san-pham` có route và danh mục riêng. Bản ghi “Trang nội dung” trong admin chỉ quản lý phần biên tập của trang; trạng thái xuất bản của bản ghi này không tự ẩn danh mục sản phẩm hoặc banner do module khác quản lý. Quy trình duyệt nội bộ và trạng thái hiển thị công khai là hai trạng thái riêng.
