export const endpoints = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
    changePassword: '/auth/change-password'
  },
  public: {
    productGroups: '/public/product-groups'
  },
  songThanh: {
    dashboardAnalytics: '/song-thanh/dashboard/analytics',
    homePage: '/song-thanh/home-page',
    websiteSettings: '/song-thanh/website-settings',
    socialLinks: '/song-thanh/website-settings/social-links',
    menus: '/song-thanh/menus',
    menuItems: '/song-thanh/menu-items',
    pageContents: '/song-thanh/page-contents',
    brandPages: '/song-thanh/brand-pages',
    newsCategories: '/song-thanh/news-categories',
    banners: '/song-thanh/banners',
    redirects: '/song-thanh/redirects',
    files: '/song-thanh/files',
    fileUpload: '/song-thanh/files/upload',
    fileUsageRecords: '/song-thanh/files/usage-records',
    fileUsages: '/song-thanh/file-usages',
    productCategories: '/song-thanh/product-categories',
    brands: '/song-thanh/brands',
    productGroups: '/song-thanh/product-groups',
    productVariants: '/song-thanh/product-variants',
    variantAttributeNameSuggestions: '/admin/variant-attributes/name-suggestions',
    technicalDocuments: '/song-thanh/technical-documents',
    services: '/song-thanh/services',
    projects: '/song-thanh/projects',
    contacts: '/song-thanh/contacts',
    customers: '/song-thanh/customers',
    quotes: '/song-thanh/quotes',
    adminUsers: '/song-thanh/admin-users',
    adminRoles: '/song-thanh/admin-roles',
    importBatches: '/song-thanh/import-batches',
    importBatchUpload: '/song-thanh/import-batches/upload',
    importConflicts: '/song-thanh/import-conflicts',
    auditLogs: '/song-thanh/audit-logs'
  }
} as const;

export function byId(base: string, id: string) {
  return `${base}/${encodeURIComponent(id)}`;
}
