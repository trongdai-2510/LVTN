# Kiểm tra phân trang danh sách sản phẩm — 2026-10-08

Tài liệu này ghi lại hành vi đã quan sát trong runtime local. Nó không định nghĩa thêm yêu cầu nghiệp vụ.

## Phạm vi và cách tái hiện

- Website `localhost:3000`, API `localhost:4000`, dữ liệu local hiện tại.
- Mở `/san-pham/danh-sach?brands=anfaco%2Ccadivi&sort=popular` ở 1920 px, cuộn đến cuối danh sách; đối chiếu số thẻ, số cột và nút phân trang.
- Dùng Chrome thật qua Playwright: `node scripts/qa/productPagination.cjs`, `node scripts/qa/productListing.cjs` và `node scripts/qa/productCatalogue.cjs`.
- Ảnh sau sửa do bài kiểm thử tạo tại `frontend/tmp/qa-artifacts/productPagination/filtered1920.png` (có thể tái tạo bằng lệnh trên).

## Trước sửa

| Thao tác | Kết quả ban đầu |
| --- | --- |
| Mở URL lọc ANFACO + CADIVI, sắp xếp phổ biến ở 1920 px | 10 sản phẩm trên lưới 4 cột: 4 + 4 + 2; hàng cuối dư 2 vị trí trước phân trang, đúng như ảnh người dùng gửi. |
| Từ trang 1 bấm trang sau rồi dùng Back của trình duyệt | URL về trang 1 nhưng danh sách vẫn là sản phẩm trang 2 trong bài kiểm thử; listener `popstate` bị gắn lại theo mỗi lần render. |
| Mở liên kết cũ có `page_size=10` hoặc `20` | Số lượng mỗi trang không chia hết cho số cột ở một hoặc nhiều breakpoint. |
| Mở số trang vượt phạm vi | API trả danh sách rỗng dù vẫn có sản phẩm ở trang hợp lệ. |

## Sau sửa và kết quả kiểm tra

| Trường hợp | Thao tác kiểm tra | Kết quả |
| --- | --- | --- |
| Lưới responsive | Mở URL người dùng ở 320, 390, 768, 1440, 1920 px; đếm sản phẩm theo hàng và kiểm tra tràn ngang | 12 sản phẩm/trang; lần lượt 12×1, 6×2, 4×3, 3×4. Không tràn ngang, không lỗi JavaScript. |
| Phân trang và lịch sử | Bấm “Trang sau”, so 12 URL sản phẩm với trang 1, dùng Back rồi Forward | Trang 1 và 2 không trùng sản phẩm; Back/Forward khôi phục đúng URL và đúng danh sách. |
| Bốn cách sắp xếp | Gọi API hai trang đầu với `popular`, `newest`, `name_asc`, `name_desc` | Mỗi trang 12 sản phẩm, 24 ID khác nhau. Truy vấn có khóa phụ ID cố định để giữ thứ tự khi các khóa khác bằng nhau. |
| Tám nhóm sản phẩm | Lần lượt mở mỗi nhóm công khai, so số thẻ với API | Các nhóm có ≥12 kết quả đều xếp đủ 3 hàng × 4 cột ở 1920 px; số thẻ khớp API. |
| URL `page_size` cũ | Mở 10, 12, 20, 40 và 1 | Chuẩn hóa về 12, 12, 24, 36 và 12; URL được đưa về dạng chuẩn, các trang đầy không dư ô ở lưới 2/3/4 cột. |
| Trang cuối | Mở trang 100 của bộ lọc ANFACO + CADIVI | 11 sản phẩm đúng với tổng 1.199; hàng cuối 3 sản phẩm là phần dư thực của trang cuối, không có sản phẩm bị lặp hoặc tự chèn. |
| Trang vượt phạm vi | Mở `page=99999` khi có kết quả | Chuyển về trang cuối hợp lệ và hiện đúng sản phẩm. |
| Không có kết quả | Tìm chuỗi không tồn tại, cả khi kèm `page=99999` | Hiện thông báo trống, không có phân trang; số trang vượt phạm vi trở về trang 1. |
| Luồng giao diện khác | Chạy `productListing.cjs` ở 8 độ rộng 320–1920 px, đổi nhóm, sắp xếp, tìm kiếm, mở báo giá và giả lập mạng chậm | Đều đạt; kiểm tra axe trong `main` không báo vi phạm, chuyển nhóm không làm nhảy vị trí danh sách. |
| Chuyển từ trang danh mục và dùng lọc | Chạy `productCatalogue.cjs` ở 390/1440 px, mở nhóm/brand, lọc trong trang danh sách; kiểm tra 320 px | Đều đạt; 8 nhóm và logo thương hiệu còn hiển thị, bảng lọc không che sản phẩm hay tràn ngang. |

Giới hạn: dữ liệu có thể đổi sau thời điểm kiểm tra, nên tổng 1.199 và trang cuối 11 sản phẩm chỉ là kết quả trên database local ngày 2026-10-08. Trang cuối của một tập kết quả không chia hết cho 12 vẫn có thể có hàng cuối chưa đủ cột; đó là phần dư đúng của dữ liệu, không phải trang đầy bị chia sai.
