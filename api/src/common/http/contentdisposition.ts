export type ContentDispositionKind = 'inline' | 'attachment';

export function buildContentDisposition(
  disposition: ContentDispositionKind,
  filename: string
): string {
  const safeUnicodeName = normalizeHeaderFilename(filename);
  const asciiName = createAsciiFallback(safeUnicodeName);
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeHeaderFilename(safeUnicodeName)}`;
}

function normalizeHeaderFilename(value: string): string {
  const withoutUnsafeCodeUnits = Array.from(value.trim(), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 0xd800 && codePoint <= 0xdfff ? '\uFFFD' : character;
  }).join('');
  const withoutControls = withoutUnsafeCodeUnits.replace(/[\u0000-\u001f\u007f]/g, '_');
  return withoutControls || 'song-thanh-file';
}

function createAsciiFallback(value: string): string {
  const fallback = value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\/]/g, '_')
    .replace(/_+/g, '_')
    .trim();
  return fallback || 'song-thanh-file';
}

function encodeHeaderFilename(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
