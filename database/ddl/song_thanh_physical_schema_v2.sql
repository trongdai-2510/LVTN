-- =========================================================
-- SONG THANH - PHYSICAL SCHEMA V2 (PostgreSQL)
-- Chốt theo trạng thái dự án hiện tại
-- =========================================================
-- ⚠️ NGUỒN SỰ THẬT (cập nhật): File này là BASELINE. Mọi thay đổi schema SAU baseline
-- nằm trong api/migrations/ và LÀ nguồn sự thật khi có khác biệt. Các thay đổi đáng chú ý
-- KHÔNG có trong baseline này:
--   • Bảng auth thật: admin_user / admin_role / admin_permission (migration 202604250001)
--   • Bảng `permission` cũ ĐÃ bị xóa (migration 202606150003) — đừng dùng lại
--   • brand_page.accent_color + layout_archetype (migration 202606150001)
--   • UNIQUE slug/sku/code... đổi sang PARTIAL INDEX WHERE deleted_at IS NULL (migration 202606150002)
--   • home_section, file_metadata.purpose/is_orphan, và các cột drift khác — xem v3 dump
-- Ảnh chụp đầy đủ gần thực tế hơn: song_thanh_physical_schema_v3.sql.
-- Khi có pg_dump, nên regenerate baseline từ DB thật để đồng bộ tuyệt đối.
-- =========================================================
-- Nền tảng quyết định:
-- 1) 44 bảng theo ERD logical đã chốt.
-- 2) PK/FK nghiệp vụ dùng UUID.
-- 3) Các field user logic (created_by, updated_by, approved_by, assigned_to,
--    added_by, resolved_by, actor_id, uploaded_by) giữ INTEGER theo contract.
--    Runtime auth standalone dùng UUID PK và ánh xạ qua admin_user.logic_user_id;
--    không dựng auth nội bộ song song và không đổi kiểu các field nghiệp vụ này.
-- 4) Status/decision dùng VARCHAR + CHECK constraint.
-- 5) Toàn hệ thống dùng soft delete qua deleted_at.
-- 6) created_at và updated_at có ở tất cả bảng.
-- 7) Hard delete chỉ là thao tác đặc biệt; schema ưu tiên giữ lịch sử.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- Helper functions
-- =========================================================

CREATE OR REPLACE FUNCTION st_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION st_sync_status_on_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Soft delete
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        NEW.status = 'inactive';
    END IF;

    -- Restore
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        NEW.status = 'active';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION st_sync_public_workflow_on_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Soft delete
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        NEW.publish_status = 'archived';
        NEW.review_status = 'approved'; -- keep last approved/reviewed meaning at delete moment
    END IF;

    -- Restore
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        NEW.publish_status = 'unpublished';
        NEW.review_status = 'pending_review';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- A. Nhóm file (tạo sớm vì được tham chiếu rộng)
-- =========================================================

CREATE TABLE file_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL UNIQUE,
    file_size BIGINT NOT NULL CHECK (file_size >= 0),
    mime_type VARCHAR(128) NOT NULL,
    storage_location VARCHAR(32) NOT NULL,
    uploaded_by INTEGER,
    is_orphan BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_file_metadata_storage_location CHECK (storage_location IN ('local', 'r2', 'other')),
    CONSTRAINT chk_file_metadata_name_not_blank CHECK (btrim(original_filename) <> ''),
    CONSTRAINT chk_file_metadata_path_not_blank CHECK (btrim(stored_path) <> '')
);

CREATE TRIGGER trg_file_metadata_updated_at
BEFORE UPDATE ON file_metadata
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE file_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    field_name VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_file_usage_entity_type_not_blank CHECK (btrim(entity_type) <> ''),
    CONSTRAINT chk_file_usage_field_name_not_blank CHECK (btrim(field_name) <> ''),
    CONSTRAINT fk_file_usage_file FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_file_usage_updated_at
BEFORE UPDATE ON file_usage
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

-- =========================================================
-- B. Nhóm nội dung / website
-- =========================================================

CREATE TABLE company_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    hotline VARCHAR(32) NOT NULL,
    hotlines JSONB DEFAULT '[]'::jsonb,
    email VARCHAR(128) NOT NULL,
    address TEXT NOT NULL,
    map_embed_code TEXT,
    working_hours_from TIME,
    working_hours_to TIME,
    working_days VARCHAR(100),
    home_seo_title VARCHAR(255),
    home_seo_description TEXT,
    logo_file_id UUID,
    favicon_file_id UUID,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_company_info_display_name_not_blank CHECK (btrim(display_name) <> ''),
    CONSTRAINT chk_company_info_legal_name_not_blank CHECK (btrim(legal_name) <> ''),
    CONSTRAINT chk_company_info_hotline_not_blank CHECK (btrim(hotline) <> ''),
    CONSTRAINT chk_company_info_email_format CHECK (email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'),
    CONSTRAINT fk_company_info_logo FOREIGN KEY (logo_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT,
    CONSTRAINT fk_company_info_favicon FOREIGN KEY (favicon_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

-- Singleton đúng nghĩa: chỉ được có đúng 1 record chưa soft delete
CREATE UNIQUE INDEX uq_company_info_singleton_active
ON company_info ((1))
WHERE deleted_at IS NULL;

CREATE TRIGGER trg_company_info_updated_at
BEFORE UPDATE ON company_info
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE company_social_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_info_id UUID NOT NULL,
    platform VARCHAR(32) NOT NULL,
    label VARCHAR(64) NOT NULL,
    url TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_company_social_link_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_company_social_link_platform_not_blank CHECK (btrim(platform) <> ''),
    CONSTRAINT chk_company_social_link_label_not_blank CHECK (btrim(label) <> ''),
    CONSTRAINT chk_company_social_link_url_not_blank CHECK (btrim(url) <> ''),
    CONSTRAINT fk_company_social_link_company_info FOREIGN KEY (company_info_id) REFERENCES company_info(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_company_social_link_updated_at
BEFORE UPDATE ON company_social_link
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_company_social_link_soft_delete
BEFORE UPDATE ON company_social_link
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE menu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    position VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_menu_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_menu_position CHECK (position IN ('header', 'footer', 'mobile')),
    CONSTRAINT chk_menu_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TRIGGER trg_menu_updated_at
BEFORE UPDATE ON menu
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_menu_soft_delete
BEFORE UPDATE ON menu
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE menu_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL,
    parent_id UUID,
    title VARCHAR(128) NOT NULL,
    link_type VARCHAR(16) NOT NULL,
    link_target TEXT,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_menu_item_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_menu_item_link_type CHECK (link_type IN ('internal', 'external', 'anchor', 'group')),
    CONSTRAINT chk_menu_item_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_menu_item_target_required CHECK (
        (link_type = 'group' AND link_target IS NULL) OR
        (link_type <> 'group' AND link_target IS NOT NULL AND btrim(link_target) <> '')
    ),
    CONSTRAINT chk_menu_item_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT fk_menu_item_menu FOREIGN KEY (menu_id) REFERENCES menu(id) ON DELETE RESTRICT,
    CONSTRAINT fk_menu_item_parent FOREIGN KEY (parent_id) REFERENCES menu_item(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_menu_item_updated_at
BEFORE UPDATE ON menu_item
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_menu_item_soft_delete
BEFORE UPDATE ON menu_item
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE news_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_news_category_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT chk_news_category_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT chk_news_category_sort_order_non_negative CHECK (sort_order >= 0)
);

CREATE TRIGGER trg_news_category_updated_at
BEFORE UPDATE ON news_category
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE page_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content_type VARCHAR(20) NOT NULL DEFAULT 'page',
    excerpt TEXT,
    content_html TEXT,
    news_category_id UUID,
    featured_image_file_id UUID,
    review_status VARCHAR(24) NOT NULL DEFAULT 'draft',
    publish_status VARCHAR(16) NOT NULL DEFAULT 'unpublished',
    seo_title VARCHAR(255),
    seo_description VARCHAR(512),
    published_at TIMESTAMPTZ,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    seo_og_image_file_id UUID,
    created_by INTEGER,
    updated_by INTEGER,
    approved_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_page_content_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_page_content_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT chk_page_content_content_type CHECK (content_type IN ('page', 'news')),
    CONSTRAINT chk_page_content_review_status CHECK (review_status IN ('draft', 'pending_review', 'approved', 'rejected')),
    CONSTRAINT chk_page_content_publish_status CHECK (publish_status IN ('unpublished', 'published', 'archived')),
    CONSTRAINT fk_page_content_news_category FOREIGN KEY (news_category_id) REFERENCES news_category(id) ON DELETE SET NULL,
    CONSTRAINT fk_page_content_featured_image FOREIGN KEY (featured_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT,
    CONSTRAINT fk_page_content_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_page_content_updated_at
BEFORE UPDATE ON page_content
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_page_content_soft_delete_workflow
BEFORE UPDATE ON page_content
FOR EACH ROW EXECUTE FUNCTION st_sync_public_workflow_on_soft_delete();

CREATE TABLE banner (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    content_position VARCHAR(16) NOT NULL DEFAULT 'left',
    title_size VARCHAR(10) NOT NULL DEFAULT 'large',
    title_color VARCHAR(7) NOT NULL DEFAULT '#ffffff',
    description_color VARCHAR(7) NOT NULL DEFAULT '#ffffff',
    image_file_id UUID NOT NULL,
    image_mobile_file_id UUID,
    link_type VARCHAR(16) NOT NULL,
    link_target TEXT,
    cta_buttons JSONB,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    notes TEXT,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_banner_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_banner_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_banner_content_position CHECK (content_position IN ('left', 'center', 'right')),
    CONSTRAINT chk_banner_title_size CHECK (title_size IN ('small', 'medium', 'large')),
    CONSTRAINT chk_banner_title_color_hex CHECK (title_color ~* '^#[0-9a-f]{6}$'),
    CONSTRAINT chk_banner_description_color_hex CHECK (description_color ~* '^#[0-9a-f]{6}$'),
    CONSTRAINT chk_banner_link_type CHECK (link_type IN ('internal', 'external', 'anchor', 'none')),
    CONSTRAINT chk_banner_target_required CHECK (
        (link_type = 'none' AND link_target IS NULL) OR
        (link_type <> 'none' AND link_target IS NOT NULL AND btrim(link_target) <> '')
    ),
    CONSTRAINT fk_banner_image FOREIGN KEY (image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT,
    CONSTRAINT fk_banner_image_mobile FOREIGN KEY (image_mobile_file_id) REFERENCES file_metadata(id) ON DELETE SET NULL
);

CREATE TRIGGER trg_banner_updated_at
BEFORE UPDATE ON banner
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_banner_soft_delete
BEFORE UPDATE ON banner
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE service (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    subtitle VARCHAR(220),
    description TEXT,
    content_html TEXT,
    when_to_contact TEXT,
    deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
    typical_duration VARCHAR(120),
    sort_order INTEGER NOT NULL DEFAULT 1000,
    icon_key VARCHAR(40),
    image_file_id UUID,
    review_status VARCHAR(24) NOT NULL DEFAULT 'draft',
    publish_status VARCHAR(16) NOT NULL DEFAULT 'unpublished',
    seo_title VARCHAR(255),
    seo_description VARCHAR(512),
    seo_og_image_file_id UUID,
    created_by INTEGER,
    updated_by INTEGER,
    approved_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_service_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_service_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT chk_service_deliverables_array CHECK (jsonb_typeof(deliverables) = 'array'),
    CONSTRAINT chk_service_sort_order_non_negative CHECK (sort_order >= 0),
    CONSTRAINT chk_service_review_status CHECK (review_status IN ('draft', 'pending_review', 'approved', 'rejected')),
    CONSTRAINT chk_service_publish_status CHECK (publish_status IN ('unpublished', 'published', 'archived')),
    CONSTRAINT fk_service_image FOREIGN KEY (image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT,
    CONSTRAINT fk_service_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_service_updated_at
BEFORE UPDATE ON service
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_service_soft_delete_workflow
BEFORE UPDATE ON service
FOR EACH ROW EXECUTE FUNCTION st_sync_public_workflow_on_soft_delete();

CREATE INDEX idx_service_sort_order
ON service (sort_order, updated_at DESC)
WHERE deleted_at IS NULL;

CREATE TABLE project (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    location VARCHAR(255),
    project_year SMALLINT,
    client_name VARCHAR(200),
    description TEXT,
    content_html TEXT,
    image_file_id UUID,
    review_status VARCHAR(24) NOT NULL DEFAULT 'draft',
    publish_status VARCHAR(16) NOT NULL DEFAULT 'unpublished',
    seo_title VARCHAR(255),
    seo_description VARCHAR(512),
    seo_og_image_file_id UUID,
    created_by INTEGER,
    updated_by INTEGER,
    approved_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_project_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_project_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT chk_project_year_range CHECK (project_year IS NULL OR project_year BETWEEN 1900 AND 2100),
    CONSTRAINT chk_project_review_status CHECK (review_status IN ('draft', 'pending_review', 'approved', 'rejected')),
    CONSTRAINT chk_project_publish_status CHECK (publish_status IN ('unpublished', 'published', 'archived')),
    CONSTRAINT fk_project_image FOREIGN KEY (image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT,
    CONSTRAINT fk_project_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_project_updated_at
BEFORE UPDATE ON project
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_project_soft_delete_workflow
BEFORE UPDATE ON project
FOR EACH ROW EXECUTE FUNCTION st_sync_public_workflow_on_soft_delete();

CREATE TABLE project_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    file_id UUID NOT NULL,
    alt_text VARCHAR(255),
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_project_gallery_sort_order_non_negative CHECK (sort_order >= 0),
    CONSTRAINT fk_project_gallery_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_gallery_file FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_project_gallery_updated_at
BEFORE UPDATE ON project_gallery
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE partner (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    logo_file_id UUID,
    website_url TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_partner_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_partner_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT fk_partner_logo FOREIGN KEY (logo_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_partner_updated_at
BEFORE UPDATE ON partner
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_partner_soft_delete
BEFORE UPDATE ON partner
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE certificate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    file_id UUID,
    image_file_id UUID,
    issued_date DATE,
    expires_date DATE,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_certificate_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_certificate_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_certificate_dates CHECK (expires_date IS NULL OR issued_date IS NULL OR expires_date >= issued_date),
    CONSTRAINT fk_certificate_file FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT,
    CONSTRAINT fk_certificate_image FOREIGN KEY (image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_certificate_updated_at
BEFORE UPDATE ON certificate
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_certificate_soft_delete
BEFORE UPDATE ON certificate
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE redirect_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_path TEXT NOT NULL UNIQUE,
    to_path TEXT NOT NULL,
    redirect_type SMALLINT NOT NULL DEFAULT 301,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_redirect_rule_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_redirect_type CHECK (redirect_type IN (301, 302)),
    CONSTRAINT chk_redirect_paths_not_blank CHECK (btrim(from_path) <> '' AND btrim(to_path) <> ''),
    CONSTRAINT chk_redirect_not_self CHECK (from_path <> to_path),
    CONSTRAINT chk_redirect_paths_start_slash CHECK (left(from_path, 1) = '/' AND left(to_path, 1) = '/')
);

CREATE TRIGGER trg_redirect_rule_updated_at
BEFORE UPDATE ON redirect_rule
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_redirect_rule_soft_delete
BEFORE UPDATE ON redirect_rule
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

-- =========================================================
-- C. Nhóm sản phẩm
-- =========================================================

CREATE TABLE product_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    parent_id UUID,
    description TEXT,
    icon_file_id UUID,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_product_category_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_product_category_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT chk_product_category_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT chk_product_category_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT fk_product_category_parent FOREIGN KEY (parent_id) REFERENCES product_category(id) ON DELETE RESTRICT,
    CONSTRAINT fk_product_category_icon FOREIGN KEY (icon_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_product_category_updated_at
BEFORE UPDATE ON product_category
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_product_category_soft_delete
BEFORE UPDATE ON product_category
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE brand (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    primary_category_id UUID,
    logo_file_id UUID,
    description TEXT,
    website_url TEXT,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_brand_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_brand_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT chk_brand_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT fk_brand_primary_category FOREIGN KEY (primary_category_id) REFERENCES product_category(id) ON DELETE RESTRICT,
    CONSTRAINT fk_brand_logo FOREIGN KEY (logo_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_brand_updated_at
BEFORE UPDATE ON brand
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_brand_soft_delete
BEFORE UPDATE ON brand
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE product_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    category_id UUID NOT NULL,
    brand_id UUID,
    short_description TEXT,
    detailed_description TEXT,
    thumbnail_file_id UUID,
    review_status VARCHAR(24) NOT NULL DEFAULT 'draft',
    publish_status VARCHAR(16) NOT NULL DEFAULT 'unpublished',
    seo_title VARCHAR(255),
    seo_description VARCHAR(512),
    seo_og_image_file_id UUID,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    sort_order SMALLINT NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    created_by INTEGER,
    updated_by INTEGER,
    approved_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_product_group_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_product_group_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT chk_product_group_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT chk_product_group_review_status CHECK (review_status IN ('draft', 'pending_review', 'approved', 'rejected')),
    CONSTRAINT chk_product_group_publish_status CHECK (publish_status IN ('unpublished', 'published', 'archived')),
    CONSTRAINT fk_product_group_category FOREIGN KEY (category_id) REFERENCES product_category(id) ON DELETE RESTRICT,
    CONSTRAINT fk_product_group_brand FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT,
    CONSTRAINT fk_product_group_thumbnail FOREIGN KEY (thumbnail_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT,
    CONSTRAINT fk_product_group_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_product_group_updated_at
BEFORE UPDATE ON product_group
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_product_group_soft_delete_status
BEFORE UPDATE ON product_group
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TRIGGER trg_product_group_soft_delete_workflow
BEFORE UPDATE ON product_group
FOR EACH ROW EXECUTE FUNCTION st_sync_public_workflow_on_soft_delete();

CREATE TABLE product_group_daily_view (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_group_id UUID NOT NULL,
    view_date DATE NOT NULL,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_group_daily_view_product_date UNIQUE (product_group_id, view_date),
    CONSTRAINT chk_product_group_daily_view_count CHECK (view_count >= 0),
    CONSTRAINT fk_product_group_daily_view_product FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_product_group_daily_view_updated_at
BEFORE UPDATE ON product_group_daily_view
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE site_daily_view (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    view_date DATE NOT NULL,
    view_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_site_daily_view_date UNIQUE (view_date),
    CONSTRAINT chk_site_daily_view_count CHECK (view_count >= 0)
);

CREATE TRIGGER trg_site_daily_view_updated_at
BEFORE UPDATE ON site_daily_view
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE brand_page (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    excerpt TEXT,
    overview_title VARCHAR(255),
    overview_body TEXT,
    support_title VARCHAR(255),
    support_intro TEXT,
    support_items JSONB,
    support_image_file_id UUID,
    hero_banner_id UUID,
    hero_title_size VARCHAR(16) NOT NULL DEFAULT 'large',
    hero_excerpt_size VARCHAR(16) NOT NULL DEFAULT 'large',
    hero_eyebrow_color VARCHAR(16),
    hero_title_color VARCHAR(16),
    hero_excerpt_color VARCHAR(16),
    cta_title VARCHAR(255),
    cta_description TEXT,
    cta_button_label VARCHAR(120),
    cta_button_url TEXT,
    review_status VARCHAR(24) NOT NULL DEFAULT 'draft',
    publish_status VARCHAR(16) NOT NULL DEFAULT 'unpublished',
    seo_title VARCHAR(255),
    seo_description VARCHAR(512),
    seo_og_image_file_id UUID,
    created_by INTEGER,
    updated_by INTEGER,
    approved_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_brand_page_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_brand_page_hero_title_size CHECK (hero_title_size IN ('medium', 'large', 'xlarge')),
    CONSTRAINT chk_brand_page_hero_excerpt_size CHECK (hero_excerpt_size IN ('medium', 'large')),
    CONSTRAINT chk_brand_page_hero_eyebrow_color CHECK (hero_eyebrow_color IS NULL OR hero_eyebrow_color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_brand_page_hero_title_color CHECK (hero_title_color IS NULL OR hero_title_color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_brand_page_hero_excerpt_color CHECK (hero_excerpt_color IS NULL OR hero_excerpt_color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_brand_page_review_status CHECK (review_status IN ('draft', 'pending_review', 'approved', 'rejected')),
    CONSTRAINT chk_brand_page_publish_status CHECK (publish_status IN ('unpublished', 'published', 'archived')),
    CONSTRAINT fk_brand_page_brand FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT,
    CONSTRAINT fk_brand_page_support_image FOREIGN KEY (support_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT,
    CONSTRAINT fk_brand_page_hero_banner FOREIGN KEY (hero_banner_id) REFERENCES banner(id) ON DELETE SET NULL,
    CONSTRAINT fk_brand_page_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_brand_page_updated_at
BEFORE UPDATE ON brand_page
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_brand_page_soft_delete_workflow
BEFORE UPDATE ON brand_page
FOR EACH ROW EXECUTE FUNCTION st_sync_public_workflow_on_soft_delete();

CREATE TABLE brand_page_stat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_page_id UUID NOT NULL,
    value VARCHAR(80) NOT NULL,
    label VARCHAR(160) NOT NULL,
    note TEXT,
    source_url TEXT,
    source_file_id UUID,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_brand_page_stat_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_brand_page_stat_value_not_blank CHECK (btrim(value) <> ''),
    CONSTRAINT chk_brand_page_stat_label_not_blank CHECK (btrim(label) <> ''),
    CONSTRAINT fk_brand_page_stat_page FOREIGN KEY (brand_page_id) REFERENCES brand_page(id) ON DELETE CASCADE,
    CONSTRAINT fk_brand_page_stat_source_file FOREIGN KEY (source_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_brand_page_stat_updated_at
BEFORE UPDATE ON brand_page_stat
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_brand_page_stat_soft_delete
BEFORE UPDATE ON brand_page_stat
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE brand_page_source (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_page_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    source_type VARCHAR(32) NOT NULL DEFAULT 'other',
    url TEXT,
    file_id UUID,
    description TEXT,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_brand_page_source_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_brand_page_source_type CHECK (source_type IN ('website', 'catalogue', 'certificate', 'other')),
    CONSTRAINT chk_brand_page_source_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_brand_page_source_has_ref CHECK (
        (url IS NOT NULL AND btrim(url) <> '') OR file_id IS NOT NULL
    ),
    CONSTRAINT fk_brand_page_source_page FOREIGN KEY (brand_page_id) REFERENCES brand_page(id) ON DELETE CASCADE,
    CONSTRAINT fk_brand_page_source_file FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_brand_page_source_updated_at
BEFORE UPDATE ON brand_page_source
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_brand_page_source_soft_delete
BEFORE UPDATE ON brand_page_source
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE brand_page_featured_product_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_page_id UUID NOT NULL,
    product_group_id UUID NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_brand_page_featured_group UNIQUE (brand_page_id, product_group_id),
    CONSTRAINT fk_brand_page_featured_page FOREIGN KEY (brand_page_id) REFERENCES brand_page(id) ON DELETE CASCADE,
    CONSTRAINT fk_brand_page_featured_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_brand_page_featured_updated_at
BEFORE UPDATE ON brand_page_featured_product_group
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE product_variant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_group_id UUID NOT NULL,
    external_code VARCHAR(128),
    sku VARCHAR(128) NOT NULL UNIQUE,
    model_code VARCHAR(128),
    variant_name VARCHAR(255) NOT NULL,
    detailed_description TEXT,
    public_price_mode VARCHAR(32) NOT NULL DEFAULT 'contact_for_quote',
    public_price_amount INTEGER,
    review_status VARCHAR(24) NOT NULL DEFAULT 'draft',
    publish_status VARCHAR(16) NOT NULL DEFAULT 'unpublished',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_product_variant_external_code UNIQUE (external_code),
    CONSTRAINT uq_product_variant_model_code UNIQUE (model_code),
    CONSTRAINT chk_product_variant_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_product_variant_variant_name_not_blank CHECK (btrim(variant_name) <> ''),
    CONSTRAINT chk_product_variant_public_price_mode CHECK (public_price_mode IN ('public_price', 'contact_for_quote')),
    CONSTRAINT chk_product_variant_public_price CHECK (
        (
            public_price_mode = 'public_price'
            AND public_price_amount IS NOT NULL
            AND public_price_amount > 0
            AND public_price_amount <= 2147483647
        )
        OR
        (public_price_mode = 'contact_for_quote' AND public_price_amount IS NULL)
    ),
    CONSTRAINT chk_product_variant_review_status CHECK (review_status IN ('draft', 'pending_review', 'approved', 'rejected')),
    CONSTRAINT chk_product_variant_publish_status CHECK (publish_status IN ('unpublished', 'published', 'archived')),
    CONSTRAINT fk_product_variant_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_product_variant_updated_at
BEFORE UPDATE ON product_variant
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_product_variant_soft_delete_status
BEFORE UPDATE ON product_variant
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TRIGGER trg_product_variant_soft_delete_workflow
BEFORE UPDATE ON product_variant
FOR EACH ROW EXECUTE FUNCTION st_sync_public_workflow_on_soft_delete();

CREATE TABLE variant_attribute (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_variant_id UUID NOT NULL,
    attribute_name VARCHAR(128) NOT NULL,
    attribute_value TEXT NOT NULL,
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_variant_attribute_name_not_blank CHECK (btrim(attribute_name) <> ''),
    CONSTRAINT chk_variant_attribute_value_not_blank CHECK (btrim(attribute_value) <> ''),
    CONSTRAINT fk_variant_attribute_variant FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_variant_attribute_updated_at
BEFORE UPDATE ON variant_attribute
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE spec_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_group_id UUID NOT NULL,
    group_name VARCHAR(128) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_spec_group_name_per_product_group UNIQUE (product_group_id, group_name),
    CONSTRAINT chk_spec_group_name_not_blank CHECK (btrim(group_name) <> ''),
    CONSTRAINT fk_spec_group_product_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_spec_group_updated_at
BEFORE UPDATE ON spec_group
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE product_spec (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_group_id UUID NOT NULL,
    spec_name VARCHAR(128) NOT NULL,
    spec_value TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_product_spec_name_not_blank CHECK (btrim(spec_name) <> ''),
    CONSTRAINT chk_product_spec_value_not_blank CHECK (btrim(spec_value) <> ''),
    CONSTRAINT fk_product_spec_group FOREIGN KEY (spec_group_id) REFERENCES spec_group(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_product_spec_updated_at
BEFORE UPDATE ON product_spec
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE variant_spec_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_variant_id UUID NOT NULL,
    group_name VARCHAR(128) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_variant_spec_group_name_per_variant UNIQUE (product_variant_id, group_name),
    CONSTRAINT chk_variant_spec_group_name_not_blank CHECK (btrim(group_name) <> ''),
    CONSTRAINT fk_variant_spec_group_variant FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_variant_spec_group_updated_at
BEFORE UPDATE ON variant_spec_group
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE variant_spec (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_spec_group_id UUID NOT NULL,
    spec_name VARCHAR(128) NOT NULL,
    spec_value TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_variant_spec_name_not_blank CHECK (btrim(spec_name) <> ''),
    CONSTRAINT chk_variant_spec_value_not_blank CHECK (btrim(spec_value) <> ''),
    CONSTRAINT fk_variant_spec_group FOREIGN KEY (variant_spec_group_id) REFERENCES variant_spec_group(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_variant_spec_updated_at
BEFORE UPDATE ON variant_spec
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE product_highlight_spec (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_group_id UUID NOT NULL,
    product_variant_id UUID,
    source_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    source_id UUID,
    display_label VARCHAR(128) NOT NULL,
    display_value TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_product_highlight_spec_source_type CHECK (source_type IN ('product_spec', 'variant_spec', 'variant_attribute', 'manual')),
    CONSTRAINT chk_product_highlight_spec_source_trace CHECK (
        (source_type = 'manual' AND source_id IS NULL)
        OR (source_type <> 'manual' AND source_id IS NOT NULL)
    ),
    CONSTRAINT chk_product_highlight_spec_label_not_blank CHECK (btrim(display_label) <> ''),
    CONSTRAINT chk_product_highlight_spec_value_not_blank CHECK (btrim(display_value) <> ''),
    CONSTRAINT fk_product_highlight_spec_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_highlight_spec_variant FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_product_highlight_spec_updated_at
BEFORE UPDATE ON product_highlight_spec
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE technical_document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_group_id UUID NOT NULL,
    product_variant_id UUID,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(32) NOT NULL,
    file_id UUID NOT NULL,
    version VARCHAR(32),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_technical_document_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_technical_document_type CHECK (document_type IN ('datasheet', 'manual', 'catalogue', 'certificate', 'other')),
    CONSTRAINT chk_technical_document_name_not_blank CHECK (btrim(document_name) <> ''),
    CONSTRAINT fk_technical_document_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE,
    CONSTRAINT fk_technical_document_variant FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE RESTRICT,
    CONSTRAINT fk_technical_document_file FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_technical_document_updated_at
BEFORE UPDATE ON technical_document
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_technical_document_soft_delete
BEFORE UPDATE ON technical_document
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE product_image (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_group_id UUID NOT NULL,
    product_variant_id UUID,
    file_id UUID NOT NULL,
    alt_text VARCHAR(255),
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_product_image_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_image_variant FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE RESTRICT,
    CONSTRAINT fk_product_image_file FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_product_image_updated_at
BEFORE UPDATE ON product_image
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE tag (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL,
    slug VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_tag_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_tag_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT chk_tag_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE TRIGGER trg_tag_updated_at
BEFORE UPDATE ON tag
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TRIGGER trg_tag_soft_delete
BEFORE UPDATE ON tag
FOR EACH ROW EXECUTE FUNCTION st_sync_status_on_soft_delete();

CREATE TABLE product_group_tag (
    product_group_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (product_group_id, tag_id),
    CONSTRAINT fk_product_group_tag_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_group_tag_tag FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_product_group_tag_updated_at
BEFORE UPDATE ON product_group_tag
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE project_product_group (
    project_id UUID NOT NULL,
    product_group_id UUID NOT NULL,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (project_id, product_group_id),
    CONSTRAINT fk_project_product_group_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_product_group_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_project_product_group_updated_at
BEFORE UPDATE ON project_product_group
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE service_product_group (
    service_id UUID NOT NULL,
    product_group_id UUID NOT NULL,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (service_id, product_group_id),
    CONSTRAINT fk_service_product_group_service FOREIGN KEY (service_id) REFERENCES service(id) ON DELETE CASCADE,
    CONSTRAINT fk_service_product_group_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_service_product_group_updated_at
BEFORE UPDATE ON service_product_group
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

-- =========================================================
-- D. Nhóm lead
-- =========================================================

CREATE TABLE customer_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(128) NOT NULL,
    phone VARCHAR(32),
    email VARCHAR(128),
    company_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_customer_profile_name_not_blank CHECK (btrim(full_name) <> ''),
    CONSTRAINT chk_customer_profile_email_format CHECK (email IS NULL OR email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$')
);

CREATE TRIGGER trg_customer_profile_updated_at
BEFORE UPDATE ON customer_profile
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE contact_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID,
    full_name VARCHAR(128) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(128),
    company_name VARCHAR(255),
    message TEXT NOT NULL,
    source_page TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'new',
    assigned_to INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    CONSTRAINT fk_contact_request_customer FOREIGN KEY (customer_id) REFERENCES customer_profile(id) ON DELETE SET NULL,
    CONSTRAINT chk_contact_request_status CHECK (status IN ('new', 'in_progress', 'done', 'spam', 'invalid')),
    CONSTRAINT chk_contact_request_name_not_blank CHECK (btrim(full_name) <> ''),
    CONSTRAINT chk_contact_request_phone_not_blank CHECK (btrim(phone) <> ''),
    CONSTRAINT chk_contact_request_email_format CHECK (email IS NULL OR email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$')
);

CREATE TRIGGER trg_contact_request_updated_at
BEFORE UPDATE ON contact_request
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE contact_internal_note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL,
    note_text TEXT NOT NULL,
    added_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_contact_internal_note_not_blank CHECK (btrim(note_text) <> ''),
    CONSTRAINT fk_contact_internal_note_contact FOREIGN KEY (contact_id) REFERENCES contact_request(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_contact_internal_note_updated_at
BEFORE UPDATE ON contact_internal_note
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE quote_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID,
    full_name VARCHAR(128) NOT NULL,
    company_name VARCHAR(255),
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(128),
    address TEXT,
    message TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'new',
    assigned_to INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    CONSTRAINT fk_quote_request_customer FOREIGN KEY (customer_id) REFERENCES customer_profile(id) ON DELETE SET NULL,
    CONSTRAINT chk_quote_request_status CHECK (status IN ('new', 'in_progress', 'done', 'spam', 'invalid')),
    CONSTRAINT chk_quote_request_name_not_blank CHECK (btrim(full_name) <> ''),
    CONSTRAINT chk_quote_request_phone_not_blank CHECK (btrim(phone) <> ''),
    CONSTRAINT chk_quote_request_email_format CHECK (email IS NULL OR email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$')
);

CREATE TRIGGER trg_quote_request_updated_at
BEFORE UPDATE ON quote_request
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE quote_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID NOT NULL,
    product_group_id UUID NOT NULL,
    product_variant_id UUID,
    quantity INTEGER CHECK (quantity IS NULL OR quantity > 0),
    notes TEXT,
    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_quote_item_quote FOREIGN KEY (quote_request_id) REFERENCES quote_request(id) ON DELETE CASCADE,
    CONSTRAINT fk_quote_item_group FOREIGN KEY (product_group_id) REFERENCES product_group(id) ON DELETE RESTRICT,
    CONSTRAINT fk_quote_item_variant FOREIGN KEY (product_variant_id) REFERENCES product_variant(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_quote_item_updated_at
BEFORE UPDATE ON quote_item
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE quote_internal_note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL,
    note_text TEXT NOT NULL,
    added_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_quote_internal_note_not_blank CHECK (btrim(note_text) <> ''),
    CONSTRAINT fk_quote_internal_note_quote FOREIGN KEY (quote_id) REFERENCES quote_request(id) ON DELETE CASCADE
);

CREATE INDEX idx_customer_profile_phone ON customer_profile(phone);
CREATE INDEX idx_customer_profile_email ON customer_profile(email);
CREATE INDEX idx_customer_profile_deleted_at ON customer_profile(deleted_at);
CREATE INDEX idx_contact_request_customer_id ON contact_request(customer_id);
CREATE INDEX idx_quote_request_customer_id ON quote_request(customer_id);

CREATE TRIGGER trg_quote_internal_note_updated_at
BEFORE UPDATE ON quote_internal_note
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

-- =========================================================
-- E. Nhóm quản trị / audit
-- =========================================================

-- [GỠ BỎ] Bảng `permission` (model auth cũ bị bỏ) đã được xóa khỏi DB qua migration
-- 202606150003_drop_dead_permission_table. Hệ phân quyền thật dùng admin_user / admin_role /
-- admin_permission (định nghĩa ở migration 202604250001_create_admin_auth_tables), KHÔNG nằm
-- trong baseline này. Xem thêm song_thanh_physical_schema_v3.sql cho ảnh chụp đầy đủ hơn.

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(64) NOT NULL,
    entity_id TEXT NOT NULL,
    actor_id TEXT,
    action VARCHAR(32) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_fields TEXT[],
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_audit_log_action CHECK (action IN ('create', 'update', 'soft_delete', 'restore', 'approve', 'publish', 'archive', 'apply_import', 'resolve_conflict', 'other')),
    CONSTRAINT chk_audit_log_entity_type_not_blank CHECK (btrim(entity_type) <> ''),
    CONSTRAINT chk_audit_log_entity_id_not_blank CHECK (btrim(entity_id) <> '')
);

CREATE TRIGGER trg_audit_log_updated_at
BEFORE UPDATE ON audit_log
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

-- =========================================================
-- F. Nhóm import dữ liệu
-- =========================================================

CREATE TABLE import_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name VARCHAR(255),
    source_file_name TEXT NOT NULL,
    source_file_id UUID NOT NULL,
    uploaded_by INTEGER,
    status VARCHAR(16) NOT NULL DEFAULT 'created',
    total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
    error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
    conflict_count INTEGER NOT NULL DEFAULT 0 CHECK (conflict_count >= 0),
    notes TEXT,
    selected_row_ranges JSONB,
    column_mapping JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_import_batch_status CHECK (status IN ('created', 'validated', 'in_review', 'ready_to_apply', 'applied', 'cancelled')),
    CONSTRAINT chk_import_batch_source_file_name_not_blank CHECK (btrim(source_file_name) <> ''),
    CONSTRAINT fk_import_batch_source_file FOREIGN KEY (source_file_id) REFERENCES file_metadata(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_import_batch_updated_at
BEFORE UPDATE ON import_batch
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE import_mapping_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_name VARCHAR(160) NOT NULL,
    header_signature VARCHAR(1000) NOT NULL,
    normalized_headers JSONB NOT NULL,
    mapping_config JSONB NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_import_mapping_profile_name_not_blank CHECK (btrim(profile_name) <> '')
);

CREATE TRIGGER trg_import_mapping_profile_updated_at
BEFORE UPDATE ON import_mapping_profile
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE raw_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL,
    row_number INTEGER NOT NULL CHECK (row_number > 0),
    external_code VARCHAR(128),
    raw_content JSONB NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_raw_data_status CHECK (status IN ('new', 'parsed', 'error', 'ignored')),
    CONSTRAINT fk_raw_data_batch FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_raw_data_updated_at
BEFORE UPDATE ON raw_data
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE data_conflict (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id TEXT,
    conflict_type VARCHAR(32) NOT NULL,
    existing_data JSONB,
    incoming_data JSONB,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_data_conflict_status CHECK (status IN ('open', 'resolved', 'skipped')),
    CONSTRAINT chk_data_conflict_entity_type_not_blank CHECK (btrim(entity_type) <> ''),
    CONSTRAINT chk_data_conflict_type_not_blank CHECK (btrim(conflict_type) <> ''),
    CONSTRAINT fk_data_conflict_batch FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_data_conflict_updated_at
BEFORE UPDATE ON data_conflict
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE pending_product_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL,
    external_code VARCHAR(128),
    product_name TEXT NOT NULL,
    main_category_name TEXT,
    category_name TEXT,
    brand_name TEXT,
    short_description TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'pending_review',
    conflict_id UUID,
    mapped_official_id UUID,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_pending_product_group_status CHECK (status IN ('pending_review', 'approved', 'rejected', 'applied')),
    CONSTRAINT chk_pending_product_group_name_not_blank CHECK (btrim(product_name) <> ''),
    CONSTRAINT fk_pending_product_group_batch FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE,
    CONSTRAINT fk_pending_product_group_conflict FOREIGN KEY (conflict_id) REFERENCES data_conflict(id) ON DELETE SET NULL,
    CONSTRAINT fk_pending_product_group_official FOREIGN KEY (mapped_official_id) REFERENCES product_group(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_pending_product_group_updated_at
BEFORE UPDATE ON pending_product_group
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE pending_variant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL,
    pending_product_group_id UUID NOT NULL,
    external_code VARCHAR(128),
    sku VARCHAR(128),
    model_code VARCHAR(128),
    variant_name TEXT NOT NULL,
    public_price_mode VARCHAR(32) NOT NULL DEFAULT 'contact_for_quote',
    public_price_amount INTEGER,
    status VARCHAR(16) NOT NULL DEFAULT 'pending_review',
    conflict_id UUID,
    mapped_official_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_pending_variant_status CHECK (status IN ('pending_review', 'approved', 'rejected', 'applied')),
    CONSTRAINT chk_pending_variant_name_not_blank CHECK (btrim(variant_name) <> ''),
    CONSTRAINT chk_pending_variant_public_price_mode CHECK (public_price_mode IN ('public_price', 'contact_for_quote')),
    CONSTRAINT chk_pending_variant_public_price CHECK (
        (
            public_price_mode = 'public_price'
            AND public_price_amount IS NOT NULL
            AND public_price_amount > 0
            AND public_price_amount <= 2147483647
        )
        OR
        (public_price_mode = 'contact_for_quote' AND public_price_amount IS NULL)
    ),
    CONSTRAINT fk_pending_variant_batch FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE,
    CONSTRAINT fk_pending_variant_group FOREIGN KEY (pending_product_group_id) REFERENCES pending_product_group(id) ON DELETE CASCADE,
    CONSTRAINT fk_pending_variant_conflict FOREIGN KEY (conflict_id) REFERENCES data_conflict(id) ON DELETE SET NULL,
    CONSTRAINT fk_pending_variant_official FOREIGN KEY (mapped_official_id) REFERENCES product_variant(id) ON DELETE RESTRICT
);

CREATE TRIGGER trg_pending_variant_updated_at
BEFORE UPDATE ON pending_variant
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE conflict_resolution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_id UUID NOT NULL,
    decision VARCHAR(16) NOT NULL,
    note TEXT,
    resolved_by INTEGER,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_conflict_resolution_decision CHECK (decision IN ('keep_existing', 'overwrite', 'merge', 'manual_edit', 'skip')),
    CONSTRAINT fk_conflict_resolution_conflict FOREIGN KEY (conflict_id) REFERENCES data_conflict(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_conflict_resolution_updated_at
BEFORE UPDATE ON conflict_resolution
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE import_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL,
    external_code VARCHAR(128) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    official_id TEXT NOT NULL,
    decision VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_import_mapping_decision CHECK (decision IN ('created_new', 'updated_existing', 'merged', 'skipped')),
    CONSTRAINT chk_import_mapping_external_code_not_blank CHECK (btrim(external_code) <> ''),
    CONSTRAINT chk_import_mapping_entity_type_not_blank CHECK (btrim(entity_type) <> ''),
    CONSTRAINT chk_import_mapping_official_id_not_blank CHECK (btrim(official_id) <> ''),
    CONSTRAINT fk_import_mapping_batch FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_import_mapping_updated_at
BEFORE UPDATE ON import_mapping
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

CREATE TABLE import_error_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL,
    raw_data_id UUID,
    error_code VARCHAR(32) NOT NULL,
    error_message TEXT NOT NULL,
    severity VARCHAR(8) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_import_error_log_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT chk_import_error_log_error_code_not_blank CHECK (btrim(error_code) <> ''),
    CONSTRAINT chk_import_error_log_message_not_blank CHECK (btrim(error_message) <> ''),
    CONSTRAINT fk_import_error_log_batch FOREIGN KEY (import_batch_id) REFERENCES import_batch(id) ON DELETE CASCADE,
    CONSTRAINT fk_import_error_log_raw_data FOREIGN KEY (raw_data_id) REFERENCES raw_data(id) ON DELETE SET NULL
);

CREATE TRIGGER trg_import_error_log_updated_at
BEFORE UPDATE ON import_error_log
FOR EACH ROW EXECUTE FUNCTION st_set_updated_at();

-- =========================================================
-- Suggested indexes
-- =========================================================

CREATE INDEX idx_company_social_link_company_info ON company_social_link(company_info_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_menu_status ON menu(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_menu_item_menu_parent ON menu_item(menu_id, parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_news_category_active_sort ON news_category(sort_order, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_page_content_workflow ON page_content(review_status, publish_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_page_content_content_type ON page_content(content_type);
CREATE INDEX idx_page_content_news_category_id ON page_content(news_category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_page_content_published_at ON page_content(published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX idx_page_content_is_featured ON page_content(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_service_workflow ON service(review_status, publish_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_workflow ON project(review_status, publish_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_project_gallery_project_order ON project_gallery(project_id, sort_order, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_redirect_rule_status ON redirect_rule(status) WHERE deleted_at IS NULL;

CREATE INDEX idx_product_category_parent ON product_category(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_brand_status ON brand(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_brand_primary_category ON brand(primary_category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_brand_page_brand ON brand_page(brand_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_brand_page_public ON brand_page(brand_id, review_status, publish_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_brand_page_stat_page ON brand_page_stat(brand_page_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_brand_page_source_page ON brand_page_source(brand_page_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_brand_page_featured_page ON brand_page_featured_product_group(brand_page_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_group_category ON product_group(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_group_brand ON product_group(brand_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_group_status_workflow ON product_group(status, review_status, publish_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_group_view_count ON product_group(view_count DESC, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_group_daily_view_date ON product_group_daily_view(view_date DESC);
CREATE INDEX idx_site_daily_view_date ON site_daily_view(view_date DESC);
CREATE INDEX idx_product_variant_group ON product_variant(product_group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_variant_status_workflow ON product_variant(status, review_status, publish_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_variant_price_mode ON product_variant(public_price_mode) WHERE deleted_at IS NULL;
CREATE INDEX idx_variant_attribute_variant ON variant_attribute(product_variant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_spec_group_group ON spec_group(product_group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_spec_group ON product_spec(spec_group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_variant_spec_group_variant ON variant_spec_group(product_variant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_variant_spec_group ON variant_spec(variant_spec_group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_highlight_spec_group_default ON product_highlight_spec(product_group_id, sort_order, created_at) WHERE product_variant_id IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_product_highlight_spec_variant ON product_highlight_spec(product_variant_id, sort_order, created_at) WHERE product_variant_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_product_highlight_spec_active_source ON product_highlight_spec(product_group_id, COALESCE(product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid), source_type, source_id) WHERE deleted_at IS NULL AND source_id IS NOT NULL;
CREATE INDEX idx_technical_document_group_public ON technical_document(product_group_id, is_public) WHERE deleted_at IS NULL;
CREATE INDEX idx_technical_document_group_variant ON technical_document(product_group_id, product_variant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_image_group ON product_image(product_group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_image_group_variant_order ON product_image(product_group_id, product_variant_id, sort_order, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_image_variant ON product_image(product_variant_id) WHERE product_variant_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_product_image_active_group_file ON product_image(product_group_id, file_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_contact_request_status_assigned_created ON contact_request(status, assigned_to, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_quote_request_status_assigned_created ON quote_request(status, assigned_to, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_quote_item_quote ON quote_item(quote_request_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_actor_created ON audit_log(actor_id, created_at);

CREATE INDEX idx_import_batch_status_created ON import_batch(status, created_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_import_mapping_profile_signature_active ON import_mapping_profile(header_signature) WHERE deleted_at IS NULL;
CREATE INDEX idx_raw_data_batch_status ON raw_data(import_batch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_data_conflict_batch_status ON data_conflict(import_batch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_pending_product_group_batch_status ON pending_product_group(import_batch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_pending_variant_batch_status ON pending_variant(import_batch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_import_mapping_external_code ON import_mapping(external_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_import_error_log_batch_severity ON import_error_log(import_batch_id, severity) WHERE deleted_at IS NULL;

CREATE INDEX idx_file_usage_file ON file_usage(file_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_file_metadata_orphan ON file_metadata(is_orphan) WHERE deleted_at IS NULL;

-- =========================================================
-- End of schema
-- =========================================================
