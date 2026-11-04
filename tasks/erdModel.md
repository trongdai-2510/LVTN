# Xác định lại thực thể và quan hệ cho mục 3.1.1.1

**Ngày chụp hiện trạng:** 04/11/2026. **Nguồn:** `D:\Song_thanh_3_1_1_1.zip` (Chương 1–2 và Hình 3-1 chỉ để xác định phạm vi), PostgreSQL local qua cấu hình API, `database/ddl/schema.sql`, migration và code API/website/admin đang có. Không dùng tài liệu `docs/` cũ hoặc bản Word khác trong Downloads. Theo `AGENTS.md`, tài liệu này là **bản kiểm kê và đề xuất để thảo luận**, chỉ trở thành đặc tả luận văn sau khi sinh viên xác nhận. Không thay đổi schema hay code.

## Đính chính phạm vi kết luận

**50 không phải số thực thể ERD đã chốt.** Đó là kết quả của một cách phân loại 60 bảng ứng dụng thành 50 đối tượng có dữ liệu riêng, 6 bảng quan hệ và 4 bảng hỗ trợ. Kiểm kê này bảo đảm không bỏ sót bảng khi chuyển sang lược đồ luận lý/vật lý, nhưng **không chứng minh mọi đối tượng trong nhóm 50 đều phải là hộp ở mức ý niệm**, cũng không chứng minh 31 hộp cũ đều phải giữ. Việc chọn hộp của Hình 3-1 cần nhất quán theo phạm vi Chương 1–2 và định nghĩa mức ý niệm, rồi giải thích rõ đối tượng nào được thể hiện ở mức luận lý/vật lý.

Hình 31 hộp hiện tại có các cặp quan hệ đã vẽ dựa trên FK hoặc bảng nối, nhưng cách chọn quan hệ chưa nhất quán: `admin_user` nối riêng với `page_content` qua liên hệ logic trong khi nhiều bảng khác có cột người thao tác tương tự; `file_metadata` chỉ được nối với vài bảng có FK tệp; nhập Excel có bản tạm nhưng thiếu dữ liệu nguồn và xung đột. **Không sửa hình bằng cách thêm lần lượt 19 hộp**; trước hết phải chọn mức mô hình và quy tắc thể hiện đường nối. Đường logic cần có chú giải riêng, không đặt lẫn với đường FK vật lý như thể chúng có cùng ràng buộc.

## 1. Tiêu chí chọn thực thể

Mục 3.1.1.1 cần mô tả các đối tượng dữ liệu tồn tại bền vững mà người dùng hoặc hệ thống đọc, quản lý hay dùng trong các quy trình ở Chương 1–2. Một thực thể có thể phụ thuộc thực thể khác nhưng vẫn cần mô tả nếu nó có định danh, thuộc tính và ý nghĩa riêng (dòng báo giá, biến thể tạm, ghi chú nội bộ, thông số). **Bảng không tự động đồng nghĩa với thực thể**: bảng nối thuần quan hệ được biểu diễn bằng liên kết; bảng phiên đăng nhập, chỉ mục sử dụng tệp và bảng đếm ngày được giải thích ở mức triển khai. Hai bảng Knex thuộc công cụ migration.

Theo tiêu chí kiểm kê này, **60 bảng ứng dụng** được tạm chia thành **50 đối tượng dữ liệu có ý nghĩa riêng, 6 bảng hiện thực hóa quan hệ và 4 bảng hỗ trợ triển khai**; thêm 2 bảng Knex thành 62 bảng vật lý. Đây là danh sách **ứng viên để xét ở ERD ý niệm**, không phải chỉ dẫn vẽ đúng 50 hộp. Mọi bảng vẫn phải có vị trí trong lược đồ quan hệ hoặc phần mô tả mức vật lý.

| Miền | Số | Đối tượng ứng viên cần xét ở mức ý niệm |
| --- | ---: | --- |
| Quản trị và truy vết | 4 | `admin_user`, `admin_role`, `admin_permission`, `audit_log` |
| Tệp | 1 | `file_metadata` |
| Danh mục và sản phẩm | 13 | `product_category`, `brand`, `product_group`, `product_variant`, `tag`, `product_image`, `technical_document`, `spec_group`, `product_spec`, `variant_spec_group`, `variant_spec`, `variant_attribute`, `product_highlight_spec` |
| Nội dung website | 17 | `brand_page`, `brand_page_source`, `brand_page_stat`, `service`, `project`, `project_gallery`, `page_content`, `news_category`, `banner`, `menu`, `menu_item`, `home_section`, `company_info`, `company_social_link`, `partner`, `certificate`, `redirect_rule` |
| Khách và yêu cầu | 6 | `customer_profile`, `contact_request`, `quote_request`, `quote_item`, `contact_internal_note`, `quote_internal_note` |
| Nhập bảng tính | 9 | `import_batch`, `raw_data`, `pending_product_group`, `pending_variant`, `data_conflict`, `conflict_resolution`, `import_mapping`, `import_mapping_profile`, `import_error_log` |

### So với 31 thực thể cũ

Cả **31/31 nhãn** trong hình cũ đều là tên bảng có thật, nhưng điều đó **không tự quyết định** phải giữ cả 31 ở ERD ý niệm. Có thêm **19 đối tượng cần cân nhắc** khi kiểm tra độ bao phủ toàn hệ thống; chúng không mặc nhiên là 19 hộp phải thêm vào hình:

| Miền | Loại bổ sung | Lý do |
| --- | --- | --- |
| Quản trị | `audit_log` | Nhật ký thao tác có màn/API đọc riêng; cần phân biệt liên hệ logic với FK. |
| Sản phẩm | `variant_spec_group`, `variant_spec`, `product_highlight_spec` | Thông số riêng biến thể và thông số nổi bật được API/website dùng; không gộp với thông số chung hoặc thuộc tính biến thể. |
| Trang thương hiệu, dự án | `brand_page_source`, `brand_page_stat`, `project_gallery` | Nguồn, số liệu trang thương hiệu và thư viện ảnh dự án là bản ghi lặp có thuộc tính riêng. |
| Nội dung website | `partner`, `certificate`, `home_section`, `redirect_rule` | Có dữ liệu/chức năng đọc hoặc quản trị hiện hành; `home_section` không có FK tới những khối nội dung được cấu hình bằng JSON. |
| Khách hàng | `contact_internal_note`, `quote_internal_note` | Chương 2 có bước ghi chú nội bộ khi xử lý yêu cầu; ghi chú là bản ghi phụ thuộc. |
| Nhập bảng tính | `raw_data`, `data_conflict`, `conflict_resolution`, `import_mapping`, `import_mapping_profile`, `import_error_log` | Chương 2 yêu cầu tách dữ liệu nguồn, rà soát/xung đột và áp dụng; nhóm tạm không mô tả đủ toàn bộ quy trình. |

Nếu GVHD muốn ERD ý niệm gọn hơn, có thể chuyển một số đối tượng vận hành như `redirect_rule` hoặc `import_mapping_profile` sang phần lược đồ luận lý. Khi đó phải ghi tiêu chí rút gọn và vẫn liệt kê chúng ở lược đồ quan hệ; không tuyên bố con số ít hơn là toàn bộ bảng CSDL.

**Sáu bảng hiện thực hóa quan hệ, không cộng vào 50 ứng viên:** `admin_user_role` (phân vai 1:N do unique ở phía user), `admin_role_permission`, `product_group_tag`, `service_product_group`, `project_product_group`, `brand_page_featured_product_group` (năm bảng sau là nhiều–nhiều). `brand_page_featured_product_group` còn giữ thứ tự hiển thị, cần mô tả thuộc tính `sort_order` của quan hệ khi chuyển mức.

**Bốn bảng chỉ trình bày ở mức vật lý/triển khai:** `admin_refresh_session` (phiên làm mới xác thực), `file_usage` (theo dõi tệp dùng ở nhiều loại đối tượng), `product_group_daily_view` và `site_daily_view` (số liệu tổng hợp theo ngày). Chúng vẫn phải có trong kiểm kê lược đồ đầy đủ; không gọi chúng là dữ liệu không dùng. `knex_migrations` và `knex_migrations_lock` là hai bảng metadata của Knex, trình bày riêng.

## 2. Miền quản trị — cách vẽ chính xác

| Cặp | Lực lượng trên mô hình ý niệm | Căn cứ và lưu ý |
| --- | --- | --- |
| `admin_role` – `admin_user` | Một vai trò có 0..n tài khoản; một tài khoản có 0..1 vai trò **theo khả năng DB**. | `admin_user_role` có hai FK và `UNIQUE(admin_user_id)`. API tạo/cập nhật yêu cầu đúng một vai trò; DB vẫn cho phép user chưa có dòng phân vai. Không gọi là M:N. |
| `admin_role` – `admin_permission` | 0..n ở cả hai phía. | `admin_role_permission` có khóa ghép hai FK. Quyền hiệu lực của `super_admin` được code tính đặc biệt; không kết luận mọi quyền hiệu lực của vai trò này chỉ đến từ các dòng trong bảng nối. |
| `admin_user` – `audit_log` | Chỉ là liên hệ logic, không phải FK vật lý. | `audit_log.actor_id` là `text`, code đọc nối với `admin_user.id::text`; `entity_type`/`entity_id` là tham chiếu đa hình. Có thể vẽ đường nét đứt có chú giải hoặc để `audit_log` độc lập trên ERD và giải thích trong lời văn. |

Các `created_by`, `updated_by`, `approved_by`, `assigned_to`, `uploaded_by` ở nhiều bảng là mã người thao tác/được giao theo code, thường dùng `admin_user.logic_user_id` dạng số nguyên; **không có FK vật lý thống nhất**. Không kéo hàng chục đường FK giả từ `admin_user` đến mọi hộp. `audit_log.actor_id` là trường hợp khác, không được đồng nhất với `logic_user_id`.

## 3. Những quan hệ cần có hoặc phải giải thích rõ

Ký hiệu `1` ở phía bản ghi con nghĩa là FK `NOT NULL`; `0..1` nghĩa là FK nullable. Ở phía cha, thông thường là `0..n`, trừ ràng buộc unique được ghi riêng. Cột và hành động xóa được kiểm ở `tasks/erdRelations.md`.

### Sản phẩm

| Quan hệ | Lực lượng của một bản ghi con | Ghi chú |
| --- | --- | --- |
| `product_category` cha – con | Con `0..1` cha; cha `0..n` con. | `parent_id` tự tham chiếu nullable. |
| `product_group` – `product_category` | Nhóm `1` danh mục. | `category_id` bắt buộc. |
| `product_group` – `brand` | Nhóm `0..1` thương hiệu. | `brand_id` nullable. `brand.primary_category_id` còn tạo quan hệ tùy chọn từ thương hiệu đến danh mục chính. |
| `product_variant` – `product_group` | Biến thể `1` nhóm. | Một nhóm có thể chưa có biến thể. |
| `spec_group` – `product_group`; `product_spec` – `spec_group` | Mỗi nhóm thông số `1` nhóm sản phẩm; mỗi thông số `1` nhóm thông số. | Cấu trúc thông số dùng chung của nhóm. |
| `variant_spec_group` – `product_variant`; `variant_spec` – `variant_spec_group` | Mỗi nhóm thông số biến thể `1` biến thể; mỗi thông số `1` nhóm thông số biến thể. | Khác `variant_attribute`; cả hai đang được code/API dùng. |
| `variant_attribute` – `product_variant` | Thuộc tính `1` biến thể. | Không gộp với `variant_spec` nếu viết theo DB hiện tại. |
| `product_image` – `product_group`/`product_variant`/`file_metadata` | Ảnh `1` nhóm, `0..1` biến thể, `1` tệp. | FK đơn lẻ không tự chứng minh biến thể thuộc đúng nhóm; code phải kiểm. |
| `technical_document` – `product_group`/`product_variant`/`file_metadata` | Tài liệu `1` nhóm, `0..1` biến thể, `1` tệp. | `file_id` bắt buộc. |
| `product_highlight_spec` – `product_group`/`product_variant` | Thông số nổi bật `1` nhóm, `0..1` biến thể. | `source_type`/`source_id` chọn nguồn đa hình, `source_id` không có FK cố định. |
| `product_group` – `tag` | M:N qua `product_group_tag`. | Không vẽ bảng nối thành loại thực thể nếu dùng hình thoi quan hệ. |

### Nội dung website

| Quan hệ | Lực lượng của một bản ghi con | Ghi chú |
| --- | --- | --- |
| `brand_page` – `brand` | Trang `1` thương hiệu. | Mỗi thương hiệu có tối đa một trang `deleted_at IS NULL`; bản lưu trữ lịch sử không bị giới hạn bởi unique này. |
| `brand_page` – `banner` | Trang `0..1` banner đại diện. | `hero_banner_id` nullable. |
| `brand_page` – `product_group` | M:N qua `brand_page_featured_product_group`. | Sản phẩm nổi bật của trang thương hiệu. |
| `brand_page_source`/`brand_page_stat` – `brand_page` | Mỗi nguồn/thống kê `1` trang. | `source_type='certificate'` không phải FK đến `certificate`. |
| `service`/`project` – `product_group` | Hai quan hệ M:N riêng qua `service_product_group`/`project_product_group`. | Không gộp dịch vụ và dự án. |
| `project_gallery` – `project`/`file_metadata` | Ảnh thư viện `1` dự án, `1` tệp. | Khác ảnh đại diện của dự án. |
| `page_content` – `news_category` | Nội dung `0..1` chuyên mục. | Tin tức là loại `page_content`, không có bảng `news_article`. |
| `menu_item` – `menu`; `menu_item` cha – con | Mục menu `1` menu và `0..1` mục cha. | Hai FK độc lập; cần vẽ quan hệ tự tham chiếu. |
| `company_social_link` – `company_info` | Liên kết xã hội `1` hồ sơ công ty. | `company_info` có unique một phần cho bản chưa lưu trữ. |

`home_section` và `redirect_rule` có dữ liệu riêng nhưng không có FK đến các bảng nội dung; `home_section.config` chứa JSON cấu hình. `partner` và `certificate` được website công khai sử dụng, song các liên kết chính đến tệp là FK ảnh/tài liệu. **Không bịa quan hệ chỉ vì hai đối tượng cùng xuất hiện trên trang.** Các FK tệp khác (logo, ảnh SEO, banner, chứng nhận...) được liệt kê chính xác ở mức luận lý/vật lý để hình ý niệm không thành mạng đường chéo.

### Khách và yêu cầu

| Quan hệ | Lực lượng của một bản ghi con | Ghi chú |
| --- | --- | --- |
| `contact_request`/`quote_request` – `customer_profile` | Mỗi yêu cầu `0..1` hồ sơ khách. | Yêu cầu vẫn lưu tên/số điện thoại khi không liên kết hồ sơ; `customer_profile` không phải tài khoản đăng nhập. |
| `quote_item` – `quote_request`/`product_group`/`product_variant` | Mỗi dòng `1` yêu cầu, `1` nhóm sản phẩm và `0..1` biến thể. | Một yêu cầu có thể có **0** dòng sản phẩm; không phải đơn hàng. |
| `contact_internal_note` – `contact_request`; `quote_internal_note` – `quote_request` | Mỗi ghi chú `1` yêu cầu tương ứng. | Một yêu cầu có 0..n ghi chú. |

`assigned_to` trên hai loại yêu cầu là số nguyên liên hệ logic đến người quản trị, không phải FK vật lý. Phạm vi Chương 1 loại trừ kho, đơn bán, thanh toán, hóa đơn, vận chuyển; không thêm các loại thực thể đó.

### Nhập Excel/CSV

| Quan hệ | Lực lượng của một bản ghi con | Ghi chú |
| --- | --- | --- |
| `import_batch` – `file_metadata` | Lô nhập `1` tệp nguồn. | `source_file_id` bắt buộc. |
| `raw_data`, `pending_product_group`, `pending_variant`, `data_conflict`, `import_mapping`, `import_error_log` – `import_batch` | Mỗi bản ghi con `1` lô. | Tách dữ liệu nguồn, bản tạm, xung đột, quyết định áp dụng và lỗi. |
| `pending_variant` – `pending_product_group` | Biến thể tạm `1` nhóm tạm. | Không đồng nhất bản tạm với dữ liệu sản phẩm chính thức. |
| `pending_product_group` – `product_group`; `pending_variant` – `product_variant` | Bản tạm `0..1` bản chính thức sau ánh xạ. | `mapped_official_id` là FK nullable ở cả hai bảng. |
| `pending_product_group`/`pending_variant` – `data_conflict` | Bản tạm `0..1` xung đột được gắn. | `conflict_id` nullable. Bản thân `data_conflict.entity_id` là tham chiếu đa hình. |
| `conflict_resolution` – `data_conflict` | Mỗi quyết định `1` xung đột; một xung đột có 0..n quyết định theo DB. | Không ghi 1:1 nếu thiếu unique. |
| `import_error_log` – `raw_data` | Dòng lỗi `0..1` dữ liệu nguồn. | `raw_data_id` nullable. |

`import_mapping.official_id` là `text` và không có FK cố định; `import_mapping_profile` là cấu hình ánh xạ cột tái sử dụng, không có FK tới `import_batch`. Không vẽ hai đường FK giả này.

## 4. Quy tắc trạng thái và phạm vi khi viết lời dẫn Hình 3-1

- `review_status` (duyệt nội bộ), `publish_status` (công bố) và `status` (hoạt động) là những chiều khác nhau. Duyệt xong không đồng nghĩa hiển thị công khai; nhóm công khai không tự công bố mọi biến thể.
- `deleted_at` là dấu lưu trữ/xóa mềm ở các bảng có cột này. Không mô tả hard-delete dữ liệu nghiệp vụ là mặc định.
- Ghi lực lượng quan hệ dựa trên FK/NULL/UNIQUE hiện tại, rồi ghi riêng quy tắc mà API áp dụng chặt hơn. Đặc biệt: user–role, brand–brand_page, company_info.
- Đoạn dẫn của 3.1.1.1 phải nói rõ hình ở mức **ý niệm** và tiêu chí chọn thực thể/quan hệ; sáu bảng hiện thực hóa quan hệ phải xuất hiện ở mức luận lý, còn bốn bảng hỗ trợ và hai bảng Knex nằm trong kiểm kê vật lý. Không gọi 50 là tổng số bảng DB hoặc số hộp ERD bắt buộc.
- Mẫu trường quy định trang A4. Một hình chứa 50 hộp và đủ quan hệ sẽ quá nhỏ để đọc; bản 31 hộp cũ đã có dấu hiệu này. Khi em vẽ lại, ưu tiên tính đúng của mô hình và khả năng đọc. Nếu vẫn chọn một hình như quyết định trước đây trong chat LVTN, phải thử in A4 trước khi nộp; đừng giảm chữ đến mức không đọc được chỉ để giữ một hình.

## 5. Trạng thái xác minh

- Tên bảng, cột nullable, PK và 85 FK: catalog PostgreSQL local đã đối chiếu với `database/ddl/schema.sql` và 51/51 migration; danh mục tại `tasks/erdRelations.md`.
- `admin_user_role` unique một vai trò tối đa: `database/ddl/schema.sql` có `uq_admin_user_role_single_role`; API `admin-user.service.ts` yêu cầu đúng một vai trò khi tạo/cập nhật.
- `brand_page` unique có điều kiện: `uq_brand_page_brand_active` chỉ áp dụng `deleted_at IS NULL`.
- Thông số nhóm/biến thể, đối tác/chứng nhận và nguồn trang thương hiệu có truy vấn API và sử dụng ở frontend hiện tại; không loại chỉ vì bảng local rỗng.
- Cần kiểm lại đúng phiên bản schema/runtime trước khi nộp; các thay đổi sau ngày chụp hiện trạng sẽ làm tài liệu này cần cập nhật.
