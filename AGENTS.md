# AGENTS.md — LVTN

## Mục tiêu hiện tại

Repository này được phát triển thành sản phẩm cho luận văn tốt nghiệp (LVTN).

## Trạng thái tài liệu

- Toàn bộ thư mục `docs/` cũ đã bị loại bỏ ngày 2026-08-04 vì không còn phản ánh đúng yêu cầu hiện tại.
- Không khôi phục hoặc dùng các tài liệu cũ trong lịch sử Git làm nguồn sự thật.
- Không suy diễn yêu cầu mới từ tên bảng, code legacy hoặc tài liệu đã bị xóa.
- Khi hành vi nghiệp vụ chưa rõ, phải đối chiếu code/runtime hiện tại và hỏi người dùng trước khi chốt thay đổi kiến trúc.

## Cấu trúc runtime hiện tại

- `frontend/`: website công khai.
- `admin/`: giao diện quản trị độc lập.
- `api/`: backend API hiện hành.
- `database/`: schema, migration và dữ liệu nền.

## Nguyên tắc làm việc

- Ưu tiên hành vi đang chạy và kiểm thử có bằng chứng hơn giả định cũ.
- Không tự thêm bảng, endpoint, quyền, workflow hoặc phạm vi sản phẩm khi chưa được xác nhận.
- Không hard-delete dữ liệu nghiệp vụ làm mặc định.
- Giữ tách biệt trạng thái duyệt nội bộ và trạng thái hiển thị công khai nếu code hiện tại đang dùng hai trạng thái này.
- Mọi tài liệu mới phải mô tả đúng code/runtime hiện tại và chỉ được xem là nguồn sự thật sau khi người dùng xác nhận.
- Bảo toàn các thay đổi đang có trong worktree; không reset hoặc ghi đè thay đổi không thuộc task.
- File mã nguồn tạo mới phải dùng tên ASCII ngắn, liền chữ và có ý nghĩa; ưu tiên `PascalCase` cho component/class và `camelCase` cho module/hàm. Không dùng dấu tiếng Việt, tên trang trí, nhãn kiểu nội dung do AI tạo hoặc dấu gạch nối trong tên file mới. Không đổi tên route/framework hiện có chỉ để áp dụng quy tắc này.

