# Tiến độ làm lại website công khai

Tài liệu này chỉ ghi việc đã làm và bằng chứng kiểm tra trên worktree local. File Excel `Song_Thanh_LVTN_Ban_Thiet_Ke_Duy_Nhat_Hoan_Chinh.xlsx` là đầu vào thiết kế; các đề xuất trong đó được đối chiếu với code và dữ liệu chạy thực tế trước khi triển khai. Nhật ký này không thay thế xác nhận nghiệp vụ của người dùng. Hiện chưa có staging/VPS; mọi trạng thái hoàn thành dưới đây chỉ áp dụng cho phạm vi local được nêu rõ.

| Mốc | Phạm vi | Trạng thái | Bằng chứng / việc còn lại |
| --- | --- | --- | --- |
| M0 | Baseline và kiểm kê | **Hoàn thành local** | Đã kiểm tra runtime API và 10 route, lưu ảnh baseline. Chưa có môi trường ngoài local để đo Core Web Vitals thực tế; hành trình khách B2B cần người dùng xác nhận. |
| M1 | Font và design tokens | **Hoàn thành local** | Website dùng Be Vietnam Pro; cỡ chữ tiêu đề dùng `clamp`; tiêu đề thẻ dùng nét 600; header hiện 76/68px. Đã đối chiếu ảnh ở 390/1440px và kiểm tra 390/768/1360/1440px. |
| M2 | UI primitives, header, footer | **Hoàn thành local** | Header theo phản hồi, menu CMS tên dài/nhiều mục/mục con, footer, nút liên hệ nổi và modal báo giá đã qua kiểm tra code/browser. Tương tác riêng từng trang tiếp tục ở M4–M6. |
| M3 | Trang chủ và hero | **Hoàn thành local** | CTA hero mobile, lỗi tải CMS, bố cục thiếu ảnh, banner tự động/chọn tay, chọn danh mục/sản phẩm/dịch vụ/dự án/thương hiệu, thứ tự và ẩn section, dải số liệu, tùy chọn ẩn form đã qua kiểm thử local. Kiểm tra admin chỉnh trực tiếp → website sẽ thực hiện ở M7 khi có môi trường phù hợp. |
| M4 | Catalogue và chi tiết sản phẩm | **Hoàn thành local với dữ liệu giả lập giá** | Lỗi tải/filter, URL, biến thể, context báo giá và ba kiểu hiển thị giá đã qua kiểm tra local. API hiện có 0 sản phẩm công khai có giá; cần kiểm tra lại với dữ liệu giá thật ở M7. |
| M5 | Trang nội dung | **Hoàn thành local với CMS giả lập** | Route danh sách/chi tiết, block CMS hiện có và ba kiểu block giả lập, thứ tự/ẩn section, thẻ thiếu logo đã qua kiểm tra local. Kiểm tra thao tác admin thật → website thuộc M7. |
| M6 | Biểu mẫu, mobile, accessibility | **Hoàn thành trong browser local** | Ba form qua kiểm tra gửi trùng/lỗi/thử lại, keyboard modal/menu, touch giả lập, axe chín route và stress CSS zoom. Thiết bị thật, text zoom theo trình duyệt và kiểm tra người dùng thuộc M7. |
| M7 | QA, hiệu năng, phát hành | **QA local hoàn thành; chưa nghiệm thu phát hành** | Typecheck/test/build, 20 lượt smoke route và kiểm tra ảnh/network local đạt. Chưa có staging/VPS để đo Core Web Vitals thực tế, thử admin thật → website, thiết bị thật và phát hành. |

## M0 — bằng chứng local

- Baseline Git: `main@8ccff3a`, worktree đã có thay đổi chưa commit ở `frontend/`, `admin/`, `api/` trước tác vụ này. Không reset hoặc ghi đè phần ngoài phạm vi.
- Runtime local: API `http://localhost:4000/health` trả `ok`; website Next.js chạy ở cổng 3000. API trả 2.956 sản phẩm công khai lúc kiểm tra.
- Các route `/`, `/san-pham`, `/san-pham/danh-sach`, `/tim-kiem?q=CADIVI`, `/du-an`, `/dich-vu`, `/doi-tac-thuong-hieu`, `/tin-tuc`, `/gioi-thieu`, `/lien-he` đều trả HTTP 200 ở 390px; không có lỗi JavaScript hoặc tràn ngang trong lượt đo. `/`, catalogue, liên hệ cũng được kiểm tra ở 768px và 1440px.
- Ảnh và số liệu baseline nằm tại `tmp/websiteUx/baseline/` (đầu ra kiểm thử local, không phải mã nguồn). TTFB đo ở chế độ dev chỉ dùng để nhận biết tương đối, không xem là Core Web Vitals production.
- Trang chủ lấy thứ tự section, banner, danh mục, sản phẩm, dự án, thương hiệu và thông tin công ty từ API/CMS. Menu, footer và báo giá cũng có hợp đồng dữ liệu riêng. Những quyền quản trị này là ranh giới phải giữ nguyên khi cải thiện giao diện.
- Trong lúc kiểm thử, ổ C chỉ còn khoảng 1,5 MB nên PostgreSQL báo `No space left on device` ở truy vấn catalogue; frontend tạm hiện sai 0 sản phẩm. Đã dọn cache npm có thể tái tạo và kiểm tra API/trang công khai trả lại 2.956 sản phẩm. Đây là sự cố môi trường cần theo dõi, không tính là thay đổi nghiệp vụ.

## M1 — bằng chứng local

- Ảnh `baseline/home390.png`, `baseline/home1440.png` được so với `afterFont390.png`, `afterFont1440.png`; font tiếng Việt và tiêu đề hero hiển thị không cắt dấu ở các viewport này.
- Sau phản hồi về chữ quá đậm, tiêu đề thẻ thường, thẻ lớn và thẻ sản phẩm được đưa về nét 600 theo sheet thiết kế; thẻ catalogue dùng nét 600 thay cho 700. Ảnh `cardTypeHome390.png`, `cardTypeHome1440.png`, `cardTypeCatalog390.png`, `cardTypeCatalog1440.png` nằm tại `tmp/websiteUx/`. Trình duyệt xác nhận font Be Vietnam Pro, nét 600, HTTP 200, không tràn ngang hoặc lỗi JavaScript ở hai viewport.
- `npm.cmd run typecheck` đạt; `npm.cmd test` đạt 32/32 bài sau khi sửa menu.
- Kiểm thử browser ở 390/768/1360/1440px: trang chủ không tràn ngang, CTA hero còn click được. Sau lượt chỉnh header, desktop hiển thị trực tiếp tám mục CMS hiện có; mục thứ chín trở đi vào “Thêm”. Modal báo giá mở/đóng bằng Esc; tìm `CADIVI` dẫn đến `/tim-kiem?q=CADIVI`.

## M2 — bằng chứng local và việc tiếp theo

- Header render menu CMS theo `sort_order`, giữ mục tùy chỉnh và submenu; tám mục hiện có hiển thị trực tiếp ở desktop 1360/1440px, mobile hiển thị đầy đủ. Khi mục thứ chín trở đi xuất hiện hoặc nhãn dài khiến thanh điều hướng thiếu chỗ, desktop chuyển phần vượt sang “Thêm”; ba bài kiểm thử mapping menu đạt. Không đổi dữ liệu hoặc quyền admin.
- Theo phản hồi người dùng, header đã đổi sang nền trắng, chữ menu 15px nét thường, thu logo/ô tìm kiếm và chuyển nút menu sang phải ở mobile. Ảnh `headerAfter390.png`, `headerAfter768.png`, `headerAfter1360.png`, `headerAfter1440.png` nằm ở `tmp/websiteUx/`.
- Trên bản build local: ở 390px menu mở/đóng bằng Esc và trả focus về nút mở; đủ tám link theo thứ tự CMS; tìm `CADIVI` dẫn tới `/tim-kiem?q=CADIVI`. Ở 1440px đủ tám link trực tiếp, không có “Thêm”. Sáu viewport 320/390/768/1024/1360/1440px không tràn ngang/lỗi JavaScript.
- Dùng API shell giả lập chỉ trong quá trình test: đổi hai nhãn thành tên dài và thêm năm mục. Ở 1360px còn bốn mục trực tiếp, chín mục nằm trong “Thêm”, không đè logo hoặc ô tìm kiếm; ở 390px đủ 13 link đúng thứ tự. Không ghi thay đổi vào CMS hay cơ sở dữ liệu.
- Ô tìm kiếm mobile với query `CADIVI` hiển thị gợi ý, bàn phím đi vào gợi ý bằng ↓, quay lại ô nhập bằng ↑, Esc đóng và trả focus, Enter mở `/tim-kiem?q=CADIVI`.
- Kiểm tra lại trên bản build local sau khi giảm nét chữ: drawer 390px hiện đủ tám mục CMS, Esc đóng và trả focus; desktop 1440px hiện đủ tám mục trực tiếp. Ảnh menu mở ở `tmp/websiteUx/headerMenu390.png`.
- Footer khi API shell lỗi báo rõ thông tin liên hệ chưa tải được, không hiện dữ liệu giả.
- Footer trước đây lặp hotline/email ở cả cột logo và cột văn phòng; nay thông tin liên hệ nằm một chỗ trong cột văn phòng, email vẫn mở `mailto:`, dữ liệu và các nhóm link vẫn lấy từ CMS. Dòng bản quyền được thống nhất tiếng Việt. Ảnh `footer320.png`, `footer390.png`, `footer1440.png` trong `tmp/websiteUx/`.
- Rà 19 link footer ở 320/390/1440px: không có `href` rỗng, hotline/email còn đúng liên kết, không lỗi JavaScript hoặc tràn ngang. Phát hiện nút liên hệ nổi che một số link hỗ trợ khi cuộn trên 320/390px; nay nút ẩn khi footer vào màn hình và hiện lại khi cuộn lên. Quét các vị trí cuộn trong footer không còn link bị che.
- Rà `Button`, `FormField`, `Card`, `Container`, modal báo giá và trạng thái focus qua code hiện hành: nút chuẩn có kích thước chạm tối thiểu 44px, form field nối label/helper/error bằng ID, modal khóa cuộn và giữ focus trong dialog. Các trang vẫn có style riêng cần kiểm bằng browser ở M6; không thêm component mới chỉ vì backlog Excel đề xuất.
- Menu CMS thật hiện có tám mục cấp một và chưa có mục con. Proxy local thêm một mục con vào “Sản phẩm” mà không ghi DB: ở 1440px, Enter mở dropdown, link con đúng `/san-pham/danh-sach`, Esc đóng và trả focus; ở 390px, drawer khóa cuộn, mục con hiện đúng, Esc đóng và trả focus về nút menu. Hai lượt HTTP 200, không lỗi JavaScript.
- Modal báo giá từ thẻ catalogue ở 390/1440px khóa cuộn, `Shift+Tab` ở nút đóng đi đến nút cuối, `Tab` quay lại nút đóng; Esc đóng và trả focus về nút đã mở. Không gửi yêu cầu thật.
- Menu đánh dấu đúng mục hiện tại bằng `aria-current="page"` cho Trang chủ, Sản phẩm/danh sách, Dự án và Tin tức ở cả 390/1440px. M2 hoàn thành local với shell và primitives đang dùng; control riêng của nội dung, sản phẩm và biểu mẫu được theo dõi ở M4–M6.

## M3 — bằng chứng local và việc tiếp theo

- Ở 390px, nút chuyển banner không còn che CTA; banner vẫn chuyển bằng các chấm điều hướng. CTA còn click được ở 390/768/1360/1440px.
- Ngắt API trong local, trang chủ trả HTTP 500 với màn hình “Chưa tải được trang”, không dựng section mặc định thay nội dung CMS. API được khởi động lại và `/health` trả 200.
- Phần giới thiệu không còn dựng logo chữ “ST” và câu nhắc thay ảnh khi CMS chưa có ảnh. Ảnh `companyOverview390.png` và `companyOverview1440.png` cho thấy nội dung thật hiển thị gọn, không tràn ngang; khi CMS có ảnh, nhánh ảnh hiện có vẫn được giữ. Thẻ dịch vụ cũng không dựng chữ “ST” thay ảnh.
- Phát hiện trang chủ trước đây chỉ lấy trang đầu (8 sản phẩm, 4 dịch vụ, 12 dự án) rồi mới lọc theo ID do admin chọn; sản phẩm ở trang sau không thể hiện dù đã được chọn. Nay ba API danh sách công khai hiện có nhận bộ lọc `ids`, vẫn áp dụng điều kiện `approved` và `published`; trang chủ lấy đúng các ID được chọn, giữ thứ tự cấu hình, dùng đúng `item_limit` và `sort` ở chế độ tự động. Không thêm route API, bảng hay quyền.
- API local: chọn một sản phẩm thuộc trang 60/40 trả đúng một thẻ; chọn dịch vụ/dự án trả đúng một mục; ID không có bản ghi công khai trả 0. `tmp/websiteUx/homeCmsProxy.cjs` và `homeCmsProbe.cjs` thử bốn cấu hình CMS chỉ qua proxy local, không ghi DB: thủ công chọn ba mục trên, thủ công rỗng, tự động `newest` với giới hạn 1, và dải tin cậy nhập tay rỗng. Cả bốn HTTP 200, không lỗi JavaScript/tràn ngang ở 390px. Proxy xác nhận request `ids` hoặc `sort=newest&page_size=1` tương ứng.
- Dải tin cậy tự động trước đây dùng số thẻ tải cho các section; khi admin chọn thủ công một dịch vụ/dự án, số này có thể thành 1 dù tổng công khai lớn hơn. Nay lấy `pagination.total` từ danh sách công khai, chỉ gọi thêm truy vấn đếm khi cần; trong bốn cấu hình giả lập local vẫn hiện 4 dịch vụ, 6 dự án, 18 thương hiệu. Chế độ nhập tay rỗng không tự thay bằng số liệu tự động.
- Proxy local đã thử thêm banner chọn tay (đúng tiêu đề được chọn), banner chọn tay rỗng (hero dự phòng), danh mục và thương hiệu chọn tay (chỉ hiện mục chọn), tắt form báo giá, đổi thứ tự section và ẩn phần giới thiệu. Hai sản phẩm chọn tay từ các trang khác nhau hiện theo thứ tự admin cấu hình khi chuyển carousel. Tất cả ở 390px trả 200, không lỗi JavaScript hoặc tràn ngang.
- Nhánh danh mục được admin chọn nhưng thiếu ảnh không còn hiện hình trang trí “ST/Đang cập nhật”. Thẻ dùng tên danh mục thật làm điểm nhấn, vẫn giữ đường dẫn và thứ tự CMS. Kiểm thử qua proxy local với danh mục gốc giả lập thiếu `icon_file`: 390px trả 200, đúng tên “VAN CÔNG NGHIỆP”, không tràn ngang/lỗi JavaScript; ảnh `categoryNoImage390.png`. Dữ liệu gốc không bị sửa.
- Ảnh toàn trang `currentHome390.png` và `currentHome1440.png` từng làm ảnh dự án trông trắng vì browser chưa cuộn đến ảnh `loading="lazy"`; kiểm tra cuộn thật xác nhận ảnh dự án tải thành công (HTTP 200, `naturalWidth > 0`), ảnh `projectSection1440.png`. Không ghi nhận ảnh trắng là lỗi runtime. Nhánh CMS thiếu ảnh được kiểm tra riêng: thẻ hiện khách hàng, tiêu đề, mô tả, địa điểm từ dữ liệu công khai, không dựng vùng ảnh trống; ảnh `projectNoImage390.png`.
- M3 hoàn thành trong phạm vi local, với cấu hình CMS giả lập qua proxy không ghi dữ liệu. Kiểm tra thao tác admin thật đến website và môi trường triển khai thuộc M7.

## M4 — bằng chứng local và việc tiếp theo

- Khi tải catalogue lần đầu thất bại, route hiện “Chưa tải được sản phẩm” và nút thử lại. Khi filter phía client nhận 503, trang giữ 12 thẻ cũ, hiển thị lỗi và thử lại cùng bộ lọc thành công.
- Sản phẩm có bốn biến thể trên route `/san-pham/en-led-downlight-vien-bac-phi-140mm` qua kiểm tra 390/1440px: chọn CCT 6000 đổi mã thành `DLBL2-9T`, URL lưu ID biến thể, modal báo giá nhận đúng biến thể, tải lại giữ lựa chọn. Khi không có ảnh, thẻ không dựng ảnh sản phẩm giả.
- Trên catalogue mobile 390px, chọn thương hiệu ANFACO cập nhật URL `?brands=anfaco`; Back bỏ điều kiện, Forward khôi phục URL và chip lọc. Kiểm tra trên bản build local với dữ liệu công khai hiện tại.
- API local hiện trả 0 sản phẩm ở bộ lọc `status=has_price`; route lọc trả 200 và trạng thái không có kết quả. Không sửa giá hoặc trạng thái của sản phẩm trong DB để tạo dữ liệu thử.
- Proxy chỉ dùng lúc test trả ba kiểu dữ liệu giá: tất cả biến thể cùng giá (`exact_price`), tất cả có giá khác nhau (`from_price`), và một phần có giá/một phần cần báo giá. Thẻ sản phẩm hiển thị số tiền thấp nhất ở chế độ “Giá từ”, kèm ghi chú đúng từng trường hợp; sản phẩm chỉ báo giá vẫn có nút báo giá. Ảnh `priceMixed390.png` và `priceMixed1440.png` trong `tmp/websiteUx/`.
- Trên PDP giả lập, đổi từ mã có giá 125.000 ₫ sang mã chưa có giá bỏ số tiền cũ, đổi CTA sang “Nhận báo giá ngay”, và danh sách yêu cầu ghi đúng mã cần báo giá. Mã có giá giữ số tiền và nhãn “Gửi yêu cầu ngay”; modal ghi “Giá công khai khi chọn”. Kiểm thử 390/1440px trả HTTP 200, không lỗi JavaScript/tràn ngang. Không gửi yêu cầu thật.
- M4 hoàn thành trong phạm vi local và phản hồi giả lập; cần nghiệm thu giá thật do admin công khai ở M7 khi có dữ liệu phù hợp. Frontend typecheck, build, 32/32 test và `git diff --check` đạt sau lượt sửa này.

## M5 — bằng chứng local và việc tiếp theo

- `/dich-vu`, `/du-an`, `/doi-tac-thuong-hieu`, `/tin-tuc`, `/lien-he`, `/tim-kiem?q=CADIVI` đều trả 200, có một `h1`, không tràn ngang/lỗi JavaScript ở 390 và 1440px. Bốn route chi tiết dịch vụ, dự án, thương hiệu, tin tức cũng đạt các kiểm tra này.
- Các API danh sách chính của dịch vụ, dự án, thương hiệu, tin tức và tìm kiếm để lỗi hiển thị ở ranh giới lỗi chung, không trả danh sách rỗng giả.
- Nội dung CMS thật của `/gioi-thieu` có bullet list và card grid; `/dich-vu` có card grid và bullet list trong accordion “Cách làm việc...”. Cả hai kiểu block hiển thị đúng. Tám route nội dung `/gioi-thieu`, `/dich-vu`, `/du-an`, `/doi-tac-thuong-hieu`, `/tin-tuc`, `/lien-he`, `/ho-so-nang-luc`, `/san-pham` đều HTTP 200, có một H1, không lỗi JavaScript/tràn ngang ở 390/1440px.
- Proxy local trên `/du-an` thử ba kiểu block `bullet_list`, `card_grid`, `image_card` với ảnh công khai thật; đặt `projects-story` trước phần chính và ẩn CTA. Thứ tự được giữ, phần dự án bắt buộc còn hiển thị, CTA ẩn, link nội bộ đúng và link `javascript:` không được dựng. 390/1440px không lỗi/tràn ngang; ảnh trong block tải thành công. Ảnh `contentBlocks390.png`, `contentBlocks1440.png` trong `tmp/websiteUx/`.
- Block ảnh có link trước đây không hiện nhãn CTA do admin cấu hình; nay hiện nhãn cạnh mũi tên và alt ưu tiên tiêu đề nội dung. Ảnh `imageBlock390.png` cho nhánh này. Không thay cấu trúc CMS hay quyền quản trị.
- Dữ liệu thương hiệu thật có 17/18 logo; ảnh toàn trang trước đó làm nhiều ô trông trống do lazy loading, không phải thiếu ảnh hàng loạt. Hãng “Đệ Nhất” thật sự thiếu logo, thẻ trước đây lặp tên hai lần; nay hiện tên một lần và hành động xem hồ sơ. Ảnh `brandNoLogo390.png`; 390/1440px không tràn ngang. M5 hoàn thành local với dữ liệu công khai và CMS giả lập, chưa thay thế nghiệm thu admin thật ở M7.

## M6 — bằng chứng local và việc tiếp theo

- Form `/lien-he` với dữ liệu giả lập: gửi rỗng đặt focus vào họ tên; email sai không gửi; phản hồi POST giả lập thành công, `source_page` và nội dung đúng, không ghi dữ liệu thật.
- Phát hiện và sửa gửi POST trùng khi hai lệnh submit xảy ra sát nhau ở báo giá sản phẩm, báo giá trang chủ và liên hệ. Cả ba form qua test trình duyệt: hai lệnh chỉ tạo một POST; khi POST đầu giả lập lỗi 503, dữ liệu nhập còn nguyên và gửi lại thành công. Báo giá sản phẩm vẫn giữ đúng ID biến thể và số lượng.
- Axe ở 390px cho `/`, catalogue, PDP, liên hệ, tin tức: 0 vi phạm WCAG 2 A/AA và 2.1 A/AA trong phạm vi quét tự động sau lượt chỉnh header. `prefers-reduced-motion: reduce` giữ hero không tự chuyển sau 5,5 giây nhưng vẫn chuyển thủ công.
- Bàn phím menu con CMS giả lập và modal báo giá đã qua kiểm tra focus, khóa cuộn, Esc và trả focus ở M2. Touch giả lập với viewport 320/390px và device scale 2: mở/đóng menu, liên hệ nổi, lọc thương hiệu ANFACO, chọn biến thể `DLBL2-9T`, mở/đóng báo giá đúng mã; không lỗi JavaScript hoặc tràn ngang.
- Axe quét thêm `/gioi-thieu`, `/dich-vu`, `/du-an`, `/doi-tac-thuong-hieu`: tổng chín route ở 390px không báo vi phạm WCAG 2 A/AA, 2.1 A/AA trong phạm vi quét tự động. Dùng CSS zoom 200% trên viewport 640px để stress bố cục tương đương bề rộng hiệu dụng 320px: trang chủ, catalogue, PDP, liên hệ, dịch vụ không tràn ngang. CSS zoom không thay thế kiểm tra text zoom của trình duyệt/thiết bị thật.
- M6 hoàn thành trong phạm vi browser local; M7 giữ phần kiểm thử thiết bị thật, text zoom theo trình duyệt và nghiệm thu hành trình người dùng.

## M7 — bằng chứng local và giới hạn nghiệm thu

- Sau sửa chọn mục CMS, API và frontend typecheck đạt; API unit test 141/141, frontend test 32/32, frontend build và `git diff --check` đạt. Sau sửa dải số liệu và nhánh dự án thiếu ảnh, frontend typecheck, test 32/32, build, `git diff --check` và kiểm thử trang chủ qua proxy local đạt; favicon PNG trả HTTP 200 sau khi proxy thử nghiệm chuyển tiếp dữ liệu nhị phân đúng cách. Axe năm route không báo vi phạm trong phạm vi quét tự động ở lượt trước.
- Bản build chạy tại local với `API_BASE_URL=http://localhost:4000`: 10 route chính ở 390px đều HTTP 200, một `h1`, không tràn ngang hoặc lỗi JavaScript; header tương tác đạt ở 390/1440px. Sau khi bổ sung lọc `ids`, kiểm tra lại HTTP cho 10 route đều trả 200; header và chữ thẻ cũng qua kiểm tra trình duyệt local ở 390/1440px.
- Chưa có staging/VPS, thiết bị thật hoặc số đo Core Web Vitals từ môi trường triển khai. Chưa đánh dấu hoàn thành QA phát hành.
- Sau chỉnh giá trên thẻ sản phẩm và footer/nút liên hệ nổi: frontend typecheck, build, 32/32 test và `git diff --check` đều đạt; kiểm tra trình duyệt local ở 320/390/1440px cho footer và 390/1440px cho giá/biến thể đạt. Chưa có sản phẩm có giá công khai trong dữ liệu thật để nghiệm thu luồng này bằng bản ghi admin.
- Sau chỉnh thẻ danh mục thiếu ảnh: frontend typecheck, build, 32/32 test và kiểm tra diff đạt; proxy thử nhánh CMS thiếu ảnh qua browser local đạt. Website production local đang chạy ở cổng 3000, API cổng 4000; proxy thử đã tắt.
- Sau chỉnh block CMS và thẻ thương hiệu thiếu logo: frontend typecheck, build, 32/32 test và kiểm tra diff đạt. Bản production local đang chạy ở cổng 3000.
- Lượt QA cuối trên bản production local: 10 route chính ở 390 và 1440px (20 lượt) đều HTTP 200, đúng một H1, không tràn ngang hoặc lỗi JavaScript. Cuộn hết trang chủ, dự án, danh bạ thương hiệu và PDP ở 390px để kích hoạt ảnh lazy: không có request lỗi HTTP, request thất bại hoặc ảnh `naturalWidth=0`. API `/health` vẫn trả `ok`; `git diff --check` toàn worktree đạt.
- M7 chỉ hoàn thành phần QA local. Do chưa có staging/VPS và sản phẩm giá công khai thật, chưa kiểm thử thao tác chỉnh/duyệt/xuất bản từ admin đến website với dữ liệu thật, chưa đo Core Web Vitals thực tế, chưa thử text zoom trên thiết bị/trình duyệt thật và chưa phát hành.
