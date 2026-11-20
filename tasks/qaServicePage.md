# Kiểm tra trang Dịch vụ — 2026-10-08

Biên bản này ghi nhận code và runtime local khi kiểm thử; không xác lập yêu cầu nghiệp vụ mới.

## Phạm vi và dữ liệu đang chạy

- Trang danh sách: `http://localhost:3000/dich-vu`; bốn dịch vụ công khai lấy từ API hiện hành.
- Banner đầu trang là banner `SERVICES_HERO` do admin quản lý, dạng ảnh có chữ (`1916 × 821`) và chưa có ảnh riêng cho điện thoại. Hai khối “Quy trình hợp tác” và “Thông tin nên gửi” đến từ `extra_blocks` của nội dung trang do admin quản lý.
- Một trang chi tiết đại diện được chụp trước/sau: `/dich-vu/tu-van-ky-thuat`. Bốn trang chi tiết đều được mở và kiểm tra đường dẫn.
- Ảnh trước sửa: `frontend/tmp/qa-artifacts/aboutRedesign/servicesBefore1440.png`, `servicesBefore390.png`, `serviceDetailBefore1440.png`, `serviceDetailBefore390.png`.

| Thao tác | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở trang danh sách trên điện thoại | Banner ngang thu nhỏ khiến chữ trong ảnh khó đọc; danh sách dịch vụ hai cột, các dòng và nút rất chật. | Tiêu đề/mô tả thật của trang xuất hiện bằng chữ lớn trước ảnh; ảnh từ banner admin được cắt vào phần hình minh họa. Mỗi dịch vụ nằm trên một hàng đủ rộng, chữ và nút đọc được. Desktop vẫn dùng nguyên banner admin. |
| Đọc một dịch vụ trong danh sách | Mỗi dịch vụ là thẻ nhỏ chứa nhiều tầng thông tin; khách phải dò hai cột. | Tên, mô tả, thời gian, kết quả nhận được và hai hướng “Xem chi tiết”/“Trao đổi nhu cầu” được phân cấp rõ trong cùng một hàng. ID và nội dung vẫn lấy từ API. |
| Cuộn qua “Khi nào liên hệ”, “Quy trình hợp tác”, “Thông tin nên gửi” | Các khối thẻ nối tiếp nhau, lặp màu nền và viền. | “Khi nào liên hệ” thành các dòng theo dịch vụ. Hai khối do admin quản lý chuyển sang trình bày dạng bước và danh sách có đường phân cách; nội dung, thứ tự và liên kết admin vẫn giữ. |
| Mở chi tiết dịch vụ trên điện thoại | Tóm tắt dạng ba thẻ; sản phẩm và dịch vụ liên quan hai cột hẹp, tên và ảnh nhỏ. | Tóm tắt thành ba cột/dòng thoáng. Sản phẩm liên quan thành hàng ngang ảnh–thông tin, dịch vụ khác thành danh sách một cột. Lời mời liên hệ cuối trang cùng sắc xanh với trang danh sách. |
| Bấm “Xem các dịch vụ” trên mobile | — | Đưa tới đầu danh mục, cách mép trên 96 px, không bị header che. |
| Bấm “Xem chi tiết” rồi “Trao đổi nhu cầu” | — | Link đầu mở đúng `/dich-vu/tu-van-ky-thuat`; link sau mở `/lien-he?dich-vu=tu-van-ky-thuat` và form hiện “Dịch vụ đang hỏi”. |
| Bấm sản phẩm liên quan trong chi tiết | — | Mở đúng `/san-pham/bo-en-led-tube-nano-oi`; bốn ảnh sản phẩm đã tải khi cuộn vào vùng nhìn thấy. |
| Mở ở 360, 390, 768, 1024, 1440, 1920 px | — | Trang danh sách HTTP 200, đúng một H1, đủ bốn dịch vụ, không tràn ngang hay lỗi JavaScript. Trang chi tiết đại diện cũng đạt các kiểm tra này; cả bốn trang chi tiết đạt HTTP 200, một H1, không tràn ngang và có link liên hệ đúng dịch vụ ở 390/1440 px. |
| Kiểm tra kỹ thuật | — | `npm.cmd run build` thành công, gồm TypeScript. Axe quét toàn trang danh sách và chi tiết đại diện không báo vi phạm. |

Ảnh sau sửa: `frontend/tmp/qa-artifacts/aboutRedesign/servicesFinal1440.png`, `servicesFinal390.png`, `servicesCatalogViewport390.png`, `serviceDetailAfter1440.png`, `serviceDetailAfter390.png`, `serviceDetailProductsViewport390.png`.

Giới hạn: chưa thử các biến thể khi admin thay banner, ẩn/đổi thứ tự khối hoặc công bố thêm dịch vụ; kiểm thử trình duyệt dùng Chrome local. Ảnh chụp toàn trang có thể bỏ qua ảnh tải lười nằm ngoài khung nhìn, nên ảnh `serviceDetailProductsViewport390.png` được chụp sau khi cuộn tới sản phẩm để xác nhận ảnh thực tế đã hiện.

## Chỉnh tiếp sau phản hồi ba vùng lặp — 2026-10-08

Người dùng chỉ ra phần đầu trang, đoạn sau “Thông tin nên gửi” và lời mời liên hệ cuối trang cùng nhắc lại một ý với nhiều khối lớn. Lượt này chỉ đổi cách trình bày ở website; banner `SERVICES_HERO`, dữ liệu dịch vụ và nội dung trang do admin quản lý vẫn lấy từ API hiện hành.

| Thao tác kiểm tra | Trước lượt chỉnh này | Sau lượt chỉnh này |
| --- | --- | --- |
| Mở `/dich-vu` trên desktop và đọc sau banner | Banner có chữ lớn; ngay dưới lại có tiêu đề CMS lớn và tiếp theo là tiêu đề danh mục “Dịch vụ của Song Thanh” cũng lớn. | Banner admin giữ nguyên. Tiêu đề CMS vẫn là H1 trong cây truy cập nhưng không lặp bằng chữ lớn trên desktop; dưới banner còn một dải mô tả ngắn. Danh mục mở bằng “Chọn hướng hỗ trợ” cỡ vừa và số lượng dịch vụ. Trên mobile, H1 vẫn hiện rõ vì phần chữ trong ảnh banner đã được cắt khỏi khung nhìn. |
| Cuộn qua “Thông tin nên gửi” | Hết danh sách là một hộp trắng lớn nhắc thêm chuyện gửi nhu cầu; khoảng cách tạo cảm giác bắt đầu một khối nội dung mới. | Đoạn CMS còn hiện nguyên nội dung nhưng thành ghi chú ngắn có vạch nhấn, liền mạch với nền của danh sách. Giảm khoảng trắng giữa hai phần. |
| Cuộn tới cuối trang danh sách và chi tiết | Khối xanh lớn lại mời liên hệ, lặp lời giới thiệu và có thêm liên kết dự án. | Cả hai trang dùng cùng một dải trắng gọn: câu hỏi ngắn, hotline, một nút “Gửi yêu cầu”. Trang chi tiết vẫn đưa mã dịch vụ vào URL biểu mẫu. |
| Bấm nút cuối trang chi tiết ở 390 px | — | Mở `/lien-he?dich-vu=tu-van-ky-thuat`; biểu mẫu hiển thị “Dịch vụ đang hỏi”. |
| Mở danh sách và chi tiết ở 360, 390, 768, 1024, 1440, 1920 px | — | Mỗi trang HTTP 200, đúng một H1, không tràn ngang, không có `pageerror`; liên kết liên hệ cuối trang đúng đích. |
| Build và khả năng truy cập | — | `npm.cmd run build` thành công. Axe quét toàn trang danh sách và chi tiết ở 390/1440 px: không báo vi phạm. |

Ảnh đối chiếu trước lượt này: `servicesFinal1440.png`, `servicesFinal390.png`, `serviceDetailAfter1440.png`, `serviceDetailAfter390.png`. Ảnh sau lượt này: `listingRefined1440Latest.png`, `listingRefined390Latest.png`, `detailRefined1440Latest.png`, `detailRefined390Latest.png` trong `frontend/tmp/qa-artifacts/aboutRedesign/`; vùng đầu và cuối danh sách còn có `servicesIntroRefined1440.png`, `servicesIntroRefined390.png`, `servicesClosingRefined1440.png`, `servicesClosingRefined390.png`.

Giới hạn kiểm tra vẫn là dữ liệu local hiện tại; chưa kiểm thử các trường hợp admin thay toàn bộ nội dung trang hoặc thay banner bằng ảnh khác. Biên bản này là quan sát runtime, chưa phải nguồn xác lập yêu cầu nghiệp vụ.

## Đồng nhất biểu mẫu liên hệ ở cuối trang — 2026-10-08

Trang chủ và trang giới thiệu hiện dùng chung `HomeQuoteRequestForm`, gửi tới `/public/quote-requests`. Trước lượt này, cuối trang danh sách và chi tiết dịch vụ chỉ có dải trắng với hotline và nút chuyển sang `/lien-he`. Theo phản hồi mới, hai trang dịch vụ dùng lại khối liên hệ sáng của trang chủ và chính biểu mẫu hiện hành; trang chi tiết hiển thị tên dịch vụ đang hỏi và gửi tên/slug kèm trong `message` để admin nhận ra ngữ cảnh. Không thêm endpoint hay workflow mới.

| Thao tác | Trước | Sau |
| --- | --- | --- |
| Cuộn đến cuối `/dich-vu` | Chỉ có tiêu đề, hotline và nút “Gửi yêu cầu” dẫn sang trang khác. | Có biểu mẫu Họ tên, Số điện thoại, Email, Nội dung và nút gửi như trang chủ/giới thiệu; hotline và email ở bên cạnh. |
| Cuộn đến cuối `/dich-vu/tu-van-ky-thuat` | Cùng dải liên hệ ngắn; phải mở trang liên hệ để điền form và mang ngữ cảnh dịch vụ qua URL. | Biểu mẫu hiện ngay trên trang, có nhãn “Dịch vụ đang hỏi: Tư vấn chọn thiết bị”; request gửi đi chứa `Dịch vụ quan tâm` và slug trong `message`. |
| Bấm gửi khi bỏ trống trên mobile | — | Không phát request; form báo lỗi bắt buộc và focus ô Họ và tên. |
| Điền hợp lệ rồi gửi trên danh sách và chi tiết | — | Request được chặn bằng mock để không tạo dữ liệu thử trong database. Payload danh sách có tên, số điện thoại, email, nội dung nhập. Payload chi tiết có tên/slug dịch vụ dù ô nội dung bỏ trống. Cả hai hiện thông báo thành công với phản hồi API giả lập. |
| Mở hai trang dịch vụ ở 360, 390, 768, 1024, 1440, 1920 px | — | HTTP 200, có một biểu mẫu, không tràn ngang và không có `pageerror`. Axe toàn trang ở 390/1440 px không báo vi phạm. `npm.cmd run build` thành công. |

Ảnh trước: `servicesClosingRefined1440.png`, `servicesClosingRefined390.png` và dải cuối trong `detailRefined1440Latest.png`, `detailRefined390Latest.png`. Ảnh sau: `servicesContact1440.png`, `servicesContact390.png`, `serviceDetailContact1440.png`, `serviceDetailContact390.png` trong `frontend/tmp/qa-artifacts/aboutRedesign/`. Có thêm `homeContact1440.png` và `aboutContact1440.png` để đối chiếu biểu mẫu gốc.

Lưu ý kiểm thử: submit hợp lệ chỉ được xác minh với phản hồi API giả lập, không tạo bản ghi thật. Khi quét toàn trang tham chiếu, Axe báo `image-redundant-alt` ở trang chủ mobile và `heading-order` ở trang giới thiệu; hai cảnh báo này nằm ngoài phần dịch vụ vừa sửa, cần kiểm tra riêng nếu tiếp tục rà toàn site.

## Khép khoảng trống trước biểu mẫu — 2026-10-08

Ảnh người dùng gửi sau khi thêm form cho thấy đoạn văn CMS đứng một mình ở cuối “Thông tin nên gửi”, rồi có khoảng trắng lớn trước khối form. Nội dung đó nay nằm dưới tiêu đề ở cột trái của khối liên hệ; tên, nội dung HTML và cách quản lý từ admin được giữ. Chỉ gộp khi hai mục `services-story` và `services-cta` đang hiển thị liền nhau theo layout; nếu admin đổi thứ tự hoặc ẩn một mục, renderer giữ cách hiển thị riêng tương ứng.

| Thao tác | Trước | Sau |
| --- | --- | --- |
| Cuộn từ “Thông tin nên gửi” xuống form trên desktop | Đoạn CMS chỉ chiếm nửa trái, nửa phải trống; form bắt đầu sau một khoảng trắng rõ rệt. | Đoạn CMS trở thành phần giải thích ngay cạnh form. Hai section tiếp giáp, khoảng từ ranh giới đến khung form là 48 px ở 1440/1920 px. |
| Cuộn trên mobile 390 px | Đoạn văn và form nằm ở hai khối tách nhau. | Một khối liên hệ liên tục, đoạn giải thích nằm trên email/hotline rồi tới form; khoảng từ ranh giới đến khung là 32 px. |
| Đếm và kiểm tra đoạn CMS | — | Câu mở “Khách hàng có thể bắt đầu từ nhu cầu thực tế” xuất hiện đúng một lần. |
| Kiểm tra kỹ thuật lại | — | Build/TypeScript thành công; danh sách và chi tiết ở 360–1920 px không tràn ngang hay có `pageerror`; Axe ở 390/1440 px không báo vi phạm trên hai trang dịch vụ. Gửi form với API mock vẫn hoạt động. |

Ảnh người dùng cung cấp là trước sửa; ảnh sau tại `frontend/tmp/qa-artifacts/aboutRedesign/serviceTransition1920.png`, `serviceTransition390.png`, `servicesContact1440.png`, `servicesContact390.png`. Chưa kiểm tra trực tiếp bằng UI admin các biến thể layout do quản trị viên đổi vị trí/ẩn section; nhánh hiển thị tương ứng được giữ trong code.

## Bỏ lời mời gửi trùng nhau — 2026-10-08

Người dùng nhận ra vùng “Thông tin nên gửi” còn link “Gửi yêu cầu”, ngay dưới là tiêu đề form “Gửi yêu cầu” và nút “GỬI YÊU CẦU NGAY”. Đây là ba lần lặp một lời mời trong cùng luồng cuộn.

| Thao tác | Trước | Sau |
| --- | --- | --- |
| Đọc mục “Thông tin nên gửi” khi form đang hiển thị trên cùng trang | Dòng thứ ba có link “Gửi yêu cầu” dẫn sang `/lien-he`, dù form đã ở ngay phía dưới. | Không hiện link `/lien-he` trùng này. Nếu admin ẩn form trong layout, link xuất hiện lại; liên kết admin trỏ đích khác vẫn được giữ. |
| Xem khung form ở danh sách và chi tiết | Tiêu đề “Gửi yêu cầu” lặp ý của nút gửi. | Tiêu đề thành “Thông tin của bạn”; nút gửi vẫn là hành động “GỬI YÊU CẦU NGAY”. Trang chủ/giới thiệu giữ tiêu đề cũ. |
| Kiểm tra DOM và gửi thử trên `/dich-vu` ở 390/1440/1920 px | — | Không còn link “Gửi yêu cầu” trong mục chuẩn bị; trong form có đúng một nút gửi. Biểu mẫu vẫn báo lỗi khi bỏ trống và gửi thành công với API mock. |
| Kiểm tra rộng hơn | — | `npm.cmd run build` thành công; hai trang dịch vụ ở 360–1920 px không tràn ngang hoặc có `pageerror`; Axe 390/1440 px không báo vi phạm. |

Ảnh sau sửa: `frontend/tmp/qa-artifacts/aboutRedesign/serviceTransition1920.png` và `servicesContact1440.png`. Ảnh này thay thế ảnh chụp cùng tên từ các bước kiểm tra trước.
