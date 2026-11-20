# Kiểm thử danh sách sản phẩm — 08/10/2026

Phạm vi: website công khai `/san-pham/danh-sach` với dữ liệu local hiện tại. Đây là biên bản thao tác, không phải đặc tả nghiệp vụ.

| Thao tác | Kết quả ban đầu | Kết quả sau sửa |
| --- | --- | --- |
| Mở Dây Dẫn ở desktop | Cột lọc dọc rồi bảng chọn danh mục riêng gây trùng với hàng danh mục; bảng nổi che thẻ sản phẩm. | Hàng danh mục đổi nhóm trực tiếp; không còn nút hay ô “Tìm danh mục”. Tìm sản phẩm/thương hiệu, Lọc và Sắp xếp nằm trong cùng thanh. Lưới ba cột ở 1440 px, bốn cột ở 1920 px. |
| Mở Lọc khi đang xem Dây Dẫn | Bảng thương hiệu che sản phẩm, phần nhóm con nằm ở một chỗ khác. | Nhóm con và thương hiệu ở một phần mở rộng liền mạch. Khi mở, lưới sản phẩm dịch xuống dưới đáy bộ lọc; không có lớp phủ. Chọn Dây Điện ra đúng URL `categories=day-dien`. |
| Đổi nhóm trên mobile 390 px | Cần tránh hiện cả hàng danh mục và bảng chọn trùng nhau. | Chỉ có nút Danh mục; bảng chọn mở trong trang rồi tự đóng sau khi chọn. Bộ lọc cũng mở trong trang; không tràn ngang. |
| Đổi Dây Dẫn → Đèn LED ở 390, 768, 1024, 1280, 1360, 1440 và 1920 px | Danh sách có lúc bị làm mờ hoặc nhảy khi chờ API. | Đổi nhóm thành công ở cả bảy kích thước. Đầu lưới giữ nguyên vị trí, không có lỗi JavaScript hoặc tràn ngang; CLS đo được dưới 0,001 trong lần chạy cuối. |
| Giả lập API chậm 1,2 giây | Cần bảo đảm điều khiển và thẻ không biến mất khi chờ. | Thanh báo tải nhỏ xuất hiện sau 400 ms; bộ lọc vẫn có mặt, thẻ giữ nguyên độ mờ và vị trí. |
| Sắp xếp, báo giá, tìm `led`, quay lại | Cần bảo đảm các tác vụ vẫn hoạt động sau khi đổi bố cục. | Sắp xếp A–Z, mở danh sách yêu cầu báo giá, tìm `led` và quay lại đều hoạt động. |
| Đi từ `/san-pham` khi đang cuộn sâu | Có thể giữ vị trí cuộn cũ. | Danh sách mở ở đầu trang (`scrollY=0`). |

Đã chạy `node scripts/qa/productListing.cjs`; axe trên nội dung chính không báo vi phạm ở cả bảy kích thước. `npm.cmd run build` thành công. Ảnh: [danh sách desktop](../frontend/tmp/qa-artifacts/productListing/listing1440.png), [danh sách mobile](../frontend/tmp/qa-artifacts/productListing/listing390.png), [bộ lọc mở trong trang](../frontend/tmp/qa-artifacts/productCatalogue/filterInline1440.png). Kiểm tra 1.000 mục giả lập nằm trong [biên bản danh mục](qaProductCatalogue.md).
