/**
 * Seed: Download featured images for news articles and link via file_metadata
 *
 * Downloads images from public source URLs, saves to api/storage/file-library/news-images/,
 * inserts file_metadata records, and updates page_content.featured_image_file_id.
 *
 * Safe to run multiple times (idempotent).
 */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Use absolute Windows path consistent with existing file_metadata records
const STORAGE_DIR = 'D:\\WebSongThanh\\api\\storage\\file-library\\news-images';

// ─── Image mapping ────────────────────────────────────────────────────────────
// Each entry: try imageUrl first, then each fallback in order
const ARTICLES = [
  {
    slug: 'phan-biet-mcb-mccb-acb-rccb-rcbo-trong-he-thong-dien-ha-the',
    urls: [
      'https://www.chintglobal.com/content/dam/chintsite/global/en/products/low-voltage/landing-page/Low%20Voltage%20Products%20Industrial%20control.jpg',
    ],
    filename: 'phan-biet-aptomat-cb-chint-low-voltage.jpg',
    mimeType: 'image/jpeg',
  },
  {
    slug: 'cach-chon-mccb-cho-tu-dien-nha-xuong-nhung-thong-so-quan-trong',
    urls: [
      // Try several CHINT MCCB product image paths
      'https://www.chintglobal.com/content/dam/chintsite/global/en/products/low-voltage/moulded-case-circuit-breaker/NM8S/NM8S-1.jpg',
      'https://www.chintglobal.com/content/dam/chintsite/global/en/products/low-voltage/moulded-case-circuit-breaker/NM8/NM8-1.jpg',
      'https://www.chintglobal.com/content/dam/chintsite/global/en/products/low-voltage/moulded-case-circuit-breaker/NM8-400S/NM8-400S-1.jpg',
      // Fallback: use the same CHINT low-voltage products image
      'https://www.chintglobal.com/content/dam/chintsite/global/en/products/low-voltage/landing-page/Low%20Voltage%20Products%20Industrial%20control.jpg',
    ],
    filename: 'chon-mccb-tu-dien-nha-xuong-chint.jpg',
    mimeType: 'image/jpeg',
  },
  {
    slug: 'cach-chon-tiet-dien-cap-dien-cho-nha-xuong',
    urls: [
      'https://cadivi.vn/vnt_upload/conduct/05_2018/HD_lua_chon-1.jpg',
    ],
    filename: 'chon-tiet-dien-cap-dien-cadivi.jpg',
    mimeType: 'image/jpeg',
  },
  {
    slug: 'cach-chon-bien-tan-cho-bom-quat-trong-nha-may',
    urls: [
      // Mitsubishi FA global CDN (various path patterns)
      'https://www.mitsubishielectric.com/fa/products/drv/inv/items/fr-f800/img/fr-f800_kv.jpg',
      'https://www.mitsubishielectric.com/fa/products/drv/inv/items/fr-f800/img/product_01.jpg',
      // CHINT inverter product (NVF2 series)
      'https://www.chintglobal.com/content/dam/chintsite/global/en/products/automation/inverter/NVF5/NVF5-1.jpg',
      'https://www.chintglobal.com/content/dam/chintsite/global/en/products/automation/inverter/NVF2-G/NVF2-G-1.jpg',
      // EVN industrial equipment image as reliable final fallback
      'https://www.evn.com.vn/Upload/NewsImgCache/xanhhoa120526-20260512082126564_w1024.jpg',
    ],
    filename: 'chon-bien-tan-bom-quat-nha-may.jpg',
    mimeType: 'image/jpeg',
  },
  {
    slug: 'chon-den-led-highbay-cho-nha-xuong-lumen-ip-goc-chieu',
    urls: [
      'https://rangdong.com.vn/themes/rangdong/images/slide-04.png',
      'https://rangdong.com.vn/themes/rangdong/images/slide-03.png',
      'https://rangdong.com.vn/themes/rangdong/images/slide-01.png',
    ],
    filename: 'den-led-highbay-nha-xuong-rangdong.png',
    mimeType: 'image/png',
  },
  {
    slug: 'qcvn-25-2025-bct-an-toan-dien-diem-doanh-nghiep-can-quan-tam',
    urls: [
      'https://www.evn.com.vn/Upload/NewsImgCache/xanhhoa120526-20260512082126564_w1024.jpg',
    ],
    filename: 'qcvn-25-2025-an-toan-dien-evn.jpg',
    mimeType: 'image/jpeg',
  },
  {
    slug: 'nha-may-can-kiem-tra-gi-truoc-mua-cao-diem-dien',
    urls: [
      'https://www.evn.com.vn/Upload/NewsImgCache/2752026nhietdienquangninh2-20260527200910137_w1024.jpg',
    ],
    filename: 'kiem-tra-he-thong-dien-truoc-cao-diem-nhiet-dien.jpg',
    mimeType: 'image/jpeg',
  },
  {
    slug: 'luat-dien-luc-61-2024-qh15-nhung-dieu-doanh-nghiep-su-dung-dien-can-biet',
    urls: [
      'https://www.evn.com.vn/userfile/User/ngoctuantuoitre/images/2024/6/tietkiemdien1_10_6_2024.jpg',
    ],
    filename: 'luat-dien-luc-61-2024-qh15-doanh-nghiep-su-dung-dien.jpg',
    mimeType: 'image/jpeg',
  },
  {
    slug: 'chuong-trinh-dieu-chinh-phu-tai-dien-dr-doanh-nghiep-tiet-kiem-duoc-bao-nhieu',
    urls: [
      'https://www.evn.com.vn/userfile/User/ngoctuantuoitre/images/2024/6/tietkiemdien1_10_6_2024.jpg',
    ],
    filename: 'dr-dieu-chinh-phu-tai-tiet-kiem-dien-doanh-nghiep.jpg',
    mimeType: 'image/jpeg',
  },
  {
    slug: 'lich-trien-lam-nganh-dien-nang-luong-tu-dong-hoa-2026',
    urls: [
      'https://automationfiesta.com/wp-content/uploads/2025/11/web_VIAF-2026.jpg',
      'https://automationfiesta.com/wp-content/uploads/2025/11/VIAF-2026-banner.jpg',
    ],
    filename: 'trien-lam-viet-nam-automation-fiesta-dien-nang-luong-2026.jpg',
    mimeType: 'image/jpeg',
  },
];

// ─── Download helper ──────────────────────────────────────────────────────────
function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {
    // ignore — file may already be removed or locked briefly
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    function doRequest(currentUrl, redirectCount) {
      if (redirectCount > 8) {
        reject(new Error('Too many redirects'));
        return;
      }

      const isHttps = currentUrl.startsWith('https');
      const protocol = isHttps ? https : http;

      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const file = fs.createWriteStream(dest);
      let settled = false;

      function abort(err) {
        if (settled) return;
        settled = true;
        // Let the stream finish closing before trying to remove
        file.close(() => {
          safeUnlink(dest);
          reject(err);
        });
      }

      const req = protocol.get(
        currentUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
          },
          timeout: 20000,
        },
        (response) => {
          // Follow redirects
          if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            settled = true;
            file.close(() => {
              safeUnlink(dest);
              let loc = response.headers.location;
              if (loc && !loc.startsWith('http')) {
                try {
                  loc = new URL(loc, new URL(currentUrl)).href;
                } catch (_) {}
              }
              if (!loc) {
                reject(new Error('Redirect with no Location header'));
                return;
              }
              doRequest(loc, redirectCount + 1);
            });
            response.resume(); // drain response
            return;
          }

          if (response.statusCode !== 200) {
            response.resume(); // drain response
            abort(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            if (!settled) {
              settled = true;
              file.close(resolve);
            }
          });

          file.on('error', (err) => abort(err));
          response.on('error', (err) => abort(err));
        },
      );

      req.on('timeout', () => {
        req.destroy();
        abort(new Error(`Timeout`));
      });

      req.on('error', (err) => abort(err));
    }

    doRequest(url, 0);
  });
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
exports.seed = async function (knex) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  console.log(`\n📁 Storage dir: ${STORAGE_DIR}\n`);

  let linked = 0;
  let skipped = 0;

  for (const article of ARTICLES) {
    const { slug, urls, filename, mimeType } = article;

    // Check article exists in DB
    const pageContent = await knex('page_content')
      .where({ slug })
      .whereNull('deleted_at')
      .first('id', 'featured_image_file_id');

    if (!pageContent) {
      console.log(`  ⚠️  [SKIP] Article not found: ${slug}`);
      skipped++;
      continue;
    }

    const destPath = path.win32.join(STORAGE_DIR, filename);

    // If already on disk and large enough, skip download
    const existsOnDisk = fs.existsSync(destPath);
    const diskSize = existsOnDisk ? fs.statSync(destPath).size : 0;
    const needsDownload = !existsOnDisk || diskSize < 1000;

    if (needsDownload) {
      // Clean up stale/partial file first
      safeUnlink(destPath);

      let downloaded = false;

      for (const url of urls) {
        try {
          console.log(`  ⬇️  ${filename}`);
          console.log(`       ${url}`);
          await downloadFile(url, destPath);

          // Verify file size
          const size = fs.statSync(destPath).size;
          if (size < 1000) {
            safeUnlink(destPath);
            throw new Error(`Too small (${size} B)`);
          }

          console.log(`  ✅ ${(size / 1024).toFixed(1)} KB`);
          downloaded = true;
          break;
        } catch (err) {
          console.log(`  ❌ ${err.message}`);
          safeUnlink(destPath);
        }
      }

      if (!downloaded) {
        console.log(`  ⚠️  [SKIP] All URLs failed for: ${slug}\n`);
        skipped++;
        continue;
      }
    } else {
      console.log(`  ✅ Already on disk: ${filename} (${(diskSize / 1024).toFixed(1)} KB)`);
    }

    const fileSize = fs.statSync(destPath).size;

    // Upsert file_metadata
    const existing = await knex('file_metadata')
      .where({ stored_path: destPath })
      .first('id');

    let fileId;

    if (existing) {
      fileId = existing.id;
      console.log(`  📎 Reusing file_metadata: ${fileId}`);
    } else {
      const [inserted] = await knex('file_metadata')
        .insert({
          original_filename: filename,
          stored_path: destPath,
          file_size: fileSize,
          mime_type: mimeType,
          storage_location: 'local',
          purpose: 'other',
          is_orphan: false,
        })
        .returning('*');
      fileId = inserted.id;
      console.log(`  📎 Created file_metadata: ${fileId}`);
    }

    // Link to article
    await knex('page_content').where({ slug }).update({
      featured_image_file_id: fileId,
      updated_at: knex.fn.now(),
    });

    console.log(`  🔗 Linked → ${slug}\n`);
    linked++;
  }

  console.log('─────────────────────────────────────────');
  console.log(`✅ Done — ${linked} linked, ${skipped} skipped`);
  console.log('─────────────────────────────────────────\n');
};
