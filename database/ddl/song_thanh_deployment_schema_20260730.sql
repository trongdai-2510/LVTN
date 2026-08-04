--
-- PostgreSQL database dump
--

\restrict YS1y5u7uG5eRkkIsr2F956pFO1wpXQm7ecnLZxa6AKyma0aReyi1S1abY7xIkGX

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: st_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.st_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: st_sync_public_workflow_on_soft_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.st_sync_public_workflow_on_soft_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: st_sync_status_on_soft_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.st_sync_status_on_soft_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_permission (
    id uuid NOT NULL,
    code text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: admin_refresh_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_refresh_session (
    id uuid NOT NULL,
    admin_user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: admin_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_role (
    id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_admin_role_status CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: admin_role_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_role_permission (
    admin_role_id uuid NOT NULL,
    admin_permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: admin_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_user (
    id uuid NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    display_name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_admin_user_status CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'locked'::text])))
);


--
-- Name: admin_user_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_user_role (
    admin_user_id uuid NOT NULL,
    admin_role_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type character varying(64) NOT NULL,
    entity_id text NOT NULL,
    actor_id text,
    action character varying(32) NOT NULL,
    old_value jsonb,
    new_value jsonb,
    changed_fields text[],
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_audit_log_action CHECK (((action)::text = ANY ((ARRAY['create'::character varying, 'update'::character varying, 'soft_delete'::character varying, 'restore'::character varying, 'approve'::character varying, 'publish'::character varying, 'archive'::character varying, 'apply_import'::character varying, 'resolve_conflict'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT chk_audit_log_entity_id_not_blank CHECK ((btrim(entity_id) <> ''::text)),
    CONSTRAINT chk_audit_log_entity_type_not_blank CHECK ((btrim((entity_type)::text) <> ''::text))
);


--
-- Name: banner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banner (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "position" character varying(32) NOT NULL,
    title character varying(255) NOT NULL,
    image_file_id uuid NOT NULL,
    link_type character varying(16) NOT NULL,
    link_target text,
    sort_order smallint DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    description character varying(500),
    content_position character varying(16) DEFAULT 'bot-left'::character varying NOT NULL,
    image_mobile_file_id uuid,
    cta_buttons jsonb,
    notes text,
    title_size character varying(10) DEFAULT 'large'::character varying NOT NULL,
    title_color character varying(7) DEFAULT '#ffffff'::character varying NOT NULL,
    description_color character varying(7) DEFAULT '#ffffff'::character varying NOT NULL,
    display_mode character varying(20) DEFAULT 'content_overlay'::character varying NOT NULL,
    CONSTRAINT chk_banner_content_position CHECK (((content_position)::text = ANY ((ARRAY['top-left'::character varying, 'top-center'::character varying, 'top-right'::character varying, 'mid-left'::character varying, 'mid-center'::character varying, 'mid-right'::character varying, 'bot-left'::character varying, 'bot-center'::character varying, 'bot-right'::character varying])::text[]))),
    CONSTRAINT chk_banner_description_color_hex CHECK (((description_color)::text ~* '^#[0-9a-f]{6}$'::text)),
    CONSTRAINT chk_banner_display_mode CHECK (((display_mode)::text = ANY ((ARRAY['image_only'::character varying, 'content_overlay'::character varying])::text[]))),
    CONSTRAINT chk_banner_link_type CHECK (((link_type)::text = ANY ((ARRAY['internal'::character varying, 'external'::character varying, 'anchor'::character varying, 'none'::character varying])::text[]))),
    CONSTRAINT chk_banner_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT chk_banner_target_required CHECK (((((link_type)::text = 'none'::text) AND (link_target IS NULL)) OR (((link_type)::text <> 'none'::text) AND (link_target IS NOT NULL) AND (btrim(link_target) <> ''::text)))),
    CONSTRAINT chk_banner_title_color_hex CHECK (((title_color)::text ~* '^#[0-9a-f]{6}$'::text)),
    CONSTRAINT chk_banner_title_not_blank CHECK ((btrim((title)::text) <> ''::text)),
    CONSTRAINT chk_banner_title_size CHECK (((title_size)::text = ANY ((ARRAY['small'::character varying, 'medium'::character varying, 'large'::character varying])::text[])))
);


--
-- Name: brand; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    logo_file_id uuid,
    description text,
    website_url text,
    sort_order smallint DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    primary_category_id uuid,
    CONSTRAINT chk_brand_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_brand_slug_format CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT chk_brand_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: brand_page; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_page (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    excerpt text,
    overview_title character varying(255),
    overview_body text,
    support_title character varying(255),
    support_intro text,
    support_items jsonb,
    support_image_file_id uuid,
    hero_banner_id uuid,
    cta_title character varying(255),
    cta_description text,
    cta_button_label character varying(120),
    cta_button_url text,
    review_status character varying(24) DEFAULT 'draft'::character varying NOT NULL,
    publish_status character varying(16) DEFAULT 'unpublished'::character varying NOT NULL,
    seo_title character varying(255),
    seo_description character varying(512),
    seo_og_image_file_id uuid,
    created_by integer,
    updated_by integer,
    approved_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    hero_title_size character varying(16) DEFAULT 'large'::character varying NOT NULL,
    hero_excerpt_size character varying(16) DEFAULT 'large'::character varying NOT NULL,
    hero_eyebrow_color character varying(16),
    hero_title_color character varying(16),
    hero_excerpt_color character varying(16),
    accent_color character varying(16),
    layout_archetype character varying(24) DEFAULT 'auto'::character varying NOT NULL,
    CONSTRAINT chk_brand_page_accent_color CHECK (((accent_color IS NULL) OR ((accent_color)::text ~ '^#[0-9A-Fa-f]{6}$'::text))),
    CONSTRAINT chk_brand_page_hero_excerpt_color CHECK (((hero_excerpt_color IS NULL) OR ((hero_excerpt_color)::text ~ '^#[0-9A-Fa-f]{6}$'::text))),
    CONSTRAINT chk_brand_page_hero_excerpt_size CHECK (((hero_excerpt_size)::text = ANY ((ARRAY['medium'::character varying, 'large'::character varying])::text[]))),
    CONSTRAINT chk_brand_page_hero_eyebrow_color CHECK (((hero_eyebrow_color IS NULL) OR ((hero_eyebrow_color)::text ~ '^#[0-9A-Fa-f]{6}$'::text))),
    CONSTRAINT chk_brand_page_hero_title_color CHECK (((hero_title_color IS NULL) OR ((hero_title_color)::text ~ '^#[0-9A-Fa-f]{6}$'::text))),
    CONSTRAINT chk_brand_page_hero_title_size CHECK (((hero_title_size)::text = ANY ((ARRAY['medium'::character varying, 'large'::character varying, 'xlarge'::character varying])::text[]))),
    CONSTRAINT chk_brand_page_layout_archetype CHECK (((layout_archetype)::text = ANY ((ARRAY['auto'::character varying, 'international'::character varying, 'domestic'::character varying, 'minimal'::character varying])::text[]))),
    CONSTRAINT chk_brand_page_publish_status CHECK (((publish_status)::text = ANY ((ARRAY['unpublished'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT chk_brand_page_review_status CHECK (((review_status)::text = ANY ((ARRAY['draft'::character varying, 'pending_review'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT chk_brand_page_title_not_blank CHECK ((btrim((title)::text) <> ''::text))
);


--
-- Name: brand_page_featured_product_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_page_featured_product_group (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_page_id uuid NOT NULL,
    product_group_id uuid NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: brand_page_source; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_page_source (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_page_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    source_type character varying(32) DEFAULT 'other'::character varying NOT NULL,
    url text,
    file_id uuid,
    description text,
    sort_order smallint DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_brand_page_source_has_ref CHECK ((((url IS NOT NULL) AND (btrim(url) <> ''::text)) OR (file_id IS NOT NULL))),
    CONSTRAINT chk_brand_page_source_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT chk_brand_page_source_title_not_blank CHECK ((btrim((title)::text) <> ''::text)),
    CONSTRAINT chk_brand_page_source_type CHECK (((source_type)::text = ANY ((ARRAY['website'::character varying, 'catalogue'::character varying, 'certificate'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: brand_page_stat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_page_stat (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_page_id uuid NOT NULL,
    value character varying(80) NOT NULL,
    label character varying(160) NOT NULL,
    note text,
    source_url text,
    source_file_id uuid,
    is_verified boolean DEFAULT false NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_brand_page_stat_label_not_blank CHECK ((btrim((label)::text) <> ''::text)),
    CONSTRAINT chk_brand_page_stat_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT chk_brand_page_stat_value_not_blank CHECK ((btrim((value)::text) <> ''::text))
);


--
-- Name: certificate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    file_id uuid,
    image_file_id uuid,
    issued_date date,
    expires_date date,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_certificate_dates CHECK (((expires_date IS NULL) OR (issued_date IS NULL) OR (expires_date >= issued_date))),
    CONSTRAINT chk_certificate_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT chk_certificate_title_not_blank CHECK ((btrim((title)::text) <> ''::text))
);


--
-- Name: company_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_info (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name character varying(255) NOT NULL,
    legal_name character varying(255) NOT NULL,
    hotline character varying(32) NOT NULL,
    email character varying(128) NOT NULL,
    address text NOT NULL,
    map_embed_code text,
    working_hours_from time without time zone,
    working_hours_to time without time zone,
    logo_file_id uuid,
    favicon_file_id uuid,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    hotlines jsonb DEFAULT '[]'::jsonb,
    working_days character varying(100),
    home_seo_title character varying(255),
    home_seo_description text,
    CONSTRAINT chk_company_info_display_name_not_blank CHECK ((btrim((display_name)::text) <> ''::text)),
    CONSTRAINT chk_company_info_email_format CHECK (((email)::text ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'::text)),
    CONSTRAINT chk_company_info_hotline_not_blank CHECK ((btrim((hotline)::text) <> ''::text)),
    CONSTRAINT chk_company_info_legal_name_not_blank CHECK ((btrim((legal_name)::text) <> ''::text))
);


--
-- Name: company_social_link; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_social_link (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_info_id uuid NOT NULL,
    platform character varying(32) NOT NULL,
    label character varying(64) NOT NULL,
    url text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_company_social_link_label_not_blank CHECK ((btrim((label)::text) <> ''::text)),
    CONSTRAINT chk_company_social_link_platform_not_blank CHECK ((btrim((platform)::text) <> ''::text)),
    CONSTRAINT chk_company_social_link_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT chk_company_social_link_url_not_blank CHECK ((btrim(url) <> ''::text))
);


--
-- Name: conflict_resolution; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conflict_resolution (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conflict_id uuid NOT NULL,
    decision character varying(16) NOT NULL,
    note text,
    resolved_by integer,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_conflict_resolution_decision CHECK (((decision)::text = ANY ((ARRAY['keep_existing'::character varying, 'overwrite'::character varying, 'merge'::character varying, 'manual_edit'::character varying, 'skip'::character varying])::text[])))
);


--
-- Name: contact_internal_note; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_internal_note (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    note_text text NOT NULL,
    added_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_contact_internal_note_not_blank CHECK ((btrim(note_text) <> ''::text))
);


--
-- Name: contact_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(128) NOT NULL,
    phone character varying(32) NOT NULL,
    email character varying(128),
    company_name character varying(255),
    message text NOT NULL,
    source_page text,
    status character varying(16) DEFAULT 'new'::character varying NOT NULL,
    assigned_to integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    ip_address inet,
    user_agent text,
    customer_id uuid,
    CONSTRAINT chk_contact_request_email_format CHECK (((email IS NULL) OR ((email)::text ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'::text))),
    CONSTRAINT chk_contact_request_name_not_blank CHECK ((btrim((full_name)::text) <> ''::text)),
    CONSTRAINT chk_contact_request_phone_not_blank CHECK ((btrim((phone)::text) <> ''::text)),
    CONSTRAINT chk_contact_request_status CHECK (((status)::text = ANY ((ARRAY['new'::character varying, 'in_progress'::character varying, 'done'::character varying, 'spam'::character varying, 'invalid'::character varying])::text[])))
);


--
-- Name: customer_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_profile (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(128) NOT NULL,
    phone character varying(32),
    email character varying(128),
    company_name character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_customer_profile_email_format CHECK (((email IS NULL) OR ((email)::text ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'::text))),
    CONSTRAINT chk_customer_profile_name_not_blank CHECK ((btrim((full_name)::text) <> ''::text))
);


--
-- Name: data_conflict; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_conflict (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_batch_id uuid NOT NULL,
    entity_type character varying(32) NOT NULL,
    entity_id text,
    conflict_type character varying(32) NOT NULL,
    existing_data jsonb,
    incoming_data jsonb,
    status character varying(16) DEFAULT 'open'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_data_conflict_entity_type_not_blank CHECK ((btrim((entity_type)::text) <> ''::text)),
    CONSTRAINT chk_data_conflict_status CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'resolved'::character varying, 'skipped'::character varying])::text[]))),
    CONSTRAINT chk_data_conflict_type_not_blank CHECK ((btrim((conflict_type)::text) <> ''::text))
);


--
-- Name: file_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_filename text NOT NULL,
    stored_path text NOT NULL,
    file_size bigint NOT NULL,
    mime_type character varying(128) NOT NULL,
    storage_location character varying(32) NOT NULL,
    uploaded_by integer,
    is_orphan boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    purpose text DEFAULT 'other'::text NOT NULL,
    CONSTRAINT chk_file_metadata_name_not_blank CHECK ((btrim(original_filename) <> ''::text)),
    CONSTRAINT chk_file_metadata_path_not_blank CHECK ((btrim(stored_path) <> ''::text)),
    CONSTRAINT chk_file_metadata_purpose CHECK ((purpose = ANY (ARRAY['product_image'::text, 'brand_logo'::text, 'banner'::text, 'technical_document'::text, 'import_file'::text, 'website_config'::text, 'other'::text]))),
    CONSTRAINT chk_file_metadata_storage_location CHECK (((storage_location)::text = ANY ((ARRAY['local'::character varying, 'r2'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT file_metadata_file_size_check CHECK ((file_size >= 0))
);


--
-- Name: file_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_id uuid NOT NULL,
    entity_type character varying(64) NOT NULL,
    entity_id uuid NOT NULL,
    field_name character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_file_usage_entity_type_not_blank CHECK ((btrim((entity_type)::text) <> ''::text)),
    CONSTRAINT chk_file_usage_field_name_not_blank CHECK ((btrim((field_name)::text) <> ''::text))
);


--
-- Name: home_section; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_section (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_type character varying(48) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    sort_order smallint NOT NULL,
    title_override character varying(255),
    subtitle character varying(512),
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_home_section_type CHECK (((section_type)::text = ANY ((ARRAY['hero'::character varying, 'product_categories'::character varying, 'company_overview'::character varying, 'featured_products'::character varying, 'services'::character varying, 'projects'::character varying, 'brands'::character varying, 'trust_strip'::character varying, 'contact_cta'::character varying])::text[])))
);


--
-- Name: import_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_batch (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_name character varying(255),
    source_file_name text NOT NULL,
    source_file_id uuid NOT NULL,
    uploaded_by integer,
    status character varying(16) DEFAULT 'created'::character varying NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    conflict_count integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    validated_at timestamp with time zone,
    applied_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    deleted_at timestamp with time zone,
    selected_row_ranges jsonb,
    column_mapping jsonb,
    CONSTRAINT chk_import_batch_source_file_name_not_blank CHECK ((btrim(source_file_name) <> ''::text)),
    CONSTRAINT chk_import_batch_status CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'validated'::character varying, 'in_review'::character varying, 'ready_to_apply'::character varying, 'applied'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT import_batch_conflict_count_check CHECK ((conflict_count >= 0)),
    CONSTRAINT import_batch_error_count_check CHECK ((error_count >= 0)),
    CONSTRAINT import_batch_total_rows_check CHECK ((total_rows >= 0))
);


--
-- Name: import_error_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_error_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_batch_id uuid NOT NULL,
    raw_data_id uuid,
    error_code character varying(32) NOT NULL,
    error_message text NOT NULL,
    severity character varying(8) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_import_error_log_error_code_not_blank CHECK ((btrim((error_code)::text) <> ''::text)),
    CONSTRAINT chk_import_error_log_message_not_blank CHECK ((btrim(error_message) <> ''::text)),
    CONSTRAINT chk_import_error_log_severity CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))
);


--
-- Name: import_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_mapping (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_batch_id uuid NOT NULL,
    external_code character varying(128) NOT NULL,
    entity_type character varying(32) NOT NULL,
    official_id text NOT NULL,
    decision character varying(16) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_import_mapping_decision CHECK (((decision)::text = ANY ((ARRAY['created_new'::character varying, 'updated_existing'::character varying, 'merged'::character varying, 'skipped'::character varying])::text[]))),
    CONSTRAINT chk_import_mapping_entity_type_not_blank CHECK ((btrim((entity_type)::text) <> ''::text)),
    CONSTRAINT chk_import_mapping_external_code_not_blank CHECK ((btrim((external_code)::text) <> ''::text)),
    CONSTRAINT chk_import_mapping_official_id_not_blank CHECK ((btrim(official_id) <> ''::text))
);


--
-- Name: import_mapping_profile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_mapping_profile (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_name character varying(160) NOT NULL,
    header_signature character varying(1000) NOT NULL,
    normalized_headers jsonb NOT NULL,
    mapping_config jsonb NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_import_mapping_profile_name_not_blank CHECK ((btrim((profile_name)::text) <> ''::text))
);


--
-- Name: knex_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knex_migrations_id_seq OWNED BY public.knex_migrations.id;


--
-- Name: knex_migrations_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knex_migrations_lock (
    index integer NOT NULL,
    is_locked integer
);


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_lock_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNED BY public.knex_migrations_lock.index;


--
-- Name: menu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(128) NOT NULL,
    "position" character varying(32) NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_menu_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_menu_position CHECK ((("position")::text = ANY ((ARRAY['header'::character varying, 'footer_quick'::character varying, 'footer_support'::character varying, 'footer_legal'::character varying, 'mobile'::character varying])::text[]))),
    CONSTRAINT chk_menu_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: menu_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    menu_id uuid NOT NULL,
    parent_id uuid,
    title character varying(128) NOT NULL,
    link_type character varying(16) NOT NULL,
    link_target text,
    sort_order smallint DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    open_in_new_tab boolean DEFAULT false NOT NULL,
    icon_name character varying(64),
    description character varying(255),
    CONSTRAINT chk_menu_item_link_type CHECK (((link_type)::text = ANY ((ARRAY['internal'::character varying, 'external'::character varying, 'anchor'::character varying, 'group'::character varying])::text[]))),
    CONSTRAINT chk_menu_item_not_self_parent CHECK (((parent_id IS NULL) OR (parent_id <> id))),
    CONSTRAINT chk_menu_item_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT chk_menu_item_target_required CHECK (((((link_type)::text = 'group'::text) AND (link_target IS NULL)) OR (((link_type)::text <> 'group'::text) AND (link_target IS NOT NULL) AND (btrim(link_target) <> ''::text)))),
    CONSTRAINT chk_menu_item_title_not_blank CHECK ((btrim((title)::text) <> ''::text))
);


--
-- Name: news_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_category (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_news_category_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_news_category_slug_format CHECK (((slug)::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT chk_news_category_sort_order_non_negative CHECK ((sort_order >= 0))
);


--
-- Name: page_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    excerpt text,
    content_html text,
    featured_image_file_id uuid,
    review_status character varying(24) DEFAULT 'draft'::character varying NOT NULL,
    publish_status character varying(16) DEFAULT 'unpublished'::character varying NOT NULL,
    seo_title character varying(255),
    seo_description character varying(512),
    seo_og_image_file_id uuid,
    created_by integer,
    updated_by integer,
    approved_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    content_type character varying(20) DEFAULT 'page'::character varying NOT NULL,
    news_category_id uuid,
    published_at timestamp with time zone,
    is_featured boolean DEFAULT false NOT NULL,
    extra_blocks jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT chk_page_content_content_type CHECK (((content_type)::text = ANY ((ARRAY['page'::character varying, 'news'::character varying])::text[]))),
    CONSTRAINT chk_page_content_publish_status CHECK (((publish_status)::text = ANY ((ARRAY['unpublished'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT chk_page_content_review_status CHECK (((review_status)::text = ANY ((ARRAY['draft'::character varying, 'pending_review'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT chk_page_content_slug_format CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT chk_page_content_title_not_blank CHECK ((btrim((title)::text) <> ''::text))
);


--
-- Name: partner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    logo_file_id uuid,
    website_url text,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_partner_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_partner_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: pending_product_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_product_group (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_batch_id uuid NOT NULL,
    external_code character varying(128),
    product_name text NOT NULL,
    category_name text,
    brand_name text,
    short_description text,
    status character varying(16) DEFAULT 'pending_review'::character varying NOT NULL,
    conflict_id uuid,
    mapped_official_id uuid,
    review_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    applied_at timestamp with time zone,
    deleted_at timestamp with time zone,
    main_category_name text,
    CONSTRAINT chk_pending_product_group_name_not_blank CHECK ((btrim(product_name) <> ''::text)),
    CONSTRAINT chk_pending_product_group_status CHECK (((status)::text = ANY ((ARRAY['pending_review'::character varying, 'approved'::character varying, 'rejected'::character varying, 'applied'::character varying])::text[])))
);


--
-- Name: pending_variant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_variant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_batch_id uuid NOT NULL,
    pending_product_group_id uuid NOT NULL,
    external_code character varying(128),
    sku character varying(128),
    model_code character varying(128),
    variant_name text NOT NULL,
    status character varying(16) DEFAULT 'pending_review'::character varying NOT NULL,
    conflict_id uuid,
    mapped_official_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_at timestamp with time zone,
    deleted_at timestamp with time zone,
    public_price_mode character varying(32) DEFAULT 'contact_for_quote'::character varying NOT NULL,
    public_price_amount integer,
    CONSTRAINT chk_pending_variant_name_not_blank CHECK ((btrim(variant_name) <> ''::text)),
    CONSTRAINT chk_pending_variant_public_price CHECK (((((public_price_mode)::text = 'public_price'::text) AND (public_price_amount IS NOT NULL) AND (public_price_amount > 0) AND (public_price_amount <= 2147483647)) OR (((public_price_mode)::text = 'contact_for_quote'::text) AND (public_price_amount IS NULL)))),
    CONSTRAINT chk_pending_variant_public_price_mode CHECK (((public_price_mode)::text = ANY ((ARRAY['public_price'::character varying, 'contact_for_quote'::character varying])::text[]))),
    CONSTRAINT chk_pending_variant_status CHECK (((status)::text = ANY ((ARRAY['pending_review'::character varying, 'approved'::character varying, 'rejected'::character varying, 'applied'::character varying])::text[])))
);


--
-- Name: product_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_category (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    parent_id uuid,
    description text,
    icon_file_id uuid,
    sort_order smallint DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_product_category_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_product_category_not_self_parent CHECK (((parent_id IS NULL) OR (parent_id <> id))),
    CONSTRAINT chk_product_category_slug_format CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT chk_product_category_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: product_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_group (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    category_id uuid NOT NULL,
    brand_id uuid,
    short_description text,
    detailed_description text,
    thumbnail_file_id uuid,
    review_status character varying(24) DEFAULT 'draft'::character varying NOT NULL,
    publish_status character varying(16) DEFAULT 'unpublished'::character varying NOT NULL,
    seo_title character varying(255),
    seo_description character varying(512),
    seo_og_image_file_id uuid,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    updated_by integer,
    approved_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    view_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT chk_product_group_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_product_group_publish_status CHECK (((publish_status)::text = ANY ((ARRAY['unpublished'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT chk_product_group_review_status CHECK (((review_status)::text = ANY ((ARRAY['draft'::character varying, 'pending_review'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT chk_product_group_slug_format CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT chk_product_group_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT chk_product_group_view_count_non_negative CHECK ((view_count >= 0))
);


--
-- Name: product_group_daily_view; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_group_daily_view (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_group_id uuid NOT NULL,
    view_date date NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_product_group_daily_view_count CHECK ((view_count >= 0))
);


--
-- Name: product_group_tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_group_tag (
    product_group_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: product_highlight_spec; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_highlight_spec (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_group_id uuid NOT NULL,
    product_variant_id uuid,
    source_type character varying(32) DEFAULT 'manual'::character varying NOT NULL,
    source_id uuid,
    display_label character varying(128) NOT NULL,
    display_value text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_product_highlight_spec_label_not_blank CHECK ((btrim((display_label)::text) <> ''::text)),
    CONSTRAINT chk_product_highlight_spec_source_trace CHECK (((((source_type)::text = 'manual'::text) AND (source_id IS NULL)) OR (((source_type)::text <> 'manual'::text) AND (source_id IS NOT NULL)))),
    CONSTRAINT chk_product_highlight_spec_source_type CHECK (((source_type)::text = ANY ((ARRAY['product_spec'::character varying, 'variant_spec'::character varying, 'variant_attribute'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT chk_product_highlight_spec_value_not_blank CHECK ((btrim(display_value) <> ''::text))
);


--
-- Name: product_image; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_image (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_group_id uuid NOT NULL,
    file_id uuid NOT NULL,
    alt_text character varying(255),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    product_variant_id uuid
);


--
-- Name: product_spec; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_spec (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    spec_group_id uuid NOT NULL,
    spec_name character varying(128) NOT NULL,
    spec_value text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_product_spec_name_not_blank CHECK ((btrim((spec_name)::text) <> ''::text)),
    CONSTRAINT chk_product_spec_value_not_blank CHECK ((btrim(spec_value) <> ''::text))
);


--
-- Name: product_variant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variant (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_group_id uuid NOT NULL,
    external_code character varying(128),
    sku character varying(128) NOT NULL,
    model_code character varying(128),
    variant_name character varying(255) NOT NULL,
    review_status character varying(24) DEFAULT 'draft'::character varying NOT NULL,
    publish_status character varying(16) DEFAULT 'unpublished'::character varying NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    public_price_mode character varying(32) DEFAULT 'contact_for_quote'::character varying NOT NULL,
    public_price_amount integer,
    detailed_description text,
    CONSTRAINT chk_product_variant_public_price CHECK (((((public_price_mode)::text = 'public_price'::text) AND (public_price_amount IS NOT NULL) AND (public_price_amount > 0) AND (public_price_amount <= 2147483647)) OR (((public_price_mode)::text = 'contact_for_quote'::text) AND (public_price_amount IS NULL)))),
    CONSTRAINT chk_product_variant_public_price_mode CHECK (((public_price_mode)::text = ANY ((ARRAY['public_price'::character varying, 'contact_for_quote'::character varying])::text[]))),
    CONSTRAINT chk_product_variant_publish_status CHECK (((publish_status)::text = ANY ((ARRAY['unpublished'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT chk_product_variant_review_status CHECK (((review_status)::text = ANY ((ARRAY['draft'::character varying, 'pending_review'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT chk_product_variant_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT chk_product_variant_variant_name_not_blank CHECK ((btrim((variant_name)::text) <> ''::text))
);


--
-- Name: project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    location character varying(255),
    project_year smallint,
    description text,
    image_file_id uuid,
    review_status character varying(24) DEFAULT 'draft'::character varying NOT NULL,
    publish_status character varying(16) DEFAULT 'unpublished'::character varying NOT NULL,
    seo_title character varying(255),
    seo_description character varying(512),
    seo_og_image_file_id uuid,
    created_by integer,
    updated_by integer,
    approved_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    content_html text,
    client_name character varying(200),
    CONSTRAINT chk_project_publish_status CHECK (((publish_status)::text = ANY ((ARRAY['unpublished'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT chk_project_review_status CHECK (((review_status)::text = ANY ((ARRAY['draft'::character varying, 'pending_review'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT chk_project_slug_format CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT chk_project_title_not_blank CHECK ((btrim((title)::text) <> ''::text)),
    CONSTRAINT chk_project_year_range CHECK (((project_year IS NULL) OR ((project_year >= 1900) AND (project_year <= 2100))))
);


--
-- Name: project_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_gallery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    file_id uuid NOT NULL,
    alt_text character varying(255),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_project_gallery_sort_order_non_negative CHECK ((sort_order >= 0))
);


--
-- Name: project_product_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_product_group (
    project_id uuid NOT NULL,
    product_group_id uuid NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: quote_internal_note; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_internal_note (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    note_text text NOT NULL,
    added_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_quote_internal_note_not_blank CHECK ((btrim(note_text) <> ''::text))
);


--
-- Name: quote_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_request_id uuid NOT NULL,
    product_group_id uuid NOT NULL,
    product_variant_id uuid,
    quantity integer,
    notes text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT quote_item_quantity_check CHECK (((quantity IS NULL) OR (quantity > 0)))
);


--
-- Name: quote_request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(128) NOT NULL,
    company_name character varying(255),
    phone character varying(32) NOT NULL,
    email character varying(128),
    address text,
    message text,
    status character varying(16) DEFAULT 'new'::character varying NOT NULL,
    assigned_to integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    ip_address inet,
    user_agent text,
    customer_id uuid,
    CONSTRAINT chk_quote_request_email_format CHECK (((email IS NULL) OR ((email)::text ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'::text))),
    CONSTRAINT chk_quote_request_name_not_blank CHECK ((btrim((full_name)::text) <> ''::text)),
    CONSTRAINT chk_quote_request_phone_not_blank CHECK ((btrim((phone)::text) <> ''::text)),
    CONSTRAINT chk_quote_request_status CHECK (((status)::text = ANY ((ARRAY['new'::character varying, 'in_progress'::character varying, 'done'::character varying, 'spam'::character varying, 'invalid'::character varying])::text[])))
);


--
-- Name: raw_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_batch_id uuid NOT NULL,
    row_number integer NOT NULL,
    external_code character varying(128),
    raw_content jsonb NOT NULL,
    status character varying(16) DEFAULT 'new'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_raw_data_status CHECK (((status)::text = ANY ((ARRAY['new'::character varying, 'parsed'::character varying, 'error'::character varying, 'ignored'::character varying])::text[]))),
    CONSTRAINT raw_data_row_number_check CHECK ((row_number > 0))
);


--
-- Name: redirect_rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redirect_rule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_path text NOT NULL,
    to_path text NOT NULL,
    redirect_type smallint DEFAULT 301 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_redirect_not_self CHECK ((from_path <> to_path)),
    CONSTRAINT chk_redirect_paths_not_blank CHECK (((btrim(from_path) <> ''::text) AND (btrim(to_path) <> ''::text))),
    CONSTRAINT chk_redirect_paths_start_slash CHECK ((("left"(from_path, 1) = '/'::text) AND ("left"(to_path, 1) = '/'::text))),
    CONSTRAINT chk_redirect_rule_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT chk_redirect_type CHECK ((redirect_type = ANY (ARRAY[301, 302])))
);


--
-- Name: service; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    image_file_id uuid,
    review_status character varying(24) DEFAULT 'draft'::character varying NOT NULL,
    publish_status character varying(16) DEFAULT 'unpublished'::character varying NOT NULL,
    seo_title character varying(255),
    seo_description character varying(512),
    seo_og_image_file_id uuid,
    created_by integer,
    updated_by integer,
    approved_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    content_html text,
    subtitle character varying(220),
    when_to_contact text,
    deliverables jsonb DEFAULT '[]'::jsonb NOT NULL,
    typical_duration character varying(120),
    sort_order integer DEFAULT 1000 NOT NULL,
    icon_key character varying(40),
    CONSTRAINT chk_service_publish_status CHECK (((publish_status)::text = ANY ((ARRAY['unpublished'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT chk_service_review_status CHECK (((review_status)::text = ANY ((ARRAY['draft'::character varying, 'pending_review'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT chk_service_slug_format CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT chk_service_title_not_blank CHECK ((btrim((title)::text) <> ''::text))
);


--
-- Name: service_product_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_product_group (
    service_id uuid NOT NULL,
    product_group_id uuid NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: site_daily_view; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_daily_view (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    view_date date NOT NULL,
    view_count bigint DEFAULT '0'::bigint NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_site_daily_view_count CHECK ((view_count >= 0))
);


--
-- Name: spec_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spec_group (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_group_id uuid NOT NULL,
    group_name character varying(128) NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_spec_group_name_not_blank CHECK ((btrim((group_name)::text) <> ''::text))
);


--
-- Name: tag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(64) NOT NULL,
    slug character varying(64) NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_tag_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_tag_slug_format CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT chk_tag_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: technical_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technical_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_group_id uuid NOT NULL,
    document_name character varying(255) NOT NULL,
    document_type character varying(32) NOT NULL,
    file_id uuid NOT NULL,
    version character varying(32),
    is_public boolean DEFAULT false NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    product_variant_id uuid,
    CONSTRAINT chk_technical_document_name_not_blank CHECK ((btrim((document_name)::text) <> ''::text)),
    CONSTRAINT chk_technical_document_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT chk_technical_document_type CHECK (((document_type)::text = ANY ((ARRAY['datasheet'::character varying, 'manual'::character varying, 'catalogue'::character varying, 'certificate'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: variant_attribute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_attribute (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_variant_id uuid NOT NULL,
    attribute_name character varying(128) NOT NULL,
    attribute_value text NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_variant_attribute_name_not_blank CHECK ((btrim((attribute_name)::text) <> ''::text)),
    CONSTRAINT chk_variant_attribute_value_not_blank CHECK ((btrim(attribute_value) <> ''::text))
);


--
-- Name: variant_spec; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_spec (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variant_spec_group_id uuid NOT NULL,
    spec_name character varying(128) NOT NULL,
    spec_value text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_variant_spec_name_not_blank CHECK ((btrim((spec_name)::text) <> ''::text)),
    CONSTRAINT chk_variant_spec_value_not_blank CHECK ((btrim(spec_value) <> ''::text))
);


--
-- Name: variant_spec_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_spec_group (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_variant_id uuid NOT NULL,
    group_name character varying(128) NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_variant_spec_group_name_not_blank CHECK ((btrim((group_name)::text) <> ''::text))
);


--
-- Name: knex_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations ALTER COLUMN id SET DEFAULT nextval('public.knex_migrations_id_seq'::regclass);


--
-- Name: knex_migrations_lock index; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations_lock ALTER COLUMN index SET DEFAULT nextval('public.knex_migrations_lock_index_seq'::regclass);


--
-- Name: admin_permission admin_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permission
    ADD CONSTRAINT admin_permission_pkey PRIMARY KEY (id);


--
-- Name: admin_refresh_session admin_refresh_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_refresh_session
    ADD CONSTRAINT admin_refresh_session_pkey PRIMARY KEY (id);


--
-- Name: admin_role_permission admin_role_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_role_permission
    ADD CONSTRAINT admin_role_permission_pkey PRIMARY KEY (admin_role_id, admin_permission_id);


--
-- Name: admin_role admin_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_role
    ADD CONSTRAINT admin_role_pkey PRIMARY KEY (id);


--
-- Name: admin_user admin_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_user
    ADD CONSTRAINT admin_user_pkey PRIMARY KEY (id);


--
-- Name: admin_user_role admin_user_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_user_role
    ADD CONSTRAINT admin_user_role_pkey PRIMARY KEY (admin_user_id, admin_role_id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: banner banner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banner
    ADD CONSTRAINT banner_pkey PRIMARY KEY (id);


--
-- Name: brand_page_featured_product_group brand_page_featured_product_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page_featured_product_group
    ADD CONSTRAINT brand_page_featured_product_group_pkey PRIMARY KEY (id);


--
-- Name: brand_page brand_page_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page
    ADD CONSTRAINT brand_page_pkey PRIMARY KEY (id);


--
-- Name: brand_page_source brand_page_source_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page_source
    ADD CONSTRAINT brand_page_source_pkey PRIMARY KEY (id);


--
-- Name: brand_page_stat brand_page_stat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page_stat
    ADD CONSTRAINT brand_page_stat_pkey PRIMARY KEY (id);


--
-- Name: brand brand_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand
    ADD CONSTRAINT brand_pkey PRIMARY KEY (id);


--
-- Name: certificate certificate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate
    ADD CONSTRAINT certificate_pkey PRIMARY KEY (id);


--
-- Name: company_info company_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_info
    ADD CONSTRAINT company_info_pkey PRIMARY KEY (id);


--
-- Name: company_social_link company_social_link_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_social_link
    ADD CONSTRAINT company_social_link_pkey PRIMARY KEY (id);


--
-- Name: conflict_resolution conflict_resolution_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflict_resolution
    ADD CONSTRAINT conflict_resolution_pkey PRIMARY KEY (id);


--
-- Name: contact_internal_note contact_internal_note_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_internal_note
    ADD CONSTRAINT contact_internal_note_pkey PRIMARY KEY (id);


--
-- Name: contact_request contact_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_request
    ADD CONSTRAINT contact_request_pkey PRIMARY KEY (id);


--
-- Name: customer_profile customer_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profile
    ADD CONSTRAINT customer_profile_pkey PRIMARY KEY (id);


--
-- Name: data_conflict data_conflict_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_conflict
    ADD CONSTRAINT data_conflict_pkey PRIMARY KEY (id);


--
-- Name: file_metadata file_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_metadata
    ADD CONSTRAINT file_metadata_pkey PRIMARY KEY (id);


--
-- Name: file_metadata file_metadata_stored_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_metadata
    ADD CONSTRAINT file_metadata_stored_path_key UNIQUE (stored_path);


--
-- Name: file_usage file_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_usage
    ADD CONSTRAINT file_usage_pkey PRIMARY KEY (id);


--
-- Name: home_section home_section_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_section
    ADD CONSTRAINT home_section_pkey PRIMARY KEY (id);


--
-- Name: home_section home_section_section_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_section
    ADD CONSTRAINT home_section_section_type_key UNIQUE (section_type);


--
-- Name: import_batch import_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_batch
    ADD CONSTRAINT import_batch_pkey PRIMARY KEY (id);


--
-- Name: import_error_log import_error_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_error_log
    ADD CONSTRAINT import_error_log_pkey PRIMARY KEY (id);


--
-- Name: import_mapping import_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_mapping
    ADD CONSTRAINT import_mapping_pkey PRIMARY KEY (id);


--
-- Name: import_mapping_profile import_mapping_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_mapping_profile
    ADD CONSTRAINT import_mapping_profile_pkey PRIMARY KEY (id);


--
-- Name: knex_migrations_lock knex_migrations_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations_lock
    ADD CONSTRAINT knex_migrations_lock_pkey PRIMARY KEY (index);


--
-- Name: knex_migrations knex_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations
    ADD CONSTRAINT knex_migrations_pkey PRIMARY KEY (id);


--
-- Name: menu_item menu_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item
    ADD CONSTRAINT menu_item_pkey PRIMARY KEY (id);


--
-- Name: menu menu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu
    ADD CONSTRAINT menu_pkey PRIMARY KEY (id);


--
-- Name: news_category news_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_category
    ADD CONSTRAINT news_category_pkey PRIMARY KEY (id);


--
-- Name: page_content page_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_content
    ADD CONSTRAINT page_content_pkey PRIMARY KEY (id);


--
-- Name: partner partner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner
    ADD CONSTRAINT partner_pkey PRIMARY KEY (id);


--
-- Name: pending_product_group pending_product_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_product_group
    ADD CONSTRAINT pending_product_group_pkey PRIMARY KEY (id);


--
-- Name: pending_variant pending_variant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_variant
    ADD CONSTRAINT pending_variant_pkey PRIMARY KEY (id);


--
-- Name: product_category product_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_pkey PRIMARY KEY (id);


--
-- Name: product_group_daily_view product_group_daily_view_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group_daily_view
    ADD CONSTRAINT product_group_daily_view_pkey PRIMARY KEY (id);


--
-- Name: product_group product_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group
    ADD CONSTRAINT product_group_pkey PRIMARY KEY (id);


--
-- Name: product_group_tag product_group_tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group_tag
    ADD CONSTRAINT product_group_tag_pkey PRIMARY KEY (product_group_id, tag_id);


--
-- Name: product_highlight_spec product_highlight_spec_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_highlight_spec
    ADD CONSTRAINT product_highlight_spec_pkey PRIMARY KEY (id);


--
-- Name: product_image product_image_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_image
    ADD CONSTRAINT product_image_pkey PRIMARY KEY (id);


--
-- Name: product_spec product_spec_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_spec
    ADD CONSTRAINT product_spec_pkey PRIMARY KEY (id);


--
-- Name: product_variant product_variant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variant
    ADD CONSTRAINT product_variant_pkey PRIMARY KEY (id);


--
-- Name: project_gallery project_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gallery
    ADD CONSTRAINT project_gallery_pkey PRIMARY KEY (id);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);


--
-- Name: project_product_group project_product_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_product_group
    ADD CONSTRAINT project_product_group_pkey PRIMARY KEY (project_id, product_group_id);


--
-- Name: quote_internal_note quote_internal_note_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_internal_note
    ADD CONSTRAINT quote_internal_note_pkey PRIMARY KEY (id);


--
-- Name: quote_item quote_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_item
    ADD CONSTRAINT quote_item_pkey PRIMARY KEY (id);


--
-- Name: quote_request quote_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_request
    ADD CONSTRAINT quote_request_pkey PRIMARY KEY (id);


--
-- Name: raw_data raw_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_data
    ADD CONSTRAINT raw_data_pkey PRIMARY KEY (id);


--
-- Name: redirect_rule redirect_rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redirect_rule
    ADD CONSTRAINT redirect_rule_pkey PRIMARY KEY (id);


--
-- Name: service service_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT service_pkey PRIMARY KEY (id);


--
-- Name: service_product_group service_product_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_product_group
    ADD CONSTRAINT service_product_group_pkey PRIMARY KEY (service_id, product_group_id);


--
-- Name: site_daily_view site_daily_view_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_daily_view
    ADD CONSTRAINT site_daily_view_pkey PRIMARY KEY (id);


--
-- Name: spec_group spec_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spec_group
    ADD CONSTRAINT spec_group_pkey PRIMARY KEY (id);


--
-- Name: tag tag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);


--
-- Name: technical_document technical_document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technical_document
    ADD CONSTRAINT technical_document_pkey PRIMARY KEY (id);


--
-- Name: admin_permission uq_admin_permission_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permission
    ADD CONSTRAINT uq_admin_permission_code UNIQUE (code);


--
-- Name: admin_role uq_admin_role_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_role
    ADD CONSTRAINT uq_admin_role_code UNIQUE (code);


--
-- Name: admin_user uq_admin_user_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_user
    ADD CONSTRAINT uq_admin_user_email UNIQUE (email);


--
-- Name: product_group_daily_view uq_product_group_daily_view_product_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group_daily_view
    ADD CONSTRAINT uq_product_group_daily_view_product_date UNIQUE (product_group_id, view_date);


--
-- Name: site_daily_view uq_site_daily_view_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_daily_view
    ADD CONSTRAINT uq_site_daily_view_date UNIQUE (view_date);


--
-- Name: variant_attribute variant_attribute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attribute
    ADD CONSTRAINT variant_attribute_pkey PRIMARY KEY (id);


--
-- Name: variant_spec_group variant_spec_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_spec_group
    ADD CONSTRAINT variant_spec_group_pkey PRIMARY KEY (id);


--
-- Name: variant_spec variant_spec_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_spec
    ADD CONSTRAINT variant_spec_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_refresh_session_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_refresh_session_expires_at ON public.admin_refresh_session USING btree (expires_at);


--
-- Name: idx_admin_refresh_session_revoked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_refresh_session_revoked_at ON public.admin_refresh_session USING btree (revoked_at);


--
-- Name: idx_admin_refresh_session_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_refresh_session_user ON public.admin_refresh_session USING btree (admin_user_id);


--
-- Name: idx_audit_log_actor_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_actor_created ON public.audit_log USING btree (actor_id, created_at);


--
-- Name: idx_audit_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_entity ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: idx_brand_page_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_page_brand ON public.brand_page USING btree (brand_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_brand_page_featured_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_page_featured_page ON public.brand_page_featured_product_group USING btree (brand_page_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_brand_page_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_page_public ON public.brand_page USING btree (brand_id, review_status, publish_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_brand_page_source_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_page_source_page ON public.brand_page_source USING btree (brand_page_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_brand_page_stat_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_page_stat_page ON public.brand_page_stat USING btree (brand_page_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_brand_primary_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_primary_category ON public.brand USING btree (primary_category_id);


--
-- Name: idx_brand_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_brand_status ON public.brand USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_company_social_link_company_info; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_social_link_company_info ON public.company_social_link USING btree (company_info_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_contact_request_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_request_customer_id ON public.contact_request USING btree (customer_id);


--
-- Name: idx_contact_request_status_assigned_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_request_status_assigned_created ON public.contact_request USING btree (status, assigned_to, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_customer_profile_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_profile_deleted_at ON public.customer_profile USING btree (deleted_at);


--
-- Name: idx_customer_profile_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_profile_email ON public.customer_profile USING btree (email);


--
-- Name: idx_customer_profile_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_profile_phone ON public.customer_profile USING btree (phone);


--
-- Name: idx_data_conflict_batch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_conflict_batch_status ON public.data_conflict USING btree (import_batch_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_file_metadata_orphan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_metadata_orphan ON public.file_metadata USING btree (is_orphan) WHERE (deleted_at IS NULL);


--
-- Name: idx_file_usage_file; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_file_usage_file ON public.file_usage USING btree (file_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_home_section_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_home_section_sort ON public.home_section USING btree (sort_order);


--
-- Name: idx_import_batch_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_batch_status_created ON public.import_batch USING btree (status, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_import_error_log_batch_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_error_log_batch_severity ON public.import_error_log USING btree (import_batch_id, severity) WHERE (deleted_at IS NULL);


--
-- Name: idx_import_mapping_external_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_mapping_external_code ON public.import_mapping USING btree (external_code) WHERE (deleted_at IS NULL);


--
-- Name: idx_import_mapping_profile_signature_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_import_mapping_profile_signature_active ON public.import_mapping_profile USING btree (header_signature) WHERE (deleted_at IS NULL);


--
-- Name: idx_menu_item_menu_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_item_menu_parent ON public.menu_item USING btree (menu_id, parent_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_menu_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_status ON public.menu USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_news_category_active_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_category_active_sort ON public.news_category USING btree (sort_order, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_page_content_content_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_content_content_type ON public.page_content USING btree (content_type);


--
-- Name: idx_page_content_is_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_content_is_featured ON public.page_content USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_page_content_news_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_content_news_category_id ON public.page_content USING btree (news_category_id);


--
-- Name: idx_page_content_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_content_published_at ON public.page_content USING btree (published_at DESC) WHERE (published_at IS NOT NULL);


--
-- Name: idx_page_content_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_content_workflow ON public.page_content USING btree (review_status, publish_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_pending_product_group_batch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_product_group_batch_status ON public.pending_product_group USING btree (import_batch_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_pending_variant_batch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_variant_batch_status ON public.pending_variant USING btree (import_batch_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_category_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_category_parent ON public.product_category USING btree (parent_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_group_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_group_brand ON public.product_group USING btree (brand_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_group_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_group_category ON public.product_group USING btree (category_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_group_daily_view_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_group_daily_view_date ON public.product_group_daily_view USING btree (view_date DESC);


--
-- Name: idx_product_group_status_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_group_status_workflow ON public.product_group USING btree (status, review_status, publish_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_group_view_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_group_view_count ON public.product_group USING btree (view_count DESC, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_highlight_spec_group_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_highlight_spec_group_default ON public.product_highlight_spec USING btree (product_group_id, sort_order, created_at) WHERE ((product_variant_id IS NULL) AND (deleted_at IS NULL));


--
-- Name: idx_product_highlight_spec_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_highlight_spec_variant ON public.product_highlight_spec USING btree (product_variant_id, sort_order, created_at) WHERE ((product_variant_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_product_image_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_image_group ON public.product_image USING btree (product_group_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_image_group_variant_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_image_group_variant_order ON public.product_image USING btree (product_group_id, product_variant_id, sort_order, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_image_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_image_variant ON public.product_image USING btree (product_variant_id) WHERE ((product_variant_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_product_spec_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_spec_group ON public.product_spec USING btree (spec_group_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_variant_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variant_group ON public.product_variant USING btree (product_group_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_variant_price_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variant_price_mode ON public.product_variant USING btree (public_price_mode) WHERE (deleted_at IS NULL);


--
-- Name: idx_product_variant_status_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variant_status_workflow ON public.product_variant USING btree (status, review_status, publish_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_project_gallery_project_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_gallery_project_order ON public.project_gallery USING btree (project_id, sort_order, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_project_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_workflow ON public.project USING btree (review_status, publish_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_quote_item_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_item_quote ON public.quote_item USING btree (quote_request_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_quote_request_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_request_customer_id ON public.quote_request USING btree (customer_id);


--
-- Name: idx_quote_request_status_assigned_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quote_request_status_assigned_created ON public.quote_request USING btree (status, assigned_to, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_raw_data_batch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_data_batch_status ON public.raw_data USING btree (import_batch_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_redirect_rule_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redirect_rule_status ON public.redirect_rule USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_service_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_sort_order ON public.service USING btree (sort_order, updated_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_service_workflow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_workflow ON public.service USING btree (review_status, publish_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_site_daily_view_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_daily_view_date ON public.site_daily_view USING btree (view_date DESC);


--
-- Name: idx_spec_group_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spec_group_group ON public.spec_group USING btree (product_group_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_technical_document_group_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_technical_document_group_public ON public.technical_document USING btree (product_group_id, is_public) WHERE (deleted_at IS NULL);


--
-- Name: idx_technical_document_group_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_technical_document_group_variant ON public.technical_document USING btree (product_group_id, product_variant_id);


--
-- Name: idx_variant_attribute_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_attribute_variant ON public.variant_attribute USING btree (product_variant_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_variant_spec_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_spec_group ON public.variant_spec USING btree (variant_spec_group_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_variant_spec_group_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variant_spec_group_variant ON public.variant_spec_group USING btree (product_variant_id) WHERE (deleted_at IS NULL);


--
-- Name: uq_bpfpg_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bpfpg_active ON public.brand_page_featured_product_group USING btree (brand_page_id, product_group_id) WHERE (deleted_at IS NULL);


--
-- Name: uq_brand_page_brand_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_brand_page_brand_active ON public.brand_page USING btree (brand_id) WHERE (deleted_at IS NULL);


--
-- Name: uq_brand_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_brand_slug_active ON public.brand USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_company_info_singleton_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_company_info_singleton_active ON public.company_info USING btree ((1)) WHERE (deleted_at IS NULL);


--
-- Name: uq_menu_position_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_menu_position_active ON public.menu USING btree ("position") WHERE (deleted_at IS NULL);


--
-- Name: uq_news_category_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_news_category_slug_active ON public.news_category USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_page_content_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_page_content_slug_active ON public.page_content USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_product_category_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_category_slug_active ON public.product_category USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_product_group_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_group_slug_active ON public.product_group USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_product_highlight_spec_active_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_highlight_spec_active_source ON public.product_highlight_spec USING btree (product_group_id, COALESCE(product_variant_id, '00000000-0000-0000-0000-000000000000'::uuid), source_type, source_id) WHERE ((deleted_at IS NULL) AND (source_id IS NOT NULL));


--
-- Name: uq_product_image_active_group_file; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_image_active_group_file ON public.product_image USING btree (product_group_id, file_id) WHERE (deleted_at IS NULL);


--
-- Name: uq_product_variant_external_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_variant_external_code_active ON public.product_variant USING btree (external_code) WHERE (deleted_at IS NULL);


--
-- Name: uq_product_variant_model_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_variant_model_code_active ON public.product_variant USING btree (model_code) WHERE (deleted_at IS NULL);


--
-- Name: uq_product_variant_sku_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_variant_sku_active ON public.product_variant USING btree (sku) WHERE (deleted_at IS NULL);


--
-- Name: uq_project_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_project_slug_active ON public.project USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_redirect_rule_from_path_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_redirect_rule_from_path_active ON public.redirect_rule USING btree (from_path) WHERE (deleted_at IS NULL);


--
-- Name: uq_service_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_slug_active ON public.service USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_spec_group_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_spec_group_name_active ON public.spec_group USING btree (product_group_id, group_name) WHERE (deleted_at IS NULL);


--
-- Name: uq_tag_slug_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tag_slug_active ON public.tag USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_variant_spec_group_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_variant_spec_group_name_active ON public.variant_spec_group USING btree (product_variant_id, group_name) WHERE (deleted_at IS NULL);


--
-- Name: audit_log trg_audit_log_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log_updated_at BEFORE UPDATE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: banner trg_banner_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_banner_soft_delete BEFORE UPDATE ON public.banner FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: banner trg_banner_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_banner_updated_at BEFORE UPDATE ON public.banner FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: brand_page_featured_product_group trg_brand_page_featured_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_page_featured_updated_at BEFORE UPDATE ON public.brand_page_featured_product_group FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: brand_page trg_brand_page_soft_delete_workflow; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_page_soft_delete_workflow BEFORE UPDATE ON public.brand_page FOR EACH ROW EXECUTE FUNCTION public.st_sync_public_workflow_on_soft_delete();


--
-- Name: brand_page_source trg_brand_page_source_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_page_source_soft_delete BEFORE UPDATE ON public.brand_page_source FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: brand_page_source trg_brand_page_source_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_page_source_updated_at BEFORE UPDATE ON public.brand_page_source FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: brand_page_stat trg_brand_page_stat_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_page_stat_soft_delete BEFORE UPDATE ON public.brand_page_stat FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: brand_page_stat trg_brand_page_stat_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_page_stat_updated_at BEFORE UPDATE ON public.brand_page_stat FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: brand_page trg_brand_page_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_page_updated_at BEFORE UPDATE ON public.brand_page FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: brand trg_brand_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_soft_delete BEFORE UPDATE ON public.brand FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: brand trg_brand_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_updated_at BEFORE UPDATE ON public.brand FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: certificate trg_certificate_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_certificate_soft_delete BEFORE UPDATE ON public.certificate FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: certificate trg_certificate_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_certificate_updated_at BEFORE UPDATE ON public.certificate FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: company_info trg_company_info_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_company_info_updated_at BEFORE UPDATE ON public.company_info FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: company_social_link trg_company_social_link_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_company_social_link_soft_delete BEFORE UPDATE ON public.company_social_link FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: company_social_link trg_company_social_link_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_company_social_link_updated_at BEFORE UPDATE ON public.company_social_link FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: conflict_resolution trg_conflict_resolution_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_conflict_resolution_updated_at BEFORE UPDATE ON public.conflict_resolution FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: contact_internal_note trg_contact_internal_note_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contact_internal_note_updated_at BEFORE UPDATE ON public.contact_internal_note FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: contact_request trg_contact_request_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_contact_request_updated_at BEFORE UPDATE ON public.contact_request FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: customer_profile trg_customer_profile_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_profile_updated_at BEFORE UPDATE ON public.customer_profile FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: data_conflict trg_data_conflict_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_data_conflict_updated_at BEFORE UPDATE ON public.data_conflict FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: file_metadata trg_file_metadata_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_file_metadata_updated_at BEFORE UPDATE ON public.file_metadata FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: file_usage trg_file_usage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_file_usage_updated_at BEFORE UPDATE ON public.file_usage FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: home_section trg_home_section_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_home_section_updated_at BEFORE UPDATE ON public.home_section FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: import_batch trg_import_batch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_import_batch_updated_at BEFORE UPDATE ON public.import_batch FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: import_error_log trg_import_error_log_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_import_error_log_updated_at BEFORE UPDATE ON public.import_error_log FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: import_mapping trg_import_mapping_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_import_mapping_updated_at BEFORE UPDATE ON public.import_mapping FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: menu_item trg_menu_item_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_menu_item_soft_delete BEFORE UPDATE ON public.menu_item FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: menu_item trg_menu_item_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_menu_item_updated_at BEFORE UPDATE ON public.menu_item FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: menu trg_menu_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_menu_soft_delete BEFORE UPDATE ON public.menu FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: menu trg_menu_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_menu_updated_at BEFORE UPDATE ON public.menu FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: news_category trg_news_category_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_news_category_updated_at BEFORE UPDATE ON public.news_category FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: page_content trg_page_content_soft_delete_workflow; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_page_content_soft_delete_workflow BEFORE UPDATE ON public.page_content FOR EACH ROW EXECUTE FUNCTION public.st_sync_public_workflow_on_soft_delete();


--
-- Name: page_content trg_page_content_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_page_content_updated_at BEFORE UPDATE ON public.page_content FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: partner trg_partner_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_partner_soft_delete BEFORE UPDATE ON public.partner FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: partner trg_partner_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_partner_updated_at BEFORE UPDATE ON public.partner FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: pending_product_group trg_pending_product_group_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pending_product_group_updated_at BEFORE UPDATE ON public.pending_product_group FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: pending_variant trg_pending_variant_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pending_variant_updated_at BEFORE UPDATE ON public.pending_variant FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: product_category trg_product_category_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_category_soft_delete BEFORE UPDATE ON public.product_category FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: product_category trg_product_category_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_category_updated_at BEFORE UPDATE ON public.product_category FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: product_group_daily_view trg_product_group_daily_view_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_group_daily_view_updated_at BEFORE UPDATE ON public.product_group_daily_view FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: product_group trg_product_group_soft_delete_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_group_soft_delete_status BEFORE UPDATE ON public.product_group FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: product_group trg_product_group_soft_delete_workflow; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_group_soft_delete_workflow BEFORE UPDATE ON public.product_group FOR EACH ROW EXECUTE FUNCTION public.st_sync_public_workflow_on_soft_delete();


--
-- Name: product_group_tag trg_product_group_tag_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_group_tag_updated_at BEFORE UPDATE ON public.product_group_tag FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: product_group trg_product_group_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_group_updated_at BEFORE UPDATE ON public.product_group FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: product_highlight_spec trg_product_highlight_spec_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_highlight_spec_updated_at BEFORE UPDATE ON public.product_highlight_spec FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: product_image trg_product_image_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_image_updated_at BEFORE UPDATE ON public.product_image FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: product_spec trg_product_spec_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_spec_updated_at BEFORE UPDATE ON public.product_spec FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: product_variant trg_product_variant_soft_delete_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_variant_soft_delete_status BEFORE UPDATE ON public.product_variant FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: product_variant trg_product_variant_soft_delete_workflow; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_variant_soft_delete_workflow BEFORE UPDATE ON public.product_variant FOR EACH ROW EXECUTE FUNCTION public.st_sync_public_workflow_on_soft_delete();


--
-- Name: product_variant trg_product_variant_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_variant_updated_at BEFORE UPDATE ON public.product_variant FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: project_gallery trg_project_gallery_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_project_gallery_updated_at BEFORE UPDATE ON public.project_gallery FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: project_product_group trg_project_product_group_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_project_product_group_updated_at BEFORE UPDATE ON public.project_product_group FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: project trg_project_soft_delete_workflow; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_project_soft_delete_workflow BEFORE UPDATE ON public.project FOR EACH ROW EXECUTE FUNCTION public.st_sync_public_workflow_on_soft_delete();


--
-- Name: project trg_project_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_project_updated_at BEFORE UPDATE ON public.project FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: quote_internal_note trg_quote_internal_note_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quote_internal_note_updated_at BEFORE UPDATE ON public.quote_internal_note FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: quote_item trg_quote_item_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quote_item_updated_at BEFORE UPDATE ON public.quote_item FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: quote_request trg_quote_request_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quote_request_updated_at BEFORE UPDATE ON public.quote_request FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: raw_data trg_raw_data_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_raw_data_updated_at BEFORE UPDATE ON public.raw_data FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: redirect_rule trg_redirect_rule_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_redirect_rule_soft_delete BEFORE UPDATE ON public.redirect_rule FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: redirect_rule trg_redirect_rule_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_redirect_rule_updated_at BEFORE UPDATE ON public.redirect_rule FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: service_product_group trg_service_product_group_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_service_product_group_updated_at BEFORE UPDATE ON public.service_product_group FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: service trg_service_soft_delete_workflow; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_service_soft_delete_workflow BEFORE UPDATE ON public.service FOR EACH ROW EXECUTE FUNCTION public.st_sync_public_workflow_on_soft_delete();


--
-- Name: service trg_service_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_service_updated_at BEFORE UPDATE ON public.service FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: site_daily_view trg_site_daily_view_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_site_daily_view_updated_at BEFORE UPDATE ON public.site_daily_view FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: spec_group trg_spec_group_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_spec_group_updated_at BEFORE UPDATE ON public.spec_group FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: tag trg_tag_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tag_soft_delete BEFORE UPDATE ON public.tag FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: tag trg_tag_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tag_updated_at BEFORE UPDATE ON public.tag FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: technical_document trg_technical_document_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_technical_document_soft_delete BEFORE UPDATE ON public.technical_document FOR EACH ROW EXECUTE FUNCTION public.st_sync_status_on_soft_delete();


--
-- Name: technical_document trg_technical_document_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_technical_document_updated_at BEFORE UPDATE ON public.technical_document FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: variant_attribute trg_variant_attribute_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_variant_attribute_updated_at BEFORE UPDATE ON public.variant_attribute FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: variant_spec_group trg_variant_spec_group_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_variant_spec_group_updated_at BEFORE UPDATE ON public.variant_spec_group FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: variant_spec trg_variant_spec_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_variant_spec_updated_at BEFORE UPDATE ON public.variant_spec FOR EACH ROW EXECUTE FUNCTION public.st_set_updated_at();


--
-- Name: admin_refresh_session admin_refresh_session_admin_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_refresh_session
    ADD CONSTRAINT admin_refresh_session_admin_user_id_foreign FOREIGN KEY (admin_user_id) REFERENCES public.admin_user(id) ON DELETE CASCADE;


--
-- Name: admin_role_permission admin_role_permission_admin_permission_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_role_permission
    ADD CONSTRAINT admin_role_permission_admin_permission_id_foreign FOREIGN KEY (admin_permission_id) REFERENCES public.admin_permission(id) ON DELETE CASCADE;


--
-- Name: admin_role_permission admin_role_permission_admin_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_role_permission
    ADD CONSTRAINT admin_role_permission_admin_role_id_foreign FOREIGN KEY (admin_role_id) REFERENCES public.admin_role(id) ON DELETE CASCADE;


--
-- Name: admin_user_role admin_user_role_admin_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_user_role
    ADD CONSTRAINT admin_user_role_admin_role_id_foreign FOREIGN KEY (admin_role_id) REFERENCES public.admin_role(id) ON DELETE CASCADE;


--
-- Name: admin_user_role admin_user_role_admin_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_user_role
    ADD CONSTRAINT admin_user_role_admin_user_id_foreign FOREIGN KEY (admin_user_id) REFERENCES public.admin_user(id) ON DELETE CASCADE;


--
-- Name: banner fk_banner_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banner
    ADD CONSTRAINT fk_banner_image FOREIGN KEY (image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: banner fk_banner_image_mobile; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banner
    ADD CONSTRAINT fk_banner_image_mobile FOREIGN KEY (image_mobile_file_id) REFERENCES public.file_metadata(id) ON DELETE SET NULL;


--
-- Name: brand fk_brand_logo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand
    ADD CONSTRAINT fk_brand_logo FOREIGN KEY (logo_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: brand_page fk_brand_page_brand; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page
    ADD CONSTRAINT fk_brand_page_brand FOREIGN KEY (brand_id) REFERENCES public.brand(id) ON DELETE RESTRICT;


--
-- Name: brand_page_featured_product_group fk_brand_page_featured_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page_featured_product_group
    ADD CONSTRAINT fk_brand_page_featured_group FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE RESTRICT;


--
-- Name: brand_page_featured_product_group fk_brand_page_featured_page; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page_featured_product_group
    ADD CONSTRAINT fk_brand_page_featured_page FOREIGN KEY (brand_page_id) REFERENCES public.brand_page(id) ON DELETE CASCADE;


--
-- Name: brand_page fk_brand_page_hero_banner; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page
    ADD CONSTRAINT fk_brand_page_hero_banner FOREIGN KEY (hero_banner_id) REFERENCES public.banner(id) ON DELETE SET NULL;


--
-- Name: brand_page fk_brand_page_og_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page
    ADD CONSTRAINT fk_brand_page_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: brand_page_source fk_brand_page_source_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page_source
    ADD CONSTRAINT fk_brand_page_source_file FOREIGN KEY (file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: brand_page_source fk_brand_page_source_page; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page_source
    ADD CONSTRAINT fk_brand_page_source_page FOREIGN KEY (brand_page_id) REFERENCES public.brand_page(id) ON DELETE CASCADE;


--
-- Name: brand_page_stat fk_brand_page_stat_page; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page_stat
    ADD CONSTRAINT fk_brand_page_stat_page FOREIGN KEY (brand_page_id) REFERENCES public.brand_page(id) ON DELETE CASCADE;


--
-- Name: brand_page_stat fk_brand_page_stat_source_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page_stat
    ADD CONSTRAINT fk_brand_page_stat_source_file FOREIGN KEY (source_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: brand_page fk_brand_page_support_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_page
    ADD CONSTRAINT fk_brand_page_support_image FOREIGN KEY (support_image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: brand fk_brand_primary_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand
    ADD CONSTRAINT fk_brand_primary_category FOREIGN KEY (primary_category_id) REFERENCES public.product_category(id) ON DELETE RESTRICT;


--
-- Name: certificate fk_certificate_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate
    ADD CONSTRAINT fk_certificate_file FOREIGN KEY (file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: certificate fk_certificate_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate
    ADD CONSTRAINT fk_certificate_image FOREIGN KEY (image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: company_info fk_company_info_favicon; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_info
    ADD CONSTRAINT fk_company_info_favicon FOREIGN KEY (favicon_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: company_info fk_company_info_logo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_info
    ADD CONSTRAINT fk_company_info_logo FOREIGN KEY (logo_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: company_social_link fk_company_social_link_company_info; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_social_link
    ADD CONSTRAINT fk_company_social_link_company_info FOREIGN KEY (company_info_id) REFERENCES public.company_info(id) ON DELETE RESTRICT;


--
-- Name: conflict_resolution fk_conflict_resolution_conflict; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflict_resolution
    ADD CONSTRAINT fk_conflict_resolution_conflict FOREIGN KEY (conflict_id) REFERENCES public.data_conflict(id) ON DELETE CASCADE;


--
-- Name: contact_internal_note fk_contact_internal_note_contact; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_internal_note
    ADD CONSTRAINT fk_contact_internal_note_contact FOREIGN KEY (contact_id) REFERENCES public.contact_request(id) ON DELETE CASCADE;


--
-- Name: contact_request fk_contact_request_customer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_request
    ADD CONSTRAINT fk_contact_request_customer FOREIGN KEY (customer_id) REFERENCES public.customer_profile(id) ON DELETE SET NULL;


--
-- Name: data_conflict fk_data_conflict_batch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_conflict
    ADD CONSTRAINT fk_data_conflict_batch FOREIGN KEY (import_batch_id) REFERENCES public.import_batch(id) ON DELETE CASCADE;


--
-- Name: file_usage fk_file_usage_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_usage
    ADD CONSTRAINT fk_file_usage_file FOREIGN KEY (file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: import_batch fk_import_batch_source_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_batch
    ADD CONSTRAINT fk_import_batch_source_file FOREIGN KEY (source_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: import_error_log fk_import_error_log_batch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_error_log
    ADD CONSTRAINT fk_import_error_log_batch FOREIGN KEY (import_batch_id) REFERENCES public.import_batch(id) ON DELETE CASCADE;


--
-- Name: import_error_log fk_import_error_log_raw_data; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_error_log
    ADD CONSTRAINT fk_import_error_log_raw_data FOREIGN KEY (raw_data_id) REFERENCES public.raw_data(id) ON DELETE SET NULL;


--
-- Name: import_mapping fk_import_mapping_batch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_mapping
    ADD CONSTRAINT fk_import_mapping_batch FOREIGN KEY (import_batch_id) REFERENCES public.import_batch(id) ON DELETE CASCADE;


--
-- Name: menu_item fk_menu_item_menu; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item
    ADD CONSTRAINT fk_menu_item_menu FOREIGN KEY (menu_id) REFERENCES public.menu(id) ON DELETE RESTRICT;


--
-- Name: menu_item fk_menu_item_parent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item
    ADD CONSTRAINT fk_menu_item_parent FOREIGN KEY (parent_id) REFERENCES public.menu_item(id) ON DELETE RESTRICT;


--
-- Name: page_content fk_page_content_featured_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_content
    ADD CONSTRAINT fk_page_content_featured_image FOREIGN KEY (featured_image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: page_content fk_page_content_og_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_content
    ADD CONSTRAINT fk_page_content_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: partner fk_partner_logo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner
    ADD CONSTRAINT fk_partner_logo FOREIGN KEY (logo_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: pending_product_group fk_pending_product_group_batch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_product_group
    ADD CONSTRAINT fk_pending_product_group_batch FOREIGN KEY (import_batch_id) REFERENCES public.import_batch(id) ON DELETE CASCADE;


--
-- Name: pending_product_group fk_pending_product_group_conflict; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_product_group
    ADD CONSTRAINT fk_pending_product_group_conflict FOREIGN KEY (conflict_id) REFERENCES public.data_conflict(id) ON DELETE SET NULL;


--
-- Name: pending_product_group fk_pending_product_group_official; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_product_group
    ADD CONSTRAINT fk_pending_product_group_official FOREIGN KEY (mapped_official_id) REFERENCES public.product_group(id) ON DELETE RESTRICT;


--
-- Name: pending_variant fk_pending_variant_batch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_variant
    ADD CONSTRAINT fk_pending_variant_batch FOREIGN KEY (import_batch_id) REFERENCES public.import_batch(id) ON DELETE CASCADE;


--
-- Name: pending_variant fk_pending_variant_conflict; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_variant
    ADD CONSTRAINT fk_pending_variant_conflict FOREIGN KEY (conflict_id) REFERENCES public.data_conflict(id) ON DELETE SET NULL;


--
-- Name: pending_variant fk_pending_variant_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_variant
    ADD CONSTRAINT fk_pending_variant_group FOREIGN KEY (pending_product_group_id) REFERENCES public.pending_product_group(id) ON DELETE CASCADE;


--
-- Name: pending_variant fk_pending_variant_official; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_variant
    ADD CONSTRAINT fk_pending_variant_official FOREIGN KEY (mapped_official_id) REFERENCES public.product_variant(id) ON DELETE RESTRICT;


--
-- Name: product_category fk_product_category_icon; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT fk_product_category_icon FOREIGN KEY (icon_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: product_category fk_product_category_parent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT fk_product_category_parent FOREIGN KEY (parent_id) REFERENCES public.product_category(id) ON DELETE RESTRICT;


--
-- Name: product_group fk_product_group_brand; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group
    ADD CONSTRAINT fk_product_group_brand FOREIGN KEY (brand_id) REFERENCES public.brand(id) ON DELETE RESTRICT;


--
-- Name: product_group fk_product_group_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group
    ADD CONSTRAINT fk_product_group_category FOREIGN KEY (category_id) REFERENCES public.product_category(id) ON DELETE RESTRICT;


--
-- Name: product_group fk_product_group_og_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group
    ADD CONSTRAINT fk_product_group_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: product_group_tag fk_product_group_tag_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group_tag
    ADD CONSTRAINT fk_product_group_tag_group FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE CASCADE;


--
-- Name: product_group_tag fk_product_group_tag_tag; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group_tag
    ADD CONSTRAINT fk_product_group_tag_tag FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE CASCADE;


--
-- Name: product_group fk_product_group_thumbnail; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group
    ADD CONSTRAINT fk_product_group_thumbnail FOREIGN KEY (thumbnail_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: product_highlight_spec fk_product_highlight_spec_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_highlight_spec
    ADD CONSTRAINT fk_product_highlight_spec_group FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE CASCADE;


--
-- Name: product_highlight_spec fk_product_highlight_spec_variant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_highlight_spec
    ADD CONSTRAINT fk_product_highlight_spec_variant FOREIGN KEY (product_variant_id) REFERENCES public.product_variant(id) ON DELETE CASCADE;


--
-- Name: product_image fk_product_image_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_image
    ADD CONSTRAINT fk_product_image_file FOREIGN KEY (file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: product_image fk_product_image_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_image
    ADD CONSTRAINT fk_product_image_group FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE CASCADE;


--
-- Name: product_image fk_product_image_variant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_image
    ADD CONSTRAINT fk_product_image_variant FOREIGN KEY (product_variant_id) REFERENCES public.product_variant(id) ON DELETE RESTRICT;


--
-- Name: product_spec fk_product_spec_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_spec
    ADD CONSTRAINT fk_product_spec_group FOREIGN KEY (spec_group_id) REFERENCES public.spec_group(id) ON DELETE CASCADE;


--
-- Name: product_variant fk_product_variant_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variant
    ADD CONSTRAINT fk_product_variant_group FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE RESTRICT;


--
-- Name: project_gallery fk_project_gallery_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gallery
    ADD CONSTRAINT fk_project_gallery_file FOREIGN KEY (file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: project_gallery fk_project_gallery_project; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gallery
    ADD CONSTRAINT fk_project_gallery_project FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: project fk_project_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT fk_project_image FOREIGN KEY (image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: project fk_project_og_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT fk_project_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: project_product_group fk_project_product_group_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_product_group
    ADD CONSTRAINT fk_project_product_group_group FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE CASCADE;


--
-- Name: project_product_group fk_project_product_group_project; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_product_group
    ADD CONSTRAINT fk_project_product_group_project FOREIGN KEY (project_id) REFERENCES public.project(id) ON DELETE CASCADE;


--
-- Name: quote_internal_note fk_quote_internal_note_quote; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_internal_note
    ADD CONSTRAINT fk_quote_internal_note_quote FOREIGN KEY (quote_id) REFERENCES public.quote_request(id) ON DELETE CASCADE;


--
-- Name: quote_item fk_quote_item_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_item
    ADD CONSTRAINT fk_quote_item_group FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE RESTRICT;


--
-- Name: quote_item fk_quote_item_quote; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_item
    ADD CONSTRAINT fk_quote_item_quote FOREIGN KEY (quote_request_id) REFERENCES public.quote_request(id) ON DELETE CASCADE;


--
-- Name: quote_item fk_quote_item_variant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_item
    ADD CONSTRAINT fk_quote_item_variant FOREIGN KEY (product_variant_id) REFERENCES public.product_variant(id) ON DELETE RESTRICT;


--
-- Name: quote_request fk_quote_request_customer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_request
    ADD CONSTRAINT fk_quote_request_customer FOREIGN KEY (customer_id) REFERENCES public.customer_profile(id) ON DELETE SET NULL;


--
-- Name: raw_data fk_raw_data_batch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_data
    ADD CONSTRAINT fk_raw_data_batch FOREIGN KEY (import_batch_id) REFERENCES public.import_batch(id) ON DELETE CASCADE;


--
-- Name: service fk_service_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT fk_service_image FOREIGN KEY (image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: service fk_service_og_image; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT fk_service_og_image FOREIGN KEY (seo_og_image_file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: service_product_group fk_service_product_group_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_product_group
    ADD CONSTRAINT fk_service_product_group_group FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE CASCADE;


--
-- Name: service_product_group fk_service_product_group_service; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_product_group
    ADD CONSTRAINT fk_service_product_group_service FOREIGN KEY (service_id) REFERENCES public.service(id) ON DELETE CASCADE;


--
-- Name: spec_group fk_spec_group_product_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spec_group
    ADD CONSTRAINT fk_spec_group_product_group FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE CASCADE;


--
-- Name: technical_document fk_technical_document_file; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technical_document
    ADD CONSTRAINT fk_technical_document_file FOREIGN KEY (file_id) REFERENCES public.file_metadata(id) ON DELETE RESTRICT;


--
-- Name: technical_document fk_technical_document_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technical_document
    ADD CONSTRAINT fk_technical_document_group FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE CASCADE;


--
-- Name: technical_document fk_technical_document_variant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technical_document
    ADD CONSTRAINT fk_technical_document_variant FOREIGN KEY (product_variant_id) REFERENCES public.product_variant(id) ON DELETE RESTRICT;


--
-- Name: variant_attribute fk_variant_attribute_variant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_attribute
    ADD CONSTRAINT fk_variant_attribute_variant FOREIGN KEY (product_variant_id) REFERENCES public.product_variant(id) ON DELETE CASCADE;


--
-- Name: variant_spec fk_variant_spec_group; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_spec
    ADD CONSTRAINT fk_variant_spec_group FOREIGN KEY (variant_spec_group_id) REFERENCES public.variant_spec_group(id) ON DELETE CASCADE;


--
-- Name: variant_spec_group fk_variant_spec_group_variant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_spec_group
    ADD CONSTRAINT fk_variant_spec_group_variant FOREIGN KEY (product_variant_id) REFERENCES public.product_variant(id) ON DELETE CASCADE;


--
-- Name: page_content page_content_news_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_content
    ADD CONSTRAINT page_content_news_category_id_foreign FOREIGN KEY (news_category_id) REFERENCES public.news_category(id) ON DELETE SET NULL;


--
-- Name: product_group_daily_view product_group_daily_view_product_group_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_group_daily_view
    ADD CONSTRAINT product_group_daily_view_product_group_id_foreign FOREIGN KEY (product_group_id) REFERENCES public.product_group(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict YS1y5u7uG5eRkkIsr2F956pFO1wpXQm7ecnLZxa6AKyma0aReyi1S1abY7xIkGX

