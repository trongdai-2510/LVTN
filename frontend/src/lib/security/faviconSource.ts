const MANAGED_FILE_PATH = /^\/public\/files\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon'
]);
const MAX_FAVICON_BYTES = 1_000_000;

export function resolveManagedFaviconUrl(source: string, apiBaseUrl: string): string | null {
  if (!MANAGED_FILE_PATH.test(source)) return null;

  try {
    const baseUrl = new URL(apiBaseUrl);
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
      return null;
    }
    return new URL(source, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function readFaviconImage(response: Response): Promise<string> {
  if (!response.ok) throw new Error(`Unable to load favicon: HTTP ${response.status}`);

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (!contentType || !IMAGE_TYPES.has(contentType)) {
    throw new Error('Unsupported favicon content type.');
  }

  const contentLength = Number(response.headers.get('content-length'));
  if (contentLength > MAX_FAVICON_BYTES) throw new Error('Favicon size limit exceeded.');

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Favicon response has no body.');

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_FAVICON_BYTES) throw new Error('Favicon size limit exceeded.');
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  return `data:${contentType};base64,${Buffer.concat(chunks, totalBytes).toString('base64')}`;
}
