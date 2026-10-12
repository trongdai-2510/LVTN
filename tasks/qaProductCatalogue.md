# Kiểm thử danh mục sản phẩm — 08/10/2026

Biên bản này ghi thao tác trên website/API local hiện tại; đây không phải đặc tả nghiệp vụ đã được người dùng xác nhận.

| Thao tác | Trước khi sửa | Sau khi sửa |
| --- | --- | --- |
| Mở `/san-pham` ở 390 và 1440 px | Ô “Tìm danh mục sản phẩm” đứng riêng trong một khung rộng, dù tám nhóm đang có đã được trình bày ngay phía dưới. | Bỏ ô tìm và khung trống. Tám nhóm, sản phẩm xem trước và logo thương hiệu theo từng nhóm vẫn hiện. Không tràn ngang; axe không báo vi phạm trong vùng danh mục. |
| Mở nhóm ĐÈN LED hoặc bấm logo CADIVI trong Dây Dẫn | Cần giữ đúng đường dẫn danh mục/thương hiệu khi giản lược giao diện. | Mở đúng danh sách theo nhóm hoặc nhóm + thương hiệu. |
| Mở `/san-pham/danh-sach?parent=day-dan` ở desktop | Hàng nhóm chính và nút “Tìm danh mục” cùng liệt kê tám nhóm giống nhau; bảng chọn đè lên thẻ sản phẩm. | Chỉ còn hàng nhóm chính để đổi trực tiếp. Nút và ô tìm danh mục được bỏ; trong nội dung chỉ có một ô tìm sản phẩm/thương hiệu. |
| Mở Lọc khi đang xem Dây Dẫn | Khung lọc nổi che sản phẩm phía dưới. | Nhóm con, thương hiệu, trạng thái và thông số nằm trong phần mở rộng cùng thanh công cụ. Sản phẩm được đẩy xuống; đo vị trí đáy bộ lọc không vượt qua đầu lưới. |
| Đổi Dây Dẫn → Đèn LED → Tất cả → Dây Dẫn → chọn Dây Điện → Ống PVC | Cần kiểm tra bộ lọc con có bị giữ sai khi đổi nhóm. | URL, tiêu đề và sản phẩm cập nhật đúng; danh mục con được bỏ khi sang nhóm khác. |
| Mở trên mobile 390 px | Cần một đường chọn danh mục mà không lặp hàng nhóm desktop. | Nút Danh mục mở danh sách ngay trong thanh công cụ; chọn nhóm xong tự đóng. Lọc mở trong trang, không tràn ngang hoặc che sản phẩm. Escape đóng bộ lọc. |
| Mở Lọc ở Dây Dẫn, chọn Dây Điện rồi CADIVI | Trước lần sửa này, chọn điều kiện đầu tiên làm bảng lọc đóng; nút Lọc không cho biết đang áp dụng mấy điều kiện, lựa chọn trong bảng quá nhạt. | Sau mỗi lần chọn, bảng lọc vẫn mở; cả hai điều kiện giữ trạng thái đã chọn rõ ràng. Nút Lọc nổi bật và hiện số `2`. Người dùng tự đóng bằng nút × hoặc Escape. |
| Mở Lọc từ tất cả sản phẩm, chọn CADIVI rồi DAPHACO | Bộ lọc thương hiệu chỉ giữ một slug, nên không thể chọn hai thương hiệu liên tiếp đúng nghĩa. | URL giữ `brands=cadivi,daphaco`; cả hai lựa chọn vẫn được đánh dấu, bảng lọc vẫn mở và nút Lọc hiện `2`. |
| Mobile 390 px, chọn MPE trong Lọc | Bảng lọc đóng sau một lựa chọn. | Bảng lọc vẫn mở, MPE được đánh dấu và nút Lọc hiện `1`; sản phẩm vẫn nằm bên dưới, không bị bảng lọc che. |
| Mở danh sách ở desktop rồi so hàng tìm kiếm / Lọc / Sắp xếp | Ô tìm kiếm bị giới hạn chiều rộng, để khoảng trống lớn giữa ô và các nút; nút Lọc quá nhỏ, nhãn Sắp xếp tách khỏi giá trị. | Ô tìm kiếm dùng phần rộng còn lại của hàng; nút Lọc và Sắp xếp cao bằng ô tìm. Sắp xếp hiển thị nhãn cùng giá trị; nút Lọc đổi sang nền xanh khi mở. |
| Mở Lọc tại Dây Dẫn trước khi chọn điều kiện | Có nút “Xóa tất cả” dù chỉ đang ở nhóm Dây Dẫn; các điều kiện trải rộng trên cả hàng. | Không hiện Xóa lọc khi chưa chọn điều kiện trong bảng. Nhóm con và thương hiệu chia hai cột trên desktop; nút “Xem … sản phẩm” đóng bảng rõ ràng. |
| Chọn Dây Điện và CADIVI rồi bấm Xóa lọc | Trước đó Xóa tất cả đồng thời đưa người dùng ra khỏi Dây Dẫn. | Bỏ hai điều kiện nhưng giữ `parent=day-dan`; bảng vẫn mở và tiêu đề trở lại DÂY DẪN. |
| Mở danh sách trên 320 px | Chữ Danh mục có thể bị xuống dòng trong nút hẹp. | Hiện nhãn ngắn “Nhóm” ở dưới 360 px, tên truy cập vẫn là “Danh mục”; không tràn ngang. |
| Trên 320 px, mở Lọc rồi chọn CADIVI | Cần chắc hàng điều khiển và tiêu đề bảng lọc không vỡ khi xuất hiện số điều kiện và nút Xóa lọc. | Bảng lọc vẫn mở, CADIVI được đánh dấu, nút Lọc hiện `1`; toàn trang rộng đúng 320 px, không tràn ngang. |

## Quy mô giả lập

`node scripts/qa/categoryScale.cjs` tạo 1.000 danh mục chính và 1.000 danh mục con trong bộ nhớ. Mỗi trang có tám mục; trang 125 chứa mục 992–999. `/san-pham` chỉ tải xem trước cho tám danh mục trên trang hiện tại. Đây là kiểm tra logic phân trang, chưa đo tải với 1.000 bản ghi trong database thật.

Đã chạy `node scripts/qa/productCatalogue.cjs`, `node scripts/qa/productListing.cjs`, `node scripts/qa/categoryScale.cjs` và `npm.cmd run build`. Ảnh: [trang danh mục](../frontend/tmp/qa-artifacts/productCatalogue/catalogOverview1440.png), [danh sách và thanh điều khiển](../frontend/tmp/qa-artifacts/productListing/listing1440.png), [bộ lọc đã chọn hai điều kiện](../frontend/tmp/qa-artifacts/productCatalogue/filterSelected1440.png), [bộ lọc mobile 390 px](../frontend/tmp/qa-artifacts/productCatalogue/filterMobileTop390.png), [bộ lọc mobile 320 px](../frontend/tmp/qa-artifacts/productCatalogue/filterMobile320.png).
