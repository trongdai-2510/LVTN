/**
 * Migration: Drop legacy Strapi tables left over from the v1 CMS.
 *
 * App đã chuyển sang knex/Nest. Các bảng strapi_*, up_*, files*, upload_folders*,
 * admin_users/admin_roles/admin_permissions* (số nhiều — của Strapi, khác với
 * admin_user/admin_role/admin_permission số ít của app mới), i18n_locale
 * không còn được dùng. Drop CASCADE để dọn FK ràng buộc lẫn nhau giữa chúng.
 *
 * Down: không khôi phục — backup trong database/ddl/song_thanh_physical_schema_v3.sql
 * và các .dump cũ (nếu cần).
 */

const LEGACY_TABLES = [
  'admin_permissions_role_lnk',
  'admin_permissions',
  'admin_users_roles_lnk',
  'admin_users',
  'admin_roles',
  'files_folder_lnk',
  'files_related_mph',
  'files',
  'upload_folders_parent_lnk',
  'upload_folders',
  'up_permissions_role_lnk',
  'up_permissions',
  'up_users_role_lnk',
  'up_users',
  'up_roles',
  'i18n_locale',
  'strapi_ai_localization_jobs',
  'strapi_ai_metadata_jobs',
  'strapi_api_token_permissions_token_lnk',
  'strapi_api_token_permissions',
  'strapi_api_tokens',
  'strapi_audit_logs_user_lnk',
  'strapi_audit_logs',
  'strapi_core_store_settings',
  'strapi_database_schema',
  'strapi_history_versions',
  'strapi_migrations_internal',
  'strapi_migrations',
  'strapi_release_actions_release_lnk',
  'strapi_release_actions',
  'strapi_releases',
  'strapi_sessions',
  'strapi_transfer_token_permissions_token_lnk',
  'strapi_transfer_token_permissions',
  'strapi_transfer_tokens',
  'strapi_webhooks',
  'strapi_workflows_stage_required_to_publish_lnk',
  'strapi_workflows_stages_permissions_lnk',
  'strapi_workflows_stages_workflow_lnk',
  'strapi_workflows_stages',
  'strapi_workflows',
];

exports.up = async function up(knex) {
  for (const table of LEGACY_TABLES) {
    await knex.raw(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
};

exports.down = async function down() {
  throw new Error(
    'Cannot rollback drop_legacy_strapi_tables. Restore from database/ddl/song_thanh_physical_schema_v3.sql or a .dump backup.',
  );
};
