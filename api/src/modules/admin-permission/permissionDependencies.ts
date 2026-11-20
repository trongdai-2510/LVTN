export interface MissingPermissionDependency {
  permission_code: string;
  missing_permission_code: string;
}

const READ_PERMISSION_FALLBACKS: Readonly<Record<string, string>> = {
  website_settings_social_link: 'website_settings.read',
  menu_item: 'menu.read',
  service_product_group: 'service.read',
  project_product_group: 'project.read',
  contact_note: 'contact.read',
  quote_note: 'quote.read'
};

export function getRequiredReadPermissionCodes(
  permissionCode: string,
  availablePermissionCodes: readonly string[]
): string[] {
  const lastDotIndex = permissionCode.lastIndexOf('.');
  if (lastDotIndex < 1 || permissionCode.slice(lastDotIndex + 1) === 'read') {
    return [];
  }

  const resourceKey = permissionCode.slice(0, lastDotIndex);
  const available = new Set(availablePermissionCodes);
  const directReadCode = `${resourceKey}.read`;
  if (available.has(directReadCode)) {
    return [directReadCode];
  }

  const fallbackReadCode = READ_PERMISSION_FALLBACKS[resourceKey];
  return fallbackReadCode && available.has(fallbackReadCode) ? [fallbackReadCode] : [];
}

export function findMissingPermissionDependencies(
  selectedPermissionCodes: readonly string[],
  availablePermissionCodes: readonly string[]
): MissingPermissionDependency[] {
  const selected = new Set(selectedPermissionCodes);
  const missing: MissingPermissionDependency[] = [];

  for (const permissionCode of selectedPermissionCodes) {
    for (const requiredCode of getRequiredReadPermissionCodes(
      permissionCode,
      availablePermissionCodes
    )) {
      if (!selected.has(requiredCode)) {
        missing.push({
          permission_code: permissionCode,
          missing_permission_code: requiredCode
        });
      }
    }
  }

  return missing;
}
