## PHẦN 1. TÊN ĐỀ TÀI

**Xây dựng website giới thiệu sản phẩm, dịch vụ và hệ thống quản trị cho Song Thành**

**Mô tả ngắn:** Đề tài hướng đến việc xây dựng một website để khách hàng dễ tìm hiểu về Song Thành, xem sản phẩm, dịch vụ và các dự án của công ty. Khi cần hỏi thêm hoặc muốn biết giá, khách có thể gửi yêu cầu ngay trên website. Nhân viên sẽ có trang quản trị để cập nhật thông tin và theo dõi những yêu cầu đó.

## PHẦN 2. CÁC WORKFLOW DỰ KIẾN

### WF01. Khách xem thông tin trên website

Bước 1: Khách mở website hoặc một đường dẫn cụ thể. Nếu đường dẫn là địa chỉ cũ đã được thiết lập chuyển hướng thì hệ thống tự chuyển sang địa chỉ mới.
Bước 2: Nếu nội dung tồn tại và đã được công bố thì hệ thống hiển thị trang; nếu không tồn tại hoặc chưa công bố thì hiện trang "Không tìm thấy" kèm nút về trang chủ.
Bước 3: Khách xem trang chủ (banner, thông tin công ty, các khu vực đang bật) rồi chọn mục muốn xem: Sản phẩm, Thương hiệu, Dịch vụ, Dự án, Tin tức, Liên hệ. Khu vực bị tắt hoặc không có dữ liệu thì không hiển thị.
Bước 4: Khách duyệt danh sách, lọc theo danh mục hoặc dùng ô tìm kiếm. Nếu không tìm thấy thì thử từ khóa khác hoặc gửi yêu cầu tư vấn (WF02).
Bước 5: Khách mở trang chi tiết. Với sản phẩm, khách xem mô tả, ảnh, thông số, tài liệu kỹ thuật và các mẫu mã; nếu mẫu mã hiện giá thì hiển thị giá, nếu để liên hệ báo giá thì chỉ hiện dòng "Liên hệ báo giá". Khách chỉ tải được tệp gắn với nội dung đã công bố, ảnh sản phẩm có dấu bản quyền (watermark).
Bước 6: Nếu khách muốn được tư vấn hoặc báo giá thì chuyển sang WF02.

### WF02. Khách gửi yêu cầu tư vấn, báo giá và liên hệ

Bước 1: Khách bấm "Yêu cầu báo giá" ở một sản phẩm, hoặc mở biểu mẫu tư vấn chung hoặc trang Liên hệ. Nếu đã chọn sản phẩm thì chọn một hoặc nhiều mẫu mã và nhập số lượng nếu biết; nếu chưa chọn thì vẫn gửi được yêu cầu tư vấn chung.
Bước 2: Với yêu cầu tư vấn hoặc báo giá, khách nhập họ tên, số điện thoại, email và nội dung cần trao đổi. Với liên hệ chung, khách nhập họ tên, số điện thoại và lời nhắn; email, tên công ty có thể bổ sung.
Bước 3: Nếu thông tin không hợp lệ (thiếu trường bắt buộc, số điện thoại hoặc email sai định dạng, số lượng sai), website báo lỗi để khách sửa; nếu hợp lệ, hệ thống tiếp tục ghi nhận yêu cầu.
Bước 4: Với yêu cầu báo giá, hệ thống kiểm tra lại các sản phẩm đã chọn. Nếu có sản phẩm vừa ngừng hiển thị, hệ thống yêu cầu khách chọn lại; nếu hợp lệ, hệ thống lưu yêu cầu ở trạng thái "Mới" và ghi lại giá công khai tại thời điểm gửi (nếu có). Với liên hệ chung, hệ thống lưu lời nhắn vào danh sách liên hệ.
Bước 5: Hệ thống tìm hồ sơ khách trùng khớp. Nếu đã có thì gắn yêu cầu vào hồ sơ cũ và bổ sung thông tin còn thiếu; nếu chưa có thì tạo hồ sơ mới.
Bước 6: Nếu lưu thành công, website báo đã tiếp nhận và yêu cầu xuất hiện trong danh sách để nhân viên theo dõi (WF07); nếu lưu thất bại, website báo lỗi để khách thử lại. Đây là yêu cầu tư vấn, không phải đơn hàng và không có thanh toán.

### WF03. Cấp tài khoản và phân quyền cho nhân viên

Bước 1: Quản trị viên cấp cao đăng nhập và mở phần quản lý tài khoản, vai trò. Nếu chưa đăng nhập hoặc không có quyền, hệ thống không cho thực hiện.

Bước 2: Quản trị viên chọn một vai trò đang hoạt động. Nếu chưa có vai trò phù hợp, quản trị viên tạo vai trò mới và chọn các quyền cần cấp.

Bước 3: Quản trị viên nhập thông tin nhân viên, chọn đúng một vai trò và đặt mật khẩu ban đầu. Nếu email đã được dùng hoặc vai trò không hợp lệ, hệ thống yêu cầu sửa; nếu hợp lệ, hệ thống tạo tài khoản.

Bước 4: Nhân viên dùng tài khoản được cấp để đăng nhập. Nếu sai email, mật khẩu hoặc tài khoản bị khóa, hệ thống từ chối; nếu hợp lệ, hệ thống mở trang quản trị.

Bước 5: Hệ thống chỉ cho nhân viên xem và thực hiện những công việc thuộc quyền được cấp. Nếu nhân viên mở một phần ngoài quyền, hệ thống từ chối truy cập.

Bước 6: Khi công việc thay đổi, quản trị viên có thể đổi vai trò, khóa hoặc mở lại tài khoản, đặt lại mật khẩu. Nếu thay đổi làm mất quản trị viên cấp cao cuối cùng, hoặc vô hiệu hóa vai trò còn nhân viên đang dùng, hệ thống từ chối; nếu hợp lệ, quyền mới được áp dụng từ lần thao tác tiếp theo.

### WF04. Quản lý thông tin website và thư viện tệp

Bước 1: Nhân viên có quyền chọn mục cần chỉnh: thông tin công ty và mạng xã hội, menu, banner, bố cục trang chủ, chuyển hướng đường dẫn, hoặc thư viện tệp.
Bước 2: Nhân viên nhập thay đổi. Thông tin công ty gồm tên, hotline, địa chỉ, giờ làm việc, logo. Menu gồm các mục, cấp cha con và thứ tự. Banner gồm ảnh máy tính và điện thoại, nội dung, liên kết, vị trí. Trang chủ gồm bật/tắt từng khu vực và thứ tự. Chuyển hướng gồm địa chỉ cũ và địa chỉ mới.
Bước 3: Khi cần ảnh hoặc tài liệu, nhân viên tải tệp lên thư viện. Nếu tệp sai định dạng hoặc quá dung lượng cho phép thì chọn tệp khác; nếu hợp lệ thì hệ thống lưu và nhân viên gắn vào banner, sản phẩm, bài viết, dự án hoặc tài liệu kỹ thuật.
Bước 4: Nếu hình ảnh hoặc đường dẫn không hợp lệ thì sửa trước khi lưu; nếu hợp lệ thì lưu.
Bước 5: Mục nào được bật thì hiển thị tại đúng vị trí trên website; mục bị tắt thì ẩn nhưng dữ liệu vẫn được giữ. Khu vực trang chủ không có dữ liệu phù hợp thì không hiển thị; mục menu dẫn tới trang chưa công bố thì tự ẩn khỏi menu.
Bước 6: Khi đổi đường dẫn của một trang, nhân viên tạo chuyển hướng từ địa chỉ cũ sang địa chỉ mới để khách không gặp trang lỗi.
Bước 7: Khi muốn lưu trữ một tệp: nếu tệp đang được nội dung nào sử dụng thì không cho lưu trữ, phải gỡ khỏi nơi đang dùng trước; nếu không còn nơi nào dùng thì cho lưu trữ.

### WF05. Nhập sản phẩm từ Excel

Bước 1: Nhân viên sản phẩm chọn tệp Excel hoặc CSV, chọn trang tính và các dòng muốn nhập. Nếu tệp sai định dạng, không đọc được hoặc quá 20 MB thì chọn lại.
Bước 2: Nhân viên ghép các cột trong tệp với danh mục, sản phẩm, mẫu mã, giá và thông tin khác (hệ thống gợi ý sẵn, có thể sửa). Nếu còn thiếu cột quan trọng thì chỉnh lại cách ghép trước khi tiếp tục.
Bước 3: Hệ thống tạo bản xem trước. Lúc này đây chỉ là dữ liệu tạm, chưa phải sản phẩm chính thức và chưa hiện trên website.
Bước 4: Nếu có dòng thiếu, trùng hoặc mâu thuẫn với dữ liệu đang có thì nhân viên sửa dòng đó, chọn cách xử lý (giữ dữ liệu cũ, ghi đè hoặc gộp) hoặc bỏ qua. Nếu giá không hợp lệ thì sửa thành giá đúng hoặc chuyển sang "Liên hệ báo giá", hệ thống không tự đoán giá.
Bước 5: Nhân viên duyệt từng dòng hoặc duyệt hàng loạt: dòng đạt thì chọn, dòng không đạt thì từ chối.
Bước 6: Nếu còn xung đột chưa giải quyết hoặc chưa có dòng nào được chọn thì quay lại rà soát; nếu đã sẵn sàng thì hệ thống cho xem trước kế hoạch (sẽ tạo mới bao nhiêu, cập nhật bao nhiêu).
Bước 7: Nhân viên xác nhận nhập vào danh mục sản phẩm. Nếu chưa muốn nhập thì giữ lại làm tiếp sau hoặc hủy lần nhập; nếu có lỗi giữa chừng thì hủy cả lần nhập, không nhập dở.
Bước 8: Dữ liệu đã nhập vẫn chưa tự hiện cho khách. Sản phẩm cần giới thiệu tiếp tục qua WF06.

### WF06. Quản lý, duyệt và công bố sản phẩm và nội dung giới thiệu

Bước 1: Nhân viên chọn loại cần quản lý: sản phẩm hoặc nội dung giới thiệu (dịch vụ, dự án, trang thương hiệu, bài viết, trang thông tin), rồi tạo mới hoặc mở bản có sẵn.
Bước 2: Với sản phẩm, nhân viên kiểm tra danh mục và thương hiệu (nếu chưa có thì tạo trước), nhập tên, mô tả, ảnh chính, thêm các mẫu mã và chọn hiện giá hoặc để khách liên hệ hỏi giá cho từng mẫu mã, rồi bổ sung ảnh, thông số, tài liệu kỹ thuật.
Bước 3: Với nội dung giới thiệu, nhân viên nhập nội dung và hình ảnh theo từng loại (dịch vụ có mô tả và kết quả bàn giao; dự án có địa điểm, năm, thư viện ảnh; trang thương hiệu có phần giới thiệu và số liệu kèm nguồn; bài viết có danh mục tin) và có thể gắn các sản phẩm liên quan.
Bước 4: Nếu thông tin bắt buộc còn thiếu, mã hoặc đường dẫn bị trùng, hoặc tệp không phù hợp thì chỉnh sửa; nếu hợp lệ thì lưu ở trạng thái Nháp. Nhân viên có thể xem trước giao diện như khách sẽ thấy.
Bước 5: Nhân viên gửi duyệt, mục chuyển sang Chờ duyệt. Quản trị viên cấp cao xem xét: nếu từ chối thì nhân viên sửa theo góp ý và gửi lại; nếu chấp thuận thì chuyển sang Đã duyệt.
Bước 6: Nếu mục đủ điều kiện công bố (sản phẩm cần đang hoạt động, có ảnh chính và mô tả ngắn; nội dung cần đủ các phần bắt buộc) thì Quản trị viên cấp cao công bố và khách thấy trên website; nếu chưa đủ thì mục vẫn ở khu vực quản trị để hoàn thiện.
Bước 7: Mẫu mã có duyệt và công bố riêng, mẫu mã chưa công bố thì khách không thấy dù sản phẩm đã công bố. Sản phẩm liên quan chỉ hiện khi chính sản phẩm đó đã được công bố. Số liệu thương hiệu chưa xác minh thì không hiển thị cho khách.
Bước 8: Khi sửa thông tin quan trọng của mục đã công bố: nếu người sửa không phải Quản trị viên cấp cao thì mục quay về Chờ duyệt và tạm ẩn cho tới khi duyệt lại; nếu là Quản trị viên cấp cao thì cập nhật trực tiếp.
Bước 9: Khi mục không còn giới thiệu, nhân viên ngừng hiển thị hoặc lưu trữ (WF08).

### WF07. Xử lý yêu cầu báo giá, liên hệ và hồ sơ khách hàng

Bước 1: Nhân viên kinh doanh mở hộp thư báo giá hoặc liên hệ, lọc theo trạng thái, người phụ trách, ngày hoặc sản phẩm, rồi mở một mục để xem thông tin khách, nội dung, sản phẩm khách chọn, số lượng và giá công khai lúc khách gửi.
Bước 2: Nếu cần thì phân công người phụ trách và ghi chú nội bộ.
Bước 3: Nếu là thư rác hoặc yêu cầu không phù hợp, nhân viên phân loại tương ứng; nếu cần tiếp tục xử lý, nhân viên cập nhật tình trạng phù hợp.
Bước 4: Khi có thêm thông tin từ việc trao đổi với khách, nhân viên ghi chú để người phụ trách tiếp tục theo dõi. Nếu chưa có kết quả, yêu cầu vẫn được giữ trong danh sách làm việc.
Bước 5: Khi công việc kết thúc, nhân viên chuyển yêu cầu sang "Đã xong". Hệ thống theo dõi yêu cầu và ghi chú xử lý, không tự lập hoặc gửi một bản báo giá thương mại cho khách.
Bước 6: Khi cần biết khách đã tương tác thế nào, nhân viên mở hồ sơ khách để xem toàn bộ liên hệ, yêu cầu báo giá và dòng thời gian. Nếu cần sửa thông tin hồ sơ thì sửa trực tiếp (hồ sơ đã lưu trữ phải khôi phục trước); nếu khách chưa có hồ sơ nhưng cần ghi nhận (ví dụ khách gọi điện) thì tạo hồ sơ thủ công.
Bước 7: Yêu cầu hoặc hồ sơ không còn cần làm việc thì lưu trữ, có thể khôi phục theo quyền (WF08).

### WF08. Theo dõi, xuất dữ liệu, lưu trữ và khôi phục

Bước 1: Người có quyền mở trang Tổng quan để xem lượt xem website, sản phẩm được xem nhiều và số yêu cầu mới theo khoảng thời gian chọn. Nếu khoảng đó chưa có dữ liệu thì hiện "Chưa có dữ liệu".
Bước 2: Khi cần đối chiếu thao tác, mở nhật ký, lọc theo người, hành động, thời gian, rồi xem chi tiết ai đã làm gì và lúc nào.
Bước 3: Khi cần lấy dữ liệu ra ngoài, chọn loại dữ liệu (sản phẩm, danh mục và thương hiệu, tài liệu kỹ thuật, khách hàng), phạm vi và định dạng (Excel hoặc CSV). Nếu khoảng ngày sai hoặc chọn "theo điều kiện" mà chưa đặt điều kiện nào thì báo lỗi để chọn lại; nếu không có dữ liệu phù hợp thì báo "Không có dữ liệu phù hợp"; nếu hợp lệ thì tải tệp về máy. Tệp xuất là bản nội bộ, cần rà lại trước khi chia sẻ ra ngoài.
Bước 4: Khi một mục không còn dùng, nhân viên bấm Lưu trữ. Nếu mục còn dữ liệu đang phụ thuộc (danh mục còn sản phẩm, thương hiệu còn sản phẩm, tệp đang được dùng, mẫu mã còn trong yêu cầu báo giá đang xử lý) thì hệ thống chặn và nêu rõ lý do; nếu không thì mục rời danh sách làm việc, và nội dung công khai cũng ngừng hiển thị trên website.
Bước 5: Khi cần dùng lại, nhân viên lọc theo "Đã lưu trữ", chọn mục và bấm Khôi phục. Nếu mục cha chưa dùng được (ví dụ danh mục con cần danh mục cha) thì phải khôi phục mục cha trước; nếu hợp lệ thì khôi phục thành công và mục chỉ hiện lại trên website nếu vẫn đủ điều kiện công bố.
Bước 6: Xóa vĩnh viễn là ngoại lệ: chỉ Quản trị viên cấp cao làm được, chỉ với mục đã lưu trữ và không còn dữ liệu liên quan đang hoạt động (áp dụng cho liên hệ, yêu cầu báo giá, hồ sơ khách và lô nhập chưa áp dụng).
