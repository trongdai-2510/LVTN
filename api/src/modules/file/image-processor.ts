// API emits CommonJS without esModuleInterop; sharp's require export is callable.
const sharp: typeof import('sharp').default = require('sharp');

/**
 * Các extension ảnh có thể xử lý (resize, convert sang WebP, strip EXIF).
 * SVG bỏ qua vì là vector, không cần optimize.
 */
const PROCESSABLE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * Kích thước tối đa cho cạnh dài nhất của ảnh (px).
 * Ảnh lớn hơn sẽ được resize xuống.
 */
const MAX_IMAGE_DIMENSION = 1920;

/**
 * Chất lượng WebP (0-100). 80 là balance tốt giữa quality và dung lượng.
 */
const WEBP_QUALITY = 80;

export interface ProcessedImage {
  buffer: Buffer;
  extension: '.webp';
  mimeType: 'image/webp';
}

/**
 * Kiểm tra extension có thuộc loại ảnh có thể xử lý không.
 * SVG, PDF, DOCX, ... trả về false.
 */
export function isProcessableImage(extension: string): boolean {
  return PROCESSABLE_IMAGE_EXTENSIONS.has(extension.toLowerCase());
}

/**
 * Xử lý ảnh:
 * 1. Strip EXIF (xóa GPS coordinates, metadata) — sharp mặc định strip
 * 2. Resize về tối đa MAX_IMAGE_DIMENSION px ở cạnh dài nhất (chỉ khi cần)
 * 3. Convert sang WebP với quality WEBP_QUALITY
 *
 * Nếu ảnh không processable (SVG, PDF, ...) hoặc có lỗi, trả về null.
 * Caller sẽ dùng buffer gốc trong trường hợp đó.
 */
export async function processImageBuffer(
  buffer: Buffer,
  extension: string
): Promise<ProcessedImage | null> {
  if (!isProcessableImage(extension)) {
    return null;
  }

  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Chỉ resize nếu ảnh lớn hơn MAX_IMAGE_DIMENSION
    const needsResize =
      (metadata.width && metadata.width > MAX_IMAGE_DIMENSION) ||
      (metadata.height && metadata.height > MAX_IMAGE_DIMENSION);

    if (needsResize) {
      image.resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert sang WebP (sharp mặc định strip EXIF)
    const processedBuffer = await image
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    return {
      buffer: processedBuffer,
      extension: '.webp',
      mimeType: 'image/webp'
    };
  } catch {
    // Nếu có lỗi (ảnh hỏng, memory, ...), trả null để dùng ảnh gốc
    return null;
  }
}
