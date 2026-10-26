---
name: Song Thanh
description: Hệ giao diện B2B hiện đại cho website công khai và không gian quản trị.
colors:
  public-primary: "#004ab4"
  admin-primary: "#145f9f"
  ink-navy: "#0b1c30"
  public-text: "#0f172a"
  admin-text: "#132238"
  public-canvas: "#f8fafc"
  admin-canvas: "#f3f6f9"
  white-surface: "#ffffff"
  public-border: "#d9e2ec"
  admin-border: "#dce3ea"
typography:
  public-display:
    fontFamily: "Archivo, Be Vietnam Pro, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: "48px"
    letterSpacing: "-0.02em"
  public-body:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "26px"
  admin-body:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
rounded:
  public-sm: "8px"
  public-md: "12px"
  public-lg: "16px"
  admin-sm: "4px"
  admin-md: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "64px"
components:
  public-button-primary:
    backgroundColor: "{colors.public-primary}"
    textColor: "{colors.white-surface}"
    rounded: "{rounded.public-sm}"
    padding: "12px 24px"
    height: "48px"
  admin-button-primary:
    backgroundColor: "{colors.admin-primary}"
    textColor: "{colors.white-surface}"
    rounded: "{rounded.admin-md}"
    padding: "10px 16px"
    height: "44px"
  admin-input:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.admin-text}"
    rounded: "{rounded.admin-sm}"
    padding: "10px 12px"
    height: "44px"
---

# Song Thanh — Quy tắc giao diện

## Overview

**Creative North Star: “Song Thanh hiện đại, đáng tin”.** Giữ nhận diện xanh–trắng hiện có, nhưng làm gọn nội dung, cân lại khoảng trắng và để hình ảnh sản phẩm thật dẫn nhịp. Website cần cảm giác của một doanh nghiệp hiện đại, chuyên nghiệp và dễ tiếp cận; admin ưu tiên nhìn rõ trạng thái, quyền và hành động kế tiếp. Hai app cùng hệ chữ nhưng không dùng cùng mật độ bố cục. Không dùng mô-típ nhà máy, xí nghiệp hay bảng điều khiển cơ khí làm phong cách giao diện.

Tài liệu này ghi lại hệ đang triển khai để người dùng duyệt; theo `AGENTS.md`, chưa xem là nguồn sự thật về yêu cầu mới trước khi được xác nhận.

**Key Characteristics:** hiện đại, đáng tin, mạch lạc; hình ảnh và dữ liệu thật trước trang trí; trạng thái công khai và nội bộ không lẫn nhau; thao tác trên điện thoại vẫn rõ ràng.

## Colors

### Primary

- **Xanh website** (`public-primary`): chỉ cho liên kết, lựa chọn và hành động chính ngoài web.
- **Xanh quản trị** (`admin-primary`): cho hành động chính và trạng thái chọn trong admin; không dùng như màu nền cho cả màn.

### Neutral

- **Xanh mực** (`ink-navy`, `public-text`, `admin-text`): chữ chính và tiêu đề.
- **Nền sáng** (`public-canvas`, `admin-canvas`, `white-surface`): tách vùng bằng sắc độ nhẹ; nội dung là trọng tâm.
- **Đường viền yên tĩnh** (`public-border`, `admin-border`): phân khu khi cần, không biến mọi nhóm thông tin thành thẻ.

**The One Accent Rule.** Mỗi khu vực chỉ có một hành động chính màu xanh; các hành động phụ dùng nền trắng hoặc chữ.

## Typography

**Display Font:** Archivo, dự phòng Be Vietnam Pro. **Body Font:** Be Vietnam Pro, hỗ trợ dấu tiếng Việt ở cả website và admin. Chữ mã/định danh giữ font monospace hệ thống khi cần phân biệt dữ liệu.

- **Tiêu đề trang website:** 700, 48/48 px ở desktop; 42/46 px ở tablet; 28/34 px trên điện thoại.
- **Tiêu đề khu vực:** 700, 30/36 px ở desktop và 22/28 px trên điện thoại.
- **Nội dung website:** 400, 16/26 px. Không kéo đoạn văn thành chiều rộng toàn màn.
- **Nội dung admin:** 400, 15 px với line-height 1.5; nhãn và điều khiển quan trọng không nhỏ hơn 12 px.

**The Readable Vietnamese Rule.** Không dùng uppercase, tracking rộng hoặc chữ 10–11 px cho thông tin cần ra quyết định; kiểm tra dấu tiếng Việt và ngắt dòng ở 390 px.

## Elevation

Mặt phẳng và viền nhẹ là mặc định. Bóng đổ chỉ giúp phân biệt lớp nổi như dialog, menu, hoặc phản hồi hover; không dùng bóng lớn đồng loạt trên lưới thẻ. Website có `--shadow-card`; admin có `shadow-soft` trong Tailwind config.

**The Flat By Default Rule.** Nếu một thẻ chỉ chứa một nhãn và một giá trị, ưu tiên hàng thông tin thay vì hộp nổi riêng.

## Components

### Buttons

- Website: hành động chính xanh website, cao tối thiểu 48 px; phụ là viền nhẹ. Admin: cao tối thiểu 44 px trên điện thoại, bo 8 px, trạng thái focus nhìn thấy rõ.
- Một hành động có một tên và một kết quả rõ. Tránh hai nút lưu không phân biệt hoặc nút không báo kết quả.

### Cards / Containers

- Dùng nền trắng, đường viền mảnh và bo 8–16 px theo ngữ cảnh. Ảnh sản phẩm/thương hiệu phải là ảnh thật; không tạo ảnh marketing thay thế khi thiếu dữ liệu.
- Trong danh sách, tên và thông tin chính đi trước metadata; không lặp cùng logo, tên hay mã ở nhiều tầng.

### Inputs / Fields

- Nhãn luôn đi cùng trường; lỗi hiển thị gần trường. Admin dùng `--control-height` (44 px trên điện thoại, 40 px từ tablet), viền `admin-border`, focus xanh quản trị.
- Helptext chỉ xuất hiện khi nó giúp quyết định hoặc ngăn sai sót; không nhắc lại chính nhãn hoặc mô tả một thao tác hiển nhiên.

### Navigation

- Header website nhất quán giữa mọi route. Trang bị ẩn không hiện từ menu công khai; URL con có trạng thái riêng. Admin giữ cụm chức năng rõ ràng, tránh nhiều lớp tab điều hướng chồng nhau.
- Trạng thái chọn thể hiện bằng chữ/hình dạng, không chỉ màu. Nút chuyển banner chỉ animate màu và vị trí, tôn trọng reduced motion.

## Do's and Don'ts

### Do:

- **Do** hiển thị dữ liệu, ảnh và trạng thái thật; phân biệt bản nháp, duyệt nội bộ và hiển thị website.
- **Do** giữ thao tác quan trọng trong tầm nhìn và báo kết quả sau khi lưu.
- **Do** kiểm tra các route chính ở 390, 1440 và 2560 px, cùng kiểm tra bàn phím và tên truy cập.

### Don't:

- **Don't** dùng mô-típ ecommerce-heavy: giỏ hàng, checkout, giảm giá giả, khan hàng giả hoặc mật độ sàn thương mại.
- **Don't** dùng generic AI-looking layouts, thẻ trang trí quá khổ hoặc gradient-heavy SaaS pages.
- **Don't** viết khẳng định “official distributor”, quan hệ chiến lược hay dự án đã dùng sản phẩm khi không có nguồn dữ liệu xác minh.
- **Don't** lặp helptext, dùng dải màu ở cạnh trái như trang trí mặc định, hoặc giấu thao tác trong menu không cần thiết.
- **Don't** dùng hình khối, chữ siêu đậm, nền kim loại hay mô-típ nhà máy để biểu thị ngành hàng; sản phẩm công nghiệp không đồng nghĩa với giao diện công nghiệp.
