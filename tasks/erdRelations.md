# Lược đồ quan hệ hiện tại — bản trích xuất để đối chiếu ERD

**Ngày đối chiếu:** 04/11/2026. **Nguồn:** catalog PostgreSQL local kết nối qua `api/.env`; kiểm lại với `api/migrations/` và `database/ddl/schema.sql`. Đây là bản chụp kỹ thuật, cần người làm luận văn xác nhận phạm vi trước khi dùng làm đặc tả nghiệp vụ.

Có **60 bảng ứng dụng**, **2 bảng metadata Knex**, **715 cột** và **87 khóa ngoại**. Danh sách cột dưới đây giữ đúng thứ tự trong DB. `?` sau tên cột nghĩa là cột cho phép `NULL`; không có `?` nghĩa là `NOT NULL`. FK ghi nguyên quy tắc `ON DELETE` từ PostgreSQL. Các ràng buộc `UNIQUE`/`CHECK` và kiểu dữ liệu cần xem thêm trong `database/ddl/schema.sql` hoặc catalog DB.

## 60 bảng ứng dụng

### `admin_permission`

Cột: `id`, `code`, `description?`, `created_at`.

PK: `PRIMARY KEY (id)`.

### `admin_refresh_session`

Cột: `id`, `admin_user_id`, `token_hash`, `expires_at`, `revoked_at?`, `created_at`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (admin_user_id) REFERENCES admin_user(id) ON DELETE CASCADE`.

### `admin_role`

Cột: `id`, `code`, `name`, `description?`, `status`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

### `admin_role_permission`

Cột: `admin_role_id`, `admin_permission_id`, `created_at`.

PK: `PRIMARY KEY (admin_role_id, admin_permission_id)`.

FK:

- `FOREIGN KEY (admin_permission_id) REFERENCES admin_permission(id) ON DELETE CASCADE`.
- `FOREIGN KEY (admin_role_id) REFERENCES admin_role(id) ON DELETE CASCADE`.

### `admin_user`

Cột: `id`, `email`, `password_hash`, `display_name`, `status`, `last_login_at?`, `created_at`, `updated_at`, `deleted_at?`, `logic_user_id`.

PK: `PRIMARY KEY (id)`.

### `admin_user_role`

Cột: `admin_user_id`, `admin_role_id`, `created_at`.

PK: `PRIMARY KEY (admin_user_id, admin_role_id)`.

FK:

- `FOREIGN KEY (admin_role_id) REFERENCES admin_role(id) ON DELETE CASCADE`.
- `FOREIGN KEY (admin_user_id) REFERENCES admin_user(id) ON DELETE CASCADE`.

### `audit_log`

Cột: `id`, `entity_type`, `entity_id`, `actor_id?`, `action`, `old_value?`, `new_value?`, `changed_fields?`, `ip_address?`, `user_agent?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

### `banner`

Cột: `id`, `position`, `title`, `image_file_id`, `link_type`, `link_target?`, `sort_order`, `status`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`, `description?`, `content_position`, `image_mobile_file_id?`, `cta_buttons?`, `notes?`, `title_size`, `title_color`, `description_color`, `display_mode`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (image_mobile_file_id) REFERENCES file_metadata(id) ON DELETE SET NULL`.

### `brand`

Cột: `id`, `name`, `slug`, `logo_file_id?`, `description?`, `website_url?`, `sort_order`, `status`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`, `primary_category_id?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (logo_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (primary_category_id) REFERENCES product_category(id) ON DELETE RESTRICT`.

### `brand_page`

Cột: `id`, `brand_id`, `title`, `excerpt?`, `overview_title?`, `overview_body?`, `support_title?`, `support_intro?`, `support_items?`, `support_image_file_id?`, `hero_banner_id?`, `cta_title?`, `cta_description?`, `cta_button_label?`, `cta_button_url?`, `review_status`, `publish_status`, `seo_title?`, `seo_description?`, `seo_og_image_file_id?`, `created_by?`, `updated_by?`, `approved_by?`, `created_at`, `updated_at`, `deleted_at?`, `hero_title_size`, `hero_excerpt_size`, `hero_eyebrow_color?`, `hero_title_color?`, `hero_excerpt_color?`, `accent_color?`, `layout_archetype`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (hero_banner_id) REFERENCES banner(id) ON DELETE SET NULL`.
- `FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (support_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.

### `brand_page_featured_product_group`

Cột: `id`, `brand_page_id`, `product_group_id`, `sort_order`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (brand_page_id) REFERENCES brand_page(id) ON DELETE CASCADE`.

### `brand_page_source`

Cột: `id`, `brand_page_id`, `title`, `source_type`, `url?`, `file_id?`, `description?`, `sort_order`, `status`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (brand_page_id) REFERENCES brand_page(id) ON DELETE CASCADE`.

### `brand_page_stat`

Cột: `id`, `brand_page_id`, `value`, `label`, `note?`, `source_url?`, `source_file_id?`, `is_verified`, `sort_order`, `status`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (brand_page_id) REFERENCES brand_page(id) ON DELETE CASCADE`.
- `FOREIGN KEY (source_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.

### `certificate`

Cột: `id`, `title`, `file_id?`, `image_file_id?`, `issued_date?`, `expires_date?`, `status`, `sort_order`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.

### `company_info`

Cột: `id`, `display_name`, `legal_name`, `hotline`, `email`, `address`, `map_embed_code?`, `working_hours_from?`, `working_hours_to?`, `logo_file_id?`, `favicon_file_id?`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`, `hotlines?`, `working_days?`, `home_seo_title?`, `home_seo_description?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (favicon_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (logo_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.

### `company_social_link`

Cột: `id`, `company_info_id`, `platform`, `label`, `url`, `sort_order`, `status`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (company_info_id) REFERENCES company_info(id) ON DELETE RESTRICT`.

### `conflict_resolution`

Cột: `id`, `conflict_id`, `decision`, `note?`, `resolved_by?`, `resolved_at?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (conflict_id) REFERENCES data_conflict(id) ON DELETE CASCADE`.

### `contact_internal_note`

Cột: `id`, `contact_id`, `note_text`, `added_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (contact_id) REFERENCES contact_request(id) ON DELETE CASCADE`.

### `contact_request`

Cột: `id`, `full_name`, `phone`, `email?`, `company_name?`, `message`, `source_page?`, `status`, `assigned_to?`, `created_at`, `updated_at`, `deleted_at?`, `ip_address?`, `user_agent?`, `customer_id?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (customer_id) REFERENCES customer_profile(id) ON DELETE SET NULL`.

### `customer_profile`

Cột: `id`, `full_name`, `phone?`, `email?`, `company_name?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

### `data_conflict`

Cột: `id`, `import_batch_id`, `entity_type`, `entity_id?`, `conflict_type`, `existing_data?`, `incoming_data?`, `status`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE`.

### `file_metadata`

Cột: `id`, `original_filename`, `stored_path`, `file_size`, `mime_type`, `storage_location`, `uploaded_by?`, `is_orphan`, `created_at`, `updated_at`, `deleted_at?`, `purpose`.

PK: `PRIMARY KEY (id)`.

### `file_usage`

Cột: `id`, `file_id`, `entity_type`, `entity_id`, `field_name`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.

### `home_section`

Cột: `id`, `section_type`, `enabled`, `sort_order`, `title_override?`, `subtitle?`, `config`, `created_by?`, `updated_by?`, `created_at`, `updated_at`.

PK: `PRIMARY KEY (id)`.

### `import_batch`

Cột: `id`, `batch_name?`, `source_file_name`, `source_file_id`, `uploaded_by?`, `status`, `total_rows`, `error_count`, `conflict_count`, `notes?`, `created_at`, `updated_at`, `validated_at?`, `applied_at?`, `cancelled_at?`, `deleted_at?`, `selected_row_ranges?`, `column_mapping?`, `source_sheet_name?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (source_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.

### `import_error_log`

Cột: `id`, `import_batch_id`, `raw_data_id?`, `error_code`, `error_message`, `severity`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE`.
- `FOREIGN KEY (raw_data_id) REFERENCES raw_data(id) ON DELETE SET NULL`.

### `import_mapping`

Cột: `id`, `import_batch_id`, `external_code`, `entity_type`, `official_id`, `decision`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE`.

### `import_mapping_profile`

Cột: `id`, `profile_name`, `header_signature`, `normalized_headers`, `mapping_config`, `usage_count`, `last_used_at?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

### `menu`

Cột: `id`, `name`, `position`, `status`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

### `menu_item`

Cột: `id`, `menu_id`, `parent_id?`, `title`, `link_type`, `link_target?`, `sort_order`, `status`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`, `open_in_new_tab`, `icon_name?`, `description?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (menu_id) REFERENCES menu(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (parent_id) REFERENCES menu_item(id) ON DELETE RESTRICT`.

### `news_category`

Cột: `id`, `name`, `slug`, `sort_order`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

### `page_content`

Cột: `id`, `title`, `slug`, `excerpt?`, `content_html?`, `featured_image_file_id?`, `review_status`, `publish_status`, `seo_title?`, `seo_description?`, `seo_og_image_file_id?`, `created_by?`, `updated_by?`, `approved_by?`, `created_at`, `updated_at`, `deleted_at?`, `content_type`, `news_category_id?`, `published_at?`, `is_featured`, `extra_blocks`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (featured_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (news_category_id) REFERENCES news_category(id) ON DELETE SET NULL`.

### `partner`

Cột: `id`, `name`, `logo_file_id?`, `website_url?`, `status`, `sort_order`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (logo_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.

### `pending_product_group`

Cột: `id`, `import_batch_id`, `external_code?`, `product_name`, `category_name?`, `brand_name?`, `short_description?`, `status`, `conflict_id?`, `mapped_official_id?`, `review_note?`, `created_at`, `updated_at`, `reviewed_at?`, `applied_at?`, `deleted_at?`, `main_category_name?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE`.
- `FOREIGN KEY (conflict_id) REFERENCES data_conflict(id) ON DELETE SET NULL`.
- `FOREIGN KEY (mapped_official_id) REFERENCES product_group(id) ON DELETE RESTRICT`.

### `pending_variant`

Cột: `id`, `import_batch_id`, `pending_product_group_id`, `external_code?`, `sku?`, `model_code?`, `variant_name`, `status`, `conflict_id?`, `mapped_official_id?`, `created_at`, `updated_at`, `applied_at?`, `deleted_at?`, `public_price_mode`, `public_price_amount?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE`.
- `FOREIGN KEY (conflict_id) REFERENCES data_conflict(id) ON DELETE SET NULL`.
- `FOREIGN KEY (pending_product_group_id) REFERENCES pending_product_group(id) ON DELETE CASCADE`.
- `FOREIGN KEY (mapped_official_id) REFERENCES product_variant(id) ON DELETE RESTRICT`.

### `product_category`

Cột: `id`, `name`, `slug`, `parent_id?`, `description?`, `icon_file_id?`, `sort_order`, `status`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (icon_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (parent_id) REFERENCES product_category(id) ON DELETE RESTRICT`.

### `product_group`

Cột: `id`, `name`, `slug`, `category_id`, `brand_id?`, `short_description?`, `detailed_description?`, `thumbnail_file_id?`, `review_status`, `publish_status`, `seo_title?`, `seo_description?`, `seo_og_image_file_id?`, `status`, `sort_order`, `created_by?`, `updated_by?`, `approved_by?`, `created_at`, `updated_at`, `deleted_at?`, `view_count`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (category_id) REFERENCES product_category(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (thumbnail_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.

### `product_group_daily_view`

Cột: `id`, `product_group_id`, `view_date`, `view_count`, `created_at`, `updated_at`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE`.

### `product_group_tag`

Cột: `product_group_id`, `tag_id`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (product_group_id, tag_id)`.

FK:

- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE`.
- `FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE`.

### `product_highlight_spec`

Cột: `id`, `product_group_id`, `product_variant_id?`, `source_type`, `source_id?`, `display_label`, `display_value`, `sort_order`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE`.
- `FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE CASCADE`.
- `FOREIGN KEY (product_variant_id, product_group_id) REFERENCES product_variant(id, product_group_id) DEFERRABLE INITIALLY DEFERRED`.

### `product_image`

Cột: `id`, `product_group_id`, `file_id`, `alt_text?`, `sort_order`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`, `product_variant_id?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE`.
- `FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (product_variant_id, product_group_id) REFERENCES product_variant(id, product_group_id) DEFERRABLE INITIALLY DEFERRED`.

### `product_spec`

Cột: `id`, `spec_group_id`, `spec_name`, `spec_value`, `sort_order`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (spec_group_id) REFERENCES spec_group(id) ON DELETE CASCADE`.

### `product_variant`

Cột: `id`, `product_group_id`, `external_code?`, `sku`, `model_code?`, `variant_name`, `review_status`, `publish_status`, `status`, `sort_order`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`, `public_price_mode`, `public_price_amount?`, `detailed_description?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE RESTRICT`.

### `project`

Cột: `id`, `title`, `slug`, `location?`, `project_year?`, `description?`, `image_file_id?`, `review_status`, `publish_status`, `seo_title?`, `seo_description?`, `seo_og_image_file_id?`, `created_by?`, `updated_by?`, `approved_by?`, `created_at`, `updated_at`, `deleted_at?`, `content_html?`, `client_name?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.

### `project_gallery`

Cột: `id`, `project_id`, `file_id`, `alt_text?`, `sort_order`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE`.

### `project_product_group`

Cột: `project_id`, `product_group_id`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (project_id, product_group_id)`.

FK:

- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE`.
- `FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE`.

### `quote_internal_note`

Cột: `id`, `quote_id`, `note_text`, `added_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (quote_id) REFERENCES quote_request(id) ON DELETE CASCADE`.

### `quote_item`

Cột: `id`, `quote_request_id`, `product_group_id`, `product_variant_id?`, `quantity?`, `notes?`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`, `quantity_raw?`, `quantity_unit?`, `quantity_state`, `public_price_amount_at_request?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (quote_request_id) REFERENCES quote_request(id) ON DELETE CASCADE`.
- `FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE RESTRICT`.

### `quote_request`

Cột: `id`, `full_name`, `company_name?`, `phone`, `email?`, `address?`, `message?`, `status`, `assigned_to?`, `created_at`, `updated_at`, `deleted_at?`, `ip_address?`, `user_agent?`, `customer_id?`, `project_name?`, `project_context?`, `project_requirements`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (customer_id) REFERENCES customer_profile(id) ON DELETE SET NULL`.

### `raw_data`

Cột: `id`, `import_batch_id`, `row_number`, `external_code?`, `raw_content`, `status`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE`.

### `redirect_rule`

Cột: `id`, `from_path`, `to_path`, `redirect_type`, `status`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

### `service`

Cột: `id`, `title`, `slug`, `description?`, `image_file_id?`, `review_status`, `publish_status`, `seo_title?`, `seo_description?`, `seo_og_image_file_id?`, `created_by?`, `updated_by?`, `approved_by?`, `created_at`, `updated_at`, `deleted_at?`, `content_html?`, `subtitle?`, `when_to_contact?`, `deliverables`, `typical_duration?`, `sort_order`, `icon_key?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.

### `service_product_group`

Cột: `service_id`, `product_group_id`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (service_id, product_group_id)`.

FK:

- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE`.
- `FOREIGN KEY (service_id) REFERENCES service(id) ON DELETE CASCADE`.

### `site_daily_view`

Cột: `id`, `view_date`, `view_count`, `created_at`, `updated_at`.

PK: `PRIMARY KEY (id)`.

### `spec_group`

Cột: `id`, `product_group_id`, `group_name`, `sort_order`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE`.

### `tag`

Cột: `id`, `name`, `slug`, `status`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`, `icon_key?`, `tone_key?`.

PK: `PRIMARY KEY (id)`.

### `technical_document`

Cột: `id`, `product_group_id`, `document_name`, `document_type`, `file_id`, `version?`, `is_public`, `status`, `sort_order`, `created_by?`, `updated_by?`, `created_at`, `updated_at`, `deleted_at?`, `product_variant_id?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE`.
- `FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE RESTRICT`.

### `variant_attribute`

Cột: `id`, `product_variant_id`, `attribute_name`, `attribute_value`, `display_order`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE CASCADE`.

### `variant_spec`

Cột: `id`, `variant_spec_group_id`, `spec_name`, `spec_value`, `sort_order`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (variant_spec_group_id) REFERENCES variant_spec_group(id) ON DELETE CASCADE`.

### `variant_spec_group`

Cột: `id`, `product_variant_id`, `group_name`, `sort_order`, `created_by?`, `created_at`, `updated_at`, `deleted_at?`.

PK: `PRIMARY KEY (id)`.

FK:

- `FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE CASCADE`.

## Metadata Knex (không đưa vào ERD nghiệp vụ)

### `knex_migrations`

Cột: `id`, `name?`, `batch?`, `migration_time?`.

PK: `PRIMARY KEY (id)`.

### `knex_migrations_lock`

Cột: `index`, `is_locked?`.

PK: `PRIMARY KEY (index)`.

## Khóa duy nhất ngoài PK

PostgreSQL có 32 unique index ngoài PK trong schema hiện tại. Index có mệnh đề `WHERE` chỉ áp dụng cho các dòng thỏa điều kiện đó, nên không suy ra quan hệ 1–1 trên toàn bộ lịch sử.

- `CREATE UNIQUE INDEX uq_admin_permission_code ON public.admin_permission USING btree (code)`.
- `CREATE UNIQUE INDEX uq_admin_role_code ON public.admin_role USING btree (code)`.
- `CREATE UNIQUE INDEX uq_admin_user_email ON public.admin_user USING btree (email)`.
- `CREATE UNIQUE INDEX uq_admin_user_logic_user_id ON public.admin_user USING btree (logic_user_id)`.
- `CREATE UNIQUE INDEX uq_admin_user_role_single_role ON public.admin_user_role USING btree (admin_user_id)`.
- `CREATE UNIQUE INDEX uq_brand_slug_active ON public.brand USING btree (slug) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_brand_page_brand_active ON public.brand_page USING btree (brand_id) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_bpfpg_active ON public.brand_page_featured_product_group USING btree (brand_page_id, product_group_id) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_certificate_sort_order_active ON public.certificate USING btree (sort_order) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_company_info_singleton_active ON public.company_info USING btree ((1)) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX file_metadata_stored_path_key ON public.file_metadata USING btree (stored_path)`.
- `CREATE UNIQUE INDEX home_section_section_type_key ON public.home_section USING btree (section_type)`.
- `CREATE UNIQUE INDEX idx_import_mapping_profile_signature_active ON public.import_mapping_profile USING btree (header_signature) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_menu_position_active ON public.menu USING btree ("position") WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_news_category_slug_active ON public.news_category USING btree (slug) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_page_content_slug_active ON public.page_content USING btree (slug) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_partner_sort_order_active ON public.partner USING btree (sort_order) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_product_category_slug_active ON public.product_category USING btree (slug) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_product_group_slug_active ON public.product_group USING btree (slug) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_product_group_daily_view_product_date ON public.product_group_daily_view USING btree (product_group_id, view_date)`.
- `CREATE UNIQUE INDEX uq_product_highlight_spec_active_source ON public.product_highlight_spec USING btree (product_group_id, COALESCE(product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid), source_type, source_id) WHERE ((deleted_at IS NULL) AND (source_id IS NOT NULL))`.
- `CREATE UNIQUE INDEX uq_product_image_active_group_file ON public.product_image USING btree (product_group_id, file_id) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_product_variant_external_code_active ON public.product_variant USING btree (external_code) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_product_variant_model_code_active ON public.product_variant USING btree (model_code) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_product_variant_sku_active ON public.product_variant USING btree (sku) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_project_slug_active ON public.project USING btree (slug) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_redirect_rule_from_path_active ON public.redirect_rule USING btree (from_path) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_service_slug_active ON public.service USING btree (slug) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_site_daily_view_date ON public.site_daily_view USING btree (view_date)`.
- `CREATE UNIQUE INDEX uq_spec_group_name_active ON public.spec_group USING btree (product_group_id, group_name) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_tag_slug_active ON public.tag USING btree (slug) WHERE (deleted_at IS NULL)`.
- `CREATE UNIQUE INDEX uq_variant_spec_group_name_active ON public.variant_spec_group USING btree (product_variant_id, group_name) WHERE (deleted_at IS NULL)`.

## Giới hạn khi chuyển thành ERD

Không suy thêm FK cho các trường đa hình `file_usage.entity_type/entity_id`, `audit_log.entity_type/entity_id`, `import_mapping.entity_type/official_id` hoặc `product_highlight_spec.source_type/source_id`. `created_by`, `updated_by`, `approved_by`, `assigned_to` cũng không có FK vật lý đến `admin_user`. Xem `tasks/erdReview.md` để biết cách chọn thực thể cho ERD nghiệp vụ.
