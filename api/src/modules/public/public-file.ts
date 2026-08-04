import { isPathWithinFileLibraryStorageRoot } from '../file/file-storage';
import { isR2FileLibraryObjectKey } from '../file/r2-storage';
import type { PublicFileSummary } from './public.types';

const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//i;

export interface PublicFileRecord {
  id: string;
  original_filename: string;
  mime_type: string;
  storage_location: string;
  stored_path: string;
}

export function buildPublicFileUrl(fileId: string): string {
  return `/public/files/${encodeURIComponent(fileId)}`;
}

export function toPublicFileSummary(file: PublicFileRecord): PublicFileSummary {
  return {
    id: file.id,
    original_filename: file.original_filename,
    mime_type: file.mime_type,
    url: resolvePublicFilePath(file)
  };
}

function resolvePublicFilePath(file: PublicFileRecord): string {
  if (file.storage_location === 'local') {
    return isPathWithinFileLibraryStorageRoot(file.stored_path)
      ? buildPublicFileUrl(file.id)
      : '';
  }

  if (file.storage_location === 'r2') {
    return isR2FileLibraryObjectKey(file.stored_path)
      ? buildPublicFileUrl(file.id)
      : '';
  }

  if (
    ABSOLUTE_HTTP_URL_PATTERN.test(file.stored_path) ||
    file.stored_path.startsWith('/')
  ) {
    return file.stored_path;
  }

  return '';
}
