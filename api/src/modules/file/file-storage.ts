import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { config as loadDotEnv } from 'dotenv';

function loadLocalEnvForStorage(): void {
  const envPath = resolve(process.cwd(), '.env');

  if (existsSync(envPath)) {
    loadDotEnv({ path: envPath });
  }
}

loadLocalEnvForStorage();

const DEFAULT_STORAGE_ROOT = resolve(process.cwd(), 'storage');

function resolveStorageRoot(envName: string, fallbackPath: string): string {
  const configuredPath = process.env[envName]?.trim();
  return resolve(configuredPath || fallbackPath);
}

const API_STORAGE_ROOT = resolveStorageRoot('API_STORAGE_ROOT', DEFAULT_STORAGE_ROOT);

export const FILE_LIBRARY_STORAGE_ROOT = resolveStorageRoot(
  'FILE_LIBRARY_STORAGE_ROOT',
  resolve(API_STORAGE_ROOT, 'file-library')
);

export const IMPORT_WORKBOOK_STORAGE_ROOT = resolveStorageRoot(
  'IMPORT_WORKBOOK_STORAGE_ROOT',
  resolve(API_STORAGE_ROOT, 'import-workbooks')
);

export function resolveStoredFilePath(storedPath: string): string {
  const resolvedPath = resolve(storedPath);

  if (isPathInsideFileLibraryRoot(resolvedPath) || !isAbsolute(resolvedPath)) {
    return resolvedPath;
  }

  const legacyRelativePath = extractLegacyFileLibraryRelativePath(resolvedPath);

  if (!legacyRelativePath) {
    return resolvedPath;
  }

  const remappedPath = resolve(FILE_LIBRARY_STORAGE_ROOT, legacyRelativePath);

  return existsSync(remappedPath) ? remappedPath : resolvedPath;
}

export function isPathWithinFileLibraryStorageRoot(storedPath: string): boolean {
  const resolvedPath = resolveStoredFilePath(storedPath);
  return isPathInsideFileLibraryRoot(resolvedPath);
}

export function isPathWithinImportWorkbookStorageRoot(storedPath: string): boolean {
  const resolvedPath = resolve(storedPath);
  return isPathInsideRoot(IMPORT_WORKBOOK_STORAGE_ROOT, resolvedPath);
}

function isPathInsideFileLibraryRoot(resolvedPath: string): boolean {
  return isPathInsideRoot(FILE_LIBRARY_STORAGE_ROOT, resolvedPath);
}

function isPathInsideRoot(rootPath: string, resolvedPath: string): boolean {
  const relativePath = relative(rootPath, resolvedPath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !isAbsolute(relativePath))
  );
}

function extractLegacyFileLibraryRelativePath(resolvedPath: string): string | null {
  const segments = resolvedPath.split(/[\\/]+/);
  const storageIndex = segments.findIndex(
    (segment, index) =>
      segment.toLowerCase() === 'storage' &&
      segments[index + 1]?.toLowerCase() === 'file-library'
  );

  if (storageIndex < 0) {
    return null;
  }

  const relativeSegments = segments.slice(storageIndex + 2).filter(Boolean);

  return relativeSegments.length > 0 ? relativeSegments.join(sep) : '';
}
