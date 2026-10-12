# Song Thanh API

Backend NestJS + Knex + PostgreSQL cho website và trang quản trị Song Thanh.

## Chạy cục bộ

```powershell
npm.cmd ci
Copy-Item ..\.env.example .env
npm.cmd run migrate:latest
npm.cmd run seed:run
npm.cmd run dev
```

API mặc định chạy tại `http://localhost:4000`. Hai endpoint kiểm tra sức khỏe là
`GET /health` và `GET /health/db`.

## Kiểm tra

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
```

Bộ kiểm thử tích hợp toàn hệ thống nằm trong `scripts/qa/` ở thư mục gốc.

## Dữ liệu và migration

- `migrations/` là chuỗi thay đổi schema có thứ tự.
- `seeds/` chứa dữ liệu nền và tài khoản quản trị khởi tạo.
- `database/ddl/song_thanh_deployment_schema_20260730.sql` là snapshot schema dùng
  cho diễn tập khôi phục sạch; migration mới vẫn phải được chạy sau snapshot.
- Không chạy các script `import:*` hoặc `backfill:*` với `--apply` nếu chưa sao lưu
  và kiểm tra kết quả dry-run.

## Lưu file

Đặt `FILE_STORAGE_DRIVER=local` để phát triển ngoại tuyến, hoặc `r2` cùng đầy đủ
biến môi trường R2 cho môi trường thật. Với kho ảnh cục bộ lớn, đặt
`API_STORAGE_ROOT` ngoài repository để công cụ build và tìm kiếm không quét media.
