# Nhật ký rà sâu giao diện admin — 06/10/2026

> Đây là bằng chứng kiểm thử code/runtime hiện tại, không phải đặc tả nghiệp vụ đã được phê duyệt. Các luồng ghi dữ liệu chạy trên database QA `songthanh_qa_20261006154712`, phục hồi từ snapshot của đợt QA trước, với kho tệp QA tách khỏi dữ liệu gốc.

## Phạm vi và kết quả

Lượt này tập trung vào các form và luồng còn cần thao tác sâu sau [báo cáo tổng](qaAudit.md). Chromium chạy với admin ở `/admin`, API local và dữ liệu QA. Mỗi ca mới nhập/chọn/nhấp trong giao diện, quan sát phản hồi, tải lại trang để kiểm tra dữ liệu đã lưu, và khi cần đối chiếu API hoặc bytes tệp tải xuống.

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| 13 màn hình ít được thao tác sâu trước đó: redirect, kho tệp, ba danh sách danh mục, banner, dịch vụ, tài liệu kỹ thuật, khách hàng, liên hệ, báo giá, import, nhật ký | 13/13 HTTP 200; không ghi nhận response 4xx/5xx ở các endpoint `/song-thanh/` và không tràn ngang ở desktop 1440px. Đây chỉ là bước thăm dò điều khiển, không thay cho kiểm thử lưu dữ liệu. | `tmp/userAudit/adminDeepInspect.json` |
| 8 ca thao tác sâu mới | 8/8 đạt; sau đó mở rộng ca Kho tệp với lưu trữ/khôi phục và chạy riêng 1/1 đạt | `tmp/userAudit/AdminDeepFinal3.log`, `AdminDeepFileLifecycle.log`; [mã ca](../admin/tests/e2e/admindeep.spec.ts) |
| Hồi quy nội dung, reference picker và product workspace | 35/36 ở lượt đầu; ca còn lại đạt khi sửa selector test bắt nhầm nút của danh mục QA mới tạo. Kết quả cuối 36/36. | `tmp/userAudit/AdminDeepRegression.log`, `AdminDeepRegressionRetry.log` |
| Hồi quy phân quyền, import, audit, accessibility và responsive | 28/28 đạt | `tmp/userAudit/AdminDeepRegression2.log` |
| Admin typecheck và production build | Đạt | Lệnh `npm.cmd run typecheck`, `npm.cmd run build` trong `admin/` |
| Unit admin | 10/10 đạt | `node --test tests/unit/*.test.mjs` trong `admin/` |

## Lỗi admin tìm thấy và sửa

| Cách tái hiện | Kết quả ban đầu | Thay đổi | Kết quả sau sửa |
| --- | --- | --- | --- |
| Ở Danh mục sản phẩm, chọn “Tạo danh mục con” hoặc mở `/admin/product-categories/new?level=sub`. | Form vẫn chọn “Danh mục cấp 1 / Lớp ông” dù URL yêu cầu cấp con; ca Playwright chờ 20 giây vẫn thấy `level_1`. Nếu admin không để ý, sẽ tạo sai cấp. | Áp preset `level=sub` cùng lúc khởi tạo form sau khi tải reference, tránh effect tải form ghi đè preset. | Form chọn `level_2` và hiện “Danh mục cấp 1 cha”. Ca tạo danh mục con, chọn cha, lưu, tải lại và kiểm tra cấp/cha/tên đều đạt. Trước: `AdminDeepCategoryBefore.log`; sau: `AdminDeepCategoryAfter2.log`, `AdminDeepCategoryCreate.log`. |
| Trong Kho tệp, chọn file `.exe`, bấm “Tải tệp lên”. | API trả 400 đúng vì định dạng bị cấm, nhưng modal hiện “Thiếu tệp — Vui lòng chọn tệp”, sai nguyên nhân. | Dùng `details.extension` từ lỗi API để hiện “Định dạng tệp chưa được hỗ trợ” và hướng dẫn chọn loại file hợp lệ. | Modal diễn giải đúng lỗi; file PNG hợp lệ tiếp tục upload được. Trước: `AdminDeepFileBefore.log`; sau: `AdminDeepFileAfter3.log`. |
| Từ chế độ “Theo nơi sử dụng” của Kho tệp, upload PNG hợp lệ. | File xuất hiện trong danh sách nhưng drawer chi tiết không mở như luồng `handleUploaded` dự kiến; nút “Tải xuống” không có. Danh sách/selection đổi trạng thái trong lúc request tải lại, làm lựa chọn vừa upload bị đóng. | Giữ ID vừa upload ở trạng thái chờ, chuyển sang “Tất cả tệp”, đặt lại lọc, tải danh sách mới rồi mới mở chi tiết khi file có mặt. | Drawer mở sau upload, tên file hiện trong tiêu đề; tải xuống cho bytes giống file gốc. Trước: `AdminDeepFileAfter.log`; sau: `AdminDeepFileAfter3.log`. |

Các sửa đổi nằm ở [ProductDomainBusinessPages.tsx](../admin/src/features/product-domain/ProductDomainBusinessPages.tsx), [admin-error-messages.ts](../admin/src/lib/admin-error-messages.ts) và [WebsiteContentPages.tsx](../admin/src/features/website-content/WebsiteContentPages.tsx).

## Tám ca sử dụng trực tiếp

| Ca | Thao tác và phép kiểm | Trạng thái trước → sau |
| --- | --- | --- |
| Redirect | Tạo trống để kiểm tra validation; nhập nguồn/đích, chọn 301 và trạng thái hoạt động, lưu; tải lại; đổi 302 và tạm ngưng, tải lại. | Chưa có lỗi sản phẩm tái hiện trong luồng này → tạo/sửa và dữ liệu sau reload đạt. |
| Phím tắt tạo danh mục | Mở form `level=main` rồi `level=sub`; kiểm tra cấp đã chọn và trường chọn cha. | `sub` chọn nhầm `level_1` → chọn `level_2`, hiện trường cha. |
| Danh mục con | Thử tạo thiếu tên/cha; nhập tên, chọn danh mục cấp 1, lưu và tải lại. | Bị ảnh hưởng bởi preset sai → validation và quan hệ cha/con sau reload đạt. |
| Khách hàng | Nhập email sai và giữ tên khi API từ chối; sửa email, tạo hồ sơ, sửa công ty, tải lại; lưu trữ mềm rồi khôi phục. | Chưa có lỗi sản phẩm tái hiện → dữ liệu và hai trạng thái vòng đời đạt. Không dùng xóa vĩnh viễn. |
| Kho tệp | Kiểm tra nút upload bị vô hiệu khi chưa chọn file; thử `.exe`; upload PNG hợp lệ; mở drawer và tải xuống, so bytes; lưu trữ mềm, lọc bản ghi đã lưu trữ, khôi phục và lọc bản ghi hoạt động. | Thông báo sai và drawer không mở → thông báo đúng, chi tiết mở, bytes tải xuống khớp; lưu trữ/khôi phục và lọc trạng thái đạt. |
| Tài liệu kỹ thuật | Thử lưu khi thiếu reference; nhập tên, chọn sản phẩm và file PDF có sẵn qua picker, lưu, tải lại. | Chưa có lỗi sản phẩm tái hiện → reference, tên và sản phẩm được giữ sau reload. |
| Banner | Thử lưu khi thiếu trường bắt buộc; nhập tên, tải ảnh PNG, giữ trạng thái nháp, lưu; tải lại và xem preview. | Chưa có lỗi sản phẩm tái hiện → ảnh, tên, trạng thái nháp và preview đạt. |
| Dịch vụ | Kiểm tra nút lưu khi form chưa đổi; nhập tên, kiểm tra slug tự sinh, lưu nháp, tải lại; gọi API công khai với slug đó. | Chưa có lỗi sản phẩm tái hiện → lưu/reload đạt và dịch vụ nháp trả 404 công khai. |

Các bước click, selector, dữ liệu và assertion chính xác nằm trong [admindeep.spec.ts](../admin/tests/e2e/admindeep.spec.ts). Hồi quy 36 ca bao gồm tạo/xuất bản/lưu trữ/khôi phục nội dung, hai phiên sửa cạnh tranh, picker 320px và workspace sản phẩm. Hồi quy 28 ca bao gồm role chỉ xem, URL sâu/API bị từ chối, import workbook và mapping, audit detail, giao diện 320px, bàn phím và accessibility. Một ca test cũ bắt regex “danh mục con” trùng tên bản ghi QA trong menu hành động; đã đổi selector sang nút cây có `aria-expanded` và chạy lại đạt, không phải lỗi sản phẩm.

Phạm vi admin trước đợt này còn có route smoke 49/49, ma trận xác thực/phân quyền API 22/22 và các ca Playwright khác trong [báo cáo tổng](qaAudit.md). Những số đó không được cộng vào 8 ca mới. Không thể từ hữu hạn dữ liệu kết luận mọi tổ hợp quyền, tệp, trình duyệt, thiết bị và production đều không còn lỗi.

Các tiến trình QA trên cổng 3000/3001/4000 đã dừng và database QA mới đã được xóa. Truy vấn sau dọn chỉ thấy database gốc `song_thanh_cms` trong hai tên được kiểm tra. Bản sao kho tệp và dump từ đợt QA trước vẫn ở `tmp/userAudit/`; thao tác xóa file/thư mục tạm từng bị hệ thống duyệt tự động từ chối với lý do `blocked by policy`, nên không thử đi đường khác để xóa. Các file này chỉ nằm cục bộ và cần dọn theo chính sách của môi trường.

## Bổ sung: bố cục Vai trò và chuyển trang admin

Lượt này dùng ảnh `/admin/roles` do người dùng cung cấp làm bằng chứng ban đầu cho bố cục. Các phép kiểm sau sửa chạy trên Chrome với API được giả lập trong Playwright, không ghi vào database đang chạy của người dùng. Máy đã có sẵn dịch vụ ở cổng 3000/3001/4000 nên không tạo hoặc dừng tiến trình đó.

| Cách thao tác | Trước sửa | Sau sửa và bằng chứng |
| --- | --- | --- |
| Mở `/admin/roles` ở desktop 1920×1080, xem từ tiêu đề đến ma trận quyền. | Ảnh ban đầu có thanh điều hướng Hệ thống lặp lại, danh sách vai trò chiếm cột hẹp bên trái, ma trận quyền bị đẩy gần cuối màn hình. | Danh sách vai trò thành các thẻ chọn trải theo chiều ngang; nút tạo ở đầu trang; chi tiết và ma trận quyền dùng toàn bộ chiều rộng. Ma trận xuất hiện trong màn hình đầu. Ca Playwright đo vùng chọn rộng hơn 1000px và vị trí đầu ma trận dưới 800px; ảnh `admin/tmp/qa-artifacts/contentownership/rolelayout-role-workspace--1f1f5-keeps-role-selection-usable/roles-desktop.png`. |
| Mở `/admin/roles` ở điện thoại 390×844, cuộn hết danh sách và phần quyền. | Bố cục cột danh sách–chi tiết phải xếp lại trên màn hình hẹp. | Thẻ vai trò xếp một cột, có thể mở phần quyền; `document.documentElement.scrollWidth <= 390`. Ảnh `admin/tmp/qa-artifacts/contentownership/rolelayout-role-workspace--9ba7d-without-horizontal-overflow/roles-phone.png`. |
| Đang ở Vai trò, nhấn Người dùng trong sidebar; giả lập `/auth/me` chờ 500ms rồi trả quyền hợp lệ. | `ProtectedRoute` thay toàn bộ `AdminShell` bằng skeleton mỗi khi pathname đổi; sidebar và topbar bị tháo rồi dựng lại, tạo nhảy bố cục. | Sau khi trang cũ đã xác minh, trong lúc chờ chỉ nội dung chính đổi thành skeleton; sidebar DOM giữ nguyên cả khi đang chờ lẫn khi trang Người dùng tải xong. Ca `rolelayout.spec.ts` kiểm tra cùng một phần tử DOM trước/sau chuyển trang. |
| Giả lập quyền phiên bị thu hồi, API xác minh lỗi, vai trò chỉ được xem và lưu ma trận quyền. | Cần giữ ranh giới xác thực và hành vi chỉnh quyền sau đổi bố cục. | 4 ca `authBoundary.spec.ts` và 3 ca `rolesWorkspace.spec.ts` đạt; lỗi xác minh vẫn khóa nội dung, quyền bị thu hồi không hiện hành động, vai trò chỉ xem không sửa được, thao tác lưu gửi đúng tập quyền. |

Tổng 10/10 ca Playwright liên quan đạt theo `tests/readonly.config.ts`; `npm run typecheck` đạt. Test mới ở [rolelayout.spec.ts](../admin/tests/e2e/rolelayout.spec.ts). Phép kiểm dùng API giả lập nên xác nhận bố cục, tương tác và trạng thái bảo vệ trong trình duyệt; không đại diện cho độ trễ mạng hay biên dịch route lần đầu của Next.js ở chế độ dev.

## Bổ sung: chi tiết Nhật ký trong ảnh người dùng

Ảnh tiếp theo cho thấy trang `/admin/audit-logs/:id` hiển thị hai khối JSON đầy đủ cạnh nhau và liệt kê `changed_fields` như thể tất cả đều đã đổi. Đối chiếu backend hiện tại cho thấy `changed_fields` gồm các khóa gửi trong request, nên có thể chứa cả giá trị không đổi. Không dùng nó làm kết luận về khác biệt thực tế.

| Thao tác kiểm thử | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở chi tiết sự kiện có nội dung HTML dài, request gửi 4 trường nhưng chỉ 3 giá trị trong snapshot khác nhau. | Trang đẩy hai JSON dài ra trước mắt; không phân biệt trường gửi lên với trường thực sự đổi. Ca `auditlayout.spec.ts` chờ tiêu đề “Thay đổi thực tế” thất bại. | Bảng “Thay đổi thực tế” hiện 3 hàng trước/sau; nội dung HTML không đổi không có trong bảng. Có nhãn dễ hiểu và mã trường gốc; snapshot JSON và danh sách trường từ request nằm trong mục “Dữ liệu gốc (kỹ thuật)” mặc định đóng. Ca sau sửa đạt. |
| So sánh hai mốc `updated_at` cách nhau 35 giây. | Định dạng ngày giờ ngắn có thể hiển thị giống nhau đến phút, che mất khác biệt. | Cột trước/sau hiển thị đến giây và mili giây; test xác nhận hai giá trị đọc được là khác nhau. |
| Từ danh sách 25 sự kiện đã cuộn xuống, nhấn “Xem” ở cuối. | Ảnh người dùng chụp ở vị trí cuộn xuống làm tiêu đề nằm ngoài khung nhìn; chưa rõ có phải lỗi khi điều hướng. | Ca tái hiện trước và sau sửa đều ghi nhận `window.scrollY = 0` khi trang chi tiết tải xong. Không đổi logic cuộn vì không tái hiện được lỗi chuyển trang; khi người dùng cuộn thủ công, tiêu đề vẫn cuộn ra khỏi màn hình như trang dài thông thường. |
| Mở chi tiết trên điện thoại 390px, thử mở và đóng snapshot kỹ thuật. | Hai JSON cạnh nhau gây khó đọc trên màn hình nhỏ. | Các trường trước/sau xếp dọc; có thể mở dữ liệu gốc khi cần, không tràn ngang. |

Thay đổi nằm ở [AuditLogDetail.tsx](../admin/src/features/system/AuditLogDetail.tsx); thanh điều hướng Hệ thống trùng sidebar cũng được bỏ khỏi danh sách Nhật ký và Người dùng. 23/23 ca Playwright đọc/giả lập liên quan đến audit, users, roles, xác thực và responsive đạt; `npm run typecheck` đạt. Ảnh sau sửa: `admin/tmp/qa-artifacts/contentownership/auditlayout-audit-detail-e-639cc-eps-raw-snapshots-secondary/auditDetail.png` và `auditPhone.png`. Dữ liệu trong ảnh kiểm thử là mẫu API giả lập; đợt này không ghi vào database đang chạy.

## Bổ sung: lỗi Vai trò 60/110 quyền trong ảnh mới

Ảnh mới của người dùng cho thấy bản sửa bố cục trước vẫn chưa dùng được: năm thẻ vai trò chiếm hai hàng, phần quyền nằm dưới khung nhìn và người dùng không cuộn tới được. Ca Playwright trước đó chỉ giả lập **một quyền** nên kết luận “ma trận xuất hiện trong màn hình đầu” ở mục trên không đại diện cho vai trò Content Admin thật có 60/110 quyền. Lần này kiểm tra đúng dữ liệu đang chạy trong Chrome trước khi phiên đăng nhập tự chuyển về `/admin/login`: Content Admin có 60 quyền đã chọn trên 10 nhóm; bấm liên kết nhảy tới ma trận làm `window.scrollY` đổi từ 0 sang 480, phần tử quyền đầu tiên nằm ở y=280 trên viewport cao 674px. Trong lần kiểm tra đó `body.style.overflow` rỗng và cuộn vùng chính hoạt động; không tái hiện được chính xác trạng thái không cuộn của ảnh chỉ từ phiên hiện tại. Hai component `Modal` và `MobileNav` có cơ chế khóa cuộn độc lập, có thể để lại giá trị `hidden` khi các lớp mở/đóng chồng nhau; đã sửa chung và kiểm thử trường hợp này.

| Thao tác | Kết quả trước sửa | Thay đổi và kết quả sau sửa |
| --- | --- | --- |
| Mở `/admin/roles`, chọn Content Admin trên viewport CSS 1536×720 (tương đương nội dung hẹp khi trình duyệt 125%), với 110 quyền và 60 quyền được gán. | Năm thẻ lớn đẩy ma trận xuống dưới; test một quyền trước đây không bắt được. | Bộ chọn vai trò thành các nút gọn; đầu trang có “Xem 60 quyền đang có ↓”; bộ lọc mặc định “Đang có (60)” và mở sẵn 10 nhóm chứa quyền. Ảnh thử lại: `admin/tmp/qa-artifacts/contentownership/rolelayout-110-permissions-21326-at-a-short-desktop-viewport/roles110Top.png`. |
| Bấm liên kết xem quyền, cuộn bằng bánh xe ở vùng nội dung. | Ảnh người dùng cho thấy không tới được danh sách quyền. | Playwright xác nhận `window.scrollY > 0`, ô quyền đầu vào viewport và bánh xe làm `scrollY` tăng thêm; thanh lưu vẫn trong viewport khi ở cuối nhóm. Ảnh ma trận: `roles110.png` cùng thư mục trên. |
| Ở bộ lọc quyền đang có, bỏ chọn một quyền. | Lần chạy thử đầu tiên sau thay bố cục: ô quyền biến mất tức thì do bộ lọc chỉ dựa trên quyền đang chọn; lệnh `uncheck()` không hoàn tất trong 60 giây. | Bộ lọc giữ quyền gốc tới khi lưu, ô vẫn hiện ở trạng thái bỏ chọn và ghi “Sẽ gỡ khi lưu”. Ca bỏ quyền đầu, thêm quyền ở nhóm thứ 11, xác nhận lưu và đối chiếu payload còn đúng 60 mã (không còn mã bị gỡ, có mã mới) đạt. API được giả lập, không đổi quyền trong database thật. |
| Mở rồi đóng hộp thoại tạo vai trò; thử cuộn lại. Mở hai khóa cuộn chồng nhau, thả theo thứ tự khác nhau. | `Modal` và `MobileNav` tự lưu/phục hồi `body.style.overflow`; thứ tự dọn khác nhau có thể giữ `hidden` dù các lớp đã đóng. | Dùng bộ đếm khóa cuộn chung; test trình duyệt xác nhận đóng modal phục hồi cuộn, unit test xác nhận chỉ khóa cuối cùng mới phục hồi giá trị `overflow` ban đầu. |

Kiểm thử cuối: 12/12 ca Playwright ở `rolelayout.spec.ts`, `rolesWorkspace.spec.ts`, `authBoundary.spec.ts` đạt; 1/1 unit `bodyScrollLock.test.mjs` đạt; `npm run typecheck` và `git diff --check` đạt. Test desktop dùng API giả lập đủ 110 quyền và không ghi dữ liệu thật. Phiên admin thật chuyển về trang đăng nhập trong lúc đối chiếu sau cùng, nên chưa xác nhận thao tác lưu với database hiện tại; bằng chứng cuộn và số quyền ở Chrome thật là phép kiểm đọc trước khi phiên hết hạn.

Ngày 07/10, chạy rộng 101 ca với `tests/readonly.config.ts`: 100 đạt, 1 ca responsive công khai timeout ở `page.goto('/gioi-thieu')` khi chờ sự kiện `load` mặc dù endpoint trả 404 nhanh. Chạy riêng lần hai tái hiện đúng timeout. Đổi đúng ca đó sang `waitUntil: 'domcontentloaded'`; các kiểm tra HTTP, nội dung và chiều rộng vẫn giữ nguyên. Chạy riêng sau sửa đạt 1/1 trong 22,7 giây. Log bộ rộng trước sửa nằm ở `tmp/userAudit/RolesRegression20261007.log`; chưa chạy lại trọn bộ 101 ca sau thay đổi điều kiện chờ này, nên không ghi 101/101.

## Bổ sung 07/10: chi tiết hoạt động dễ đọc

Người dùng phản hồi màn hình Chi tiết hoạt động vẫn lộ mã kỹ thuật. Kiểm tra giao diện hiện hành xác nhận phần đầu hiển thị `page_content`, UUID; mỗi trường có khóa như `publish_status`, và nút “Dữ liệu gốc (kỹ thuật)” mở hai snapshot JSON. Ca mới `auditlayout.spec.ts` ban đầu thất bại khi chờ câu mô tả hoạt động và nội dung HTML đã được chuyển thành chữ thường.

| Thao tác thử | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở sự kiện xuất bản trang “Danh mục sản phẩm”, có request chứa cả trường không đổi. | Mã loại dữ liệu, mã bản ghi và tên trường kỹ thuật xuất hiện trên màn hình; người đọc có thể mở hai khối JSON lớn. | Hiện câu “Super Admin đã xuất bản trang nội dung ‘Danh mục sản phẩm’”, người thực hiện, thời gian, đối tượng và hai thay đổi thật sự: trạng thái hiển thị, tiêu đề tìm kiếm. Trường không đổi và thời gian cập nhật kỹ thuật không bị liệt kê. Không có JSON hoặc UUID trong giao diện. |
| Mở sự kiện sửa bài có HTML, ảnh và `extra_blocks`. | HTML/JSON có thể xuất hiện khi xem toàn bộ giá trị. | Nội dung HTML thành văn bản thuần; tham chiếu ảnh thành “Đã chọn ảnh”; dữ liệu lồng nhau có mục “Xem chi tiết” với nhãn đọc được, không hiện thẻ HTML hay mã tệp. |
| Mở sự kiện đổi quyền vai trò. | Mảng mã như `admin_role.update` hiện trong giá trị. | Hiện “2 quyền”, có thể mở để đọc “Sửa vai trò”; không hiện mã quyền. |
| API trả snapshot sau chỉ gồm trường `title`, còn snapshot trước có `description`. | Thuật toán so sánh hợp nhất mọi khóa có thể báo sai rằng mô tả đã bị xóa. | Chỉ so sánh các khóa thật sự có trong snapshot sau; ca test xác nhận mô tả vắng mặt không bị báo là thay đổi. |
| Mở chi tiết từ danh sách đã cuộn và xem trên điện thoại 390px; kiểm tra tài khoản thiếu quyền xem nhật ký. | Cần giữ nguyên điều hướng, responsive và giới hạn quyền. | Điều hướng mở ở đầu trang, không tràn ngang, kiểm tra accessibility đạt; tài khoản thiếu quyền vẫn không tải dữ liệu nhật ký. |

Các thay đổi ở [AuditLogDetail.tsx](../admin/src/features/system/AuditLogDetail.tsx), nhãn loại dữ liệu trong [AuditLogTable.tsx](../admin/src/features/system/AuditLogTable.tsx), cùng ca Playwright ở [auditlayout.spec.ts](../admin/tests/e2e/auditlayout.spec.ts). Trước sửa 2 ca hiển thị mới thất bại; sau sửa 9/9 ca nhật ký đạt, gồm ca giữ nguyên dấu trong URL/câu văn và diễn đạt loại nội dung, trạng thái duyệt bằng tiếng Việt; `npm run typecheck` và `git diff --check` đạt. Ảnh desktop/điện thoại ở `admin/tmp/qa-artifacts/contentownership/auditlayout-audit-detail-e-9eabc-guage-without-showing-codes/`. Bản ghi thử do API giả lập cung cấp, không thay đổi database. Với tham chiếu ảnh/danh mục, snapshot hiện chỉ có ID nên giao diện mô tả quan hệ trước/sau, chưa thể hiển thị tên tệp hoặc danh mục mà không tra thêm dữ liệu.

## Bổ sung 07/10: thiết kế lại trang Tổng quan

Thử trực tiếp `/admin/dashboard` với tài khoản admin trên Chrome ở 1920×1000 và 390×844. Trang đọc API hiện hành; không tạo/sửa dữ liệu nghiệp vụ. Ảnh trước sửa: `admin/tmp/qa-artifacts/contentownership/dashboard-dashboard-traffi-2bc12-ro-days-have-no-visible-bar/dashboard1920.png` và `dashboard390.png`. Ảnh sau sửa toàn trang: `admin/tmp/qa-artifacts/contentownership/dashboard-dashboard-shows--16a60--rankings-and-mobile-layout/dashboard1920.png` và `dashboard390.png`.

| Thao tác kiểm thử | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở Tổng quan desktop, xem biểu đồ 20 ngày. | Có 20 cột hẹp trong vùng có `minWidth` theo số ngày, phải cuộn ngang; danh sách sản phẩm bên cạnh có thanh cam rất ngắn. | Biểu đồ đường và vùng màu xanh chiếm chiều ngang của trang, không cuộn ngang; năm nhãn thời gian và trục giá trị dễ đối chiếu. Sản phẩm thành bảng xếp hạng 6 hàng với thanh tỷ lệ đúng số lượt xem. |
| Mở Tổng quan trên điện thoại 390×844, cuộn đến biểu đồ và danh sách. | Bốn KPI xếp một cột, gần hết màn hình đầu mà chưa thấy phần xu hướng. | KPI xếp 2×2; biểu đồ, bảng xếp hạng và việc cần xử lý xếp một cột, không tràn ngang. Biểu đồ bắt đầu trước y=750; cả trang cuộn được. |
| Mở “Xem số liệu chi tiết”, đối chiếu từng mốc với biểu đồ. | Mỗi cột chỉ có tooltip khi rê/đặt focus; phải cuộn ngang để tìm ngày và không có bảng tổng hợp. | Bảng có đúng 20 hàng cho 20 ngày, gồm cả ngày có 0 lượt; mốc đầu khớp nhãn trên biểu đồ. Bảng cuộn bằng bàn phím và có tên vùng rõ ràng. |
| Chuyển “Theo năm”, rồi “Theo tháng”. | Bộ lọc hiện có và API trả các series theo kỳ. | Vẫn tải đúng 12 mốc theo năm và ít nhất 28 mốc theo tháng; bộ chọn năm/tháng xuất hiện theo chế độ. |
| Quét WCAG A/AA khi bảng chi tiết đang mở. | Chưa có phép kiểm riêng cho bố cục mới. | Lượt đầu phát hiện số thứ tự xếp hạng thiếu tương phản và bảng cuộn không nhận focus; đã sửa, chạy lại không còn vi phạm trong vùng nội dung chính. |

Ca [dashboard.spec.ts](../admin/tests/e2e/dashboard.spec.ts) đạt 1/1 với dữ liệu đọc từ API local và kiểm tra responsive, chế độ biểu đồ, bảng số liệu, sản phẩm, liên kết xử lý và accessibility; `npm.cmd run typecheck` đạt. Thiết kế giữ nguyên endpoint, phép tính và quyền xem hiện hành. Số liệu lượt truy cập có thể tăng khi mở website công khai trong môi trường local, nên giá trị KPI giữa hai ảnh không phải chỉ số cố định.

## Bổ sung 07/10: đích đến của công việc và tìm kiếm nhanh

| Thao tác thử | Kết quả ban đầu | Sửa và kết quả sau |
| --- | --- | --- |
| Ở Tổng quan, bấm “Bản ghi chờ duyệt”. | Số hiển thị cộng sản phẩm và trang nội dung, nhưng liên kết chỉ tới `/product-groups`; trang này bỏ qua `review_status` trong URL. Test chờ thẻ “Sản phẩm chờ duyệt” thất bại trước sửa. | Tách thành “Sản phẩm chờ duyệt” và “Trang nội dung chờ duyệt”. Sản phẩm mở danh sách với bộ lọc duyệt `pending_review` đang chọn và API nhận cùng điều kiện. Trang nội dung mở danh sách chỉ có bản ghi chờ duyệt, hiện “Đang lọc: Chờ duyệt”; nút “Bỏ lọc” trở về danh sách thông thường. |
| Bấm “Lô nhập đang xử lý”. | Liên kết `/import` mở tất cả lô, không khoanh đúng nhóm trạng thái đã được đếm. | Mở `/import?status=created,validated,in_review,ready_to_apply`; ô “Trạng thái” hiện “Đang xử lý” và API nhận chính tập trạng thái đó. |
| Gõ “sản phẩm” ở ô trên cùng rồi Enter. | Đi tới Danh mục sản phẩm vì mục này đứng trước Sản phẩm trong mảng route, dù “Sản phẩm” là khớp tên chính xác. Ca Playwright tái hiện thất bại trước sửa. | Ưu tiên tên trang khớp chính xác; Enter mở trang Sản phẩm. Bổ sung Trang chủ vào danh sách trang có thể tìm. |
| Gõ một chuỗi bất kỳ ở Tổng quan. | Menu liệt kê cả 15 mục tìm dữ liệu; Enter tự mở mục đầu tiên dù người dùng chưa chọn nơi tìm. | Chỉ hiện bốn khu vực gợi ý và nút “Xem tất cả khu vực”. Menu nói rõ phải chọn nơi tìm; Enter không tự điều hướng. Mũi tên xuống chọn mục đầu, Enter sau đó mới mở đúng mục đã chọn. |
| Gõ từ khóa khi đang ở Liên hệ; thử Ctrl+K và Escape. | Các hành động tìm trong mọi khu vực cùng hiện, không ưu tiên mục đang dùng. | Enter ưu tiên tìm trong Liên hệ và giữ từ khóa tại bộ lọc của trang. Ctrl+K đặt focus/mở menu; Escape đóng menu. |
| Đang ở Sản phẩm hoặc Trang nội dung, nhập từ khóa vào ô trên cùng rồi Enter; sau đó sửa ngay ô lọc của trang. | URL có thể đổi mà ô lọc vẫn rỗng, hoặc thao tác gõ tiếp bị trạng thái URL cũ ghi đè. Ca tái hiện thất bại ở Trang nội dung. | Trang nhận thay đổi URL từ thanh tìm kiếm và cập nhật ô lọc; gõ tiếp trong ô lọc cũng cập nhật lại URL. Ca tương tự đã thử ở cả 15 khu vực có tìm kiếm, chờ UI ổn định sau chuyển trang đều đạt. |
| Mở menu tìm kiếm và quét WCAG A/AA. | Sau lần sửa đầu, input có thuộc tính ARIA không phù hợp và nhãn nhóm trên hàng hover thiếu tương phản. | Đổi input thành combobox điều khiển dialog gợi ý, tăng tương phản; quét lại không còn vi phạm trong topbar. Các trang Người dùng/Vai trò chỉ được gợi ý khi tài khoản có quyền đọc tương ứng. |

Ca [adminsearch.spec.ts](../admin/tests/e2e/adminsearch.spec.ts) thử chuyển từ khóa tới 15 khu vực, tìm ngay trong từng khu vực, Enter, phím mũi tên, Ctrl+K, Escape và accessibility. Ca [dashboard.spec.ts](../admin/tests/e2e/dashboard.spec.ts) bấm đủ ba công việc và kiểm tra URL, bộ lọc tại trang đích, rồi bỏ lọc trang nội dung. Hai ca đạt. Hồi quy mở rộng 45/45 ca đạt, gồm xác thực, nội dung, sản phẩm và responsive; `npm.cmd run typecheck` và `git diff --check` đạt. Ảnh menu sau sửa: `admin/tmp/qa-artifacts/contentownership/adminsearch-topbar-search--50e97--each-searchable-admin-area/searchDestinations.png`. Các phép kiểm này đọc dữ liệu local hoặc dùng API giả lập, không ghi vào database.

## Bổ sung 07/10: màn hình đăng nhập quản trị, lượt đầu

Ảnh người dùng gửi cho thấy `/admin/login` ban đầu là nền sáng gần như trống, một chữ “SONG THANH” thay logo, tiêu đề/form ở giữa và khoảng trắng lớn giữa trường mật khẩu với nút đăng nhập. Đây là bằng chứng trước sửa; không suy diễn từ các tài liệu cũ.

| Thao tác kiểm thử | Kết quả ban đầu | Thay đổi và kết quả sau |
| --- | --- | --- |
| Mở trang đăng nhập ở desktop, quan sát nhận diện và bố cục. | Không thấy logo công ty, chỉ có chữ và form chung chung. | Dùng logo thật từ `/public/site-shell` (đã kiểm tra ảnh tải có `naturalWidth > 0`), bố cục hai vùng xanh đậm/sáng. Vùng thương hiệu nhắc đúng ba nhóm hiện có: nội dung, sản phẩm, khách hàng; đường nét sơ đồ điện là họa tiết trang trí. Ảnh người dùng chụp bản này ở `admin/tmp/qa-artifacts/login/previous.png`. |
| Mở ở 390×844 và 320×700, cuộn/nhập dữ liệu. | Ảnh gốc chỉ cung cấp desktop; chưa có bằng chứng mobile trước sửa. | Logo, tiêu đề, email, mật khẩu và nút đăng nhập nằm trong luồng cuộn; không tràn ngang. Bản này đã được thay thế, ảnh mobile hiện ở `mobile.png` thuộc thiết kế mới bên dưới. |
| Nhập email/mật khẩu; bấm hiện rồi ẩn mật khẩu; gửi thông tin sai. | Form có khoảng trống cố định cho lỗi ngay cả khi không lỗi. | Bỏ khoảng trống cố định. Nút đổi `password → text → password`; lỗi 401 giả lập hiện `role=alert`, trường mật khẩu có `aria-invalid=true`. |
| Đăng nhập với `returnTo` độc hại và với đường dẫn nội bộ có query. | Luồng cũ đã kiểm tra chặn chuyển hướng ngoài, cần giữ khi làm lại giao diện. | Hai ca Playwright dùng API local đạt: `//example.com` đưa về Tổng quan; đường dẫn nội bộ tới trang tạo nội dung giữ cả `?template=about`. |
| Quét WCAG A/AA trên desktop và mobile, xem lỗi JavaScript của trang. | Chưa có kết quả riêng cho giao diện mới. | Axe không báo vi phạm; không có `pageerror` trong ca kiểm thử. |

Ca [loginlayout.spec.ts](../admin/tests/e2e/loginlayout.spec.ts) lưu ảnh và kiểm tra layout, logo, thao tác form, lỗi giả lập, accessibility; đạt 1/1. Hai ca chuyển hướng nằm trong [accessibility-security-responsive.spec.ts](../admin/tests/e2e/accessibility-security-responsive.spec.ts) và đạt 2/2. Hồi quy admin/công khai gồm 106/106 ca đạt sau khi đổi giao diện. `npm.cmd run typecheck`, `npm.cmd run build` và `git diff --check` đạt. Phần đổi giao diện không thay đổi API, cách lưu phiên hoặc chính sách quyền.

## Bổ sung 07/10: thiết kế lại lần hai theo phản hồi

Người dùng mở bản đầu và phản hồi giao diện trông như sản phẩm tạo bởi AI. Ảnh `admin/tmp/qa-artifacts/login/previous.png` cho thấy nguyên nhân dễ nhận ra: nửa màn hình xanh đậm phủ lưới, vòng tròn, đường mạch trang trí và khẩu hiệu lớn; form bị tách ra bên phải. Đây là kết quả trước vòng sửa thứ hai, không phải thiết kế hiện hành.

| Thao tác | Trước sửa lần hai | Sau sửa lần hai |
| --- | --- | --- |
| Mở `/admin/login` trên Chrome 1440×900 và 1920×900. | Mảng minh họa chiếm hơn nửa màn hình, chữ thương hiệu dạng khẩu hiệu cạnh tranh với form. | Bỏ toàn bộ lưới/vòng/đường mạch/khẩu hiệu. Cổng nội bộ rộng tối đa 1080px dùng nền xanh nhạt theo website, logo đủ màu từ API và form trắng phẳng; chỉ còn thông tin thật về các khu vực đang quản lý. Ảnh người dùng chụp bản này ở `admin/tmp/qa-artifacts/login/beforePhoto.png`. |
| Xem 390×844, sau đó thử 320, 768 và 1024px. | Bản đầu có mảng thương hiệu cao làm form bắt đầu thấp trên điện thoại. | Mảng thương hiệu thu thành hàng logo gọn ở mobile; email, mật khẩu, nút đăng nhập nằm gần đầu trang. Không tràn ngang ở cả năm bề rộng đã thử. Ảnh 390px ở `admin/tmp/qa-artifacts/login/mobile.png`. |
| Đăng nhập, nhập sai mật khẩu, bật/tắt hiển thị, thử URL `returnTo` ngoài và trong ứng dụng. | Luồng xác thực đã hoạt động. | Giữ nguyên luồng; lỗi nằm sát form và được thông báo cho trình đọc màn hình. Cả chặn chuyển hướng ngoài, giữ query của đường dẫn nội bộ, mất quyền phiên cũ và nút hiện/ẩn mật khẩu đều đạt. |
| Quét accessibility và build. | Bản đầu đạt WCAG tự động nhưng phản hồi thẩm mỹ không đạt. | Axe không báo vi phạm ở desktop/mobile; không thấy `pageerror`; build production thành công. Năm ca Playwright trọng tâm đạt 5/5, gồm form, icon, chuyển hướng và phiên bị thu hồi. |

Thiết kế của lượt thứ hai nằm ở [page.tsx](../admin/src/app/login/page.tsx), [LoginForm.tsx](../admin/src/features/auth/LoginForm.tsx) và [AdminBrand.tsx](../admin/src/components/layout/AdminBrand.tsx). Lượt kiểm thử 106/106 ở mục trên thuộc thời điểm trước vòng chỉnh UI lần hai; vòng này kiểm 5 ca liên quan trực tiếp và build, không nhận 106 ca đó là đã chạy lại sau đổi giao diện.

## Bổ sung 07/10: lấp vùng trống bằng hình ảnh Song Thanh đang dùng

Ảnh `admin/tmp/qa-artifacts/login/beforePhoto.png` do người dùng gửi cho thấy mảng xanh nhạt bên trái gần như trống dù form đã gọn. Phản hồi cụ thể là giao diện đơn điệu và trống. Kiểm tra website công khai đang chạy tại `/` xác định banner “Hệ Thống Kỹ Thuật Công Trình” dùng ảnh hệ thống tủ điện từ file công khai `9d961238-536d-491c-9c9b-b0c4aff5467e`.

| Thao tác kiểm thử | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở đăng nhập ở 1920×900 và 1440×900, đối chiếu ảnh. | Nửa trái là nền nhạt ít nội dung. | Ảnh từ banner hiện có của Song Thanh chiếm dải 250px phía dưới cột thương hiệu, giữ logo và thông tin phía trên. Ảnh phiên bản này đã lưu ở `admin/tmp/qa-artifacts/login/hallVersion.png`; không tạo ảnh mới hoặc dữ liệu giả. |
| Kiểm tra request ảnh và kết quả render. | Chưa có ảnh. | File gốc 1,508,924 byte từng được lưu riêng trong admin; Next Image trả AVIF 11,491 byte trong lần kiểm thử Chrome ở 1920px, HTTP 200 và `naturalWidth > 0`. Bản sao này đã được gỡ sau khi người dùng thấy ảnh không phù hợp. |
| Xem 390px và các cỡ 320, 768, 1024px. | Bản trước không tràn ngang nhưng cột thương hiệu thiếu điểm nhìn. | Ảnh ẩn dưới breakpoint desktop để logo và form tiếp tục xuất hiện sớm trên điện thoại; không tràn ngang ở các bề rộng đã thử. |
| Thử form, quyền phiên cũ, URL quay lại, icon, accessibility và build. | Các luồng đã đạt trước khi thêm ảnh. | Năm ca trọng tâm chạy lại đạt 5/5. Ca layout kiểm ảnh thực sự tải, Axe desktop/mobile không báo vi phạm, build production đạt. |

Phiên bản này đã được thay bằng bộ ảnh danh mục bên dưới. Không thay đổi API xác thực hay dữ liệu nghiệp vụ.

## Bổ sung 07/10: thay ảnh hành lang bằng ảnh danh mục thiết bị

Người dùng phản hồi ảnh hành lang hệ thống tủ điện ở bản trước không hợp với trang đăng nhập. Ảnh trước đã lưu ở `admin/tmp/qa-artifacts/login/hallVersion.png`. Đối chiếu danh mục thiết bị trên website công khai hiện hành cho thấy ảnh “DÂY DẪN” và “THIẾT BỊ ĐIỆN” phù hợp hơn với ngành hàng và bố cục nhỏ ở cột trái.

| Thao tác kiểm thử | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở `/admin/login` ở 1920×900, xem dải ảnh ở cột thương hiệu. | Một ảnh hành lang tủ điện trải kín chiều ngang, người dùng nhận xét không phù hợp. | Thay bằng hai ảnh danh mục dây dẫn và thiết bị điện đặt cạnh nhau, kèm nhãn rõ ràng. Hai ảnh lấy từ file công khai `4c6cbbb4-a290-4586-91ed-def9535c7f6a` và `91090465-77a1-4b42-8a82-c15f0cfc49ee`; file hành lang bị loại khỏi `admin/public`. Ảnh người dùng gửi về bản này được lưu thành `admin/tmp/qa-artifacts/login/productTiles.png`. |
| Kiểm request ảnh trên Chrome. | File hành lang gốc 1.5 MB. | Hai file gốc lần lượt 17,783 và 16,181 byte; ảnh tối ưu AVIF ở lần thử trả HTTP 200 với 1,278 và 2,408 byte, cả hai có `naturalWidth > 0`. |
| Xem mobile và thao tác form. | Ảnh hành lang đã ẩn ở mobile. | Ảnh danh mục vẫn ẩn dưới breakpoint desktop, không đẩy form xuống. Ca layout quét Axe desktop/mobile, kiểm 320/390/768/1024/1440px, lỗi giả lập và nút hiện/ẩn mật khẩu đạt. |
| Chạy hồi quy đăng nhập và build. | Các luồng đã đạt ở phiên bản trước. | Năm ca trọng tâm đạt 5/5: chặn URL quay lại bên ngoài, giữ query đường dẫn nội bộ, icon, phiên bị thu hồi và giao diện đăng nhập. Build production đạt. |

Đây là kết quả của vòng thử ảnh danh mục, không phải thiết kế hiện hành. Người dùng đánh giá hai ô ảnh sản phẩm quá nhỏ và thiếu chất lượng; ảnh trước khi sửa tiếp được giữ ở `admin/tmp/qa-artifacts/login/productTiles.png`. Hai bản sao ảnh trong `admin/public/assets/login/` đã được gỡ khỏi giao diện và xóa.

## Bổ sung 07/10: thay ô ảnh bằng bố cục thương hiệu và khu vực làm việc

Người dùng phản hồi bản hai ô ảnh sản phẩm trông yếu và muốn thử hướng khác. Đã bỏ toàn bộ ảnh minh họa khỏi màn hình đăng nhập. Bố cục mới phủ toàn chiều cao: mảng xanh thương hiệu với logo thật và ba nhóm chức năng đang có của admin; phần trắng tập trung vào form. Các nhóm ở cột trái là thông tin mô tả, không giả làm liên kết hay bổ sung quyền mới.

| Thao tác kiểm thử | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở `/admin/login` ở 1920×900 và 1440×900. | Khung nhỏ trên nền nhạt, cột trái trống phía trên và hai ảnh danh mục nhỏ ở chân, như ảnh `productTiles.png`. | Mảng xanh chạy hết chiều cao và chiếm gần nửa màn hình; ba nhóm Nội dung website, Sản phẩm, Khách hàng & yêu cầu có phân cấp và đường chia rõ. Form đứng độc lập trên nền trắng. Ảnh kiểm ở thời điểm này đã được thay thế bởi ảnh vòng sau. |
| Mở ở 390×844, rồi thử 320, 768 và 1024px. | Hai ảnh chỉ xuất hiện ở desktop. | Cột xanh rút thành phần đầu có logo trên điện thoại, các nhóm mô tả được ẩn; email, mật khẩu, nút đăng nhập đều nhìn thấy và không tràn ngang. Ảnh sau: `mobile.png`. |
| Kiểm ảnh nhận diện, nhập sai, hiện/ẩn mật khẩu và quét WCAG. | Logo đã tải được; form cũ hoạt động. | Logo thật tải có `naturalWidth > 0`; lỗi 401 giả lập được thông báo trong form, mật khẩu chuyển text/password đúng. Axe không báo vi phạm WCAG A/AA ở desktop và mobile, không có `pageerror`. |
| Chạy hồi quy luồng đăng nhập và build. | Năm ca trọng tâm đạt trước khi đổi bố cục. | Chạy lại 5/5 ca đạt: giao diện, icon, chặn `returnTo` ngoài, giữ query `returnTo` nội bộ, phiên admin bị thu hồi. `npm.cmd run build` đạt. Không thay đổi API xác thực, phiên hay phân quyền. |

Đây là phiên bản đã được thay thế sau phản hồi tiếp theo của người dùng. Kết quả 106/106 được ghi phía trên thuộc vòng kiểm cũ; vòng này chỉ chạy lại năm ca liên quan trực tiếp và build.

## Bổ sung 07/10: thiết kế lại với ui-ux-pro-max

Người dùng nhận xét bố cục mảng xanh toàn chiều cao vẫn kỳ và yêu cầu dùng `ui-ux-pro-max` để làm lại. Tra cứu design system cho cổng quản trị B2B và hướng Swiss Modernism cho thấy nên ưu tiên phân cấp chữ, một màu nhấn, form rõ ràng, tương phản và không dùng hình trang trí. Đối chiếu logo từ API và hồ sơ năng lực đang công khai; không dùng ảnh trong màn đăng nhập vì các vòng thử ảnh trước không được người dùng chấp nhận.

| Thao tác kiểm thử | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở `/admin/login` tại 1920×900 và 1440×900. | Mảng xanh chiếm gần nửa màn hình, danh sách ba khu vực cạnh tranh với form. | Nền sáng, logo màu gốc ở đầu trang; tiêu đề đăng nhập lớn và form trắng có viền xanh mảnh đặt cạnh nhau. Không còn danh sách, ảnh hay mảng màu toàn chiều cao. Ảnh sau ở `admin/tmp/qa-artifacts/login/wide.png` và `desktop.png`. |
| Thử 390×844, 320, 768 và 1024px. | Trên điện thoại cột xanh chỉ còn logo nhưng form vẫn bị đẩy xuống. | Logo, tiêu đề và form xếp một cột; nút đăng nhập nhìn thấy trong vùng đầu trang 390×844. Không tràn ngang ở các cỡ đã thử; ảnh ở `mobile.png`. |
| Kiểm logo, biểu mẫu và accessibility trên desktop/mobile. | Các chức năng đã hoạt động. | Logo tải được, hiện/ẩn mật khẩu đúng, lỗi 401 giả lập nằm gần form và có `role=alert`; Axe không báo vi phạm WCAG A/AA và không có `pageerror`. |
| Chạy hồi quy liên quan và build. | 5/5 ca ở bố cục cũ đạt. | 5/5 ca chạy lại đạt gồm layout, icon, hai trường hợp `returnTo` và phiên bị thu hồi; `npm.cmd run build` đạt. Xác thực, API và phân quyền không đổi. |

Mã hiện hành ở [page.tsx](../admin/src/app/login/page.tsx), ca kiểm ở [loginlayout.spec.ts](../admin/tests/e2e/loginlayout.spec.ts). Các ảnh lịch sử thuộc từng vòng thử không được xem là thiết kế hiện hành.

## Bổ sung 07/10: thiết kế lại Tổng quan với ui-ux-pro-max

Người dùng yêu cầu làm lại `/admin/dashboard`. Đối chiếu trang đang chạy, code hiện tại và gợi ý `ui-ux-pro-max` về dashboard nhiều dữ liệu: ưu tiên chỉ số dễ quét, vùng việc cần làm, tương phản, trục biểu đồ rõ ràng, hiệu ứng tiết chế. Giữ nguyên API, tập dữ liệu, phân quyền và bộ lọc theo 20 ngày/tháng/năm. Ảnh trước/sau lưu ở `admin/tmp/qa-artifacts/dashboardRedesign/`.

| Thao tác kiểm thử | Ban đầu | Sau sửa |
| --- | --- | --- |
| Mở desktop 1920×1000, quét thứ tự thông tin. | Bốn thẻ KPI tách rời với icon màu; biểu đồ chiếm trọn một hàng; “Việc cần xử lý” ở cuối bên cạnh bảng sản phẩm. | Đưa việc cần xử lý lên đầu, tiếp theo là một dải bốn chỉ số; biểu đồ và danh sách sáu sản phẩm đặt cạnh nhau. Bỏ bóng đổ và icon trang trí ở KPI, dùng đường chia và một màu nhấn. Ảnh `beforeDesktop.png` và `afterDesktop.png`. |
| Xem biểu đồ 20 ngày, chuyển theo năm/tháng và mở số liệu chi tiết. | Đường có vùng tô gradient, trục lưới nét đứt; phải rê điểm để biết ngày cao nhất. | Đường xanh nét rõ, lưới mảnh; hiện ngày cao nhất và mức trung bình ở đầu biểu đồ. Vẫn có 20 hàng chi tiết, 12 mốc theo năm và ít nhất 28 mốc theo tháng; điểm đầu khớp bảng chi tiết. |
| Xem danh sách sản phẩm được quan tâm. | Mỗi hàng có một thanh tỷ lệ nhỏ và khá nhiều chi tiết phụ. | Sáu hàng gọn theo dạng xếp hạng: thứ tự, tên, thương hiệu và số lượt xem ở cột phải; mỗi hàng vẫn mở đúng sản phẩm. |
| Xem 390×844, rồi kiểm 320/768/1024/1440px. | Biểu đồ sau bốn KPI, việc cần xử lý ở tận dưới cùng. | Trên điện thoại: việc cần xử lý → biểu đồ → KPI → sản phẩm. Biểu đồ bắt đầu trước y=750; không tràn ngang ở các bề rộng đã thử. Ảnh `beforeMobile.png` và `afterMobile.png`. |
| Bấm ba việc chờ xử lý, “Liên hệ mới” và “Yêu cầu báo giá mới”. | Ba việc chờ xử lý đã có URL lọc đúng, nhưng hai KPI “mới” chỉ mở danh sách chung. | Giữ ba liên kết có bộ lọc hiện hành. Hai KPI mới mở `/contacts?status=new` và `/quotes?status=new`, tab “Mới” được chọn và API lọc theo trạng thái; bấm “Tất cả” xóa tham số trạng thái. |
| Quét accessibility, kiểm lỗi JavaScript và build. | Bản cũ đạt ca dashboard trước sửa. | Axe trong vùng chính không báo vi phạm WCAG A/AA; test không thấy tràn ngang. `npm.cmd run typecheck` và `npm.cmd run build` đạt; Playwright dashboard và tìm kiếm quản trị đạt 2/2 ca, gồm các thao tác và điều hướng trên. |

Thay đổi tại [DashboardPage.tsx](../admin/src/features/dashboard/DashboardPage.tsx), [ContactQuoteListPage.tsx](../admin/src/features/contact/ContactQuoteListPage.tsx) và [dashboard.spec.ts](../admin/tests/e2e/dashboard.spec.ts). Các số thực tế như lượt truy cập có thể biến động trong lúc xem website công khai; ca test kiểm quan hệ và đường đi, không giả định số cố định.

## Bổ sung 07/10: làm lại biểu đồ lượt truy cập sau phản hồi

Người dùng nhận xét biểu đồ trong bản Tổng quan vừa sửa nhìn kỳ. Thử lại trên Chrome ở 1920×1000 và 390×844, xem cả 20 ngày, theo tháng hiện tại và theo năm hiện tại. Ảnh trước là `admin/tmp/qa-artifacts/dashboardRedesign/afterDesktop.png` và `afterMobile.png`; ảnh sau là `chartDesktop.png`, `chartMobile.png`, `chartMonthMobile.png`, `chartYearMobile.png` cùng thư mục. Ảnh cắt trực tiếp từ vùng biểu đồ sau sửa là `trafficDesktop.png` và `trafficMobile.png`.

| Thao tác kiểm thử | Kết quả ban đầu | Sửa và kết quả sau |
| --- | --- | --- |
| Xem 20 ngày gần nhất. | Đường nối các tổng lượt theo ngày thành nhiều đỉnh nhọn, khó so sánh từng ngày. | Dùng cột cùng trục gốc 0; ngày không có lượt có dấu ngắn trên trục, ngày cao nhất đậm hơn. Từng cột có nhãn giá trị khi rê hoặc dùng bàn phím; bảng chi tiết vẫn hiển thị đủ 20 ngày. |
| Chọn tháng hiện tại. | API trả đủ 31 ngày dù hiện mới đến ngày 7; ngày tương lai bị vẽ như 0, làm nửa biểu đồ trống và mức trung bình bị chia cho cả tháng. | Chỉ vẽ và tính trung bình trên những ngày đã diễn ra theo múi giờ Việt Nam; nhãn kỳ ghi “tính đến hôm nay”. Ô chọn tháng không cho chọn tháng tương lai. Ca test kiểm số cột bằng ngày hiện tại, không cố định vào tháng 10. |
| Chọn năm hiện tại. | Các tháng tương lai xuất hiện là 0; đỉnh khoảng 1.336 lượt nhưng trục trên ở 4.000 khiến cột thấp khó nhìn. | Chỉ hiện những tháng đã đến; thang dọc lấy bước gần mức đỉnh và chừa khoảng trên, ví dụ trục trên 2.000 cho đỉnh 1.336. Trung bình chỉ chia cho số tháng đã qua. Kỳ quá khứ vẫn hiện đầy đủ. |
| Kiểm trên điện thoại và chạy hồi quy. | Biểu đồ đường co nhỏ ở 390px. | Cột co theo chiều rộng mà không cuộn ngang; 320/390/768/1024/1440px không tràn ngang. Ca Playwright dashboard đạt 1/1, gồm chuyển kỳ, bảng chi tiết, điều hướng và quét Axe; `npm.cmd run typecheck`, `npm.cmd run build` đạt. |

Chỉ thay phần trình bày chuỗi thời gian ở [DashboardPage.tsx](../admin/src/features/dashboard/DashboardPage.tsx) và cập nhật [dashboard.spec.ts](../admin/tests/e2e/dashboard.spec.ts). API và dữ liệu lưu trữ không đổi; điểm tương lai vẫn có trong phản hồi API nhưng không được coi là số liệu đã quan sát trên giao diện.

## Bổ sung 07/10: giữ bố cục Tổng quan, sửa riêng biểu đồ

Người dùng phản hồi bản biểu đồ cột trông thô; bố cục Tổng quan trước đó chỉ có vấn đề ở biểu đồ. Vì vậy giữ nguyên thứ tự việc cần xử lý, KPI và sản phẩm; thay riêng cột bằng đường lượt truy cập **lũy kế trong kỳ**. Ảnh cột trước sửa là `chartDesktop.png` và `chartMobile.png`; ảnh mới là `cumulativeDesktop.png`, `cumulativeMobile.png`, `cumulativeYearMobile.png`, `cumulativeMonthMobile.png` trong `admin/tmp/qa-artifacts/dashboardRedesign/`. Hai ảnh cắt vùng biểu đồ là `cumulativeTrafficDesktop.png` và `cumulativeTrafficMobile.png`.

| Thao tác kiểm thử | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở Tổng quan 1920×1000 và 390×844, xem 20 ngày gần nhất. | Cột dày và nhiều vạch 0, người dùng đánh giá thô. | Một đường lũy kế màu xanh với vùng tô nhạt, trục từ 0 và thang sát mức dữ liệu; không đổi bố cục ngoài biểu đồ. Tại lần chạy này có 20 mốc, 1.390 lượt lũy kế, mốc cao nhất 304 lượt. |
| Mở “Xem số liệu chi tiết”, đối chiếu giá trị với biểu đồ. | Bảng liệt kê lượt riêng từng ngày nhưng biểu đồ cột khó nhìn xu hướng. | Bảng vẫn có đủ 20 hàng và giá trị từng mốc. Tổng các hàng khớp nhãn lũy kế ở điểm cuối; nhãn truy cập của mỗi điểm ghi cả lượt trong mốc và lũy kế, tránh nhầm đường là số lượt từng ngày. |
| Chuyển “Theo năm” rồi “Theo tháng” trên điện thoại. | Cột cho các mốc đã diễn ra, đã loại mốc tương lai ở lần sửa trước. | Đường lũy kế tiếp tục chỉ vẽ các mốc đã diễn ra: 10 tháng của năm 2026 và 7 ngày của tháng 10 tại thời điểm kiểm. Chế độ 20 ngày, tháng, năm đều có đường và không tràn ngang. |
| Kiểm giao diện và hồi quy. | Điểm đánh dấu ở cuối đường thử đầu tiên bị méo trên điện thoại; trục trên còn dư khoảng trống. | Bỏ điểm đánh dấu thường trực, thêm bước chia trục phù hợp. Xem lại ảnh desktop/mobile; Playwright dashboard đạt 1/1, gồm điều hướng tới danh sách cần xử lý, kiểm mobile và Axe không báo vi phạm WCAG A/AA. `npm.cmd run typecheck` và `npm.cmd run build` đều đạt. |

Chỉ thay biểu đồ và lời giải thích dưới biểu đồ trong [DashboardPage.tsx](../admin/src/features/dashboard/DashboardPage.tsx), cùng phép kiểm trong [dashboard.spec.ts](../admin/tests/e2e/dashboard.spec.ts). Không thay API hay cách ghi lượt truy cập; số liệu thực tế có thể thay đổi theo hoạt động website.

## Bổ sung 07/10: làm biểu đồ Tổng quan bớt khô

Người dùng thấy đường lũy kế vừa sửa còn khô. Đối chiếu ảnh `cumulativeTrafficDesktop.png` và `cumulativeTrafficMobile.png` với giao diện đang chạy; tra cứu hướng biểu đồ xu hướng trong `ui-ux-pro-max` để giữ trục thời gian, bảng số liệu gốc và khả năng xem giá trị chính xác khi tương tác. Giữ nguyên bố cục Tổng quan bên ngoài vùng biểu đồ. Ảnh sau là `interactiveDesktop.png`, `interactiveMobile.png`, `interactiveYearMobile.png`, `interactiveMonthMobile.png`; ảnh cắt biểu đồ là `interactiveTrafficDesktop.png` và `interactiveTrafficMobile.png` trong `admin/tmp/qa-artifacts/dashboardRedesign/`.

| Thao tác kiểm thử | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở Tổng quan ở 1920×1000 và 390×844, nhìn trực tiếp vùng biểu đồ. | Đường nối gấp khúc trên nền trắng, số liệu ở một dòng chữ nhỏ; người dùng đánh giá khô. | Đường lũy kế được nối cong qua đúng các điểm dữ liệu, vùng tô xanh nhẹ nằm trong khung nền xanh rất nhạt; một điểm đọc hiện rõ ở mốc đang xem. Số lượt của mốc và lũy kế được phân cấp chữ lớn/nhỏ, có chú thích đường và mốc cao nhất. |
| Rê chuột từ mốc cuối về đầu trên desktop. | Chỉ có `title` trình duyệt, không có số liệu cập nhật ngay trên giao diện. | Vạch dọc, điểm đọc và hai số liệu thay đổi theo mốc; rê về đầu rồi về cuối đều khớp nhãn ngày trong bảng. |
| Chọn biểu đồ bằng bàn phím rồi nhấn ←. | Mỗi điểm là một tab riêng, phải đi qua nhiều điểm. | Biểu đồ là một điểm focus; phím ← chuyển sang mốc liền trước, vùng đọc đổi đúng ngày. Có nhãn hướng dẫn phím và `aria-live` cho số liệu thay đổi. |
| Chạm trực tiếp hai đầu biểu đồ trên thiết bị cảm ứng giả lập 390×844. | Chưa thử một thao tác chạm thật trên biểu đồ. | Playwright tạo context `hasTouch: true`, chạm mốc đầu và cuối; vùng đọc hiển thị đúng nhãn từng mốc. Không cần bấm vào chấm nhỏ. |
| Chuyển 20 ngày, tháng, năm; kiểm số liệu, layout và hồi quy. | Các bộ lọc và bảng đã hoạt động. | Chế độ 20 ngày có 20 mốc; tháng/năm hiện tại chỉ lấy mốc đã diễn ra. Tổng bảng bằng lũy kế điểm cuối. Không tràn ngang tại 320/390/768/1024/1440px; Axe vùng chính không báo vi phạm WCAG A/AA. Playwright dashboard đạt 1/1, `npm.cmd run typecheck` và `npm.cmd run build` đạt. |

Đã sửa [DashboardPage.tsx](../admin/src/features/dashboard/DashboardPage.tsx) và [dashboard.spec.ts](../admin/tests/e2e/dashboard.spec.ts). Đường cong đi qua các số liệu lũy kế thực, không làm mượt bằng cách thay đổi hoặc dự đoán số liệu gốc. API và dữ liệu lưu trữ không đổi.

## Bổ sung 07/10: ô tìm kiếm trên thanh admin

Người dùng gửi ảnh ô tìm kiếm với từ “ống”: danh sách “Đi tới trang” gợi ý Tổng quan, Chuyển hướng, Thương hiệu, Nhật ký hệ thống, Cấu hình website và chiếm hết chiều cao cuộn. Ảnh trước lưu ở `admin/tmp/qa-artifacts/searchRedesign/before.png`; ảnh sau là `after.png` (ô nhập và popup), `results.png` (popup) và `context.png` (trong trang Tổng quan). Đối chiếu hướng tìm kiếm và Soft UI trong `ui-ux-pro-max`, rồi kiểm trực tiếp bằng Chrome.

| Thao tác kiểm thử | Ban đầu | Sau sửa |
| --- | --- | --- |
| Gõ “ống” trên trang Tổng quan. | Chuỗi được bỏ dấu và khớp giữa từ: “ống” thành `ong`, trùng một phần “tổng”, “hướng”, “thống”. Ca Playwright thêm cho tình huống này thất bại vì vẫn có mục “Đi tới trang”. | Chỉ xét tên trang ở đầu tên/đầu từ và từ khóa tìm kiếm ở đầu cụm; không gợi ý năm trang không liên quan. Bốn lựa chọn nơi tìm dữ liệu nằm gọn trong popup, Sản phẩm ở đầu. |
| Nhìn ô nhập và popup ở kích thước desktop. | Nhiều hàng chữ lặp lại “Tìm ‘ống’ trong…”, nhóm trang và nhóm dữ liệu chen nhau, phải cuộn. | Ô nhập và popup bo góc nhất quán, bóng nhẹ; hàng kết quả có biểu tượng và khoảng cách rõ hơn. Tiêu đề nhóm chỉ ghi truy vấn một lần, mỗi hàng chỉ hiện tên khu vực. Truy vấn “ống” không cần thanh cuộn. |
| Nhấn Enter khi chưa có trang trùng tên, rồi nhấn ↓ và Enter. | Mục gợi ý đầu tiên là một trang khớp sai; Enter dễ mở nhầm. | Enter đơn lẻ giữ nguyên trang; ↓ rồi Enter mở `/admin/product-groups?q=ống`. |
| Chọn nơi tìm ở 15 khu vực admin, tìm “sản phẩm”, thử Ctrl+K/Escape và tìm ngay trong trang. | Các đường đi này đã hoạt động ở bản trước. | Ca Playwright tìm kiếm đạt 1/1 sau sửa: truy vấn được đưa đúng vào 15 nơi tìm, “sản phẩm” mở danh sách sản phẩm, Ctrl+K/Escape và tìm trong trang vẫn đúng. Axe trên thanh admin không báo vi phạm WCAG A/AA. `npm.cmd run typecheck` và `npm.cmd run build` đạt. |

Thay đổi tại [TopbarQuickNav.tsx](../admin/src/components/layout/TopbarQuickNav.tsx) và ca kiểm [adminsearch.spec.ts](../admin/tests/e2e/adminsearch.spec.ts). Không thêm endpoint hay tìm dữ liệu toàn hệ thống; popup tiếp tục dẫn tới bộ lọc tìm kiếm hiện có của từng khu vực.

## Bổ sung 07/10: độ chính xác tìm kiếm sản phẩm

Người dùng chọn “Tìm ‘ống’ trong Sản phẩm” từ thanh admin và thấy 1.677 kết quả, trong đó có cáp điện, van đồng và đèn. Kiểm tra trực tiếp API xác nhận `q=ống` vẫn trả 1.677 mục; bộ lọc cũ dùng `%ống%` trên cả mô tả dài nên khớp vào “hệ thống”, “chống”, “xuống”. Ca Playwright mới đã thất bại với 1.677 kết quả trước khi sửa. Ảnh trước/sau ở `admin/tmp/qa-artifacts/productSearch/`.

| Thao tác kiểm thử | Trước sửa | Sau sửa |
| --- | --- | --- |
| Tìm `ống` trên `/admin/product-groups`, đối chiếu API và 20 hàng đầu. | 1.677 kết quả; các tên không liên quan xuất hiện ở đầu danh sách. | 90 kết quả; cả 90 tên đều chứa từ “ống”, các hàng đầu bắt đầu bằng “Ống…”. Số trên trang trùng tổng API. |
| Tìm không dấu `ong`, `den`, `cong tac`; đối chiếu có dấu. | `ong` còn có thể khớp sai do slug cũ của “đồng”; tìm kiếm phụ thuộc chuỗi con thô. | `ong` và `ống` cùng 90; `den`/`đèn` cùng 312; `cong tac`/`công tắc` cùng 63. Tên được chuẩn hóa dấu tiếng Việt trước khi so khớp theo đầu từ. |
| Gõ nhiều từ khác thứ tự, mã kích cỡ và SKU. | Tìm một chuỗi liền trong tên/mô tả; kết quả khó giải thích khi khớp trường ẩn. | `cadivi cáp` tìm 996 sản phẩm, `van cửa` và `cửa van` cùng 33; `4x185` tìm được mã `4×185`, `185` tìm được phần số trong mã. `MT-63` trả 4 mục; hàng khớp SKU hiện “Khớp SKU: …” ngay trong danh sách. Kết hợp tên + mã `rơ le MT-63` trả đúng 2 sản phẩm, không lẫn `MT-800 (400-630A)`. |
| Gõ sai `cavidi` và ký tự đặc biệt `.*`. | Không có quy tắc tìm gần đúng minh bạch; `%` là wildcard trong SQL cũ. | Chỉ khi không có kết quả trực tiếp, tìm từ gần nhất (tối đa 1–2 lỗi ký tự theo độ dài) và hiện nhãn “gần đúng”. `cavidi` trả 1.197 mục; kiểm toàn bộ 1.197 giá trị khớp đều chứa Cadivi. `.*` không trả hàng loạt kết quả. |
| Chạy hồi quy và build. | Ca kiểm mới thất bại: mong dưới 300, nhận 1.677. | Playwright tìm kiếm sản phẩm 1/1, tìm kiếm thanh admin 1/1; API unit 108/108; typecheck và build admin/API đều đạt. |

Tìm kiếm mặc định chỉ xét tên sản phẩm, tên biến thể, SKU và các mã model/mã ngoài; mô tả dài không còn tạo kết quả không thấy lý do. API xếp mức khớp theo tên/mã, trả trường `search_match` để giao diện chỉ rõ trường khớp; trường `summary.search_match_mode` báo khi dùng kết quả gần đúng. Không thêm bảng, migration hay endpoint. Ca kiểm ở [productSearch.test.ts](../api/tests/unit/productSearch.test.ts) và [productsearch.spec.ts](../admin/tests/e2e/productsearch.spec.ts). Kết quả gần đúng dựa trên lỗi gõ ký tự, không suy đoán đồng nghĩa hoặc ý định ngữ nghĩa.
