const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { config } = require('dotenv');

config({ path: '.env' });

const PERMISSIONS = [
  'admin_user.read',
  'admin_user.create',
  'admin_user.update',
  'admin_user.manage_status',
  'admin_user.reset_password',
  'admin_role.read',
  'admin_role.create',
  'admin_role.update',
  'admin_role.archive',
  'admin_role.manage_permissions',
  'website_settings.read',
  'website_settings.update',
  'website_settings_social_link.create',
  'website_settings_social_link.update',
  'website_settings_social_link.archive',
  'website_settings_social_link.restore',
  'menu.read',
  'menu.create',
  'menu.update',
  'menu.archive',
  'menu.restore',
  'menu_item.create',
  'menu_item.update',
  'menu_item.reorder',
  'menu_item.archive',
  'menu_item.restore',
  'page_content.read',
  'page_content.create',
  'page_content.update',
  'page_content.archive',
  'page_content.restore',
  'news_category.read',
  'news_category.create',
  'news_category.update',
  'news_category.archive',
  'news_category.restore',
  'banner.read',
  'banner.create',
  'banner.update',
  'banner.archive',
  'banner.restore',
  'product_category.read',
  'product_category.create',
  'product_category.update',
  'product_category.archive',
  'product_category.restore',
  'brand.read',
  'brand.create',
  'brand.update',
  'brand.archive',
  'brand.restore',
  'product_group.read',
  'product_group.create',
  'product_group.update',
  'product_group.archive',
  'product_group.restore',
  'product_variant.read',
  'product_variant.create',
  'product_variant.update',
  'product_variant.archive',
  'product_variant.restore',
  'technical_document.read',
  'technical_document.create',
  'technical_document.update',
  'technical_document.archive',
  'technical_document.restore',
  'service.read',
  'service.create',
  'service.update',
  'service.archive',
  'service.restore',
  'service_product_group.update',
  'project.read',
  'project.create',
  'project.update',
  'project.archive',
  'project.restore',
  'project_gallery.read',
  'project_gallery.create',
  'project_gallery.update',
  'project_gallery.archive',
  'project_gallery.restore',
  'project_product_group.update',
  'file.read',
  'file.create',
  'file.archive',
  'file.restore',
  'contact.read',
  'contact.update_status',
  'contact.assign',
  'contact_note.create',
  'quote.read',
  'quote.update_status',
  'quote.assign',
  'quote_note.create',
  'redirect.read',
  'redirect.create',
  'redirect.update',
  'redirect.archive',
  'redirect.restore',
  'audit_log.read',
  'import.read',
  'import.intake',
  'import.taxonomy_bootstrap',
  'import.review',
  'import.conflict_resolve',
  'import.apply'
];

const ROLES = [
  {
    code: 'super_admin',
    name: 'Super Admin',
    description: 'Full administrative access.'
  },
  {
    code: 'content_admin',
    name: 'Content Admin',
    description: 'Content administration role. Permission mapping is intentionally minimal for now.'
  },
  {
    code: 'product_admin',
    name: 'Product Admin',
    description: 'Product administration role. Permission mapping is intentionally minimal for now.'
  },
  {
    code: 'sales_admin',
    name: 'Sales Admin',
    description: 'Sales administration role. Permission mapping is intentionally minimal for now.'
  },
  {
    code: 'viewer',
    name: 'Viewer',
    description: 'Read-only role. Permission mapping is intentionally minimal for now.'
  }
];

async function ensureRole(knex, role) {
  const existing = await knex('admin_role').where({ code: role.code }).first('id');
  if (existing) {
    await knex('admin_role')
      .where({ id: existing.id })
      .update({
        name: role.name,
        description: role.description,
        status: 'active',
        updated_at: knex.fn.now()
      });
    return existing.id;
  }

  const id = randomUUID();
  await knex('admin_role').insert({
    id,
    code: role.code,
    name: role.name,
    description: role.description,
    status: 'active'
  });
  return id;
}

async function ensurePermission(knex, code) {
  const existing = await knex('admin_permission').where({ code }).first('id');
  if (existing) {
    return existing.id;
  }

  const id = randomUUID();
  await knex('admin_permission').insert({
    id,
    code,
    description: null
  });
  return id;
}

async function ensureSuperAdminUser(knex) {
  const email = (
    process.env.SUPER_ADMIN_EMAIL || 'admin@songthanh.local'
  ).toLowerCase();
  const displayName = process.env.SUPER_ADMIN_NAME || 'Super Admin';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await knex('admin_user').where({ email }).first('id');
  if (existing) {
    return existing.id;
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  await knex('admin_user').insert({
    id,
    email,
    password_hash: passwordHash,
    display_name: displayName,
    status: 'active'
  });
  return id;
}

exports.seed = async function seed(knex) {
  const roleIds = {};
  for (const role of ROLES) {
    roleIds[role.code] = await ensureRole(knex, role);
  }

  const permissionIds = [];
  for (const code of PERMISSIONS) {
    permissionIds.push(await ensurePermission(knex, code));
  }

  const superAdminUserId = await ensureSuperAdminUser(knex);
  await knex('admin_user_role')
    .insert({
      admin_user_id: superAdminUserId,
      admin_role_id: roleIds.super_admin
    })
    .onConflict(['admin_user_id', 'admin_role_id'])
    .ignore();

  for (const permissionId of permissionIds) {
    await knex('admin_role_permission')
      .insert({
        admin_role_id: roleIds.super_admin,
        admin_permission_id: permissionId
      })
      .onConflict(['admin_role_id', 'admin_permission_id'])
      .ignore();
  }
};
