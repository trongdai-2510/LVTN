import { PERMISSIONS } from './permissions';

const routePermissions: Array<{ prefix: string; permission?: string }> = [
  { prefix: '/home-page', permission: PERMISSIONS.homePageRead },
  { prefix: '/website-settings', permission: PERMISSIONS.websiteSettingsRead },
  { prefix: '/menu', permission: PERMISSIONS.menuRead },
  { prefix: '/page-contents', permission: PERMISSIONS.pageContentRead },
  { prefix: '/banners', permission: PERMISSIONS.bannerRead },
  { prefix: '/redirects', permission: PERMISSIONS.redirectRead },
  { prefix: '/files', permission: PERMISSIONS.fileRead },
  { prefix: '/product-categories', permission: PERMISSIONS.productCategoryRead },
  { prefix: '/brands', permission: PERMISSIONS.brandRead },
  { prefix: '/product-groups', permission: PERMISSIONS.productGroupRead },
  { prefix: '/product-variants', permission: PERMISSIONS.productVariantRead },
  { prefix: '/technical-documents', permission: PERMISSIONS.technicalDocumentRead },
  { prefix: '/services', permission: PERMISSIONS.serviceRead },
  { prefix: '/projects', permission: PERMISSIONS.projectRead },
  { prefix: '/customers', permission: PERMISSIONS.customerRead },
  { prefix: '/contacts', permission: PERMISSIONS.contactRead },
  { prefix: '/quotes', permission: PERMISSIONS.quoteRead },
  { prefix: '/import', permission: PERMISSIONS.importRead },
  { prefix: '/audit-logs', permission: PERMISSIONS.auditLogRead },
  { prefix: '/users', permission: PERMISSIONS.adminUserRead },
  { prefix: '/roles', permission: PERMISSIONS.adminRoleRead },
  { prefix: '/dashboard' },
  { prefix: '/access-denied' }
];

export function getRoutePermission(pathname: string) {
  const match = routePermissions.find(
    (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
  );
  return match?.permission;
}
