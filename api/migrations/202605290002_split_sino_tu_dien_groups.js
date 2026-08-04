/**
 * Migration: Split Sino "Tủ điện" into 3 proper product groups
 *
 * Before: 1 group "Tủ điện" (slug: tu-ien) contains all 28 variants mixed
 * After:
 *   1. "Tủ điện âm vỏ kim loại" (slug: tu-ien-am-vo-kim-loai) — 13 EM variants → category tu-ien-am
 *   2. "Vỏ tủ điện nổi kim loại" (slug: vo-tu-ien-noi-kim-loai) — 7 CKE variants → category tu-ien-noi
 *   3. "Tủ điện âm mặt nhựa"    (slug: tu-ien-am-mat-nhua)     — 8 E4FC/V4FC variants → category tu-ien-am
 *
 * Also sets correct prices from price list (public_price mode + VND amount).
 */

// ── Fixed IDs ──────────────────────────────────────────────────────────────────
const ORIG_GROUP_ID  = '2cf30d41-2585-4200-bd29-cf2d0ff7ad93'; // existing tu-ien → becomes Group 1
const GROUP2_ID      = 'b8e5c1d2-4a3f-4e6b-9c7d-1f2e3a4b5c6d'; // new CKE group
const GROUP3_ID      = 'a1b2c3d4-5e6f-7890-abcd-ef1234567890'; // new E4FC/V4FC group

const BRAND_SINO     = '41c96cc5-ce02-4b90-ba56-1a6669f55a1a';
const CAT_TU_IEN_AM  = '37623c3f-f090-4df9-9ae6-ea7bb2a428ed';
const CAT_TU_IEN_NOI = '546dcb89-2b27-4af7-bc56-79af5c32396b';

// Thumbnail file IDs
const THUMB_EM  = '6768b643-f721-4fed-ad76-d73d675cde41'; // 01_EM2PLPS.jpg
const THUMB_CKE = '5a7f25ab-e8f3-43fe-9858-f7b9dfcf6c92'; // 01_CKE8.jpg  (original group thumb)
const THUMB_E4FC = '4af70749-b385-43ae-b16a-8af28cfcd028'; // 01_E4FC24SA.png

// ── Variant assignments ────────────────────────────────────────────────────────
// Each entry: [model_code, sort_order, price_vnd]
const EM_VARIANTS = [
  ['EM2PL/PS',  1,  101000],
  ['EM3PL/PS',  2,  101000],
  ['EM4PL/PS',  3,  101000],
  ['EM6PL/PS',  4,  159000],
  ['EM9PL/PS',  5,  250000],
  ['EM13PL/PS', 6,  313000],
  ['EM14PL/PS', 7,  343000],
  ['EM18PL/PS', 8,  502000],
  ['EM24PL/PS', 9,  741000],
  ['EM26PL/PS', 10, 862000],
  ['EM28PL/PS', 11, 948000],
  ['EM36PL/PS', 12, 1047000],
  ['EM48PL/PS', 13, 1354000],
];

const CKE_VARIANTS = [
  ['CKE8',  1, 3235000],
  ['CKE33', 2,  725000],
  ['CKE46', 3,  725000],
  ['CKE47', 4,  725000],
  ['CKE51', 5,  725000],
  ['CKE54', 6, 1364000],
  ['CKE73', 7, 1364000],
];

const E4FC_VARIANTS = [
  ['E4FC2/4SA',  1,  117000],
  ['E4FC3/6SA',  2,  152000],
  ['E4FC4/8SA',  3,  230000],
  ['E4FC8/12SA', 4,  266000],
  ['E4FC14/18S', 5,  620000],
  ['V4FC2/4SA',  6,   94000],
  ['V4FC5/8SA',  7,  143000],
  ['V4FC9/12SA', 8,  177000],
];

// ── Helpers ────────────────────────────────────────────────────────────────────
async function updateVariants(knex, groupId, variantList) {
  for (const [model, sortOrder, price] of variantList) {
    const updated = await knex('product_variant')
      .where({ product_group_id: ORIG_GROUP_ID, model_code: model })
      .whereNull('deleted_at')
      .update({
        product_group_id: groupId,
        sort_order: sortOrder,
        public_price_mode: 'public_price',
        public_price_amount: price,
        updated_at: knex.fn.now(),
      });
    if (!updated) console.warn(`[split-tu-ien] variant not found: ${model}`);
    else console.log(`  → ${model}: group=${groupId.substring(0, 8)} sort=${sortOrder} price=${price.toLocaleString()}`);
  }
}

async function reattachImages(knex, newGroupId, modelCodes) {
  // Find variant IDs for the moved models
  const variants = await knex('product_variant')
    .whereIn('model_code', modelCodes)
    .where({ product_group_id: newGroupId })
    .whereNull('deleted_at')
    .select('id');
  const variantIds = variants.map(v => v.id);
  if (variantIds.length === 0) return;

  const updated = await knex('product_image')
    .whereIn('product_variant_id', variantIds)
    .whereNull('deleted_at')
    .update({ product_group_id: newGroupId, updated_at: knex.fn.now() });
  console.log(`  → Reattached ${updated} images to group ${newGroupId.substring(0, 8)}`);
}

// ──────────────────────────────────────────────────────────────────────────────
exports.up = async function (knex) {
  console.log('\n[split-tu-ien] Starting migration...\n');

  // 1. Rename existing group → Group 1 (EM series)
  await knex('product_group')
    .where({ id: ORIG_GROUP_ID })
    .update({
      name: 'Tủ điện âm vỏ kim loại',
      slug: 'tu-ien-am-vo-kim-loai',
      thumbnail_file_id: THUMB_EM,
      updated_at: knex.fn.now(),
    });
  console.log('[1] Group 1 updated: Tủ điện âm vỏ kim loại');

  // 2. Create Group 2 — CKE (tủ điện nổi)
  await knex('product_group').insert({
    id: GROUP2_ID,
    name: 'Vỏ tủ điện nổi kim loại',
    slug: 'vo-tu-ien-noi-kim-loai',
    category_id: CAT_TU_IEN_NOI,
    brand_id: BRAND_SINO,
    thumbnail_file_id: THUMB_CKE,
    review_status: 'approved',
    publish_status: 'published',
    status: 'active',
    sort_order: 0,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  });
  console.log('[2] Group 2 created: Vỏ tủ điện nổi kim loại');

  // 3. Create Group 3 — E4FC/V4FC (tủ điện âm mặt nhựa)
  await knex('product_group').insert({
    id: GROUP3_ID,
    name: 'Tủ điện âm mặt nhựa',
    slug: 'tu-ien-am-mat-nhua',
    category_id: CAT_TU_IEN_AM,
    brand_id: BRAND_SINO,
    thumbnail_file_id: THUMB_E4FC,
    review_status: 'approved',
    publish_status: 'published',
    status: 'active',
    sort_order: 0,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  });
  console.log('[3] Group 3 created: Tủ điện âm mặt nhựa');

  // 4. Update EM variants (stay in ORIG_GROUP_ID / Group 1)
  console.log('\n[4] Updating EM variants → Group 1');
  await updateVariants(knex, ORIG_GROUP_ID, EM_VARIANTS);

  // 5. Move CKE variants → Group 2
  console.log('\n[5] Moving CKE variants → Group 2');
  await updateVariants(knex, GROUP2_ID, CKE_VARIANTS);

  // 6. Move E4FC/V4FC variants → Group 3
  console.log('\n[6] Moving E4FC/V4FC variants → Group 3');
  await updateVariants(knex, GROUP3_ID, E4FC_VARIANTS);

  // 7. Reattach product_image records to the correct new groups
  console.log('\n[7] Reattaching images...');
  await reattachImages(knex, GROUP2_ID, CKE_VARIANTS.map(v => v[0]));
  await reattachImages(knex, GROUP3_ID, E4FC_VARIANTS.map(v => v[0]));
  // EM images are still on ORIG_GROUP_ID — no change needed for them

  console.log('\n[split-tu-ien] Done.\n');
};

// ──────────────────────────────────────────────────────────────────────────────
exports.down = async function (knex) {
  console.log('\n[split-tu-ien] Rolling back...\n');

  const allModels = [...EM_VARIANTS, ...CKE_VARIANTS, ...E4FC_VARIANTS].map(v => v[0]);

  // Revert: move all variants back to original group, clear prices, reset sort
  await knex('product_variant')
    .whereIn('model_code', allModels)
    .whereNull('deleted_at')
    .update({
      product_group_id: ORIG_GROUP_ID,
      sort_order: 0,
      public_price_mode: 'contact_for_quote',
      public_price_amount: null,
      updated_at: knex.fn.now(),
    });

  // Reattach all images back to original group
  const variants = await knex('product_variant')
    .whereIn('model_code', allModels)
    .whereNull('deleted_at')
    .select('id');
  if (variants.length > 0) {
    await knex('product_image')
      .whereIn('product_variant_id', variants.map(v => v.id))
      .whereNull('deleted_at')
      .update({ product_group_id: ORIG_GROUP_ID, updated_at: knex.fn.now() });
  }

  // Delete new groups
  await knex('product_group').whereIn('id', [GROUP2_ID, GROUP3_ID]).delete();

  // Restore original group
  await knex('product_group')
    .where({ id: ORIG_GROUP_ID })
    .update({
      name: 'Tủ điện',
      slug: 'tu-ien',
      thumbnail_file_id: THUMB_CKE,
      updated_at: knex.fn.now(),
    });

  console.log('[split-tu-ien] Rollback complete.\n');
};
