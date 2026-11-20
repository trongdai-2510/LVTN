import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// API emits CommonJS without esModuleInterop; sharp's require export is callable.
const sharp: typeof import('sharp').default = require('sharp');

const WATERMARK_LOGO_PATH = resolve(process.cwd(), 'assets', 'watermark-logo.png');
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Watermark = logo Song Thanh thật. Chỉnh kích thước / độ mờ / lề ở đây.
const WATERMARK_WIDTH_RATIO = 0.5; // bề rộng watermark ≈ 50% bề rộng ảnh
const WATERMARK_MAX_WIDTH = 420;
const WATERMARK_MIN_WIDTH = 150;
const WATERMARK_OPACITY = 0.55;
const WATERMARK_MARGIN_RATIO = 0.045;
const WATERMARK_MARGIN_MAX = 24;

type CachedLogo = { buffer: Buffer; width: number; height: number };

let watermarkLogoCache: CachedLogo | null = null;

async function applyOpacity(pngBuffer: Buffer, opacity: number): Promise<Buffer> {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 3; index < data.length; index += 4) {
    data[index] = Math.round(data[index] * opacity);
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toBuffer();
}
async function getWatermarkLogo(): Promise<CachedLogo> {
  if (watermarkLogoCache) {
    return watermarkLogoCache;
  }

  const raw = await readFile(WATERMARK_LOGO_PATH);

  // Cắt viền trong suốt cho logo sát mép (nhìn lớn & cân hơn), rồi áp sẵn độ mờ.
  let trimmed: Buffer;
  try {
    trimmed = await sharp(raw).trim().ensureAlpha().png().toBuffer();
  } catch {
    trimmed = await sharp(raw).ensureAlpha().png().toBuffer();
  }

  const faded = await applyOpacity(trimmed, WATERMARK_OPACITY);
  const metadata = await sharp(faded).metadata();

  watermarkLogoCache = {
    buffer: faded,
    width: metadata.width ?? 300,
    height: metadata.height ?? 92
  };

  return watermarkLogoCache;
}

export function isWatermarkableMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}

export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const logo = await getWatermarkLogo();
  const metadata = await sharp(imageBuffer).metadata();
  const imageWidth = metadata.width ?? 800;
  const imageHeight = metadata.height ?? 600;

  const aspectRatio = logo.width / logo.height;
  const watermarkWidth = Math.round(
    Math.max(
      WATERMARK_MIN_WIDTH,
      Math.min(imageWidth * WATERMARK_WIDTH_RATIO, WATERMARK_MAX_WIDTH)
    )
  );
  const watermarkHeight = Math.round(watermarkWidth / aspectRatio);
  const margin = Math.round(Math.min(imageWidth * WATERMARK_MARGIN_RATIO, WATERMARK_MARGIN_MAX));

  const resizedWatermark = await sharp(logo.buffer)
    .resize(watermarkWidth, watermarkHeight, { fit: 'inside' })
    .png()
    .toBuffer();

  const top = Math.max(0, imageHeight - watermarkHeight - margin);
  const left = Math.max(0, imageWidth - watermarkWidth - margin);

  return sharp(imageBuffer)
    .composite([{ input: resizedWatermark, top, left }])
    .png()
    .toBuffer();
}
