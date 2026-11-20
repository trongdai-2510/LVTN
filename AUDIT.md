# Đánh giá hiện trạng Web Song Thanh

**Ngày rà soát:** 20/11/2026 (giờ Việt Nam)
**Mốc rà soát:** mã nguồn ngày 20/11/2026. Các nhận định về chức năng dựa trên source tại thời điểm này.
**Mục đích:** đánh giá kỹ thuật phục vụ LVTN. Đây là báo cáo kiểm kê, chưa phải đặc tả nghiệp vụ được duyệt.

## 1. Kết luận và mức độ chứng cứ

Project đã có nền tảng sản phẩm đáng kể: website công khai, admin độc lập, NestJS API, PostgreSQL, quy trình nội dung/sản phẩm, import, phân quyền, kho tệp, trợ lý ảnh/PDF cục bộ và nhiều tầng kiểm thử. Chưa thể coi là sẵn sàng bàn giao chỉ từ việc có route và test: lần rà soát này là **đọc mã nguồn**, chưa chạy ứng dụng, test, migration, quét dependency mới hoặc đối chiếu dữ liệu môi trường bàn giao. Những kết quả test ghi trong biên bản cũ chỉ đúng ở thời điểm đã ghi.

| Mức | Ý nghĩa trong báo cáo |
| --- | --- |
| **Đã triển khai trong source** | Có route, luồng xử lý và chốt kiểm tra tương ứng; chưa khẳng định chạy thành công hôm nay. |
| **Cần chỉnh** | Có lệch tài liệu/code, rủi ro logic hoặc cấu trúc cụ thể cần xử lý. |
| **Chưa xác minh** | Thiếu kết quả runtime, dữ liệu, môi trường triển khai hoặc quyết định nghiệp vụ. Không suy thành lỗi bảo mật đã xác nhận. |
| **Ngoài phạm vi hiện tại** | Không có bằng chứng là tính năng đã vận hành; không tự coi là việc bắt buộc của LVTN. |

Các con số source được đếm lại trên checkout: **19** route `page.tsx` frontend (kể cả preview), **51** route `page.tsx` admin, **29** file controller API, **56** file migration. Đây là số file/route, không phải số workflow hoàn tất. Số liệu 221 endpoint, 47 admin route và 48 migration trong báo cáo tháng 10 đã cũ; không dùng để mô tả checkout này.

## 2. Kiến trúc và công cụ

| Phần | Đã có | Cần chỉnh hoặc xác minh |
| --- | --- | --- |
| Website `frontend/` | Next.js 16, React 19, App Router; `src/app` tách route, `features` tách giao diện, `lib/api` tách gọi API; SEO metadata và JSON-LD có helper. [package](frontend/package.json), [route](frontend/src/app/page.tsx), [SEO](frontend/src/lib/seo/metadata.ts). | Đo thực tế Core Web Vitals, ảnh, cache, mobile và truy cập bàn phím trên build bàn giao. Chưa có số liệu mới. |
| Admin `admin/` | Next.js 16, React 19, base path `/admin`, màn theo module, editor Tiptap, xuất Excel/CSV, kiểm tra quyền ở UI. [package](admin/package.json), [config](admin/next.config.ts), [features](admin/src/features/). | Sửa race refresh phiên ở mục 4; test lại toàn bộ vòng đời đăng nhập trên nhiều request. |
| API `api/` | NestJS 11, Knex/PostgreSQL, DTO/validation toàn cục, response/error filter, Helmet, CORS, throttling; module được khai báo tập trung. [main](api/src/main.ts), [module](api/src/app.module.ts). | Xác minh `trustedProxies`, CORS, secrets, kho file, giới hạn request và quan sát lỗi trên cấu hình triển khai thật. |
| Dữ liệu | Migration và seed trong `api/`; snapshot schema tại [schema.sql](database/ddl/schema.sql). | Chạy migration trên DB test mới, đối chiếu snapshot với migration hiện tại, thử restore và kiểm tra ràng buộc dữ liệu. Không chạy seed/backfill trên DB đang dùng. |
| Tệp/AI cục bộ | Upload/preview/download, local hoặc R2; trợ lý xử lý ảnh/PDF/Ollama có source và test. [file controller](api/src/modules/file/file.controller.ts), [media source](api/src/modules/mediaIntake/), [launcher](api/scripts/startLocalAi.ps1). | Kiểm tra model, thời gian xử lý, lỗi OCR/PDF, giới hạn 25 MB/file và chính sách lưu/xóa trên dữ liệu giả lập. Không mặc định AI tự quyết định ghép tệp. |
| Công cụ phát triển | Lockfile riêng ba app, TypeScript strict, unit test API/frontend/admin, Playwright E2E, `scripts/qa`, `knip`. [packages](api/package.json), [Playwright](admin/playwright.config.ts). | Chưa thấy script lint chuẩn trong ba `package.json`; cần một lệnh kiểm tra định dạng/lint ổn định nếu dự định làm cổng chất lượng. Không suy rằng `knip` đã sạch khi chưa chạy. |

## 3. Từng mảng chức năng

### Website công khai

| Mảng | Đánh giá source | Bằng chứng và việc cần kiểm |
| --- | --- | --- |
| Trang chủ, thông tin công ty, menu/footer | Đã có route, cấu hình shell và nội dung lấy từ API. | [trang chủ](frontend/src/app/page.tsx), [shell](frontend/src/features/site-shell/site-shell.public.ts). Test cấu hình trống, API lỗi và thứ tự menu. |
| Sản phẩm, danh mục, biến thể, lọc/tìm kiếm | Có trang danh sách/chi tiết và helper biến thể. Các trạng thái công bố cấp nhóm/biến thể được kiểm ở API. | [route](frontend/src/app/san-pham/danh-sach/page.tsx), [biến thể](frontend/src/features/product-detail/variant-config.ts), [publish](api/src/modules/product-group/product-group.service.ts). Test SKU, sản phẩm thiếu ảnh/thông số, phân trang và tổ hợp bộ lọc. |
| Thương hiệu, đối tác, chứng nhận | Có route thương hiệu và API công khai cho đối tác/chứng nhận. | [brand route](frontend/src/app/doi-tac-thuong-hieu/page.tsx), [public controller](api/src/modules/public/public.controller.ts). Kiểm link ngoài và file logo thật. |
| Dịch vụ, dự án, tin tức, trang nội dung | Có route riêng; các trang hệ thống thường trả 404 khi bản ghi trang tương ứng không công khai. | [dịch vụ](frontend/src/app/dich-vu/page.tsx), [dự án](frontend/src/app/du-an/page.tsx), [tin](frontend/src/app/tin-tuc/page.tsx), [trang sản phẩm](frontend/src/app/san-pham/page.tsx#L39). Xác minh chủ đích ẩn route cha nhưng vẫn cho route con hoạt động. |
| Liên hệ và yêu cầu báo giá | Form công khai và endpoint POST hiện có. Đây là yêu cầu để nhân viên xử lý, không phải đơn hàng/thanh toán. | [public controller](api/src/modules/public/public.controller.ts#L218), [quote form](frontend/src/features/quote-request/QuoteRequestForm.tsx). Test spam, dữ liệu thiếu, số lượng và thông báo lỗi thực tế. |
| Preview và SEO | Có hai route preview, helper metadata, JSON-LD, sanitize rich text. | [preview](frontend/src/app/admin-preview/), [sanitize](frontend/src/lib/security/sanitize-rich-text.ts), [SEO](frontend/src/lib/seo/). Kiểm origin, noindex, quyền truy cập và ảnh khi triển khai hai domain. |

### Quản trị

| Mảng | Đánh giá source | Bằng chứng và việc cần kiểm |
| --- | --- | --- |
| Đăng nhập, người dùng, vai trò, quyền | Có session refresh, quyền API và UI; refresh token được rotate trong transaction. | [auth store](admin/src/features/auth/auth.store.ts), [rotate](api/src/modules/auth/auth.repository.ts#L169), [permission guard](api/src/common/permissions/permission.guard.ts). Sửa race mục 4, test người dùng bị khóa/đổi quyền và hết hạn phiên. |
| Sản phẩm, danh mục, thông số, tài liệu | Có workspace nhóm, biến thể, ảnh, technical document; xét duyệt và công bố là hai trạng thái khác nhau. | [product service](api/src/modules/product-group/product-group.service.ts), [variant](api/src/modules/product-variant/), [document](api/src/modules/technical-document/), [admin](admin/src/features/product-domain/). Test điều kiện công bố, sửa/xóa và khôi phục liên kết. |
| Nội dung website | Có page/news, thương hiệu, banner, menu, homepage, website settings, dịch vụ, dự án, redirect. | [modules](api/src/app.module.ts), [admin](admin/src/features/website-content/). Xác minh quyền từng thao tác và hiệu ứng public sau publish/unpublish. |
| CRM nhẹ | Có danh sách/chi tiết contact và quote, cập nhật trạng thái/người phụ trách, ghi chú, archive/restore; API cũng có route xóa vĩnh viễn quyền riêng. | [contact](api/src/modules/contact/contact.controller.ts), [quote](api/src/modules/quote/quote.controller.ts). Cần quyết định rõ ai được xóa vĩnh viễn và điều kiện giữ dữ liệu. |
| Import và export | Có batch import, đọc workbook với giới hạn kích thước/hàng/cột, transaction khi ghi; admin có xuất bảng tính. | [reader](api/src/modules/import-workspace/intake/workbook-reader.ts), [service](api/src/modules/import-workspace/import-workspace.service.ts), [export](admin/src/lib/exportFile.ts). Thử file lỗi, duplicate, bỏ dở và rollback trên DB test. |
| Tệp, trợ lý ảnh/PDF | Có file manager, media assistant, giới hạn upload; quyền quyết định ghép do quản trị thao tác. | [file controller](api/src/modules/file/file.controller.ts#L43), [UI](admin/src/features/mediaAssistant/). Kiểm tệp riêng tư/công khai, orphan file và trạng thái xử lý khi model vắng mặt. |
| Dashboard, audit trail | Có module dashboard, audit log/interceptor. | [module](api/src/app.module.ts), [audit interceptor](api/src/common/audit/audit-trail.interceptor.ts). Đối chiếu một hành động tạo/sửa/xóa giả lập với log và khả năng truy ngược chủ thể. |

## 4. Phát hiện cần xử lý

1. **Ưu tiên cao — race khi refresh phiên admin.** [auth.store.ts](admin/src/features/auth/auth.store.ts#L155) gửi refresh cho từng lời gọi và `catch` xóa phiên; [api-client.ts](admin/src/lib/api-client.ts#L71) và nhánh download ở dòng 102 đều có thể gọi song song. API tiêu thụ token cũ một lần rồi cấp token mới trong [auth.repository.ts](api/src/modules/auth/auth.repository.ts#L223). Khi nhiều request cùng 401, lời gọi thua có thể xóa phiên vừa được lời gọi thắng cập nhật. Cần single-flight theo refresh token và chỉ xóa nếu token đang giữ vẫn là token thất bại; thêm test hai request 401 đồng thời. Đây là suy luận source rõ, chưa tái hiện runtime.
2. **Ưu tiên vừa — README đã mô tả sai điều kiện ẩn trang sản phẩm.** [page.tsx](frontend/src/app/san-pham/page.tsx#L39) trả 404 nếu không lấy được page content; README cũ ghi bản ghi trang nội dung không ẩn route. README đã được sửa trong lần dọn này. Cần test lại hành vi mong muốn với chủ đề luận văn vì route con có điều kiện riêng.
3. **Ưu tiên vừa — hồ sơ kỹ thuật có nguy cơ dẫn người đọc tới số liệu cũ.** `PROJECT.md` và bản audit tháng 10 từng dẫn số route/migration ở mốc cũ. Bảng đếm mới trong mục 1 là kiểm kê source hiện tại; nên dùng script [inventory](scripts/qa/generate-system-inventory.mjs) khi chốt bản bàn giao.
4. **Ưu tiên vừa — cổng kiểm thử E2E có thao tác phá dữ liệu nếu dùng sai DB.** [playwright.config.ts](admin/playwright.config.ts#L3) chặn chạy nếu thiếu cờ xác nhận; [globalteardown.ts](admin/tests/e2e/globalteardown.ts) có script cleanup khi bật cờ. Giữ kiểm soát này, chỉ chạy trên database QA biệt lập; rà soát [cleanuptestdata.js](api/scripts/cleanuptestdata.js) trước mỗi lần bật cleanup.
5. **Ưu tiên vừa — tài liệu và mã nguồn quá lớn ở vài luồng.** [import-workspace.service.ts](api/src/modules/import-workspace/import-workspace.service.ts) có hơn 2.900 dòng, cùng trách nhiệm điều phối/validate/apply. Tách theo bước nghiệp vụ sau khi khóa test hồi quy; đây là nợ bảo trì, chưa phải lỗi chức năng được chứng minh.
6. **Chưa xác minh — bảo mật, hiệu năng và dependency trên bản triển khai.** Source có Helmet, CORS, throttling, validation, file access và sanitize, song chưa có bằng chứng trong đợt này về cấu hình proxy, storage, secret, traffic, advisory hiện tại, tải lớn hay phân quyền trên môi trường bàn giao. Không ghi “an toàn tuyệt đối” hoặc “không có lỗ hổng”.

## 5. Phần chưa hoàn thiện hoặc chưa thể kết luận

- **Quyết định nghiệp vụ:** tên/phạm vi LVTN, quyền xóa vĩnh viễn, sửa nội dung đã public, luồng xử lý sau khi nhận contact/quote và điều kiện công bố route cha/con cần người dùng xác nhận. Source hiện tại chỉ chứng minh cách xử lý đang lập trình.
- **Kiểm thử cuối:** chưa chạy `typecheck` cho cả ba app, `api test:unit`, `frontend test`, unit admin, build, E2E, smoke, migration/restore và smoke trên bản production. Các test có sẵn trong [api/tests](api/tests/), [frontend/tests](frontend/tests/) và [admin/tests](admin/tests/) không tương đương kết quả pass mới.
- **Môi trường bàn giao:** chưa kiểm tra PostgreSQL, file storage local/R2, Ollama/model, domain/CSP, reverse proxy, backup, CI/CD hay dashboard log thực tế. Không có bằng chứng source rằng các thành phần triển khai này đã vận hành ổn định.
- **Phạm vi sản phẩm:** không thấy luồng giỏ hàng, thanh toán, đơn hàng, sinh báo giá thương mại chính thức hoặc portal khách hàng trong runtime hiện tại. Không tự thêm chúng vào yêu cầu.

## 6. Việc nên làm theo thứ tự

1. Sửa race refresh phiên và test concurrent 401, tải file, logout/đổi quyền.
2. Trên môi trường QA biệt lập: cài từ lockfile, chạy typecheck/unit/build; tạo DB mới và thử migration, seed, restore; chạy smoke công khai/admin và E2E được chọn, ghi rõ pass/fail, commit, cấu hình.
3. Đối chiếu source với runtime: route ẩn/hiện, workflow duyệt vs công bố, import và file access bằng dữ liệu giả; chốt các quy tắc nghiệp vụ còn mở với người dùng.
4. Đo page load và truy cập bàn phím trên desktop/mobile; đo import và truy vấn với bộ dữ liệu gần kích thước bàn giao.
5. Chốt cấu hình triển khai, backup/restore, giám sát lỗi, CI và lịch cập nhật dependency trước khi viết kết luận LVTN.

## 7. Phương pháp và giới hạn

Rà soát dựa trên mã nguồn, cấu hình, migration và test hiện có. Chưa chạy ứng dụng, build, test hoặc thử nghiệm bảo mật trong môi trường cách ly ở lần đánh giá này. Vì vậy các nhận định chỉ phản ánh đường đi của code và rủi ro cần kiểm chứng; báo cáo không xác nhận an toàn triển khai hoặc kết quả kiểm thử mới.

Danh sách source đã đối chiếu gồm ba `package.json`, route `frontend/src/app` và `admin/src/app`, module/controller/service/DTO quan trọng trong `api/src`, migration/DDL, cấu hình Next/Playwright và các tập test/QA script. Không đọc `docs/` cũ trong Git history làm nguồn yêu cầu. Các bản thảo còn ở `docs/` và `tasks/` cần được người dùng xác nhận trước khi đưa vào khóa luận.
