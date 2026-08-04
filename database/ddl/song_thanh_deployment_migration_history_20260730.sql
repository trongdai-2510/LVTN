-- Deployment bootstrap ledger for song_thanh_deployment_schema_20260730.sql.
--
-- The deployment schema is a schema-only snapshot taken after the migrations
-- below had already been applied and verified on 2026-07-30. Recording the
-- ledger prevents Knex from replaying historical ALTER statements against a
-- schema that already contains their result. Future migration files remain
-- pending and run normally.

INSERT INTO knex_migrations (id, name, batch, migration_time) VALUES
  (1, '202604250001_create_admin_auth_tables.js', 1, NOW()),
  (2, '202604270001_add_file_metadata_purpose.js', 1, NOW()),
  (3, '202604280001_add_product_domain_contexts.js', 1, NOW()),
  (4, '202604290001_add_import_batch_mapping_config.js', 1, NOW()),
  (5, '202604290002_create_import_mapping_profiles.js', 1, NOW()),
  (6, '202605080001_create_customer_profile.js', 1, NOW()),
  (7, '202605100001_add_public_product_group_view_count_and_mpe_brand.js', 1, NOW()),
  (8, '202605130002_add_banner_content_fields.js', 1, NOW()),
  (9, '202605130003_add_banner_text_style_fields.js', 1, NOW()),
  (10, '202605130003_banner_display_mode_9pos.js', 1, NOW()),
  (11, '202605130004_add_page_content_content_type.js', 1, NOW()),
  (12, '202605130005_page_content_news_fields.js', 1, NOW()),
  (13, '202605140001_add_company_info_hotlines_working_days.js', 1, NOW()),
  (14, '202605140002_add_service_project_content_fields.js', 1, NOW()),
  (15, '202605170001_create_brand_page_tables.js', 1, NOW()),
  (16, '202605170002_add_brand_page_hero_style_fields.js', 1, NOW()),
  (17, '202605190001_add_menu_item_open_new_tab_icon_description.js', 1, NOW()),
  (18, '202605190002_rename_footer_to_footer_quick.js', 1, NOW()),
  (19, '202605200001_extend_service_for_dich_vu_redesign.js', 1, NOW()),
  (20, '202605200002_news_category_soft_delete.js', 1, NOW()),
  (21, '202605200003_project_gallery_admin_surface.js', 1, NOW()),
  (22, '202605210001_add_product_image_variant_link.js', 1, NOW()),
  (23, '202605210002_add_product_variant_detailed_description.js', 1, NOW()),
  (24, '202605290002_split_sino_tu_dien_groups.js', 1, NOW()),
  (25, '202605290003_create_product_highlight_specs.js', 1, NOW()),
  (26, '202606030001_create_home_sections.js', 1, NOW()),
  (27, '202606040001_add_page_content_extra_blocks.js', 1, NOW()),
  (28, '202606050001_seed_shipping_policy_banner.js', 1, NOW()),
  (29, '202606060001_drop_legacy_strapi_tables.js', 1, NOW()),
  (30, '202606140001_dedupe_product_image_gallery.js', 1, NOW()),
  (31, '202606140002_backfill_product_image_variant_links.js', 1, NOW()),
  (32, '202606150001_add_brand_page_accent_layout.js', 1, NOW()),
  (33, '202606150002_softdelete_aware_unique_indexes.js', 1, NOW()),
  (34, '202606150003_drop_dead_permission_table.js', 1, NOW()),
  (35, '202606150004_revert_auth_unique_to_absolute.js', 1, NOW()),
  (36, '202607120001_add_product_group_daily_views.js', 1, NOW()),
  (37, '202607130001_add_company_info_home_seo.js', 1, NOW()),
  (38, '202607130002_add_site_daily_views.js', 1, NOW()),
  (39, '202607130003_reconcile_customer_profiles_by_identity.js', 1, NOW()),
  (40, '202607130004_remove_stale_working_hours_from_page_content.js', 1, NOW()),
  (41, '202607130005_align_audit_actor_with_admin_user.js', 1, NOW());

SELECT setval('knex_migrations_id_seq', 41, true);

INSERT INTO knex_migrations_lock ("index", is_locked)
VALUES (1, 0)
ON CONFLICT ("index") DO UPDATE SET is_locked = EXCLUDED.is_locked;

SELECT setval('knex_migrations_lock_index_seq', 1, true);
