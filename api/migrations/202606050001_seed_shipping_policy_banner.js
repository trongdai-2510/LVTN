const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { existsSync, statSync } = require('node:fs');

const BANNER_TITLE = 'Chính sách vận chuyển';
const BANNER_POSITION = 'chinh-sach-van-chuyen';
const STORED_FILENAME = '2026-06-05-shipping-policy-hero.jpg';

function resolveStoredPath() {
  return path.resolve(process.cwd(), 'storage', 'file-library', STORED_FILENAME);
}

exports.up = async function up(knex) {
  const existing = await knex('banner')
    .where({ position: BANNER_POSITION, title: BANNER_TITLE })
    .whereNull('deleted_at')
    .first('id');

  if (existing) {
    return;
  }

  const storedPath = resolveStoredPath();
  if (!existsSync(storedPath)) {
    throw new Error(
      `Migration aborted — image not found at ${storedPath}. ` +
        `Place 'shipping-policy-hero.jpg' in api/storage/file-library/ before running.`
    );
  }

  const fileSize = statSync(storedPath).size;
  const fileId = randomUUID();

  await knex('file_metadata').insert({
    id: fileId,
    original_filename: 'shipping-policy-hero.jpg',
    stored_path: storedPath,
    file_size: fileSize,
    mime_type: 'image/jpeg',
    storage_location: 'local',
    is_orphan: false
  });

  await knex('banner').insert({
    id: randomUUID(),
    position: BANNER_POSITION,
    title: BANNER_TITLE,
    description:
      'Chính sách giao hàng và vận chuyển của Song Thanh — minh bạch khu vực, thời gian, phí và quy trình.',
    content_position: 'mid-left',
    title_size: 'large',
    title_color: '#ffffff',
    description_color: '#ffffff',
    image_file_id: fileId,
    link_type: 'none',
    link_target: null,
    cta_buttons: null,
    sort_order: 0,
    status: 'active'
  });
};

exports.down = async function down(knex) {
  const banner = await knex('banner')
    .where({ position: BANNER_POSITION, title: BANNER_TITLE })
    .first('id', 'image_file_id');

  if (!banner) {
    return;
  }

  await knex('banner').where({ id: banner.id }).delete();

  const otherRefs = await knex('banner')
    .where({ image_file_id: banner.image_file_id })
    .count({ cnt: 'id' })
    .first();

  if (Number(otherRefs?.cnt ?? 0) === 0) {
    await knex('file_metadata').where({ id: banner.image_file_id }).delete();
  }
};
