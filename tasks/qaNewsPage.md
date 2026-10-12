# Kiểm tra trang Tin tức — 2026-10-08

Biên bản ghi nhận code và runtime local trong lần làm lại giao diện này; không xác lập yêu cầu nghiệp vụ mới. Dữ liệu bài viết, chuyên mục, nội dung trang và banner `NEWS_HERO` tiếp tục lấy từ API/CMS hiện hành.

## Các thao tác và kết quả

| Thao tác | Trước khi sửa | Sau khi sửa |
| --- | --- | --- |
| Mở `/tin-tuc` và xem đầu trang | Banner quản trị đã có dòng “Tin tức Song Thanh”, ngay dưới lại là tiêu đề “Tin tức & Sự kiện” cỡ lớn. | Giữ banner do admin quản lý. Phần sau banner chuyển thành lời dẫn “Mới cập nhật” ngắn; tiêu đề CMS vẫn có trong cấu trúc truy cập của trang, không lặp thành một tiêu đề lớn. |
| Đọc bài nổi bật | Bài `Xu hướng tự động hóa nhà máy năm 2026` được chọn trước dù không có ảnh; thẻ nổi bật rộng nhưng gần như trống một bên. | Ưu tiên bài được đánh dấu nổi bật **và có ảnh**. Dữ liệu hiện tại đưa bài `Phân biệt MCB, MCCB, ACB, RCCB, RCBO…` lên đầu với ảnh, tiêu đề, ngày và tóm tắt rõ. Bài không ảnh vẫn nằm trong danh sách. |
| Lướt các bài khác | Lưới ba cột nhiều thẻ nhỏ; bài thiếu ảnh tạo khoảng trắng lớn trong thẻ. | Danh sách hai cột trên desktop, một cột trên mobile; mỗi mục có tiêu đề lớn hơn, ngày/chuyên mục và ảnh nhỏ nếu có. Bài không ảnh là dòng văn bản gọn, không có ô rỗng. |
| Chọn `Kỹ thuật` trong thanh chuyên mục | Banner và tiêu đề trang chính vẫn chiếm phần đầu trang lọc. | Link mở `/tin-tuc?category=ky-thuat`; banner không lặp ở kết quả lọc, tiêu đề chuyên mục và trạng thái nút lọc hiện ngay trước danh sách. Trang trả 10 bài, phân hai trang trong dữ liệu local. |
| Gõ `MCB` trong ô tìm và bấm nút tìm | Vẫn vào trang có banner lớn trước khi thấy kết quả. | Link mở `/tin-tuc?q=MCB`; phần kết quả hiện ngay, có từ khóa, số lượng 2 bài và link xóa tìm kiếm. |
| Tìm `khongcotukhoanhiem246810` không có kết quả | Từ khóa bị lặp ở dòng kết quả và hộp trống cao 280 px. | Trang trả 200, hiện 0 bài và một thông báo ngắn gợi ý dùng từ khóa khác hoặc xem tất cả; không lặp từ khóa trong thông báo. |
| Mở trang 2 của danh sách | Phân trang dùng nút 40 px; banner lớn xuất hiện lại trước các bài tiếp theo. | `/tin-tuc?page=2` trả 7 bài trong dữ liệu local và vào thẳng kết quả; các nút cao/rộng tối thiểu 44 px, trang hiện tại được đánh dấu cho công nghệ hỗ trợ. |
| Mở trang 2 sau khi chọn `Kỹ thuật` | — | Link phân trang giữ `category=ky-thuat`; trang tiếp theo không lặp banner. |
| Bấm bài từ danh sách trên điện thoại rồi bấm liên hệ | — | Mở được bài chi tiết có tiêu đề H1, sau đó đi tới `/lien-he`. |
| Đọc bài chi tiết, bấm mục lục | Tiêu đề đích dừng ở `top ≈ 0 px`, bị header sticky cao 73–97 px che. | Tiêu đề dừng ở `top ≈ 128 px` trên mobile/desktop, nhìn thấy đầy đủ bên dưới header. |
| Xem bài liên quan trong chi tiết | Bài thiếu ảnh là thẻ cao tối thiểu 220 px với vùng trống lớn. | Cùng kiểu danh sách gọn của trang tin; mục thiếu ảnh vẫn đọc được mà không tạo thẻ rỗng. Lời mời liên hệ cuối bài đồng bộ với trang danh sách. |

## Kiểm tra kỹ thuật

- Mở danh sách, lọc, tìm kiếm, trang 2 và bài chi tiết ở 390, 768, 1440 px: HTTP 200; đúng một H1 mỗi trang; không tràn ngang hoặc có `pageerror`.
- Chạy Playwright bằng Chrome local với các thao tác bấm thật; kiểm tra bài từ danh sách, chuyển tới liên hệ, chọn chuyên mục, gửi tìm kiếm, bấm mục lục và đo vị trí tiêu đề sau cuộn.
- Axe quét WCAG 2 A/AA và 2.1 A/AA trên danh sách ở 390/1440 px và chi tiết ở 1440 px: không báo vi phạm.
- `npm.cmd run build` hoàn tất, gồm TypeScript.

Ảnh trước: `frontend/tmp/qa-artifacts/newsRedesign/listingBefore1440.png`, `listingBefore390.png`, `categoryBefore1440.png`, `searchBefore390.png`, `articleBefore1440.png`. Ảnh sau: cùng thư mục với tên `listingVerified1440.png`, `listingVerified390.png`, `categoryVerified1440.png`, `searchVerified390.png`, `articleVerified1440.png`, `articleVerified390.png`. Script thao tác là `verifyNews.cjs` trong thư mục đó.

Giới hạn: kiểm tra trên dữ liệu local và Chrome; chưa thử admin thay banner, chuyên mục hay số lượng bài trong khi đang mở trang. Một vài bài đang dùng ảnh giống nhau trong CMS; lượt này chỉ thay cách trình bày, không sửa dữ liệu bài viết.

## Đồng nhất phần liên hệ — 2026-10-08

Người dùng yêu cầu chỉnh tiếp phần liên hệ của trang tin. Trước lượt này, danh sách và bài chi tiết chỉ có một dải nhỏ với nút chuyển sang `/lien-he`. Hai trang nay dùng cùng `HomeContactCtaSection` và `HomeQuoteRequestForm` đang chạy ở trang chủ/dịch vụ. Email và hotline lấy từ cấu hình website hiện hành; không thêm endpoint, trường dữ liệu hoặc quy trình xử lý mới. Trang xem trước trong admin cũng nhận cùng thông tin công ty để hiển thị đúng khối liên hệ.

| Thao tác | Trước | Sau |
| --- | --- | --- |
| Cuộn tới cuối `/tin-tuc` | Dải mời liên hệ gọn, chỉ có nút sang trang khác. | Có email, hotline và form Họ tên, Số điện thoại, Email, Nội dung ngay tại chỗ; tiêu đề form “Thông tin của bạn”. |
| Cuộn tới cuối bài chi tiết | Lời mời liên hệ nhỏ nằm giữa nội dung và bài liên quan. | Chỉ còn một khối liên hệ sau bài liên quan, cùng bố cục và màu với danh sách tin. |
| Bấm gửi khi form trống trên mobile | — | Hiện lỗi bắt buộc, chuyển focus tới Họ và tên, không phát request. |
| Điền hợp lệ rồi gửi trên hai trang | — | Dùng mock API để không ghi dữ liệu thử. Mỗi form phát đúng một POST `/public/quote-requests` gồm họ tên, điện thoại, email, nội dung; hiện thông báo thành công. |
| Kiểm tra 390, 768, 1440 px | — | Mỗi trang HTTP 200, đúng một form, thông tin công ty hiện đúng, không tràn ngang hoặc có `pageerror`. Axe toàn trang ở 390 px không báo vi phạm; build/TypeScript thành công. |

Ảnh trước nằm ở `listingVerified1440.png`, `listingVerified390.png`, `articleVerified1440.png`, `articleVerified390.png`; ảnh sau là `listingContact1440.png`, `listingContactViewport390.png`, `articleContact1440.png`, `articleContact390.png` trong `frontend/tmp/qa-artifacts/newsRedesign/`. Script kiểm tra là `verifyNewsContact.cjs` cùng thư mục. Phản hồi gửi thành công được giả lập, không tạo bản ghi trong database.
