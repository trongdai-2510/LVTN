# Kiểm thử quản lý banner — 08/10/2026

Biên bản này ghi thao tác và kết quả của đợt kiểm thử trên runtime local; không phải tài liệu yêu cầu nghiệp vụ.

| Tình huống / thao tác | Kết quả ban đầu | Thay đổi | Kết quả sau sửa |
| --- | --- | --- | --- |
| Admin mở banner mới, chọn vị trí hiển thị | Có trang Sản phẩm nhưng không có vị trí cho `/san-pham/danh-sach` | Thêm vị trí “Đầu trang Danh sách sản phẩm” vào màn tạo và bộ lọc danh sách, nối với API banner công khai | Banner thử xuất bản xuất hiện tại danh sách gốc; không lặp trên kết quả lọc và trang kế tiếp |
| Admin nhập đích của nút CTA | Phải tự gõ URL; gợi ý tĩnh không tìm được sản phẩm, biến thể, thương hiệu hay trang nội dung cụ thể | Thêm bộ chọn đích với trang thường dùng và tìm kiếm dữ liệu công khai qua API hiện có; hiện loại, tên, mô tả và đường dẫn; có nút mở thử | Tìm “ống PVC”, chọn kết quả, URL tự điền; bấm CTA ngoài website đến đúng trang sản phẩm |
| Admin xem nhanh các banner trong thư viện | Thẻ chỉ hiện đích khi bấm vào ảnh; muốn biết từng nút CTA dẫn đi đâu phải mở banner | Hiện nhãn và đường dẫn của từng nút CTA trên thẻ banner | Tạo banner thử, sửa nhãn/đích bằng giao diện quản trị rồi quay về danh sách: thấy đúng `Xem ống PVC → /san-pham/ong-pvc-d16-320n` |
| Admin chọn “Hero (Trang thương hiệu)” | Vị trí có sẵn nhưng không giải thích rằng phải gán trong hồ sơ từng thương hiệu | Thêm hướng dẫn và liên kết tới màn quản lý trang thương hiệu | Admin thấy bước gán banner ngay tại nơi chọn vị trí |
| Admin gán banner ở hồ sơ thương hiệu | Ô chọn chỉ nạp 100 banner đầu; khi nhiều banner phải mò trong danh sách và có thể không thấy banner cần chọn | Thêm tìm theo tên qua API danh sách banner hiện có, hiển thị banner đang chọn, liên kết sửa và bỏ chọn | Tìm banner thử theo tên trong hồ sơ CADIVI, chọn đúng banner, mở được hồ sơ banner để sửa |
| Khách mở trang chi tiết thương hiệu đã gán banner có CTA | Ảnh banner được đọc nhưng CTA và liên kết ảnh không được render | Đọc và render CTA/đích ảnh từ banner đã gán; kiểm tra URL an toàn trước khi tạo link | Bài test gán banner thử cho CADIVI: CTA đến đúng sản phẩm; chế độ chỉ ảnh vẫn hiện CTA; khi bỏ CTA thì click ảnh đến đúng danh sách |
| Admin chọn “Chỉ ảnh” nhưng có CTA | CTA được lưu nhưng carousel ở các trang thường không hiển thị | Hiển thị CTA gọn trên ảnh và cập nhật bản xem trước admin | CTA vẫn dùng được trên desktop/mobile trong bài test banner danh sách |
| Admin vừa có CTA vừa chọn liên kết toàn ảnh | Khối liên kết chỉ giảm opacity và chặn chuột, vẫn dễ gây hiểu nhầm | Giải thích hai cách dẫn đường; vô hiệu điều khiển liên kết toàn ảnh khi có CTA | Không thể tạo cấu hình cạnh tranh trong cùng banner từ UI |
| URL không an toàn (`//host`, ký tự điều khiển, giao thức khác http/https) | Kiểm tra URL ở admin quá rộng, có trường hợp lưu rồi ngoài web không điều hướng | Đồng bộ kiểm tra phía admin với hàm URL an toàn hiện có; phía web loại bỏ đích không an toàn | Admin báo lỗi sớm; website không dựng link không hợp lệ |
| CTA trỏ tới mỏ neo có mã bắt đầu bằng số, ví dụ `#123` | API cho lưu nhưng nút ở trang chi tiết thương hiệu không được hiển thị | Dùng chung bộ kiểm tra đích nội bộ cho banner thường và banner thương hiệu, khớp quy tắc URL của API | Gán banner thử cho CADIVI, bấm CTA `#123`: URL chuyển tới đúng mỏ neo |
| Trang danh sách có nhiều banner “Chỉ ảnh” và CTA | CTA nằm ở đáy ảnh, có thể che vùng chấm chuyển banner trên màn hình nhỏ | Chuyển CTA của banner danh sách xuống hàng thao tác riêng ngay dưới ảnh; giữ nút chuyển slide trên ảnh | Tạo hai banner thử ở khung 390 px: cả nút chuyển slide và CTA đều hiện, CTA ở ngoài vùng carousel |

Kiểm thử đã chạy:

- Playwright: mở danh sách banner và khôi phục bộ lọc vị trí; kiểm tra editor desktop/mobile; chọn đích giả lập rồi tìm đích với API thật; tạo banner thử, sửa/lưu CTA bằng giao diện quản trị, kiểm tra đích trên thẻ thư viện và bấm tới đúng sản phẩm ngoài website; kiểm tra lọc thương hiệu/trang 2; gán banner thử vào chi tiết CADIVI, thử CTA ở hai chế độ và link trên ảnh; tìm banner theo tên trong admin thương hiệu. Các ca đều đạt. Banner thử được dọn khỏi dữ liệu QA, liên kết ở hồ sơ CADIVI được trả về giá trị ban đầu.
- Màn hình admin 320 px: bộ chọn đích không tràn ngang. Danh sách công khai 390 px: CTA còn nhìn thấy và trang không tràn ngang.
- Kiểm tra lại API sau test: không còn banner đang hiển thị ở vị trí Danh sách sản phẩm; trang CADIVI có `hero_banner_id = null` như ban đầu.
- Lần rà lại: chạy cùng lúc 6 ca banner trong `page-content-lifecycle.spec.ts` đều đạt; sau hai sửa bổ sung, 2 ca tạo banner danh sách và chi tiết thương hiệu đều đạt. `api` và `frontend` typecheck đạt.
- `npm run typecheck` tại `api/`, `admin/` và `frontend/`: đạt.
- Build production frontend trong thư mục build riêng `.next-banner-recheck`: **đạt**. Lỗi tải font Manrope ở lần chạy trước không lặp lại trong lần rà này.

Giới hạn: bộ chọn chỉ trả về nội dung đã công khai; bản nháp chưa có URL công khai để chọn. Banner chi tiết thương hiệu chỉ hiển thị khi một hồ sơ thương hiệu gán nó, không tự xuất hiện trên tất cả các hãng.

## Rà bố cục bộ chọn đích — 09/10/2026

| Thao tác | Trước sửa | Sau sửa |
| --- | --- | --- |
| Admin bấm “Chọn đích” trong nút CTA | Bảng chọn bung trong cột của form, làm trang dài và để khoảng trống lớn bên cạnh | Mở hộp chọn nổi có chiều cao giới hạn; chiều dài trang giữ nguyên, bố cục form không xê dịch |
| Tìm “ống PVC” rồi chọn sản phẩm | Kết quả nằm dưới 10 trang thường dùng nên phải cuộn qua phần trên | Ô tìm được focus khi mở; khi nhập từ khóa, chỉ hiện kết quả liên quan trong vùng cuộn riêng; chọn xong điền URL vào đúng ô CTA |
| Dùng ở màn hình 320 px và bàn phím | Bảng dài trong form, khó kiểm soát vị trí cuộn | Hộp nằm trọn trong viewport, không tràn ngang; Esc đóng và trả focus về nút mở |

Kiểm thử: Playwright ca `banner editor finds an exact product destination and explains deep placements` đạt; `admin` typecheck đạt. Ca trình duyệt đo chiều dài trang trước/sau khi mở, vị trí ngang nút mở, khung 320 px, focus, Esc và chọn URL sản phẩm.

## Phân biệt vị trí banner chung và chi tiết — 09/10/2026

Runtime hiện tại có 11 vị trí banner cho kiểu trang dùng chung và một vị trí cho chi tiết thương hiệu. Danh sách vị trí trong admin được khai báo cố định; tạo thêm thương hiệu không sinh lựa chọn mới. Mỗi hồ sơ thương hiệu chỉ hiện banner riêng khi quản trị viên gán banner vào `hero_banner_id`. Trang nội dung tạo mới chưa tự có vị trí banner; frontend chỉ đọc vị trí đã được nối vào trang tương ứng.

Đã nhóm và đổi tên lựa chọn trong form, giải thích sự khác nhau giữa trang danh sách thương hiệu/đối tác và trang chi tiết từng hãng, đồng thời dùng chung danh sách vị trí giữa form và bộ lọc thư viện để tránh lệch nhãn. Không thay đổi cách lưu hay hiển thị banner công khai.

Kiểm thử: `admin` typecheck đạt; Playwright ca chọn vị trí banner, phân nhóm 11 vị trí dùng chung / một vị trí cần gán riêng, chuyển giữa trang danh sách thương hiệu và chi tiết thương hiệu, chọn đích CTA đạt. `git diff --check` không báo lỗi định dạng.

## Cập nhật gán theo trang cụ thể — 09/10/2026

Các mục mô tả dropdown vị trí cố định và thao tác gán `hero_banner_id` ở trên là lịch sử kiểm thử, không còn là luồng tạo banner hiện tại. Banner mới lưu đường dẫn trang cụ thể vào `position`, ví dụ `/san-pham/danh-sach` hoặc `/doi-tac-thuong-hieu/cadivi`. Quản trị viên tìm trang theo tên trong hộp chọn; danh sách banner cũng lọc theo cùng hộp chọn. Trang mới đã công khai được tìm từ API gợi ý, không cần thêm vào dropdown cố định. Với trang chưa có trong kết quả tìm, người quản trị có thể dán đường dẫn nội bộ trong lựa chọn nâng cao. Cột `position` được mở rộng lên 512 ký tự bằng migration `202610090001_bannerPosition.js`.

Website đọc banner theo đường dẫn trang trước, rồi dùng vị trí banner cũ làm dự phòng cho các trang chung. Trang chi tiết thương hiệu đọc banner của chính URL trước; `hero_banner_id` cũ vẫn là dự phòng để không làm mất banner đang hiển thị. Trang chi tiết sản phẩm, dịch vụ, dự án, tin tức và trang nội dung đọc banner của URL tương ứng. Màn hồ sơ thương hiệu dẫn thẳng đến banner của trang đó thay vì yêu cầu chọn lại một banner chung.

Liên kết của ảnh và nút CTA được chọn bằng tên trang, sản phẩm hoặc thương hiệu; URL chỉ hiện nhỏ để kiểm tra và nằm trong mục “Dùng đường dẫn khác” khi cần nhập thủ công. Các lựa chọn khi click ảnh được viết theo hành động của khách. Đổi loại liên kết sẽ xóa đích cũ để tránh lưu nhầm đường dẫn của loại trước.

Kiểm thử: `admin`, `frontend`, `api` typecheck và build production của hai giao diện đạt; 9 ca Playwright banner đạt, gồm chọn trang theo tên, chọn trang CADIVI, liên kết ảnh, CTA tới sản phẩm, bố cục mobile, banner danh sách cũ, banner gán trực tiếp cho trang CADIVI không cần gán thêm trong hồ sơ, và đường dẫn trang dài hơn giới hạn 32 ký tự cũ. Banner QA được lưu trữ sau kiểm thử.
