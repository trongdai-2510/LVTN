# Kiểm tra trang Liên hệ — 2026-10-07

Biên bản này ghi nhận code và runtime local tại thời điểm kiểm tra; không phải tài liệu yêu cầu nghiệp vụ.

## Dữ liệu và ảnh trước sửa

- Trang: `http://localhost:3000/lien-he`.
- Hiện không có banner công khai được gán cho vị trí hero Liên hệ; trang dùng hero dự phòng. Tiêu đề và mô tả lấy từ nội dung trang đang xuất bản, hotline/email/địa chỉ/giờ làm việc lấy từ thông tin công ty.
- Ảnh trước sửa: `frontend/tmp/qa-artifacts/aboutRedesign/contactBefore1440.png`, `contactBefore390.png`.

| Thao tác | Trước sửa | Sau sửa |
| --- | --- | --- |
| Mở trang desktop và mobile | Hero có thẻ “Phiếu tiếp nhận” mô phỏng, dải vàng/xanh khác hệ màu trang; sau đó là hai thẻ trắng lớn. | Hero dùng nền và chữ theo token hiện hành; số điện thoại và email thật xuất hiện ngay đầu trang. Form và thông tin trực tiếp tách rõ, không còn thẻ quy trình mô phỏng. |
| Bấm hai hành động ở hero | “Gửi yêu cầu” và “Thông tin liên hệ” đều dẫn tới `#gui-yeu-cau`. | Nút đầu dẫn tới `#gui-yeu-cau` (đầu khối cách mép trên 96 px); nút sau dẫn tới `#thong-tin-lien-he` (112 px), không bị header che. |
| Cuộn đến bản đồ | Ảnh nhúng Google Maps hiện trắng trong trình duyệt kiểm thử, để lại một vùng trống lớn. | Địa chỉ và liên kết “Mở trong Google Maps” luôn thấy được. Bản đồ nhúng nằm trong khối “Bản đồ tương tác”, chỉ mở khi chọn; có hướng dẫn dùng liên kết ngoài nếu ảnh nhúng không hiện. Mở/đóng khối hoạt động, iframe có tiêu đề. |
| Gửi form rỗng | Form báo các trường bắt buộc nhưng không đưa con trỏ tới trường đầu. | Ba trường bắt buộc báo lỗi, họ tên nhận focus; không gửi request. |
| Nhập email sai, còn lại điền hợp lệ | — | Hiện “Email không hợp lệ.” và focus vào trường email; không gửi request. |
| Mở từ dịch vụ `tu-van-ky-thuat` | — | Khối “Dịch vụ đang hỏi” và liên kết quay lại dịch vụ vẫn có. Khi gửi qua phản hồi API giả lập, payload giữ `source_page=/lien-he?dich-vu=tu-van-ky-thuat`, nội dung có tên dịch vụ; form hiển thị thành công rồi xóa dữ liệu đã nhập. Không tạo yêu cầu thật trong database. |
| Mở tại 360, 390, 768, 1024, 1440, 1920 px | — | HTTP 200, đúng một H1, không tràn ngang, không lỗi JavaScript. Kiểm tra axe trong `main` không báo vi phạm. |
| Chạy build production | — | `npm.cmd run build` trong `frontend/` thành công, gồm kiểm tra TypeScript. Màn xem trước nội dung trong admin đã được cập nhật theo bố cục trang công khai. |

Ảnh sau sửa: `frontend/tmp/qa-artifacts/aboutRedesign/contactRedesign1440.png`, `contactRedesign390.png`.

Giới hạn: Google Maps iframe có thể bị trình duyệt hoặc mạng chặn. Kiểm thử đã xác nhận liên kết Google Maps được tạo từ địa chỉ công khai; chưa xác nhận bản đồ nhúng hiển thị trên mọi mạng. Màn xem trước trong admin đã qua build nhưng chưa kiểm thử tương tác của trình biên tập nội dung.

## Chỉnh tiếp ngày 2026-10-08 theo phản hồi “mờ nhạt”

| Thao tác | Trước lần chỉnh này | Sau lần chỉnh này |
| --- | --- | --- |
| Mở đầu trang ở desktop và mobile | Hero, form và bản đồ đều dùng nền trắng hoặc xanh rất nhạt, thiếu điểm nhấn. | Hero giữ nền trắng nhưng có vùng xanh thương hiệu `#004ab4` chứa hotline, email và giờ làm việc thật. Nội dung chính vẫn lấy từ trang đã xuất bản. |
| Cuộn đến form | Form màu gần giống nền trang, viền mảnh. | Form nền trắng có viền xanh ở trên, đặt trên nền xanh nhạt theo token `--color-bg-subtle`; chức năng và các trường không đổi. |
| Cuộn đến bản đồ | Thẻ mở bản đồ và nền khu vực đều rất nhạt. | Khu vực dùng nền trắng, thẻ mở bản đồ có sắc xanh nhạt để nhận biết là một thao tác riêng; liên kết mở Google Maps vẫn hiện. |
| Mở ở 360, 390, 768, 1024, 1440, 1920 px | — | HTTP 200, một H1, không tràn ngang và không lỗi JavaScript. Vùng liên hệ tính từ trình duyệt là `rgb(0, 74, 180)`; form `rgb(255, 255, 255)`. |
| Bấm hai liên kết trong hero, mở bản đồ và gửi form rỗng | — | Điểm cuộn của form/chi tiết lần lượt ở 96/112 px dưới mép trên; bản đồ mở được; form báo ba lỗi và focus trường họ tên. Kiểm tra axe trong `main` không báo vi phạm. |

Ảnh sau lần chỉnh này: `frontend/tmp/qa-artifacts/aboutRedesign/contactVivid1440.png`, `contactVivid390.png`. Nội dung trong admin preview dùng cùng hero và màu nền form như trang công khai; chưa kiểm thử tương tác của trình biên tập.

## Chỉnh tiếp ngày 2026-10-08 theo phản hồi về bố cục và bản đồ

| Thao tác | Trước lần chỉnh này | Sau lần chỉnh này |
| --- | --- | --- |
| Mở đầu trang Liên hệ | Hotline, email và giờ làm việc nằm trong một thẻ xanh cao, tách khỏi phần giới thiệu, làm bố cục mất cân đối. | Đầu trang chia rõ tiêu đề và lời dẫn; ba kênh liên hệ nằm trong dải xanh ngang ngay dưới, tự xếp dọc trên điện thoại. Số và email vẫn bấm gọi/gửi thư được. |
| Cuộn tới văn phòng | Bản đồ nằm trong khối đóng; phải bấm mở mới thấy iframe. | Google Maps nhúng hiện ngay trên trang, không cần thao tác mở. Đã cuộn tới bản đồ và chụp vùng nhìn thấy ở 390 và 1440 px: ảnh bản đồ và ghim vị trí xuất hiện. Liên kết mở Google Maps vẫn có bên cạnh địa chỉ. |
| Mở trang ở 360, 390, 768, 1024, 1440, 1920 px | — | HTTP 200; mỗi kích thước có đúng một H1, có iframe bản đồ, không tràn ngang, không có lỗi JavaScript trên trang. |
| Bấm hai liên kết đầu trang | — | “Gửi yêu cầu” đưa đến đầu khối form cách mép trên 96 px; “Thông tin liên hệ” đưa đến đầu khối chi tiết cách 112 px. |
| Gửi form rỗng | — | Ba trường bắt buộc báo lỗi; con trỏ trở về trường họ tên. |
| Kiểm tra build và khả năng tiếp cận | — | `npm.cmd run build` thành công, gồm TypeScript; axe quét toàn trang không báo vi phạm. |

Ảnh vùng nhìn thấy bản đồ: `frontend/tmp/qa-artifacts/aboutRedesign/contactMapViewport1440.png`, `contactMapViewport390.png`. Ảnh toàn trang: `contactFinalMap1440.png`, `contactFinalMap390.png`. Chromium chụp **toàn trang** có thể để trắng nội dung iframe ngoài khung nhìn; ảnh vùng nhìn thấy được chụp sau khi cuộn tới bản đồ và chờ tải, nên dùng để đối chiếu bản đồ thực tế. Bản đồ vẫn phụ thuộc kết nối Google Maps; liên kết ngoài là đường mở thay thế khi dịch vụ nhúng bị chặn.
