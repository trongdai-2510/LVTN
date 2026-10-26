# Bản thảo phân tích workflow hiện trạng Song Thanh

> **Trạng thái:** Bản thảo reverse-engineer ngày 12/10/2026, chờ người dùng xác nhận trước khi dùng làm nguồn sự thật cho LVTN. Đây là mô tả hành vi thể hiện trong mã hiện tại, không phải đề xuất xây hệ thống mới. Danh mục chứng cứ và giới hạn kiểm chứng nằm ở [workflowEvidence.md](workflowEvidence.md).

## Tên đề tài đề xuất

**Xây dựng website giới thiệu sản phẩm, dịch vụ và hệ thống quản trị cho Song Thành.**

Tên này nêu website công khai và giao diện quản trị độc lập đang có trong code. Các luồng dự án, nội dung, liên hệ và yêu cầu báo giá vẫn thuộc phạm vi phân tích bên dưới, không cần liệt kê hết trong tên đề tài. Cách viết tên đơn vị và tên chính thức cần được người dùng, giảng viên xác nhận.

## Ranh giới và cách đọc

- **Tác nhân công khai:** khách truy cập website. **Tác nhân nội bộ:** người dùng Admin có quyền theo vai trò; khi cần, workflow nêu rõ Super Admin.
- **Duyệt nội bộ** là `draft → pending_review → approved/rejected`. **Hiển thị công khai** là `unpublished/published/archived`; với sản phẩm/biến thể còn có `active/inactive`. Các trục này không thay thế nhau. Bản ghi công khai phải qua điều kiện lọc của từng loại nội dung.
- **Lưu trữ** thường là đánh dấu `deleted_at`, có thể khôi phục. `publish_status = archived` là trạng thái hiển thị của một số loại nội dung và không đồng nghĩa mọi bản ghi có `deleted_at`. Xóa vĩnh viễn chỉ tồn tại ở các luồng được chỉ rõ bên dưới.
- Từ **“Bước”** diễn đạt hành vi nghiệp vụ cho giai đoạn phân tích yêu cầu. Các mã `WF` trỏ đến chứng cứ code, không phải cam kết rằng mọi nhánh đã được thử qua giao diện.

| Trục cần phân biệt | Quyết định trong code hiện tại | Luồng liên quan |
| --- | --- | --- |
| Duyệt nội dung | `review_status` cho sản phẩm, biến thể, trang, trang thương hiệu, dịch vụ, dự án; người có quyền biên tập gửi duyệt, Super Admin chốt duyệt/từ chối | WF11–WF12, WF17–WF20 |
| Xuất bản | `publish_status` quyết định nội dung đã duyệt có hiện trên website hay không; API công khai còn lọc quan hệ và các điều kiện riêng | WF02–WF03, WF11–WF12, WF17–WF20 |
| Khả dụng và lưu trữ | `status` như `active/inactive` ở các bản ghi có trục này; `deleted_at` đánh dấu lưu trữ/khôi phục. Banner dùng `status` và `deleted_at`, không có duyệt/xuất bản riêng | WF07–WF13, WF17–WF25 |
| Phân quyền | Một vai trò active cho mỗi tài khoản Admin; controller kiểm tra mã quyền theo hành động; Super Admin có thêm quyền chốt nội dung/xóa vĩnh viễn ở những luồng cụ thể | WF07–WF09, WF11–WF29 |
| Xử lý dữ liệu | Dòng tạm của lô nhập có quyết định duyệt riêng, độc lập duyệt nội dung chính thức; liên hệ/báo giá dùng trạng thái xử lý `new/in_progress/done/spam/invalid`, không phải trạng thái xuất bản | WF05–WF09, WF14–WF16, WF29 |

## Kiểm kê module và phạm vi

| Nhóm | Chức năng hiện có | Workflow |
| --- | --- | --- |
| Website công khai | Trang chủ, điều hướng, thông tin công ty, tìm kiếm/gợi ý, danh mục và chi tiết sản phẩm, thương hiệu, dịch vụ, dự án, tin tức, trang nội dung, banner, tệp công khai, chuyển hướng | WF01–WF04 |
| Khách hàng gửi yêu cầu | Liên hệ; tư vấn/báo giá tổng quát hoặc gắn sản phẩm, biến thể, số lượng và bối cảnh dự án | WF05–WF06 |
| Kinh doanh và khách hàng | Hộp thư liên hệ/báo giá, phân công, trạng thái, ghi chú, hồ sơ khách hàng và lịch sử tương tác | WF07–WF09 |
| Dữ liệu sản phẩm | Cây danh mục, thương hiệu, sản phẩm, biến thể, giá công khai hoặc liên hệ báo giá, ảnh, thông số nổi bật, thuộc tính, tài liệu kỹ thuật | WF10–WF13 |
| Nhập/xuất dữ liệu | Tải Excel/CSV, chọn sheet/dòng, ánh xạ cột, dữ liệu tạm, rà soát, xung đột, xem trước, áp dụng và quản lý lô; xuất bảng dữ liệu hiện có | WF14–WF16, WF29 |
| Biên tập nội dung | Trang hệ thống/tin tức, trang thương hiệu, dịch vụ, dự án, thư viện ảnh dự án, quan hệ sản phẩm | WF17–WF20 |
| Vận hành website | Banner, bố cục trang chủ, menu, thông tin công ty/mạng xã hội, chuyển hướng URL, tệp | WF21–WF25 |
| Quản trị hệ thống | Đăng nhập/phiên, tài khoản, vai trò/quyền, dashboard và nhật ký thao tác | WF26–WF28 |

Các bảng `partner`, `certificate`, `tag`, `product_group_tag` và các bảng thông số cũ có trong DDL không tự tạo thành workflow: không có controller quản trị tương ứng trong runtime hiện tại. Bảng dữ liệu nền và migration là chứng cứ cấu trúc, không phải yêu cầu nghiệp vụ mới.

## A. Hành trình trên website công khai

### WF01 — Xem trang chủ và điều hướng website

- **Tác nhân / mục đích:** Khách truy cập tìm hiểu Song Thanh và đi tới khu vực cần xem.
- **Điều kiện bắt đầu:** Khách mở trang chủ hoặc một trang có header/footer; API có dữ liệu công ty, menu và bố cục tương ứng nếu muốn hiển thị các phần đó.
- **Bước 1:** Website lấy thông tin công ty, logo/favicon, liên kết xã hội và các menu đang hoạt động.
- **Bước 2:** Website lấy bố cục trang chủ, chỉ dùng các khu vực đã bật và sắp theo thứ tự quản trị.
- **Bước 3:** Khách xem banner, nhóm sản phẩm, dịch vụ, dự án, thương hiệu và nội dung công ty có dữ liệu công khai phù hợp.
- **Bước 4:** Khách chọn liên kết menu, thẻ nội dung hoặc dùng ô tìm kiếm để chuyển đến trang liên quan.
- **Luồng thay thế:** Mục menu dẫn tới trang hệ thống chưa công khai bị ẩn khỏi menu; một khu vực trang chủ tắt hoặc không có dữ liệu phù hợp không được tự điền nội dung giả. URL cũ có quy tắc chuyển hướng đang hoạt động được chuyển theo WF24.
- **Trường hợp lỗi:** Không tải được API thì phần dữ liệu phụ thuộc API không được xác nhận là đã hiển thị; không có cấu hình URL API thì chuyển hướng động không tải được.
- **Quy tắc nghiệp vụ:** Trạng thái xuất bản của một bản ghi “Trang nội dung” chỉ quyết định phần nội dung biên tập của trang đó; route/danh mục/banner của module khác không tự bị ẩn theo. Menu chỉ hiển thị mục và cha còn hoạt động.
- **Kết quả:** Khách tới đúng khu vực còn công khai; số lượt xem website có thể được ghi khi trang gọi API theo dõi.
- **Chứng cứ:** [E01](workflowEvidence.md#e01).

### WF02 — Tìm và xem sản phẩm, cấu hình/biến thể

- **Tác nhân / mục đích:** Khách tìm sản phẩm phù hợp và xem thông tin trước khi liên hệ.
- **Điều kiện bắt đầu:** Có sản phẩm đáp ứng điều kiện công khai; khách mở `/san-pham`, danh sách, tìm kiếm hoặc đường dẫn chi tiết.
- **Bước 1:** Khách chọn danh mục hoặc nhập từ khóa; ô tìm kiếm có thể gợi ý sản phẩm/biến thể.
- **Bước 2:** Khách lọc theo thương hiệu, danh mục con, trạng thái giá, thông số và đổi sắp xếp/phân trang.
- **Bước 3:** Website chỉ trả nhóm sản phẩm đang hoạt động, đã duyệt, đã xuất bản, chưa lưu trữ cùng tham chiếu danh mục/thương hiệu hợp lệ.
- **Bước 4:** Khách mở chi tiết để xem mô tả, ảnh, thông số, tài liệu kỹ thuật và các biến thể đang công khai; lựa chọn biến thể cập nhật phần cấu hình/giá/ảnh tương ứng.
- **Bước 5:** Khách có thể mở yêu cầu báo giá cho lựa chọn hiện tại hoặc lưu sản phẩm vào danh sách yêu cầu tổng hợp (WF05).
- **Luồng thay thế:** Biến thể đặt chế độ “liên hệ báo giá” không hiện giá số; nhóm sản phẩm vẫn có thể có trang công khai dù chưa có biến thể công khai. Tệp sản phẩm công khai có kiểm soát truy cập và ảnh sản phẩm được cấp bản có watermark.
- **Trường hợp lỗi:** Bộ lọc danh mục không tồn tại hoặc slug sản phẩm không công khai trả lỗi/404; lựa chọn biến thể không công khai không thể đưa vào yêu cầu.
- **Quy tắc nghiệp vụ:** Giá là thuộc tính biến thể, không phải giá cố định của sản phẩm; thông số/tài liệu gắn biến thể chỉ hiện khi biến thể đủ điều kiện công khai.
- **Kết quả:** Khách xem dữ liệu sản phẩm được phép hiển thị và có ngữ cảnh chuẩn để gửi yêu cầu.
- **Chứng cứ:** [E02](workflowEvidence.md#e02).

### WF03 — Xem thương hiệu, dịch vụ, dự án, tin tức và trang thông tin

- **Tác nhân / mục đích:** Khách tìm hiểu năng lực, nội dung và các lĩnh vực Song Thanh công bố.
- **Điều kiện bắt đầu:** Khách mở danh sách hoặc đường dẫn chi tiết tương ứng.
- **Bước 1:** Website lấy danh sách theo loại: thương hiệu, dịch vụ, dự án, tin tức hoặc trang nội dung.
- **Bước 2:** Khách lọc/tìm trên các danh sách có hỗ trợ; mở trang chi tiết theo slug.
- **Bước 3:** Chi tiết dịch vụ/dự án có thể kèm sản phẩm liên quan; dự án có thư viện ảnh; trang thương hiệu có banner, số liệu đã xác minh, nguồn và sản phẩm gắn thương hiệu.
- **Bước 4:** Tin tức hiển thị bài, danh mục và bài liên quan; trang thông tin hệ thống hiển thị nội dung biên tập cùng phần dữ liệu do module khác cấp.
- **Luồng thay thế:** Danh sách thương hiệu chỉ cần thương hiệu `active`; trang chi tiết thương hiệu cần thêm trang thương hiệu đã duyệt/xuất bản. Banner theo vị trí là dữ liệu độc lập. Số liệu thương hiệu chưa xác minh không xuất hiện như số liệu công khai.
- **Trường hợp lỗi:** Slug không tồn tại/chưa công khai trả 404; tệp đính kèm không được cấp nếu không có tham chiếu công khai hợp lệ.
- **Quy tắc nghiệp vụ:** Dịch vụ, dự án, tin tức/trang nội dung và trang thương hiệu đều cần `approved + published + chưa lưu trữ`; thương hiệu còn cần `active`. Nội dung HTML được làm sạch trước khi gửi/hiển thị.
- **Kết quả:** Khách nhận nội dung đã được công bố và có thể chuyển tới sản phẩm/yêu cầu tư vấn phù hợp.
- **Chứng cứ:** [E03](workflowEvidence.md#e03).

### WF04 — Tải tệp công khai gắn với nội dung

- **Tác nhân / mục đích:** Khách xem/tải ảnh hoặc tài liệu được cho phép công khai.
- **Điều kiện bắt đầu:** Tệp đang được một nội dung công khai sử dụng hoặc là tài liệu kỹ thuật được đánh dấu công khai.
- **Bước 1:** Khách chọn ảnh/tài liệu trên trang công khai.
- **Bước 2:** API kiểm tra tệp còn hoạt động và quan hệ sử dụng hợp lệ với dữ liệu công khai.
- **Bước 3:** API đọc nội dung lưu trữ; với ảnh sản phẩm thuộc diện watermark, tạo bản có watermark khi trả về hoặc tải xuống.
- **Luồng thay thế:** SVG được làm sạch khi cấp; tệp khác trả nội dung gốc nếu qua kiểm tra quyền công khai.
- **Trường hợp lỗi:** Không tìm thấy tệp, đường dẫn lưu trữ không an toàn, hoặc xử lý watermark thất bại thì không cấp bản ảnh gốc thay thế.
- **Quy tắc nghiệp vụ:** Đánh dấu một tệp là còn hoạt động chưa đủ để tự biến tệp thành công khai; tài liệu kỹ thuật cần `active`, `is_public` và biến thể gắn kèm cũng công khai nếu có.
- **Kết quả:** Khách chỉ nhận tệp được phép công bố.
- **Chứng cứ:** [E04](workflowEvidence.md#e04).

## B. Tiếp nhận và xử lý khách hàng

### WF05 — Gửi yêu cầu tư vấn/báo giá

- **Tác nhân / mục đích:** Khách để lại nhu cầu tổng quát hoặc yêu cầu cho một/nhiều sản phẩm.
- **Điều kiện bắt đầu:** Khách mở biểu mẫu ở trang chủ/dịch vụ hoặc từ chi tiết sản phẩm; API công khai tiếp nhận yêu cầu.
- **Bước 1:** Khách nhập tên, số điện thoại, email và tùy chọn công ty, địa chỉ, lời nhắn, tên/bối cảnh cùng các yêu cầu dự án có cấu trúc.
- **Bước 2:** Nếu bắt đầu từ sản phẩm, khách chọn sản phẩm/biến thể và nhập số lượng cho từng mục; giao diện cho phép gom nhiều mục.
- **Bước 3:** Giao diện kiểm tra trường bắt buộc và số lượng. Số lượng xác nhận phải là số nguyên hợp lệ; số lượng chưa rõ được giữ nguyên văn để nhân viên xác nhận lại.
- **Bước 4:** API kiểm tra lại từng nhóm/biến thể còn công khai và biến thể thuộc đúng nhóm, ngay trong giao dịch ghi dữ liệu.
- **Bước 5:** Hệ thống tạo yêu cầu ở trạng thái `new`, các dòng sản phẩm nếu có, ảnh chụp giá công khai của biến thể tại thời điểm gửi, và liên kết/tạo hồ sơ khách hàng.
- **Luồng thay thế:** Biểu mẫu tư vấn tổng quát có thể gửi `items` rỗng; biến thể “liên hệ báo giá” không được tự gán một giá số. Bối cảnh dịch vụ ở biểu mẫu trang chủ được đưa vào lời nhắn.
- **Trường hợp lỗi:** Số điện thoại/email không đúng, số lượng không hợp lệ, nhóm/biến thể vừa bị ẩn hoặc không khớp sẽ từ chối gửi và hiển thị lỗi; không sinh yêu cầu một phần.
- **Quy tắc nghiệp vụ:** Email bắt buộc; số điện thoại bắt đầu bằng `0` và có đúng 10 chữ số. Mỗi yêu cầu tối đa 50 mục sản phẩm và 20 yêu cầu dự án có cấu trúc theo DTO. Đây là yêu cầu tư vấn/báo giá, không phải đơn hàng hay quy trình thanh toán. Giá chụp chỉ là giá công khai tại lúc gửi, không phải giá báo chính thức.
- **Kết quả:** Yêu cầu xuất hiện trong hộp thư báo giá để nhân viên xử lý.
- **Chứng cứ:** [E05](workflowEvidence.md#e05).

### WF06 — Gửi liên hệ

- **Tác nhân / mục đích:** Khách gửi thông tin để Song Thanh liên lạc.
- **Điều kiện bắt đầu:** Khách mở trang liên hệ hoặc form liên hệ có ngữ cảnh dịch vụ.
- **Bước 1:** Khách nhập tên, điện thoại, lời nhắn; có thể thêm email, công ty.
- **Bước 2:** Giao diện kiểm tra dữ liệu và bổ sung ngữ cảnh dịch vụ/trang nguồn nếu form được mở từ đó.
- **Bước 3:** API kiểm tra lại, xác định thông tin request, liên kết hoặc tạo hồ sơ khách hàng.
- **Bước 4:** Hệ thống lưu yêu cầu ở trạng thái `new`; giao diện báo đã gửi thành công.
- **Luồng thay thế:** Không có email/công ty vẫn có thể gửi nếu các trường bắt buộc hợp lệ.
- **Trường hợp lỗi:** Tên/điện thoại/lời nhắn trống hoặc email sai định dạng bị từ chối; lỗi API được hiển thị tại form.
- **Quy tắc nghiệp vụ:** Địa chỉ IP lấy từ request đã qua cấu hình tin cậy, không dùng tùy tiện header do khách tự khai.
- **Kết quả:** Nhân viên thấy yêu cầu ở hộp thư liên hệ.
- **Chứng cứ:** [E06](workflowEvidence.md#e06).

### WF07 — Xử lý yêu cầu liên hệ

- **Tác nhân / mục đích:** Nhân viên có quyền liên hệ phân loại và theo dõi việc trả lời.
- **Điều kiện bắt đầu:** Yêu cầu đã được khách gửi; nhân viên đăng nhập với quyền tương ứng.
- **Bước 1:** Nhân viên lọc hộp thư theo từ khóa, trạng thái, người phụ trách, ngày và phạm vi lưu trữ.
- **Bước 2:** Nhân viên mở chi tiết để xem thông tin khách, lời nhắn, nguồn và ghi chú nội bộ.
- **Bước 3:** Người có quyền phân công gán/bỏ người phụ trách; người có quyền ghi chú thêm diễn biến nội bộ.
- **Bước 4:** Người có quyền trạng thái chuyển sang `in_progress`, `done`, `spam` hoặc `invalid` khi phù hợp.
- **Bước 5:** Khi cần dọn hộp thư, nhân viên có quyền lưu trữ; bản ghi có thể được khôi phục.
- **Luồng thay thế:** Quyền xem không mặc nhiên cho quyền phân công/ghi chú/đổi trạng thái. Super Admin có thể xóa vĩnh viễn **sau khi đã lưu trữ** qua chức năng riêng.
- **Trường hợp lỗi:** Không có quyền, người được gán không tồn tại, trạng thái sai, hoặc cố xử lý bản ghi đã lưu trữ thì API từ chối.
- **Quy tắc nghiệp vụ:** `new/in_progress/done/spam/invalid` là trạng thái xử lý yêu cầu, không liên quan duyệt nội dung công khai. Lưu trữ là mặc định dọn dữ liệu; xóa vĩnh viễn là ngoại lệ có điều kiện.
- **Kết quả:** Liên hệ có người phụ trách, lịch sử ghi chú và trạng thái xử lý hiện thời.
- **Chứng cứ:** [E07](workflowEvidence.md#e07).

### WF08 — Xử lý yêu cầu báo giá

- **Tác nhân / mục đích:** Nhân viên kinh doanh tiếp nhận yêu cầu và theo dõi tiến độ tư vấn.
- **Điều kiện bắt đầu:** Có yêu cầu từ WF05; nhân viên có quyền xem báo giá.
- **Bước 1:** Nhân viên lọc theo từ khóa, trạng thái, người phụ trách, sản phẩm/biến thể, ngày và phạm vi lưu trữ.
- **Bước 2:** Nhân viên mở chi tiết để xem thông tin khách, bối cảnh dự án, từng mục hàng, số lượng gốc/xác nhận và giá công khai được chụp khi gửi.
- **Bước 3:** Người có quyền phân công gán nhân viên; người có quyền ghi chú ghi diễn biến nội bộ.
- **Bước 4:** Người có quyền cập nhật trạng thái `new/in_progress/done/spam/invalid` và có thể lưu trữ/khôi phục.
- **Luồng thay thế:** Yêu cầu tư vấn tổng quát không có dòng sản phẩm vẫn là yêu cầu hợp lệ. Super Admin được xóa vĩnh viễn sau khi lưu trữ.
- **Trường hợp lỗi:** Gán người không tồn tại, cập nhật bản ghi đã lưu trữ, hoặc xóa vĩnh viễn bản ghi còn hoạt động đều bị chặn.
- **Quy tắc nghiệp vụ:** Phần quản trị theo dõi **yêu cầu**; code hiện tại không tạo báo giá bán hàng chính thức, đơn hàng hay thanh toán.
- **Kết quả:** Nhân viên nắm đủ ngữ cảnh và trạng thái chăm sóc yêu cầu.
- **Chứng cứ:** [E08](workflowEvidence.md#e08).

### WF09 — Quản lý hồ sơ khách hàng và lịch sử tương tác

- **Tác nhân / mục đích:** Nhân viên có quyền khách hàng theo dõi một khách qua các liên hệ và báo giá.
- **Điều kiện bắt đầu:** Có hồ sơ được tạo thủ công hoặc phát sinh khi khách gửi form.
- **Bước 1:** Nhân viên tìm/lọc hồ sơ theo nguồn liên hệ/báo giá và trạng thái lưu trữ.
- **Bước 2:** Nhân viên mở chi tiết để xem thông tin, số lượng liên hệ/báo giá và dòng thời gian tương tác.
- **Bước 3:** Người có quyền tạo hồ sơ mới hoặc sửa tên, điện thoại, email, công ty.
- **Bước 4:** Khi không còn dùng, nhân viên lưu trữ; khi cần có thể khôi phục.
- **Luồng thay thế:** Khi form công khai đến, hệ thống tìm hồ sơ theo tên chuẩn hóa cùng điện thoại/email, có thể khôi phục hồ sơ trùng đã lưu trữ và bổ sung trường còn trống.
- **Trường hợp lỗi:** Cập nhật hồ sơ đã lưu trữ bị từ chối. Xóa vĩnh viễn chỉ dành cho Super Admin, sau lưu trữ và khi không còn liên hệ/báo giá đang hoạt động gắn với hồ sơ.
- **Quy tắc nghiệp vụ:** Hồ sơ khách là điểm gom lịch sử; không phải tài khoản đăng nhập của khách. Thông tin đã có không bị form mới tự ghi đè bằng ô trống.
- **Kết quả:** Hồ sơ và lịch sử tương tác được tra cứu nhất quán.
- **Chứng cứ:** [E09](workflowEvidence.md#e09).

## C. Dữ liệu sản phẩm và nhập bảng tính

### WF10 — Tổ chức cây danh mục và thương hiệu

- **Tác nhân / mục đích:** Quản trị sản phẩm tạo phân loại đủ để gắn và tìm sản phẩm.
- **Điều kiện bắt đầu:** Có quyền danh mục/thương hiệu; muốn thêm hoặc điều chỉnh cấu trúc.
- **Bước 1:** Xem danh mục cấp 1/cấp 2 và danh sách thương hiệu.
- **Bước 2:** Tạo/sửa tên, slug, mô tả, ảnh, thứ tự, trạng thái; với danh mục con chọn danh mục cha hợp lệ.
- **Bước 3:** Kiểm tra tham chiếu cha, giới hạn cấp, slug trùng và tệp được chọn.
- **Bước 4:** Gắn sản phẩm vào danh mục cấp 2 và có thể gắn thương hiệu đang dùng.
- **Luồng thay thế:** Tạo thương hiệu có thử tạo kèm trang chi tiết nháp; nếu bước trang nháp lỗi, thương hiệu vẫn được tạo và trang có thể lập sau. Danh mục/thương hiệu `inactive` không xuất hiện như lựa chọn công khai.
- **Trường hợp lỗi:** Không thể lưu trữ danh mục còn sản phẩm hoặc danh mục con đang hoạt động; không thể lưu trữ thương hiệu còn sản phẩm đang hoạt động. Khôi phục danh mục con cần cha dùng được.
- **Quy tắc nghiệp vụ:** Danh mục có hai cấp trong luồng sản phẩm; thương hiệu và trang nội dung thương hiệu là hai bản ghi khác nhau.
- **Kết quả:** Cấu trúc phân loại dùng được cho nhập/chỉnh sửa và duyệt sản phẩm.
- **Chứng cứ:** [E10](workflowEvidence.md#e10).

### WF11 — Lập và duy trì hồ sơ sản phẩm

- **Tác nhân / mục đích:** Quản trị sản phẩm tạo hồ sơ nhóm sản phẩm để công bố trên website.
- **Điều kiện bắt đầu:** Có danh mục cấp 2 đang hoạt động, quyền tương ứng và tệp ảnh nếu định xuất bản.
- **Bước 1:** Tìm/lọc danh sách; mở sản phẩm có sẵn hoặc tạo mới với tên, slug, danh mục, thương hiệu tùy chọn, mô tả, ảnh chính, thứ tự và SEO.
- **Bước 2:** Lưu bản nháp; hệ thống kiểm tra tên/slug, danh mục cấp 2, thương hiệu và tệp còn dùng được.
- **Bước 3:** Bổ sung thông số nổi bật, ảnh, biến thể/tài liệu theo WF12–WF13; xem cảnh báo chất lượng trong Admin.
- **Bước 4:** Gửi duyệt; Super Admin duyệt hoặc từ chối; sau khi được duyệt có thể xuất bản nếu sản phẩm `active`, có ảnh chính và mô tả ngắn.
- **Bước 5:** Khi nội dung công khai bị sửa đáng kể bởi người không phải Super Admin, bản ghi trở lại chờ duyệt và bị ẩn; có thể chủ động ngừng xuất bản hoặc đổi `active/inactive`.
- **Bước 6:** Khi ngừng quản lý, lưu trữ và có thể khôi phục nếu tham chiếu còn hợp lệ.
- **Luồng thay thế:** Có thao tác đổi trạng thái hàng loạt với bước thử trước (`dry_run`) và kết quả chặn riêng từng bản ghi. Cảnh báo thiếu biến thể, gallery, tài liệu, SEO là chất lượng, không phải tất cả đều là điều kiện chặn xuất bản. Bản ghi cũ đã xuất bản nhưng thiếu mô tả ngắn được phép sửa các trường khác mà không đụng trạng thái xuất bản/mô tả ngắn; đó không phải ngoại lệ cho lần xuất bản mới.
- **Trường hợp lỗi:** Slug trùng, tham chiếu không hợp lệ, thiếu điều kiện xuất bản, phiên chỉnh sửa cũ hoặc còn phụ thuộc khi lưu trữ đều bị chặn.
- **Quy tắc nghiệp vụ:** Chỉ Super Admin được đặt `approved/rejected/published`; lưu trữ dùng `deleted_at`, không mặc định xóa vật lý. Sản phẩm công khai vẫn phải qua bộ lọc API, kể cả khi giao diện Admin hiển thị nhãn trạng thái.
- **Kết quả:** Hồ sơ sản phẩm được lưu trong đúng làn duyệt/hiển thị và chỉ lộ ra công khai khi đủ điều kiện.
- **Chứng cứ:** [E11](workflowEvidence.md#e11).

### WF12 — Lập và duy trì biến thể, mã và giá

- **Tác nhân / mục đích:** Quản trị sản phẩm mô tả từng cấu hình bán được của sản phẩm.
- **Điều kiện bắt đầu:** Nhóm sản phẩm cha tồn tại, chưa lưu trữ và dùng được.
- **Bước 1:** Từ hồ sơ sản phẩm hoặc danh sách biến thể, tạo biến thể với tên, SKU (có thể sinh tự động), mã ngoài/model, mô tả, giá và ảnh nếu có.
- **Bước 2:** Chọn một trong hai chế độ giá: số tiền công khai hợp lệ hoặc “liên hệ báo giá” không có số tiền.
- **Bước 3:** Thêm/sửa/lưu trữ thuộc tính biến thể; kiểm tra thông số, hình ảnh và mã duy nhất.
- **Bước 4:** Gửi duyệt; Super Admin duyệt/từ chối, sau đó xuất bản biến thể khi `active` và nhóm cha đã được duyệt/xuất bản.
- **Bước 5:** Có thể tạm ẩn, đổi trạng thái hàng loạt với xem trước, lưu trữ hoặc khôi phục.
- **Luồng thay thế:** Sửa nội dung/ảnh/thuộc tính đáng kể của biến thể đã công khai bởi người không phải Super Admin sẽ mở lại vòng duyệt và ẩn biến thể; Super Admin có thể sửa trực tiếp theo chính sách code. Khi đổi nhóm cha, tài liệu kỹ thuật đang gắn có thể chặn.
- **Trường hợp lỗi:** SKU/mã ngoài/model trùng, giá không khớp chế độ, cha chưa công khai, phiên cũ, hoặc biến thể còn dòng báo giá đang hoạt động khi lưu trữ đều bị chặn.
- **Quy tắc nghiệp vụ:** Trạng thái công khai của nhóm cha không tự xuất bản biến thể; biến thể có duyệt/hiển thị riêng. Giá công khai của yêu cầu đã gửi được chụp lại, không phụ thuộc giá sửa sau đó.
- **Kết quả:** Cấu hình và giá biến thể đủ điều kiện xuất hiện ở trang sản phẩm hoặc tiếp tục ở bản nháp.
- **Chứng cứ:** [E12](workflowEvidence.md#e12).

### WF13 — Bổ sung ảnh, thông số nổi bật và tài liệu kỹ thuật sản phẩm

- **Tác nhân / mục đích:** Quản trị sản phẩm cung cấp minh chứng và chi tiết kỹ thuật cho hồ sơ.
- **Điều kiện bắt đầu:** Có sản phẩm/biến thể và tệp trong thư viện hợp lệ.
- **Bước 1:** Chọn ảnh vào gallery sản phẩm, thứ tự, văn bản thay thế và liên kết ảnh với biến thể nếu phù hợp.
- **Bước 2:** Chọn thông số nổi bật nhập tay hoặc lấy từ nguồn thông số/thuộc tính; sắp xếp, sửa hoặc lưu trữ từng mục.
- **Bước 3:** Tạo tài liệu kỹ thuật với tên, loại, phiên bản, tệp, nhóm sản phẩm và biến thể tùy chọn.
- **Bước 4:** Đặt tài liệu `active/inactive`, `is_public`; kiểm tra tệp và biến thể thuộc đúng nhóm; xem trước nội dung công khai.
- **Luồng thay thế:** Tài liệu gắn nhóm được xem mà không cần biến thể; tài liệu gắn biến thể chỉ hiện khi biến thể công khai. Ảnh/thuộc tính sửa trên sản phẩm đã công khai có thể mở lại duyệt theo quyền người sửa.
- **Trường hợp lỗi:** Tệp không hoạt động, thông số nguồn bị trùng, biến thể không thuộc nhóm, hoặc phiên cập nhật tài liệu cũ bị chặn.
- **Quy tắc nghiệp vụ:** `is_public` của tài liệu khác với `publish_status` của sản phẩm; watermark áp dụng khi cấp ảnh sản phẩm ra công khai.
- **Kết quả:** Trang sản phẩm có ảnh, thông số và tài liệu đúng quan hệ, đúng quyền hiển thị.
- **Chứng cứ:** [E13](workflowEvidence.md#e13).

### WF14 — Tiếp nhận tệp bảng tính và ánh xạ cột

- **Tác nhân / mục đích:** Quản trị nhập liệu biến một workbook thành lô dữ liệu tạm để xem xét.
- **Điều kiện bắt đầu:** Có quyền `import.intake`; tệp `.xlsx` hoặc `.csv` hợp lệ (giao diện còn có đường dẫn tệp local do API đọc trong môi trường cho phép).
- **Bước 1:** Chọn tệp, với Excel chọn sheet; có thể chọn phạm vi dòng và đặt tên/ghi chú lô.
- **Bước 2:** Hệ thống kiểm tra loại/kích thước tệp, đọc tiêu đề và mẫu dòng, tạo lô ở trạng thái `created` cùng bản xem trước, chưa tạo sản phẩm chính thức.
- **Bước 3:** Người dùng đối chiếu cột danh mục chính/con, tên sản phẩm/biến thể, thương hiệu, mô tả, mã/SKU/model, giá và các cột thuộc tính.
- **Bước 4:** Chọn ánh xạ hệ thống gợi ý, hồ sơ ánh xạ nhận diện được, hoặc ánh xạ tay; cột còn lại phải được chọn giữ làm thuộc tính hoặc bỏ qua.
- **Bước 5:** Xác nhận ánh xạ; hệ thống chuẩn hóa dòng, tạo nhóm/biến thể tạm và xung đột, chuyển lô sang `in_review`.
- **Luồng thay thế:** Có thể lưu hồ sơ ánh xạ để tái dùng; sheet nhiều trang phải chọn chính xác. Ảnh nhúng trong Excel chỉ được cảnh báo ở phần xem trước, không tự gắn vào sản phẩm.
- **Trường hợp lỗi:** Tệp sai loại/quá 20 MB, không có dòng được chọn, header mơ hồ, cột bắt buộc chưa ánh xạ, hoặc lô đã có dữ liệu tạm thì không xác nhận lại mapping trên chính lô đó.
- **Quy tắc nghiệp vụ:** Upload qua Admin chỉ hỗ trợ `.xlsx/.csv`; bước xem trước/ánh xạ chưa ghi dữ liệu sản phẩm chính thức.
- **Kết quả:** Lô có dữ liệu tạm và danh sách việc cần rà soát.
- **Chứng cứ:** [E14](workflowEvidence.md#e14).

### WF15 — Rà soát dữ liệu tạm và giải quyết xung đột nhập

- **Tác nhân / mục đích:** Quản trị nhập liệu quyết định từng nhóm/biến thể nào được đưa vào danh mục.
- **Điều kiện bắt đầu:** Lô đã xác nhận ánh xạ, có dữ liệu tạm và quyền `import.review`/`import.conflict_resolve` cho thao tác tương ứng.
- **Bước 1:** Xem danh sách nhóm/biến thể tạm, thống kê, xung đột, dữ liệu gốc và điều kiện sẵn sàng.
- **Bước 2:** Sửa mã/nhóm danh mục hợp lệ nếu cần; duyệt hoặc từ chối từng dòng, nhiều dòng đã chọn hoặc duyệt hàng loạt dòng hợp lệ.
- **Bước 3:** Với xung đột mở, chọn giữ dữ liệu hiện có, ghi đè, gộp, sửa thủ công hoặc bỏ qua; ghi chú quyết định.
- **Bước 4:** Đối với giá không hợp lệ, chỉ sửa thủ công thành giá hợp lệ/chế độ liên hệ hoặc bỏ qua; không đoán giá.
- **Bước 5:** Kiểm tra lại blocker và xem trước kế hoạch tạo/cập nhật; chuyển lô sang `ready_to_apply` khi không còn xung đột mở, dòng chờ duyệt và có ít nhất một dòng được duyệt.
- **Luồng thay thế:** Có thể tạo lại danh mục nền từ tên danh mục trong dữ liệu tạm theo quyền riêng; chuyển về `validated/in_review` để tiếp tục xử lý.
- **Trường hợp lỗi:** Mã trùng, mục đã áp dụng, xung đột đã giải quyết, quyết định giá không an toàn hoặc blocker còn tồn tại đều ngăn chuyển trạng thái sẵn sàng.
- **Quy tắc nghiệp vụ:** Duyệt dòng nhập là quyết định **dữ liệu tạm**; nó không phải duyệt/xuất bản nội dung sản phẩm ra website.
- **Kết quả:** Lô có quyết định rõ cho từng dòng và kế hoạch áp dụng có thể kiểm tra trước.
- **Chứng cứ:** [E15](workflowEvidence.md#e15).

### WF16 — Áp dụng lô nhập và quản lý vòng đời lô

- **Tác nhân / mục đích:** Quản trị nhập liệu chuyển phần đã duyệt thành sản phẩm/biến thể chính thức.
- **Điều kiện bắt đầu:** Lô `ready_to_apply`, không có blocker và người dùng có quyền `import.apply`.
- **Bước 1:** Xem trước số nhóm/biến thể sẽ tạo mới hoặc cập nhật; xác nhận áp dụng.
- **Bước 2:** Hệ thống khóa lô và kiểm tra lại readiness trong giao dịch.
- **Bước 3:** Hệ thống tạo/tái dùng danh mục nền; tạo/cập nhật nhóm sản phẩm được duyệt, rồi tạo/cập nhật biến thể được duyệt theo nhóm cha.
- **Bước 4:** Hệ thống đồng bộ thuộc tính từ các cột đã chọn, ghi mapping nguồn→bản ghi chính thức và đánh dấu dòng/lô `applied`.
- **Bước 5:** Người dùng có thể xem kết quả, lỗi áp dụng; lô đã áp dụng hoặc đã hủy được lưu trữ và có thể khôi phục để tra cứu.
- **Luồng thay thế:** Dữ liệu ô trống không ghi đè trường đã có khi cập nhật. Lô **chưa** áp dụng có API xóa workspace vĩnh viễn cùng dữ liệu tạm; lô đã áp dụng bị cấm xóa vĩnh viễn.
- **Trường hợp lỗi:** Thiếu danh mục, liên kết cha, trùng dữ liệu hoặc lỗi đồng bộ làm giao dịch áp dụng thất bại; lỗi được ghi log, không coi là áp dụng một phần thành công.
- **Quy tắc nghiệp vụ:** Nhóm và biến thể **tạo mới** từ import ở `active`, `approved`, `unpublished`; cần workflow xuất bản sản phẩm/biến thể riêng. Đối với bản ghi được cập nhật, code áp dụng chỉ cập nhật các trường dữ liệu có giá trị, không tự chuyển trạng thái duyệt/xuất bản.
- **Kết quả:** Danh mục chính thức được cập nhật có truy vết lô, còn trạng thái công khai được xử lý độc lập.
- **Chứng cứ:** [E16](workflowEvidence.md#e16).

## D. Biên tập và vận hành nội dung

### WF17 — Biên tập, duyệt và công bố trang nội dung/tin tức

- **Tác nhân / mục đích:** Biên tập viên xây nội dung; Super Admin chốt duyệt và công bố.
- **Điều kiện bắt đầu:** Có quyền tạo/sửa trang; người dùng chọn trang hệ thống, trang thường hoặc tin tức.
- **Bước 1:** Tạo bản ghi với loại `page/news`, tiêu đề, slug, tóm tắt, nội dung HTML/khối cấu trúc, ảnh và SEO; tin tức có thêm danh mục, ngày đăng, đánh dấu nổi bật.
- **Bước 2:** Lưu bản nháp và xem trước bằng giao diện công khai mà chưa công bố.
- **Bước 3:** Gửi duyệt; Super Admin duyệt hoặc từ chối; chỉ sau duyệt mới đặt `published`.
- **Bước 4:** Hệ thống kiểm tra nội dung có ý nghĩa khi trang yêu cầu phần biên tập; trang danh mục sản phẩm cấu trúc có ngoại lệ không cần thân bài biên tập.
- **Bước 5:** Nội dung đã xuất bản được khách mở theo slug; sửa đáng kể bởi người không phải Super Admin đưa trở lại `pending_review + unpublished`.
- **Bước 6:** Có thể ngừng xuất bản, lưu trữ/khôi phục và xử lý xung đột khi hai phiên quản trị cùng sửa.
- **Luồng thay thế:** Quản lý danh mục tin tức gồm tạo/sửa/lưu trữ/khôi phục; gỡ xuất bản đơn thuần có thể thực hiện dù tham chiếu nội dung cũ không còn hợp lệ.
- **Trường hợp lỗi:** Slug trùng, tệp/danh mục tin không hợp lệ, thân bài bắt buộc trống, chưa duyệt mà đòi công bố, phiên cập nhật cũ bị chặn.
- **Quy tắc nghiệp vụ:** Xuất bản bản ghi trang hệ thống không tự quyết định việc hiển thị các danh mục, sản phẩm, banner do module khác quản lý.
- **Kết quả:** Nội dung biên tập có trạng thái duyệt và công khai rõ ràng.
- **Chứng cứ:** [E17](workflowEvidence.md#e17).

### WF18 — Biên tập trang chi tiết thương hiệu

- **Tác nhân / mục đích:** Biên tập viên tạo câu chuyện thương hiệu dựa trên thương hiệu đã có.
- **Điều kiện bắt đầu:** Thương hiệu tồn tại; một thương hiệu chỉ có một trang chi tiết đang hoạt động.
- **Bước 1:** Mở trang nháp có thể được tạo cùng thương hiệu, hoặc tạo trang chi tiết riêng.
- **Bước 2:** Điền hero/banner, phần giới thiệu, hỗ trợ, CTA, SEO, nguồn tham khảo, số liệu và chọn sản phẩm nổi bật cùng thương hiệu.
- **Bước 3:** Ghi rõ nguồn và cờ xác minh cho số liệu; xem trước ở giao diện công khai.
- **Bước 4:** Gửi duyệt; Super Admin duyệt/xuất bản; trang chi tiết chỉ xuất hiện khi trang đã duyệt/xuất bản và thương hiệu `active`.
- **Bước 5:** Sửa nội dung hoặc dữ liệu con đáng kể bởi người không phải Super Admin mở lại vòng duyệt và ẩn trang; có thể lưu trữ/khôi phục.
- **Luồng thay thế:** Danh sách thương hiệu có thể công khai dù chưa có trang chi tiết; banner ở vị trí trang thương hiệu được lấy riêng. Sản phẩm nổi bật phải thuộc đúng thương hiệu, tối đa theo giới hạn code.
- **Trường hợp lỗi:** Chọn tệp/banner không hoạt động, sản phẩm khác thương hiệu, tạo trang trùng, hoặc công bố khi chưa duyệt bị từ chối.
- **Quy tắc nghiệp vụ:** Chỉ số liệu `active` và `is_verified` mới vào dữ liệu công khai; nguồn nội bộ không tự biến thành khẳng định marketing.
- **Kết quả:** Trang thương hiệu đủ điều kiện được hiển thị, còn thương hiệu cơ sở tiếp tục tồn tại độc lập.
- **Chứng cứ:** [E18](workflowEvidence.md#e18).

### WF19 — Biên tập và công bố dịch vụ

- **Tác nhân / mục đích:** Biên tập viên mô tả dịch vụ và liên kết sản phẩm phù hợp.
- **Điều kiện bắt đầu:** Có quyền dịch vụ, dữ liệu dịch vụ hoặc nhu cầu tạo mới.
- **Bước 1:** Tạo/sửa tiêu đề, slug, phụ đề, mô tả, nội dung chi tiết, thời điểm nên liên hệ, đầu ra, thời lượng, ảnh, biểu tượng, thứ tự và SEO.
- **Bước 2:** Gắn/bỏ/khôi phục liên kết với sản phẩm còn dùng được.
- **Bước 3:** Lưu, xem trước và gửi duyệt; Super Admin phê duyệt, sau đó xuất bản khi có mô tả và ảnh hợp lệ.
- **Bước 4:** Khách xem danh sách/chi tiết dịch vụ và sản phẩm liên quan; có thể mở form tư vấn có ngữ cảnh dịch vụ.
- **Bước 5:** Có thể ngừng xuất bản, lưu trữ hoặc khôi phục.
- **Luồng thay thế:** Gỡ xuất bản đơn thuần không bắt kiểm tra lại các tham chiếu biên tập cũ; thay đổi liên kết sản phẩm bởi người không phải Super Admin có thể mở lại duyệt.
- **Trường hợp lỗi:** Slug/tệp sai, sản phẩm liên quan đã lưu trữ, thiếu mô tả/ảnh khi công bố, hoặc thao tác trên dịch vụ lưu trữ bị chặn.
- **Quy tắc nghiệp vụ:** Quan hệ dịch vụ–sản phẩm hỗ trợ giới thiệu; không tạo giao dịch bán hàng.
- **Kết quả:** Dịch vụ công khai chỉ có nội dung được duyệt và tham chiếu hợp lệ.
- **Chứng cứ:** [E19](workflowEvidence.md#e19).

### WF20 — Biên tập và công bố dự án

- **Tác nhân / mục đích:** Biên tập viên trình bày dự án và sản phẩm liên quan.
- **Điều kiện bắt đầu:** Có quyền dự án; đã có hoặc cần tạo dự án.
- **Bước 1:** Tạo/sửa tên, slug, địa điểm, năm, khách hàng, mô tả, nội dung chi tiết, ảnh chính và SEO.
- **Bước 2:** Gắn ảnh thư viện, văn bản thay thế, sắp thứ tự; gắn/bỏ/khôi phục sản phẩm liên quan.
- **Bước 3:** Xem trước, gửi duyệt; Super Admin duyệt/xuất bản khi có địa điểm, năm, mô tả và ảnh chính.
- **Bước 4:** Website hiện danh sách/chi tiết dự án, thư viện ảnh và sản phẩm liên quan.
- **Bước 5:** Có thể ngừng xuất bản, lưu trữ/khôi phục cả dự án và các mục thư viện theo quyền.
- **Luồng thay thế:** Thay ảnh/quan hệ sản phẩm đáng kể bởi người không phải Super Admin có thể đưa dự án về chờ duyệt; sắp xếp ảnh là thao tác riêng trong cùng hồ sơ dự án.
- **Trường hợp lỗi:** Tệp ảnh không dùng được, ảnh trùng, cùng mục ảnh xuất hiện hai lần trong lệnh sắp xếp, thiếu trường bắt buộc khi công bố, hoặc dự án đã lưu trữ bị chặn.
- **Quy tắc nghiệp vụ:** Dự án là nội dung giới thiệu theo dữ liệu quản trị hiện có; không tự suy ra quan hệ sử dụng sản phẩm ngoài các liên kết đã lưu.
- **Kết quả:** Trang dự án công khai phản ánh hồ sơ đã duyệt.
- **Chứng cứ:** [E20](workflowEvidence.md#e20).

### WF21 — Quản lý banner theo vị trí hiển thị

- **Tác nhân / mục đích:** Biên tập viên đặt hình ảnh/CTA tại khu vực website cụ thể.
- **Điều kiện bắt đầu:** Có quyền banner và tệp ảnh đang dùng được.
- **Bước 1:** Chọn vị trí, tạo/sửa banner với ảnh desktop, ảnh mobile tùy chọn, tiêu đề/nội dung hoặc chế độ chỉ ảnh.
- **Bước 2:** Chọn liên kết nội bộ, ngoài, neo hoặc không liên kết; đặt CTA và thứ tự.
- **Bước 3:** Xem trước các chế độ/khung nhìn rồi đặt `active` để website lấy banner theo vị trí.
- **Bước 4:** Có thể chuyển `inactive`, lưu trữ hoặc khôi phục nếu tệp tham chiếu còn hợp lệ.
- **Luồng thay thế:** Banner gắn vị trí của trang thương hiệu được trang đó lấy theo URL/vị trí; bản ghi trang thương hiệu không phải chứa toàn bộ banner. Các banner cùng vị trí có thứ tự quản trị.
- **Trường hợp lỗi:** Thiếu ảnh, tệp không hợp lệ, liên kết sai hoặc thao tác trên bản ghi lưu trữ bị từ chối.
- **Quy tắc nghiệp vụ:** Banner runtime **không có** `review_status/publish_status`; điều kiện công khai hiện tại là `active` và chưa lưu trữ. Không diễn giải nhãn cũ trong cấu hình Admin thành bước duyệt banner.
- **Kết quả:** Banner hợp lệ xuất hiện tại vị trí được gán.
- **Chứng cứ:** [E21](workflowEvidence.md#e21).

### WF22 — Sắp xếp và bật/tắt khu vực trang chủ

- **Tác nhân / mục đích:** Quản trị nội dung quyết định bố cục trang chủ và mục được giới thiệu.
- **Điều kiện bắt đầu:** Có quyền `home_page.update`.
- **Bước 1:** Mở danh sách các loại khu vực trang chủ cùng dữ liệu hiện có.
- **Bước 2:** Bật/tắt, đổi thứ tự, sửa tiêu đề/phụ đề và chọn dữ liệu tham chiếu cho các khu vực phù hợp.
- **Bước 3:** Xem trước khả dụng của lựa chọn, cập nhật SEO trang chủ.
- **Bước 4:** Lưu toàn bộ cấu hình; website chỉ trả khu vực `enabled` theo thứ tự.
- **Luồng thay thế:** Hệ thống bổ sung cấu hình mặc định cho loại khu vực còn thiếu khi đọc bố cục; lựa chọn tham chiếu không công khai có thể không tạo nội dung công khai tương ứng.
- **Trường hợp lỗi:** Thiếu/nhân đôi loại khu vực, trùng thứ tự, dữ liệu tham chiếu không hợp lệ hoặc chưa có thông tin công ty để lưu SEO bị chặn.
- **Quy tắc nghiệp vụ:** Đây là cấu hình bố cục, không phải thao tác xuất bản hộ sản phẩm/dịch vụ/dự án.
- **Kết quả:** Trang chủ dùng cấu hình được lưu, cùng dữ liệu công khai từ các module nguồn.
- **Chứng cứ:** [E22](workflowEvidence.md#e22).

### WF23 — Quản lý thông tin website và menu

- **Tác nhân / mục đích:** Quản trị nội dung cập nhật thông tin công ty, liên kết xã hội và điều hướng.
- **Điều kiện bắt đầu:** Có quyền website settings/menu tương ứng.
- **Bước 1:** Cập nhật tên, liên hệ, hotline, giờ làm việc, địa chỉ/bản đồ, logo, favicon và các thông tin công ty được cấu hình.
- **Bước 2:** Thêm/sửa/bật tắt/lưu trữ liên kết xã hội.
- **Bước 3:** Tạo/sửa menu theo vị trí header/footer/mobile; thêm mục liên kết hoặc nhóm, đặt cha con, thứ tự và trạng thái.
- **Bước 4:** Kiểm tra đích điều hướng; lưu menu và xem website dùng các menu đang hoạt động.
- **Luồng thay thế:** Mục dẫn tới trang hệ thống chưa công khai bị lược khỏi menu công khai mà không xóa bản ghi menu. Có thể lưu trữ/khôi phục menu và mục menu.
- **Trường hợp lỗi:** URL/kiểu liên kết không hợp lệ, quan hệ cha không hợp lệ, hoặc tệp cấu hình không dùng được bị chặn.
- **Quy tắc nghiệp vụ:** Menu quyết định liên kết điều hướng, không quyết định tự thân trạng thái công khai của nội dung đích.
- **Kết quả:** Header/footer và thông tin liên hệ công khai phản ánh cấu hình đang hoạt động.
- **Chứng cứ:** [E23](workflowEvidence.md#e23).

### WF24 — Quản lý chuyển hướng URL cũ

- **Tác nhân / mục đích:** Quản trị nội dung duy trì đường dẫn cũ khi URL thay đổi.
- **Điều kiện bắt đầu:** Có quyền redirect và biết đường dẫn nguồn/đích nội bộ.
- **Bước 1:** Tạo/sửa quy tắc từ một đường dẫn nguồn tới đường dẫn đích, chọn 301 hoặc 302.
- **Bước 2:** Kiểm tra nguồn/đích là đường dẫn trên chính website, không có dạng mơ hồ hoặc vượt thư mục; nguồn không có query string.
- **Bước 3:** Bật quy tắc; khi khách truy cập đường dẫn nguồn, website nạp danh sách quy tắc active và chuyển hướng.
- **Bước 4:** Vô hiệu hóa, lưu trữ hoặc khôi phục quy tắc khi cần.
- **Luồng thay thế:** Nếu đích không chứa query, query của URL cũ được giữ khi chuyển; nếu không có quy tắc, request đi tiếp bình thường.
- **Trường hợp lỗi:** Đường dẫn sai/trùng hoặc API redirect không khả dụng khiến quy tắc không áp dụng theo cơ chế cache hiện tại.
- **Quy tắc nghiệp vụ:** Chuyển hướng có trạng thái `active/inactive` và lưu trữ, không thuộc luồng duyệt nội dung.
- **Kết quả:** URL cũ dẫn đến URL mới theo mã chuyển hướng được cấu hình.
- **Chứng cứ:** [E24](workflowEvidence.md#e24).

### WF25 — Quản lý thư viện tệp và phạm vi sử dụng

- **Tác nhân / mục đích:** Nhân viên có quyền tệp tải và tái sử dụng hình ảnh/tài liệu cho nội dung khác.
- **Điều kiện bắt đầu:** Có quyền đọc/tạo tệp; tệp phù hợp mục đích và giới hạn API.
- **Bước 1:** Tải tệp hoặc đăng ký metadata; hệ thống kiểm tra định dạng, kích thước, tên và xử lý ảnh được hỗ trợ.
- **Bước 2:** Tìm/lọc theo kiểu, mục đích, tình trạng mồ côi, nơi lưu và quan hệ sử dụng.
- **Bước 3:** Xem chi tiết, preview hoặc tải xuống trong Admin; gắn tệp vào sản phẩm, thương hiệu, banner, trang, dịch vụ/dự án hoặc tài liệu kỹ thuật.
- **Bước 4:** Khi không còn sử dụng, lưu trữ; có thể khôi phục.
- **Luồng thay thế:** File storage có thể là local hoặc R2 theo cấu hình; truy cập tệp công khai đi qua WF04, không lấy thẳng mọi tệp trong thư viện.
- **Trường hợp lỗi:** Tệp còn quan hệ sử dụng đang hoạt động không được lưu trữ; đường dẫn lưu trữ không an toàn hoặc file không đọc được không được cấp.
- **Quy tắc nghiệp vụ:** Metadata, nội dung vật lý và `file_usage` có liên hệ nhưng khác nhau; xóa workspace import chưa áp dụng chỉ dọn tệp nguồn nếu không còn tham chiếu.
- **Kết quả:** Tệp được quản lý có truy vết nơi sử dụng và không lộ công khai ngoài phạm vi.
- **Chứng cứ:** [E25](workflowEvidence.md#e25).

## E. Truy cập và giám sát

### WF26 — Đăng nhập và duy trì phiên quản trị

- **Tác nhân / mục đích:** Nhân viên được cấp tài khoản truy cập Admin theo vai trò.
- **Điều kiện bắt đầu:** Tài khoản active, chưa lưu trữ và có đúng một vai trò active.
- **Bước 1:** Nhập email và mật khẩu ở trang đăng nhập.
- **Bước 2:** API xác thực và tạo access token, refresh session; giao diện nạp hồ sơ/quyền.
- **Bước 3:** Mỗi thao tác Admin được kiểm tra xác thực và quyền hiện thời; phiên có thể được làm mới bằng refresh token luân chuyển.
- **Bước 4:** Người dùng đăng xuất hoặc đổi mật khẩu; đổi mật khẩu thu hồi các phiên làm mới.
- **Luồng thay thế:** Khi quyền vai trò thay đổi hoặc tài khoản khóa, request tiếp theo phải dùng quyền/trạng thái mới; người dùng bị điều hướng khỏi trang không có quyền.
- **Trường hợp lỗi:** Sai thông tin, tài khoản inactive/locked, thiếu hoặc nhiều hơn một vai trò, refresh token hết hạn/thu hồi bị từ chối.
- **Quy tắc nghiệp vụ:** Khách website công khai không có tài khoản trong luồng này; một người dùng quản trị có đúng một vai trò active theo schema/migration hiện tại.
- **Kết quả:** Phiên Admin có phạm vi truy cập phù hợp.
- **Chứng cứ:** [E26](workflowEvidence.md#e26).

### WF27 — Quản lý tài khoản, vai trò và quyền

- **Tác nhân / mục đích:** Super Admin cấp quyền vận hành theo vai trò cho nhân viên.
- **Điều kiện bắt đầu:** Super Admin đã đăng nhập.
- **Bước 1:** Xem vai trò, ma trận quyền và tài khoản; tạo vai trò riêng nếu cần.
- **Bước 2:** Cấu hình quyền vai trò theo từng module/hành động, bảo đảm quyền đọc phụ thuộc của các thao tác.
- **Bước 3:** Tạo người dùng với thông tin, trạng thái, đúng một vai trò và mật khẩu tạm; hoặc cập nhật vai trò/trạng thái và đặt lại mật khẩu.
- **Bước 4:** Khóa/vô hiệu hóa tài khoản hoặc lưu trữ vai trò tự tạo khi không còn người được gán.
- **Luồng thay thế:** Các vai trò seed gồm Super Admin, Content Admin, Product Admin, Sales Admin, Viewer. Vai trò hệ thống có metadata được bảo vệ; quyền Super Admin không chỉnh qua ma trận.
- **Trường hợp lỗi:** Vai trò không hoạt động, email trùng, cấp quyền dành riêng cho Super Admin, thiếu quyền đọc phụ thuộc, cố vô hiệu hóa vai trò còn người dùng, hoặc làm mất Super Admin cuối cùng đều bị chặn.
- **Quy tắc nghiệp vụ:** Mã quyền trên controller là chốt kiểm soát API; menu/route Admin chỉ là lớp hiển thị bổ sung. Các thao tác user/role ghi dữ liệu chỉ Super Admin được làm.
- **Kết quả:** Mỗi nhân viên có một vai trò và tập quyền có thể thực thi.
- **Chứng cứ:** [E27](workflowEvidence.md#e27).

### WF28 — Theo dõi hoạt động và xem nhật ký

- **Tác nhân / mục đích:** Người có quyền phù hợp xem kết quả hoạt động website và đối chiếu thay đổi quản trị.
- **Điều kiện bắt đầu:** Có quyền dashboard theo controller hoặc `audit_log.read` cho nhật ký.
- **Bước 1:** Website ghi nhận lượt xem trang và sản phẩm qua endpoint công khai tương ứng.
- **Bước 2:** Dashboard lấy dữ liệu tổng hợp/lượt xem theo thời gian và hiển thị xu hướng, sản phẩm nổi bật.
- **Bước 3:** Người có quyền lọc nhật ký theo điều kiện và mở chi tiết thao tác để truy vết tác nhân, hành động, thực thể.
- **Luồng thay thế:** Nếu thiếu dữ liệu lượt xem, dashboard chỉ hiển thị dữ liệu đang có; một số request xem công khai có thể làm tăng số đếm.
- **Trường hợp lỗi:** Không có quyền xem hoặc nguồn dữ liệu không khả dụng thì không thể kết luận dashboard/nhật ký đã cập nhật.
- **Quy tắc nghiệp vụ:** Nhật ký là chức năng tra cứu chỉ đọc qua API; không phải bước phê duyệt. Lượt xem là số đo kỹ thuật, không chứng minh nhu cầu báo giá.
- **Kết quả:** Có dữ liệu vận hành và dấu vết thao tác để kiểm tra.
- **Chứng cứ:** [E28](workflowEvidence.md#e28).

## F. Xuất dữ liệu hiện có

### WF29 — Xuất dữ liệu danh mục và khách hàng ra bảng tính

- **Tác nhân / mục đích:** Nhân viên có quyền đọc các nguồn liên quan lấy một bản dữ liệu hiện có để rà soát nội bộ, chia sẻ theo lựa chọn hoặc chuẩn bị nhập lại.
- **Điều kiện bắt đầu:** Đã đăng nhập Admin; mở thẻ “Xuất dữ liệu” trong khu vực nhập/xuất hoặc nút xuất ở danh sách khách hàng; các API nguồn cho phép đọc.
- **Bước 1:** Chọn mẫu sản phẩm, danh mục và thương hiệu, tài liệu kỹ thuật hoặc khách hàng. Ở danh sách khách hàng có lối xuất riêng theo bộ lọc hiện tại.
- **Bước 2:** Chọn toàn bộ hoặc lọc theo ngày tạo/cập nhật, trạng thái, thương hiệu, danh mục hay điều kiện khách hàng tương ứng; với phạm vi “theo điều kiện” phải có ít nhất một điều kiện khi mẫu không phải khách hàng.
- **Bước 3:** Với sản phẩm, chọn có kèm biến thể/tài liệu kỹ thuật hay chỉ dữ liệu nguồn. Có tùy chọn lọc các bản ghi theo cờ đang hoạt động, đã duyệt, đã xuất bản; mẫu tài liệu lọc `active` và `is_public` khi bật lựa chọn này.
- **Bước 4:** Giao diện tải các trang dữ liệu từ API nguồn, lọc tiếp theo ngày, xây các sheet/cột tương ứng rồi tạo tệp tải về. Sản phẩm, phân loại và khách hàng dùng Excel; danh sách tài liệu kỹ thuật có thể chọn CSV.
- **Luồng thay thế:** Mẫu khách hàng cho chọn thông tin liên hệ, số yêu cầu báo giá và lần tương tác gần nhất. Tệp nhiều bảng dùng các sheet Excel riêng; CSV chỉ nhận một bảng.
- **Trường hợp lỗi:** Khoảng ngày sai, thiếu điều kiện lọc bắt buộc, không có dữ liệu phù hợp, API thiếu quyền/không trả dữ liệu, hoặc lỗi tạo tệp ở trình duyệt khiến không tải được.
- **Quy tắc nghiệp vụ:** Đây là bản xuất do Admin tạo ở trình duyệt từ dữ liệu được API trả về; không tạo lô nhập, không sửa trạng thái sản phẩm. Tùy chọn lọc “public-safe” chỉ dựa trên các cờ truy vấn trong code và không tự cấp quyền công khai cho tệp xuất; cần rà lại nội dung trước khi chia sẻ ra ngoài.
- **Kết quả:** Nhân viên nhận tệp bảng tính phản ánh tập dữ liệu và bộ lọc đã chọn tại thời điểm tải.
- **Chứng cứ:** [E29](workflowEvidence.md#e29).

## Những điểm cần người dùng xác minh trước khi chốt đặc tả

1. **Tên đề tài chính thức** và tên pháp lý của đơn vị trong bìa LVTN; tài liệu hiện chỉ dùng “Song Thanh” như tên repository/sản phẩm.
2. **Kỳ vọng xử lý sau khi nhận báo giá/liên hệ:** code chỉ có phân công, ghi chú và trạng thái. Không thấy tạo file báo giá chính thức, gửi email tự động, đơn hàng hay cam kết thời gian phản hồi; không thêm vào workflow khi chưa xác nhận.
3. **Phạm vi dùng luồng nhập qua đường dẫn local:** API có `intake` theo đường dẫn, Admin cũng có ô đường dẫn; cần xác nhận có dùng trong môi trường bàn giao hay chỉ là công cụ nội bộ.
4. **Chính sách duyệt khi Super Admin sửa nội dung đang công khai:** code cho phép cập nhật tại chỗ; cần xác nhận đây là quy trình muốn mô tả trước hội đồng hay ngoại lệ vận hành.
5. **Mức độ bắt buộc của tiêu chí chất lượng nội dung:** Admin có cảnh báo về SEO, gallery, tài liệu, biến thể; API không chặn mọi cảnh báo. Tài liệu giữ đúng mức chặn trong code hiện tại.
6. **DDL triển khai:** file schema là snapshot 30/07/2026, còn migration mới tới 09/10/2026. Cần so trạng thái migration/database thật trước khi khẳng định schema triển khai trùng bản thảo.
