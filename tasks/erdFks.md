# Ma trận khóa ngoại cho mô hình dữ liệu Song Thanh

Nguồn: catalog PostgreSQL local ngày 04/11/2026; đối chiếu `database/ddl/schema.sql`.
Bảng này là căn cứ kiểm tra 3.1.1.1 và lược đồ quan hệ, không có nghĩa mọi khóa ngoại đều phải được vẽ thành đường trong ERD ý niệm.
Mỗi hàng đọc từ phía bản ghi con: `1` nghĩa là cột FK `NOT NULL`; `0..1` nghĩa là FK nullable. Phía cha thường có `0..n` bản ghi con, trừ unique được nêu ở dưới.

| # | Bảng con | FK | Bảng cha | Cha trên mỗi con | ON DELETE |
| ---: | --- | --- | --- | --- | --- |
| 1 | `admin_refresh_session` | `admin_user_id` | `admin_user.id` | 1 | CASCADE |
| 2 | `admin_role_permission` | `admin_permission_id` | `admin_permission.id` | 1 | CASCADE |
| 3 | `admin_role_permission` | `admin_role_id` | `admin_role.id` | 1 | CASCADE |
| 4 | `admin_user_role` | `admin_role_id` | `admin_role.id` | 1 | CASCADE |
| 5 | `admin_user_role` | `admin_user_id` | `admin_user.id` | 1 | CASCADE |
| 6 | `banner` | `image_file_id` | `file_metadata.id` | 1 | RESTRICT |
| 7 | `banner` | `image_mobile_file_id` | `file_metadata.id` | 0..1 | SET NULL |
| 8 | `brand` | `logo_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 9 | `brand` | `primary_category_id` | `product_category.id` | 0..1 | RESTRICT |
| 10 | `brand_page` | `brand_id` | `brand.id` | 1 | RESTRICT |
| 11 | `brand_page` | `hero_banner_id` | `banner.id` | 0..1 | SET NULL |
| 12 | `brand_page` | `seo_og_image_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 13 | `brand_page` | `support_image_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 14 | `brand_page_featured_product_group` | `product_group_id` | `product_group.id` | 1 | RESTRICT |
| 15 | `brand_page_featured_product_group` | `brand_page_id` | `brand_page.id` | 1 | CASCADE |
| 16 | `brand_page_source` | `file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 17 | `brand_page_source` | `brand_page_id` | `brand_page.id` | 1 | CASCADE |
| 18 | `brand_page_stat` | `brand_page_id` | `brand_page.id` | 1 | CASCADE |
| 19 | `brand_page_stat` | `source_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 20 | `certificate` | `file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 21 | `certificate` | `image_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 22 | `company_info` | `favicon_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 23 | `company_info` | `logo_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 24 | `company_social_link` | `company_info_id` | `company_info.id` | 1 | RESTRICT |
| 25 | `conflict_resolution` | `conflict_id` | `data_conflict.id` | 1 | CASCADE |
| 26 | `contact_internal_note` | `contact_id` | `contact_request.id` | 1 | CASCADE |
| 27 | `contact_request` | `customer_id` | `customer_profile.id` | 0..1 | SET NULL |
| 28 | `data_conflict` | `import_batch_id` | `import_batch.id` | 1 | CASCADE |
| 29 | `file_usage` | `file_id` | `file_metadata.id` | 1 | RESTRICT |
| 30 | `import_batch` | `source_file_id` | `file_metadata.id` | 1 | RESTRICT |
| 31 | `import_error_log` | `import_batch_id` | `import_batch.id` | 1 | CASCADE |
| 32 | `import_error_log` | `raw_data_id` | `raw_data.id` | 0..1 | SET NULL |
| 33 | `import_mapping` | `import_batch_id` | `import_batch.id` | 1 | CASCADE |
| 34 | `menu_item` | `menu_id` | `menu.id` | 1 | RESTRICT |
| 35 | `menu_item` | `parent_id` | `menu_item.id` | 0..1 | RESTRICT |
| 36 | `page_content` | `featured_image_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 37 | `page_content` | `seo_og_image_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 38 | `page_content` | `news_category_id` | `news_category.id` | 0..1 | SET NULL |
| 39 | `partner` | `logo_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 40 | `pending_product_group` | `import_batch_id` | `import_batch.id` | 1 | CASCADE |
| 41 | `pending_product_group` | `conflict_id` | `data_conflict.id` | 0..1 | SET NULL |
| 42 | `pending_product_group` | `mapped_official_id` | `product_group.id` | 0..1 | RESTRICT |
| 43 | `pending_variant` | `import_batch_id` | `import_batch.id` | 1 | CASCADE |
| 44 | `pending_variant` | `conflict_id` | `data_conflict.id` | 0..1 | SET NULL |
| 45 | `pending_variant` | `pending_product_group_id` | `pending_product_group.id` | 1 | CASCADE |
| 46 | `pending_variant` | `mapped_official_id` | `product_variant.id` | 0..1 | RESTRICT |
| 47 | `product_category` | `icon_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 48 | `product_category` | `parent_id` | `product_category.id` | 0..1 | RESTRICT |
| 49 | `product_group` | `brand_id` | `brand.id` | 0..1 | RESTRICT |
| 50 | `product_group` | `category_id` | `product_category.id` | 1 | RESTRICT |
| 51 | `product_group` | `seo_og_image_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 52 | `product_group` | `thumbnail_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 53 | `product_group_daily_view` | `product_group_id` | `product_group.id` | 1 | CASCADE |
| 54 | `product_group_tag` | `product_group_id` | `product_group.id` | 1 | CASCADE |
| 55 | `product_group_tag` | `tag_id` | `tag.id` | 1 | CASCADE |
| 56 | `product_highlight_spec` | `product_group_id` | `product_group.id` | 1 | CASCADE |
| 57 | `product_highlight_spec` | `product_variant_id` | `product_variant.id` | 0..1 | CASCADE |
| 58 | `product_image` | `file_id` | `file_metadata.id` | 1 | RESTRICT |
| 59 | `product_image` | `product_group_id` | `product_group.id` | 1 | CASCADE |
| 60 | `product_image` | `product_variant_id` | `product_variant.id` | 0..1 | RESTRICT |
| 61 | `product_spec` | `spec_group_id` | `spec_group.id` | 1 | CASCADE |
| 62 | `product_variant` | `product_group_id` | `product_group.id` | 1 | RESTRICT |
| 63 | `project` | `image_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 64 | `project` | `seo_og_image_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 65 | `project_gallery` | `file_id` | `file_metadata.id` | 1 | RESTRICT |
| 66 | `project_gallery` | `project_id` | `project.id` | 1 | CASCADE |
| 67 | `project_product_group` | `product_group_id` | `product_group.id` | 1 | CASCADE |
| 68 | `project_product_group` | `project_id` | `project.id` | 1 | CASCADE |
| 69 | `quote_internal_note` | `quote_id` | `quote_request.id` | 1 | CASCADE |
| 70 | `quote_item` | `product_group_id` | `product_group.id` | 1 | RESTRICT |
| 71 | `quote_item` | `quote_request_id` | `quote_request.id` | 1 | CASCADE |
| 72 | `quote_item` | `product_variant_id` | `product_variant.id` | 0..1 | RESTRICT |
| 73 | `quote_request` | `customer_id` | `customer_profile.id` | 0..1 | SET NULL |
| 74 | `raw_data` | `import_batch_id` | `import_batch.id` | 1 | CASCADE |
| 75 | `service` | `image_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 76 | `service` | `seo_og_image_file_id` | `file_metadata.id` | 0..1 | RESTRICT |
| 77 | `service_product_group` | `product_group_id` | `product_group.id` | 1 | CASCADE |
| 78 | `service_product_group` | `service_id` | `service.id` | 1 | CASCADE |
| 79 | `spec_group` | `product_group_id` | `product_group.id` | 1 | CASCADE |
| 80 | `technical_document` | `file_id` | `file_metadata.id` | 1 | RESTRICT |
| 81 | `technical_document` | `product_group_id` | `product_group.id` | 1 | CASCADE |
| 82 | `technical_document` | `product_variant_id` | `product_variant.id` | 0..1 | RESTRICT |
| 83 | `variant_attribute` | `product_variant_id` | `product_variant.id` | 1 | CASCADE |
| 84 | `variant_spec` | `variant_spec_group_id` | `variant_spec_group.id` | 1 | CASCADE |
| 85 | `variant_spec_group` | `product_variant_id` | `product_variant.id` | 1 | CASCADE |

## Ràng buộc vượt quy tắc FK đơn lẻ

- `admin_user_role.admin_user_id` có `UNIQUE`: mỗi tài khoản có tối đa một dòng phân vai trong DB; API yêu cầu đúng một vai trò khi tạo/cập nhật.
- `brand_page.brand_id` có unique một phần `WHERE deleted_at IS NULL`: mỗi thương hiệu tối đa một trang chưa lưu trữ.
- `company_info` có unique một phần trên hằng số `1` khi `deleted_at IS NULL`: tối đa một hồ sơ công ty chưa lưu trữ.
- Các bảng nối `admin_role_permission`, `product_group_tag`, `service_product_group`, `project_product_group`, `brand_page_featured_product_group` hiện thực hóa quan hệ nhiều–nhiều. `admin_user_role` là ngoại lệ 1:N do unique ở phía user.
- `audit_log.actor_id`, các cột số nguyên `created_by`/`updated_by`/`approved_by`/`assigned_to`/`uploaded_by`, `file_usage.entity_id`, `import_mapping.official_id`, `product_highlight_spec.source_id` và `data_conflict.entity_id` không có FK vật lý cố định đến đối tượng được biểu thị. Không thêm chúng vào 85 FK.
