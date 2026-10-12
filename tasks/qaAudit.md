# Nhật ký kiểm thử như người dùng — 06/10/2026

> Báo cáo này ghi nhận code và runtime tại thời điểm kiểm thử. Theo `AGENTS.md`, tài liệu mới chưa phải nguồn yêu cầu nghiệp vụ được chấp thuận cho đến khi người dùng xác nhận.

## Phạm vi và cách thử

- Giao diện khách hàng `frontend/`, quản trị `admin/`, API `api/` và database hiện hành được chạy cục bộ. Các thay đổi cũ trong worktree được giữ nguyên.
- Lấy bản sao database `songthanh_qa_20261006105528` và bản sao kho tệp cho lượt kiểm tra chính; các thao tác tạo, gửi yêu cầu, nhập, xuất, lưu trữ và khôi phục chỉ tác động bản sao. Ảnh/tệp thật được copy vào bản sao trước khi khẳng định lỗi giao diện, để tránh kết luận sai do thiếu asset.
- Dùng Chromium thật qua Playwright và các script CDP. Test gồm nhấp, nhập, chọn, upload/download, điều hướng, dùng bàn phím, kiểm tra DOM/ảnh hiển thị, HTTP/API, dữ liệu đã lưu và lỗi console. Kích thước đã thử gồm điện thoại hẹp 320px, 390px, desktop và màn hình rất rộng tới 3840px tùy ca.
- Kiểm tra accessibility bằng `axe`, keyboard focus và kích thước vùng chạm; kiểm tra thông báo khi lỗi mạng, session hết quyền, bảo vệ truy cập trực tiếp bằng URL; kiểm tra file Excel/CSV mở đọc được thay vì chỉ nhìn nút tải.
- Danh mục tĩnh hiện có: 221 API endpoint, 47 route quản trị, 19 route công khai, 118 quyền và 62 bảng. Danh mục là công cụ rà phạm vi, không tự nó chứng minh đã thao tác hết từng endpoint hoặc từng tổ hợp dữ liệu.

## Mốc kết quả

| Mốc | Kết quả | Ý nghĩa |
| --- | --- | --- |
| Lần đầu trước khi copy kho tệp | 134 đạt, 22 lỗi, 16 bỏ qua / 172 ca | Không dùng để kết luận lỗi sản phẩm vì nhiều asset của dữ liệu gốc bị thiếu trong runtime QA. |
| Baseline đúng dữ liệu/tệp | 145 đạt, 17 lỗi, 26 bỏ qua / 188 ca | Điểm bắt đầu để phân tích lỗi thật và kịch bản test đã cũ. |
| Kiểm tra tĩnh biên | 21/21 đạt | Có log và báo cáo riêng. |
| Kiểm tra vòng phụ thuộc | 561 file nguồn, không có vòng phụ thuộc | Có log riêng. |
| Playwright tổng sau sửa | 189/189 đạt, 0 bỏ qua, 0 lỗi; 14,3 phút | Gồm UI thật và các ca logic trong cùng bộ Playwright. |
| Playwright route quản trị có `/admin` | 14/14 đạt | Đăng nhập, lưu, tìm kiếm, dashboard, brand/content/home/menu/settings. |
| Unit/guardrail API | 104/104 đạt | Thử logic và hàng rào API. |
| Unit quản trị và frontend | 10/10 và 8/8 đạt | Gồm kiểm tra route ẩn sau build. |
| Database integrity | 13/13 đạt | Migration, constraint, index, FK, vai trò seed và token hash trên bản sao. |
| API contract, RBAC và audit | 36/36, 22/22 và 7/7 đạt | HTTP thực, phân quyền, nhật ký. |
| File atomicity và bất biến domain | File 10/10; sản phẩm 54/54; nội dung 31/31; CRM 22/22; import 21/21 | Có tác động dữ liệu QA, kiểm tra race/boundary/lifecycle và cleanup. |
| Public UI smoke và end-user smoke | 30/30 và 16/16 đạt | Route desktop/mobile và luồng người dùng qua API + Chrome CDP. |
| Load baseline | 5/5 pha đạt | 60 request API thường, 180 tải, 160 spike, 18 frontend thường, 36 frontend tải; trên dev runtime QA. |
| Admin route smoke | 49/49 đạt | 49 route list/detail/create thực tế qua Chrome CDP. |
| Typecheck và production build | API, admin, frontend đều đạt | Build artifact hiện hành và kiểm tra type độc lập. |
| Fresh schema, backup/restore, lỗi phụ thuộc | Đạt cả hai diễn tập | Tạo rồi dọn database QA riêng; cô lập cổng lỗi 4010/3002, không ngắt runtime chính. |

Trạng thái “bỏ qua” ở baseline phần lớn do một nhóm test chạy tuần tự dừng sau assertion đầu; không mặc định coi đó là lỗi sản phẩm. [Danh sách từng ca và mã nguồn thao tác](qaCases.md) được sinh từ JSON sau lượt tổng.

Lượt rà sâu admin tiếp theo được ghi riêng trong [nhật ký admin](qaAdmin.md): thêm 8 ca thao tác trực tiếp, phát hiện/sửa 3 lỗi ở form danh mục và Kho tệp; 36/36 và 28/28 ca hồi quy liên quan đạt sau chỉnh một selector test cũ.

## Lỗi sản phẩm đã tái hiện và sửa

| Vấn đề và thao tác tái hiện | Kết quả trước sửa | Sửa trong code | Kết quả sau sửa |
| --- | --- | --- | --- |
| Khách mở menu công khai rồi chọn “Giới thiệu” trên bản sao dữ liệu đang có nội dung `/gioi-thieu` ở `pending_review`/`unpublished`. | API công khai không trả trang đó, vào trực tiếp là 404; header vẫn tự thêm link dự phòng nên khách bị dẫn tới 404. | Header chỉ render mục nằm trong menu được API quản lý khi menu đó tồn tại; bộ menu dự phòng chỉ áp dụng lúc không có menu quản lý. | Ca `publiccatalog` mới kiểm tra toàn bộ link header thuộc menu công khai; đạt. Link lỗi biến mất, URL trực tiếp vẫn 404 cho tới khi nội dung được duyệt/xuất bản. Không tự ý đổi trạng thái nội dung. |
| Dùng điện thoại và chạm các cột biểu đồ truy cập trên dashboard admin. | Cột là button chỉ rộng khoảng 9px, nhỏ hơn mục tiêu chạm 44px, khó chọn đúng ngày. | Biểu đồ giữ tối thiểu 44px mỗi cột và cuộn ngang khi không đủ chỗ. | Ca A11Y-03 đo lại vùng chạm trên dashboard mobile; đạt. |
| Dùng điện thoại chạm các link và kênh liên hệ ở footer công khai, hoặc chọn sáu khu vực nội dung admin. | Một số mục cao 40px, thấp hơn ngưỡng 44px của đợt audit. | Đổi `min-h-10` thành `min-h-11` ở các vị trí tương ứng. | Ca A11Y-03 và kiểm tra footer responsive đạt; footer không tràn ngang. |
| Mở trang dịch vụ không có ảnh công khai, kiểm tra chữ placeholder trên nền. | Tương phản đo khoảng 4,49:1, sát nhưng dưới ngưỡng 4,5:1. | Dùng màu chữ đậm hơn trong placeholder. | Kiểm tra axe của trang dịch vụ trên desktop/mobile đạt. |

Các file sửa sản phẩm: `frontend/src/components/layout/SiteHeader.tsx`, `frontend/src/components/layout/SiteFooter.tsx`, `frontend/src/features/services/ServiceDetailPage.tsx`, `admin/src/features/dashboard/DashboardPage.tsx`, `admin/src/features/website-content/page-content-studio/SystemPagesOverview.tsx`.

## Các báo đỏ ban đầu không phải lỗi sản phẩm

| Thao tác test cũ và kết quả đầu | Kiểm tra lại runtime | Điều chỉnh và xác minh |
| --- | --- | --- |
| Test mong `/gioi-thieu` luôn HTTP 200 ở mobile/wide screen. | Bản ghi hiện chưa được duyệt và chưa xuất bản; API công khai loại nó ra. | Test đọc trạng thái công khai hiện thời: trang đã xuất bản phải 200, trang ẩn phải 404. Đồng thời bổ sung ca riêng phát hiện link menu trỏ 404. |
| Test tìm tên nhãn/placeholder cũ ở trang quản trị, sản phẩm, content composer, audit, export và quote. | UI runtime đã đổi copy/DOM từ các thay đổi có sẵn trước đợt QA; thao tác vẫn thực hiện được qua nhãn/role hiện tại. | Cập nhật locator theo UI đang chạy, giữ assert trên thao tác và dữ liệu cuối. Các lượt thử riêng cho export 12/12, role 10/10, vòng đời nội dung 13/13, nhóm hành trình còn lại đã đạt. |
| Test đổi biến thể sản phẩm đòi gallery chỉ có một `<img>` tức thời. | Gallery chuyển ảnh có hai `<img>` trong giai đoạn crossfade và ảnh đang hiển thị có thuộc tính nhận diện riêng. | Chỉ kiểm tra ảnh hiện hành và thông số biến thể tương ứng; 4/4 ca product detail đạt ở lượt riêng. |
| Test bảo vệ export đòi dialog “không đủ quyền” khi token không hợp lệ. | Token không hợp lệ được đưa về trang đăng nhập, đúng đường xác thực hiện hành. | Test khẳng định redirect đăng nhập; 12/12 ca export đạt. |
| Test accessibility kiểm tra `<title>` trước khi trang Next dev hoàn tất, và Tab đầu tiên giả định luôn tới skip link. | Sau khi trang ổn định, title có nội dung; Next dev thêm portal nhận một lần Tab. | Đợi title/screen sẵn sàng và xử lý portal của dev runner. Các ca A11Y-01/A11Y-05 đạt sau chạy lại. |
| Test cho rằng Super Admin sửa nội dung đã duyệt/xuất bản luôn quay về trạng thái chờ duyệt/ẩn. | Code/API hiện cho phép Super Admin sửa nội dung đang live mà giữ trạng thái `approved/published`; editor thường khi sửa trang đã ẩn vẫn giữ ẩn. | Test kiểm tra cả bản ghi lưu và API công khai theo chính hành vi đang chạy. Không thay đổi workflow nghiệp vụ khi chưa có xác nhận. |
| Script database đòi số vai trò active bằng đúng 5 vai trò seed. | Sản phẩm cho tạo vai trò tùy chỉnh; bản sao có các vai trò QA bổ sung trong khi cả 5 vai trò seed vẫn còn. | Kiểm tra vai trò seed là tập con bắt buộc, giữ kiểm tra tổng 118 quyền; 13/13 đạt. |
| Script smoke trang admin đòi mọi breadcrumb có `data-admin-breadcrumbs`; script public click nút báo giá ngay khi DOM xuất hiện; end-user đòi nhãn cũ “Yêu cầu báo giá”. | Banner, service, project có breadcrumb riêng; giao diện Next cần hydrate trước khi handler click hoạt động; CTA hiện có nhãn tùy biến thể. | Kiểm tra breadcrumb riêng qua cấu trúc thực tế, đợi/retry click và kiểm tra CTA bằng hành động/biểu mẫu. Public 30/30, end-user 16/16, admin route 49/49 đạt. |

## Hành trình đã thao tác trực tiếp

| Vai trò/phần việc | Chuỗi thao tác kiểm tra | Kết quả lúc đầu → sau sửa/chỉnh test |
| --- | --- | --- |
| Khách xem catalog | Mở trang sản phẩm, search, category tab, lọc, pagination, gỡ filter, xem brand và chi tiết; thử 320px tới desktop rộng; chọn biến thể, ảnh gallery, tài liệu/thông số. | Một số assertion cũ không nhận DOM/crossfade hiện tại; sau cập nhật ca liên quan đạt. |
| Khách yêu cầu báo giá | Chọn sản phẩm từ card/detail, lưu nhiều sản phẩm để gửi cùng lượt, nhập số lượng, thử số mơ hồ/ngoài giới hạn, mở form, gửi, kiểm tra yêu cầu gắn đúng sản phẩm ở admin. | Các ca quote, quantity và hành trình hai phía đạt ở lượt riêng và lượt tổng 189/189. |
| Khách liên hệ | Mở widget bằng chuột/bàn phím, xem kênh liên hệ, gửi form, thử lỗi mạng rồi gửi lại; admin lọc yêu cầu mới, ghi chú, đổi trạng thái. | Form giữ dữ liệu khi mạng lỗi và ca hành trình liên hệ đạt. |
| Khách xem nội dung | Mở home, dịch vụ, dự án, brand, tin tức, trang nội dung đã xuất bản; thử trang đang ẩn/404; dùng header/footer ở mobile và desktop. | Phát hiện/sửa link menu `/gioi-thieu` và vùng chạm/độ tương phản; ca riêng đạt. |
| Admin đăng nhập và phân quyền | Sai mật khẩu, đăng nhập đúng, mở sâu URL, đổi/thu hồi quyền giữa phiên, thử token cũ, chỉ đọc/không có quyền và điều hướng mobile. | Bộ role 10/10, auth boundary và các ca route đạt ở lượt chạy riêng/tổng. |
| Admin tài khoản và vai trò | Tìm, lọc, chọn đúng một role, sửa profile, lưu ma trận quyền, thử cấm tự vô hiệu hóa và quyền hệ thống không ủy quyền. | Ca quản trị role/user qua UI đạt ở lượt riêng và lượt tổng; ma trận xác thực/phân quyền API 22/22 đạt. |
| Admin nội dung | Tạo trang theo loại, sửa block, sắp xếp/ẩn/khôi phục, preview, duyệt/xuất bản, ẩn, lưu trữ/khôi phục, thử hai phiên sửa cạnh tranh; quản lý banner và danh mục tin. | Vòng đời nội dung 13/13 đạt sau chỉnh test theo UI/runtime hiện hành. |
| Admin sản phẩm | Tạo bản nháp, gắn danh mục/brand, thêm biến thể, ảnh và tài liệu, xem cảnh báo hoàn thiện, thử chặn xuất bản khi thiếu điều kiện. | Hành trình UI và bất biến domain 54/54 đạt. |
| Admin nhập/xuất | Upload workbook, xem preview, mapping, tạo dữ liệu tạm để duyệt; chọn điều kiện xuất, tải XLSX nhiều sheet và CSV, mở đọc thật, thử không có dữ liệu/lỗi API. | 12/12 ca export đạt; import UI/hành trình đạt ở lượt riêng/tổng. |
| Admin dashboard/audit | Chọn kỳ biểu đồ, xem việc cần xử lý, mở nhật ký và lọc; thử mobile, bàn phím, quyền chỉ đọc. | Sửa cột biểu đồ 9px; A11Y-03, audit và dashboard đạt ở lượt riêng/tổng. |
| Admin cấu hình website | Sửa menu, nội dung home, brand page, cấu hình chung; lưu và kiểm tra kết quả công khai, điều hướng với base path `/admin`. | 14/14 ca full-path và 36/36 ca API contract đạt. |

Mỗi assertion, selector, dữ liệu nhập và bước chờ cụ thể nằm trong [bảng ca kiểm thử](qaCases.md) liên kết tới test source. Các bài API/invariant có báo cáo từng ca và trạng thái riêng trong `tmp/userAudit/qaReports/`.

## Bằng chứng, giới hạn và dọn môi trường

- Baseline Playwright: `tmp/userAudit/browser.log`, `tmp/userAudit/tmp/userAudit/resultsAfterStorage.json`.
- Lượt tổng sau chỉnh sửa: `tmp/userAudit/FinalMain.log`, `tmp/userAudit/tmp/userAudit/resultsFinalMain.json` (189/189); base path `/admin`: `tmp/userAudit/FullPathRetry.log`, `tmp/userAudit/tmp/userAudit/resultsFullPathRetryFullPath.json` (14/14). Các lượt chẩn đoán riêng: `ExportRetry.log`, `RolesRetry3.log`, `LifecycleFinal.log`, `ProductCtaRetry4.log`, `ContentPagesRetry2.log`, `MenuVisibility.log`, `RemainingRetry.log` trong `tmp/userAudit/`.
- Kiểm tra tĩnh: `tmp/userAudit/EdgeStatic.log`; danh mục: `tmp/userAudit/Inventory.log`; vòng phụ thuộc: `tmp/userAudit/ImportCycle.log`.
- Báo cáo API/database/smoke và diễn tập production được lưu dưới `tmp/userAudit/qaReports/`; log build/typecheck/unit dưới `tmp/userAudit/`. Thư mục `tmp/qa-artifacts/` đã được khôi phục về bộ báo cáo tồn tại trước đợt QA này.
- Các tiến trình QA trên 3000/3001/4000 đã dừng. Hai database QA đã xóa; truy vấn `pg_database` sau dọn chỉ thấy database gốc `song_thanh_cms` trong ba tên được kiểm tra.
- Hệ thống duyệt tự động chặn lệnh xóa file/thư mục tạm với thông báo `blocked by policy`. Vì vậy `tmp/userAudit/storage/` (bản sao kho tệp), `tmp/userAudit/source.dump`, `tmp/userAudit/source2.dump` (bản dump dữ liệu gốc) và `admin/.next-useraudit/`, `frontend/.next-useraudit/` vẫn còn. Các bản dump có thể chứa dữ liệu nhạy cảm; chúng chỉ nằm trên máy local và cần được dọn thủ công theo chính sách của môi trường. Không dùng các file này làm nguồn sự thật nghiệp vụ.
- Trang `/gioi-thieu` trong bản sao lúc thử đang `pending_review`/`unpublished`; vào thẳng URL trả 404 đúng theo API. Menu đã ngừng trỏ vào trang ẩn. Việc duyệt/xuất bản nội dung đó là quyết định nội dung của người dùng, chưa được thực hiện.
- Không thể khẳng định “không còn bất kỳ lỗi nào có thể xảy ra” từ hữu hạn dữ liệu và thiết bị. Các tổ hợp trình duyệt ngoài Chromium, môi trường production thực, dữ liệu tăng trưởng dài hạn và thiết bị thật chưa được quan sát; bài tải chỉ đo runtime dev local.
