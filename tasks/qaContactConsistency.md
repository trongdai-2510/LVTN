# Kiểm tra sự nhất quán khối Liên hệ — 2026-10-07

Biên bản này ghi nhận hành vi trên runtime local; không đặt thêm quy tắc nghiệp vụ cho website.

| Trang và thao tác | Trước chỉnh | Sau chỉnh / kết quả |
| --- | --- | --- |
| Trang chủ: cuộn đến khối có form gửi yêu cầu | Khối nền xanh đậm/rực, khác tông sáng của trang Giới thiệu; form không có tiêu đề riêng. | Khối dùng biến thể sáng có viền xanh nhạt; form có cùng nhãn “Biểu mẫu trực tuyến” và tiêu đề “Gửi yêu cầu” như ở trang Giới thiệu. Nội dung do cấu hình trang chủ cấp vẫn giữ nguyên. |
| Giới thiệu: cuộn đến khối Liên hệ | Đã được chỉnh về nền sáng ở lần trước. | Giữ nền sáng, thông tin công ty và form đầy đủ. Cùng hệ màu xanh nhạt, chữ xanh đậm, nút xanh với trang chủ. |
| Dịch vụ và Thương hiệu: cuộn đến CTA cuối | Các khối ngắn đã dùng nền sáng, nút xanh. | Giữ bố cục ngắn vì chỉ dẫn sang trang Liên hệ; bấm “Gửi yêu cầu tư vấn” và “Liên hệ Song Thanh” đều mở `/lien-he`. |
| Liên hệ: mở trang riêng | Đây là trang tiếp nhận có form và thông tin riêng. | Giữ trang chức năng riêng, không ép thành CTA ngắn. |
| Mở 5 trang ở mobile 390 px | — | `/`, `/gioi-thieu`, `/dich-vu`, `/doi-tac-thuong-hieu`, `/lien-he` đều HTTP 200, không tràn ngang, không lỗi JavaScript. |
| Gửi form rỗng ở trang chủ và Giới thiệu | — | Trường họ tên nhận focus và hiện lỗi “Vui lòng nhập họ và tên”; không gửi dữ liệu. |
| Build production của frontend | — | `npm.cmd run build` thành công, gồm kiểm tra TypeScript. |

Ảnh kiểm tra desktop: `frontend/tmp/qa-artifacts/aboutRedesign/homeContactUnified1440.png`, `aboutContactUnified.png`, `servicesContactUnified.png`, `brandsContactUnified.png`. Ảnh mobile trang chủ: `frontend/tmp/qa-artifacts/aboutRedesign/homeContactUnified390.png`.
