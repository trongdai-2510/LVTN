# Kiểm thử gợi ý tìm kiếm website — 2026-10-08

Phạm vi: ô tìm kiếm ở header website công khai và bảng gợi ý dùng lại trong danh sách sản phẩm. Đây là ghi nhận từ code/API/runtime local tại thời điểm kiểm thử, chưa phải đặc tả nghiệp vụ được xác nhận.

## Dữ liệu và lỗi ban đầu

- Truy vấn API `GET /public/search-suggestions?q=Bộ hẹn giờ analog` trả một `variant` mã `CCT15101` và một `product_group` cùng tên, cùng `group_slug`.
- Trước sửa: header hiển thị hai dòng gần như giống hệt nhau trong bảng gợi ý hẹp, người dùng khó biết nên chọn dòng nào. Ảnh: [desktop](../frontend/tmp/qa-artifacts/newsRedesign/headerSearchBefore1440.png), [mobile](../frontend/tmp/qa-artifacts/newsRedesign/headerSearchBefore390.png).
- Khi kiểm thử bàn phím sau thay đổi giao diện, phát hiện Esc từ danh sách đóng rồi mở lại ngay do thao tác trả focus vào ô tìm kiếm.
- Khi đổi từ khóa lúc request cũ còn chạy, hook vẫn giữ danh sách cũ tới lúc request mới hoàn tất, có thể cho người dùng bấm kết quả không khớp từ khóa mới.

## Thay đổi và kết quả

| Thao tác | Ban đầu | Sau sửa |
| --- | --- | --- |
| Nhập `Bộ hẹn giờ analog` | Hai gợi ý trùng tên sản phẩm/model | Một gợi ý sản phẩm, hiện mã `CCT15101` trong dòng phụ; bấm mở hồ sơ sản phẩm |
| Nhập đúng `CCT15101`, nhấn Enter | Luồng trực tiếp tới model đã có | Vẫn mở `/san-pham/...?...variant=CCT15101` |
| Nhấn “Xem tất cả kết quả” | Không có lối rõ ràng trong bảng gợi ý cũ | Mở `/tim-kiem?q=...`; trong danh sách sản phẩm mở `/san-pham/danh-sach?q=...` |
| ArrowDown/ArrowUp, Esc | Esc bị mở lại trong lần kiểm thử đầu | Di chuyển qua gợi ý/nút xem tất cả, Esc đóng và trả focus về ô tìm kiếm |
| Gõ nhanh từ khóa khác | Có thể thấy gợi ý cũ dưới từ khóa mới | Xóa gợi ý cũ ngay, hiển thị trạng thái đang tìm |
| Từ khóa rộng `ống` | Danh sách dài trong khung chật, nhãn “MODEL / SKU” lặp ở từng hàng và phải cuộn trong bảng | Ba gợi ý ngắn gọn, không có thanh cuộn lồng; tên và mã dễ đọc, có đường xem tất cả |
| Từ khóa không có kết quả | Trạng thái không nổi bật | Có thông báo không tìm thấy và đường xem toàn bộ |

Đã chạy Playwright tại 390, 768 và 1440 px: bảng nằm trong viewport, không tạo cuộn ngang, click/Enter/bàn phím/đường dẫn hoạt động; kiểm tra axe riêng vùng gợi ý không có vi phạm. Kiểm thử dùng API local hiện tại, không ghi dữ liệu. Script chạy lại: `node scripts/qa/headerSearch.cjs` (cần frontend/API local và dependency Playwright trong `admin/`). Ảnh sau sửa với từ khóa [ống trên desktop](../frontend/tmp/qa-artifacts/newsRedesign/broadSearchAfter1440.png) và [ống trên mobile](../frontend/tmp/qa-artifacts/newsRedesign/broadSearchAfter390.png); thử tên cụ thể: [desktop](../frontend/tmp/qa-artifacts/newsRedesign/headerSearchAfter1440.png), [mobile](../frontend/tmp/qa-artifacts/newsRedesign/headerSearchAfter390.png). `npm run build` đã qua.
