# Kiểm thử trang Giới thiệu công khai — 2026-10-07

Đây là biên bản quan sát trên runtime local, không phải tài liệu yêu cầu nghiệp vụ.

## Môi trường và dữ liệu

- Website: http://localhost:3000/gioi-thieu; API: http://localhost:4000.
- Nội dung đang xuất bản: “Về Song Thanh”, các mục “Lĩnh vực hoạt động”, “Đối tượng khách hàng”, “Cam kết”; hai khối admin “Hướng phát triển” và “Năng lực cốt lõi”.
- Banner Giới thiệu hiện là một ảnh image_only, không có ảnh mobile. Hồ sơ năng lực PDF nằm trong thư mục public của frontend.
- Bằng chứng trước sửa: frontend/tmp/qa-artifacts/aboutRedesign/beforeDesktopViewport.png, beforeMobileViewport.png.

## Trước sửa

| Thao tác | Quan sát |
| --- | --- |
| Mở trang Giới thiệu ở desktop 1440 px | Banner lớn chứa chữ ngay trong ảnh; phần giới thiệu nằm dưới trong cột hẹp, cạnh một thẻ hồ sơ cao và gần như trống. |
| Mở ở mobile 390 px | Chữ trong banner bị thu nhỏ; thẻ hồ sơ chiếm chỗ trước nội dung giới thiệu. |
| Đọc tiếp các khối do admin cấu hình | Các mục chuyển thành danh sách và ô thông tin lặp lại, nhịp đọc bị ngắt. |

## Sau sửa

| Thao tác | Kết quả |
| --- | --- |
| Mở trang tại 390, 768, 1024, 1440 px | HTTP 200; tiêu đề chữ thật “Về Song Thanh” xuất hiện một lần; không tràn ngang và không có lỗi JavaScript. |
| Đọc từ banner xuống nội dung | Tóm tắt và nút hành động đọc được ngay; ảnh banner hiện như hình minh họa không còn đoạn chữ bị cắt. Nội dung HTML và thứ tự các khối admin vẫn hiện đầy đủ. |
| Cuộn tới “Tài liệu doanh nghiệp” | Bìa hồ sơ tải được; đường dẫn xem hồ sơ trả HTTP 200 và PDF trả HTTP 200. |
| Bấm “Tìm hiểu về chúng tôi” sau khi trang tải | URL có #about-story; mục giới thiệu nằm dưới header (top 96 px). |
| Bấm “Liên hệ Song Thanh” | Điều hướng tới /lien-he. |
| Chạy npm.cmd run typecheck và npm.cmd run build trong frontend/ | Cả hai hoàn thành thành công. |

Bằng chứng sau sửa: frontend/tmp/qa-artifacts/aboutRedesign/finalViewport390.png, finalViewport1440.png, afterFinal390.png, afterFinal1440.png.

Phạm vi chưa kiểm: thao tác biên tập banner và khối nội dung trong admin; đợt này chỉ xác nhận dữ liệu công khai hiện hành sau khi render.

## Chỉnh tiếp sau phản hồi “trống trải”

| Thao tác | Trước lần chỉnh này | Sau lần chỉnh này |
| --- | --- | --- |
| Mở trang ở desktop 1440 px và đọc phần giới thiệu | Nội dung HTML dồn vào một cột; bên cạnh bìa hồ sơ nhỏ còn nhiều khoảng trắng. | Đoạn mở đầu giữ chiều dài dễ đọc; các mục liệt kê phân thành hai cột, bìa tài liệu rộng hơn. |
| Đọc “Hướng phát triển” | Tiêu đề chiếm cột trái, ba ý dồn ở cột phải. | Ba ý trải đều theo chiều ngang trên desktop, xếp dọc trên mobile. |
| Cuộn toàn trang 1440 px | Chiều cao khoảng 5.432 px. | Chiều cao khoảng 4.571 px; nội dung, liên hệ và CTA vẫn đủ. |
| Bấm liên kết trong “Hướng phát triển” | Chưa kiểm lại trong bố cục mới. | Hai liên kết hiện đúng /dich-vu và /lien-he; bấm “Xem dịch vụ” mở trang Dịch vụ. |
| Mở ở 360, 390, 768, 1024, 1440, 1920 px | — | HTTP 200, một H1, không tràn ngang, không lỗi JavaScript, các mục nội dung admin còn đủ. Bố cục hai cột chữ chỉ bật từ 1280 px để tránh cột quá hẹp. |
| Chạy build production | — | npm.cmd run build thành công. |

Bằng chứng mới: frontend/tmp/qa-artifacts/aboutRedesign/denser1440.png, denser390.png, denserViewport1920.png. Ảnh chụp toàn trang không tự tải các logo nằm dưới màn hình; khi cuộn tới dải thương hiệu, logo hiển thị và không có request lỗi.

## Chỉnh theo phản hồi về banner, chữ và Liên hệ

| Thao tác | Trước lần chỉnh này | Sau lần chỉnh này |
| --- | --- | --- |
| Đối chiếu banner trong admin với dữ liệu công khai | Trang dùng ảnh ở vị trí `gioi-thieu` như ảnh minh họa bị cắt trong bố cục tự dựng, khiến người xem khó biết đó là banner do admin quản lý. | API `/public/banners?position=gioi-thieu` trả một banner `image_only`, ID `9a7a0634-c759-4b0a-b60a-9d04044eeaa0`, tệp `ff261a80-f404-43d0-93d2-00b74a686652`. Ảnh trên trang có đúng `src=/public/files/ff261a80-f404-43d0-93d2-00b74a686652` và hiện nguyên khung; không tạo banner hay dữ liệu quản lý mới. |
| Đọc phần nội dung ngay sau banner | Tiêu đề và ý chính nhỏ, một tiêu đề “Song Thanh” từ nội dung CMS lặp với tiêu đề trang. | H1 “Về Song Thanh” được tăng cỡ và chỉ xuất hiện một lần; phần mở đầu nổi bật, tiêu đề CMS trùng ở đầu bài được bỏ khi hiển thị. Nội dung các mục khác vẫn giữ nguyên. |
| Đọc các khối admin | Các khối thông tin còn giống các thẻ mặc định, điểm nhấn yếu. | “Hướng phát triển” và “Năng lực cốt lõi” dùng tiêu đề lớn và bố cục nội dung thoáng, vẫn lấy nội dung và liên kết từ cấu hình hiện hành. |
| Cuộn tới cuối trang và thử form Liên hệ | Khối liên hệ cuối trang nhạt và tách khỏi form. | Nền xanh đậm toàn chiều rộng, tiêu đề “Trao đổi nhu cầu của bạn” rõ, thông tin liên hệ và form nằm cùng một vùng; trên mobile xếp dọc và không bị cắt. Gửi form rỗng tập trung vào họ tên và hiện lỗi tại họ tên, điện thoại, email; không gửi request. |
| Mở ở 360, 390, 768, 1024, 1440, 1920 px | — | HTTP 200, một H1, banner dùng đúng tệp admin, không tràn ngang, không lỗi JavaScript, khối Liên hệ và form đều hiện. |
| Chạy build production sau chỉnh cuối | — | `npm.cmd run build` trong `frontend/` thành công, gồm biên dịch và kiểm tra TypeScript. |

Bằng chứng sau chỉnh: `frontend/tmp/qa-artifacts/aboutRedesign/finalManaged1440.png`, `finalManaged390.png`, `finalManagedViewport1440.png`, `finalManagedViewport390.png`, `finalContact1440.png`, `finalContact390.png`.

Giới hạn dữ liệu hiện tại: banner `gioi-thieu` chưa có ảnh riêng cho mobile. Trang giữ nguyên toàn bộ ảnh gốc khi thu nhỏ trên điện thoại; H1 dạng chữ thật ở phần nội dung ngay bên dưới vẫn đọc được. Chưa thử thao tác sửa banner trong admin, chỉ đối chiếu dữ liệu API và ảnh được render trên website.

## Chỉnh màu Liên hệ theo phản hồi

| Thao tác | Trước sửa | Sau sửa |
| --- | --- | --- |
| Cuộn tới Liên hệ trên desktop | Nền xanh navy phủ toàn khối, khác hẳn nền sáng của các phần trước và sau; thẻ form trắng tạo độ tương phản gắt. | Nền panel sáng theo token của website, chữ xanh đậm, đường kẻ xanh nhạt và điểm nhấn xanh thương hiệu. Form trắng có viền mảnh, không còn bóng đậm. |
| Mở Liên hệ ở 390 và 1440 px | — | Tiêu đề, thông tin, form và nút gửi đều thấy rõ; không tràn ngang, không lỗi JavaScript. Màu nền tính từ trình duyệt là `rgb(248, 249, 255)`, đúng token `--color-bg-panel`. |
| Chạy build production | — | `npm.cmd run build` thành công, gồm kiểm tra TypeScript. |

Ảnh kiểm tra: `frontend/tmp/qa-artifacts/aboutRedesign/contactTone390.png` và `contactTone1440.png`.
