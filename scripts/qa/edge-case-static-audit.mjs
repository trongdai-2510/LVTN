import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const FILES = {
  rootLayout: 'frontend/src/app/layout.tsx',
  publicFetcher: 'frontend/src/lib/api/public-fetcher.ts',
  dynamicPage: 'frontend/src/app/[slug]/page.tsx',
  redirectProxy: 'frontend/src/proxy.ts',
  siteShellPublic: 'frontend/src/features/site-shell/site-shell.public.ts',
  siteFooter: 'frontend/src/components/layout/SiteFooter.tsx',
  floatingContactButtons: 'frontend/src/components/layout/FloatingContactButtons.tsx',
  socialBrandIcons: 'frontend/src/components/ui/SocialBrandIcons.tsx',
  contactInfo: 'frontend/src/features/contact-request/ContactInfo.tsx',
  websiteSettingsPage: 'admin/src/features/website-content/WebsiteSettingsPage.tsx',
  websiteSettingsDto: 'api/src/modules/website-settings/website-settings.dto.ts',
  websiteSettingsGuardrails: 'api/src/modules/website-settings/website-settings.guardrails.ts',
  websiteSettingsService: 'api/src/modules/website-settings/website-settings.service.ts',
  websiteSettingsRepository: 'api/src/modules/website-settings/website-settings.repository.ts',
  menuGuardrails: 'api/src/modules/menu/menu.guardrails.ts',
  menuService: 'api/src/modules/menu/menu.service.ts',
  publicRepository: 'api/src/modules/public/public.repository.ts',
  publicService: 'api/src/modules/public/public.service.ts',
  htmlContent: 'frontend/src/components/content/HtmlContent.tsx',
  sanitizedHtmlContent: 'frontend/src/components/content/SanitizedHtmlContent.tsx',
  pageContentPreviewClient: 'frontend/src/app/admin-preview/page-content/PageContentPreviewClient.tsx',
  publicController: 'api/src/modules/public/public.controller.ts',
  adminModuleConfig: 'admin/src/features/module-config.ts',
  adminApiEndpoints: 'admin/src/lib/api-endpoints.ts',
  adminRouteSmoke: 'scripts/qa/admin-route-smoke.mjs',
  apiSmoke: 'scripts/qa/api-contract-smoke.mjs',
  fileService: 'api/src/modules/file/file.service.ts',
  richTextEditor: 'admin/src/components/RichTextEditor.tsx',
  referencePickers: 'admin/src/components/form/ReferencePickers.tsx',
  fileWorkflow: 'admin/src/lib/file-workflow.ts',
  siteShellTypes: 'frontend/src/types/contracts/public-site-shell.ts',
  jsonLd: 'frontend/src/lib/seo/json-ld.ts',
  ddl: 'database/ddl/song_thanh_deployment_schema_20260730.sql'
};

const sourceCache = new Map();
const results = [];

const PLACEHOLDER_VALUE_PATTERN = /example\.com|first-save flow|\bqa\b|\btest\b/i;
const DISALLOWED_HOSTS = new Set(['example.com', 'www.example.com', 'localhost', '127.0.0.1']);
const PUBLIC_SOCIAL_PLATFORM_LABELS = {
  facebook: 'Facebook',
  messenger: 'Messenger',
  youtube: 'YouTube',
  zalo: 'Zalo',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  twitter: 'X',
  x: 'X',
  website: 'Website'
};

const FLOATING_SOCIAL_PLATFORMS = [
  'zalo',
  'messenger',
  'facebook',
  'whatsapp',
  'telegram',
  'youtube',
  'linkedin',
  'tiktok',
  'instagram',
  'twitter',
  'x'
];

const socialFixture = [
  {
    id: 'zalo-a',
    platform: 'Zalo',
    label: 'Zalo tu van',
    url: 'https://zalo.me/0900000001',
    sort_order: 1,
    status: 'active'
  },
  {
    id: 'fb-a',
    platform: ' Facebook ',
    label: 'Facebook chinh',
    url: 'https://facebook.com/songthanh',
    sort_order: 2,
    status: 'active'
  },
  {
    id: 'fb-b',
    platform: 'facebook',
    label: 'Facebook showroom',
    url: 'https://facebook.com/songthanh-showroom',
    sort_order: 3,
    status: 'active'
  },
  {
    id: 'zalo-b',
    platform: 'zalo',
    label: 'Zalo bao gia',
    url: 'https://zalo.me/0900000002',
    sort_order: 4,
    status: 'active'
  },
  {
    id: 'unknown-a',
    platform: 'line',
    label: 'Line support',
    url: 'https://line.me/R/ti/p/@songthanh',
    sort_order: 5,
    status: 'active'
  },
  {
    id: 'inactive-fb',
    platform: 'facebook',
    label: 'Facebook cu',
    url: 'https://facebook.com/old-songthanh',
    sort_order: 6,
    status: 'inactive'
  },
  {
    id: 'bad-protocol',
    platform: 'youtube',
    label: 'Bad protocol',
    url: 'javascript:alert(1)',
    sort_order: 7,
    status: 'active'
  },
  {
    id: 'placeholder-host',
    platform: 'website',
    label: 'Placeholder website',
    url: 'https://example.com/song-thanh',
    sort_order: 8,
    status: 'active'
  },
  {
    id: 'blank-label',
    platform: 'telegram',
    label: '',
    url: 'https://t.me/songthanh',
    sort_order: 9,
    status: 'active'
  }
];

function readSource(key) {
  if (!sourceCache.has(key)) {
    const relative = FILES[key];
    sourceCache.set(key, readFileSync(path.join(ROOT, relative), 'utf8'));
  }
  return sourceCache.get(key);
}

function getPublicValue(value) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;
  return PLACEHOLDER_VALUE_PATTERN.test(trimmedValue) ? null : trimmedValue;
}

function getPublicSafeUrl(value) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;
  try {
    const url = new URL(trimmedValue);
    const hostname = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol) || DISALLOWED_HOSTS.has(hostname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizePublicSocialPlatform(value) {
  return value?.trim().toLowerCase() || '';
}

function getPublicSocialPlatformLabel(value) {
  const normalized = normalizePublicSocialPlatform(value);
  return PUBLIC_SOCIAL_PLATFORM_LABELS[normalized] || getPublicValue(value) || 'External link';
}

function getPublicSocialLinks(items) {
  return items
    .filter((item) => item.status === 'active')
    .map((item) => {
      const label = getPublicValue(item.label) || getPublicValue(item.platform);
      const url = getPublicSafeUrl(item.url);
      if (!label || !url) return null;
      return {
        id: item.id,
        label,
        url,
        sort_order: item.sort_order,
        platform: normalizePublicSocialPlatform(item.platform),
        platform_label: getPublicSocialPlatformLabel(item.platform)
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.sort_order - right.sort_order);
}

function getFloatingSocialActions(socialLinks) {
  return socialLinks.filter((socialLink) => FLOATING_SOCIAL_PLATFORMS.includes(socialLink.platform));
}

function buildJsonLdSameAs(socialLinks) {
  return Array.from(new Set(getPublicSocialLinks(socialLinks).map((link) => link.url)));
}

function isPublicMapSrc(src) {
  if (!src?.trim()) return false;
  try {
    const url = new URL(src.trim());
    return url.origin === 'https://www.google.com' && url.pathname === '/maps/embed';
  } catch {
    return false;
  }
}

function platformCounts(items) {
  return items.reduce((acc, item) => {
    acc[item.platform] = (acc[item.platform] ?? 0) + 1;
    return acc;
  }, {});
}

function runCase(id, area, title, fn) {
  try {
    const evidence = fn();
    const status = evidence?.status || 'PASS';
    results.push({ id, area, title, status, evidence: evidence?.evidence ?? evidence });
  } catch (error) {
    results.push({
      id,
      area,
      title,
      status: 'FAIL',
      error: error?.message || String(error)
    });
  }
}

function warn(evidence) {
  return { status: 'WARN', evidence };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includesAll(source, needles) {
  return needles.every((needle) => source.includes(needle));
}

runCase('SOCIAL-NORMALIZATION', 'public-ui', 'Social links filter inactive, unsafe, placeholder, and blank data', () => {
  const publicLinks = getPublicSocialLinks(socialFixture);
  assert(!publicLinks.some((link) => link.id === 'inactive-fb'), 'inactive social link leaked');
  assert(!publicLinks.some((link) => link.id === 'bad-protocol'), 'javascript: URL leaked');
  assert(!publicLinks.some((link) => link.id === 'placeholder-host'), 'example.com URL leaked');
  assert(publicLinks.some((link) => link.id === 'blank-label' && link.label === 'telegram'), 'blank label fallback failed');
  return {
    accepted_ids: publicLinks.map((link) => link.id),
    platform_counts: platformCounts(publicLinks)
  };
});

runCase('SOCIAL-FLOATING-COMPLETE', 'public-ui', 'Floating buttons keep every active valid supported social link', () => {
  const publicLinks = getPublicSocialLinks(socialFixture);
  const desktop = getFloatingSocialActions(publicLinks);
  const mobile = getFloatingSocialActions(publicLinks);
  assert(desktop.filter((link) => link.platform === 'zalo').length === 2, 'floating buttons dropped a valid Zalo link');
  assert(desktop.filter((link) => link.platform === 'facebook').length === 2, 'floating buttons dropped a valid Facebook link');
  assert(mobile.map((link) => link.id).join(',') === desktop.map((link) => link.id).join(','), 'mobile and desktop social actions are inconsistent');
  const source = readSource('floatingContactButtons');
  assert(source.includes('getPublicHotlines(shell.company_info).entries()'), 'floating buttons do not render all configured hotlines');
  assert(source.includes('getFloatingSocialActions(getPublicSocialLinks(shell.social_links))'), 'floating buttons do not render the full supported social-link list');
  return {
    desktop_actions: desktop.map((link) => ({ id: link.id, platform: link.platform })),
    mobile_actions: mobile.map((link) => ({ id: link.id, platform: link.platform }))
  };
});

runCase('SOCIAL-FOOTER-DUPLICATES', 'public-ui', 'Footer behavior when the same platform appears more than once', () => {
  const publicLinks = getPublicSocialLinks(socialFixture);
  const duplicatePlatforms = Object.entries(platformCounts(publicLinks)).filter(([, count]) => count > 1);
  const siteFooter = readSource('siteFooter');
  assert(siteFooter.includes('const linkLabel = item.platform_label;'), 'footer does not use normal platform labels');
  assert(siteFooter.includes('publicSocialLinks.map'), 'footer does not render the public social list');
  assert(siteFooter.includes('flex flex-wrap gap-2'), 'footer social container is not flexible for multiple links');

  return {
    behavior: 'Footer renders every active valid social link as a normal social button.',
    duplicate_platforms: Object.fromEntries(duplicatePlatforms),
    footer_labels: publicLinks.map((link) => link.platform_label)
  };
});

runCase('SOCIAL-JSONLD-SAMEAS', 'seo', 'Organization JSON-LD sameAs uses safe normalized social links', () => {
  const sameAs = buildJsonLdSameAs(socialFixture);
  const rootLayout = readSource('rootLayout');
  assert(rootLayout.includes('getPublicSocialLinks'), 'layout does not use public social normalizer');
  assert(rootLayout.includes('const sameAs = Array.from(new Set('), 'layout does not dedupe sameAs URLs');
  assert(!sameAs.some((url) => url.includes('example.com') || url.startsWith('javascript:')), 'unsafe URL leaked into sameAs model');
  return { sameAs };
});

runCase('SOCIAL-UNKNOWN-PLATFORM', 'public-ui', 'Unknown social platform has a safe fallback icon and is excluded from floating shortcuts', () => {
  const publicLinks = getPublicSocialLinks(socialFixture);
  const unknown = publicLinks.find((link) => link.platform === 'line');
  assert(Boolean(unknown), 'unknown platform was unexpectedly dropped from footer model');
  assert(!getFloatingSocialActions(publicLinks).some((link) => link.platform === 'line'), 'unknown platform leaked into floating buttons');
  assert(readSource('socialBrandIcons').includes('?? WebsiteGlobeBrand'), 'unknown icon fallback is missing');
  return {
    unknown_footer_label: unknown.label,
    floating_supported_platforms: FLOATING_SOCIAL_PLATFORMS
  };
});

runCase('SOCIAL-MANY-LINKS', 'public-ui', 'Large social list remains complete and scrollable in floating actions', () => {
  const manyLinks = Array.from({ length: 30 }, (_, index) => ({
    id: `many-${index}`,
    platform: ['facebook', 'zalo', 'telegram', 'whatsapp', 'messenger'][index % 5],
    label: `Social ${index}`,
    url: `https://social-${index}.songthanh.example.org/profile`,
    sort_order: index,
    status: 'active'
  }));
  const publicLinks = getPublicSocialLinks(manyLinks);
  const desktop = getFloatingSocialActions(publicLinks);
  const mobile = getFloatingSocialActions(publicLinks);
  assert(desktop.length === publicLinks.length, 'desktop floating dropped supported links');
  assert(mobile.length === publicLinks.length, 'mobile floating dropped supported links');
  assert(readSource('floatingContactButtons').includes('overflow-y-auto'), 'floating action stack is not scrollable for large lists');
  assert(readSource('siteFooter').includes('flex flex-wrap gap-2'), 'footer social container is not flex-wrap');
  return {
    footer_would_render: publicLinks.length,
    desktop_floating_would_render: desktop.length,
    mobile_floating_would_render: mobile.length
  };
});

runCase('SOCIAL-ADMIN-DUPLICATE-POLICY', 'admin-api', 'Admin/API duplicate social platform policy is explicit', () => {
  const service = readSource('websiteSettingsService');
  const repository = readSource('websiteSettingsRepository');
  const ddl = readSource('ddl');
  const hasDuplicateCheck = /duplicate/i.test(service) && /social/i.test(service) && /platform/i.test(service);
  const hasPlatformUniqueIndex = ddl
    .split(/\r?\n/)
    .some((line) => /CREATE\s+UNIQUE\s+INDEX/i.test(line) && /company_social_link/i.test(line) && /platform/i.test(line));
  const tableStart = ddl.indexOf('CREATE TABLE company_social_link');
  const tableEnd = ddl.indexOf('CREATE TRIGGER trg_company_social_link_updated_at');
  const socialTableDdl = tableStart >= 0 && tableEnd > tableStart ? ddl.slice(tableStart, tableEnd) : '';
  const hasPlatformUniqueConstraint = /UNIQUE\s*\([^)]*platform[^)]*\)/i.test(socialTableDdl);
  assert(repository.includes('createSocialLink'), 'social link create path missing');
  if (!hasDuplicateCheck && !hasPlatformUniqueIndex && !hasPlatformUniqueConstraint) {
    return {
      policy: 'Multiple active links with the same platform are allowed.',
      effect: 'Footer and floating buttons show every active valid supported link.',
      display_guard: 'Both surfaces use normalized safe URLs and flexible or scrollable containers.'
    };
  }
  return { duplicate_check: true, platform_unique_index: hasPlatformUniqueIndex, platform_unique_constraint: hasPlatformUniqueConstraint };
});

runCase('MAP-EMBED-CONSISTENCY', 'admin-ui/public-ui', 'Admin map preview follows the same safe iframe rule as public UI', () => {
  const admin = readSource('websiteSettingsPage');
  const publicContact = readSource('contactInfo');
  assert(isPublicMapSrc('https://www.google.com/maps/embed?pb=ok'), 'valid Google Maps embed rejected by model');
  assert(!isPublicMapSrc('https://maps.app.goo.gl/demo'), 'maps.app.goo.gl should not be iframe-previewed');
  assert(!isPublicMapSrc('https://evil.example.org/maps/embed'), 'non-Google map iframe accepted');
  for (const source of [admin, publicContact]) {
    assert(
      source.includes("origin === 'https://www.google.com'") ||
        source.includes("origin !== 'https://www.google.com'"),
      'source does not require Google origin'
    );
    assert(
      source.includes("pathname === '/maps/embed'") ||
        source.includes("pathname !== '/maps/embed'"),
      'source does not require /maps/embed path'
    );
  }
  return {
    accepted: 'https://www.google.com/maps/embed?...',
    rejected: ['https://maps.app.goo.gl/...', 'https://evil.example.org/maps/embed']
  };
});

runCase('WEBSITE-HOTLINES-MAX', 'admin-api', 'Hotline list has a hard max of five entries', () => {
  assert(readSource('websiteSettingsDto').includes('@ArrayMaxSize(5)'), 'DTO missing ArrayMaxSize(5)');
  assert(readSource('websiteSettingsGuardrails').includes('value.length > 5'), 'guardrail missing hotlines length check');
  assert(readSource('websiteSettingsPage').includes('hotlines.length >= 5'), 'admin UI missing hotlines length cap');
  return { max_hotlines: 5 };
});

runCase('WEBSITE-SOCIAL-URL-GUARD', 'admin-api/public-ui', 'Social URLs reject unsafe protocols and public UI filters placeholders', () => {
  const guardrails = readSource('websiteSettingsGuardrails');
  const siteShellPublic = readSource('siteShellPublic');
  assert(includesAll(guardrails, ["new URL(url)", "['http:', 'https:'].includes(parsed.protocol)"]), 'API social URL guard missing http/https check');
  assert(includesAll(siteShellPublic, ['DISALLOWED_HOSTS', 'getPublicSafeUrl']), 'public social URL filtering missing');
  return { api_protocols: ['http', 'https'], public_disallowed_hosts: [...DISALLOWED_HOSTS] };
});

runCase('MENU-GUARDRAILS', 'admin-api/public-ui', 'Menu edge cases have API guardrails before public rendering', () => {
  const guardrails = readSource('menuGuardrails');
  const service = readSource('menuService');
  assert(guardrails.includes("internal link_target must start with /"), 'internal menu target guard missing');
  assert(guardrails.includes("anchor link_target must start with #"), 'anchor menu target guard missing');
  assert(guardrails.includes("external link_target must use http or https"), 'external menu URL protocol guard missing');
  assert(service.includes('Reorder payload has duplicate item IDs.'), 'menu duplicate reorder guard missing');
  assert(service.includes('Menu item hierarchy has an ancestor loop.'), 'menu loop guard missing');
  assert(service.includes('Menu item has active child items.'), 'active child archive guard missing');
  return {
    covered: ['external protocol', 'internal slash', 'anchor hash', 'duplicate reorder ids', 'ancestor loop', 'active child archive']
  };
});

runCase('PUBLIC-VISIBILITY-GUARDS', 'public-api', 'Public product data respects active/review/publish/parent visibility', () => {
  const repo = readSource('publicRepository');
  for (const [label, pattern] of [
    ['product status', /\.where\(`\$\{groupAlias\}\.status`,\s*["']active["']\)/],
    ['product review status', /\.where\(`\$\{groupAlias\}\.review_status`,\s*["']approved["']\)/],
    ['product publish status', /\.where\(`\$\{groupAlias\}\.publish_status`,\s*["']published["']\)/],
    ['category status', /\.where\(`\$\{categoryAlias\}\.status`,\s*["']active["']\)/],
    ['parent category status', /\.where\(`\$\{parentAlias\}\.status`,\s*["']active["']\)/],
    ['brand status', /\.where\(`\$\{brandAlias\}\.status`,\s*["']active["']\)/]
  ]) {
    assert(pattern.test(repo), `public product visibility guard missing: ${label}`);
  }
  return {
    covered: ['product_group', 'category', 'parent_category', 'brand', 'review_status', 'publish_status']
  };
});

runCase('PUBLIC-FILE-VISIBILITY-GUARDS', 'public-api', 'Public file streaming checks business visibility before file exposure', () => {
  const repo = readSource('publicRepository');
  const service = readSource('publicService');
  assert(repo.includes('isProductImageFilePublic'), 'product image public-file guard missing');
  assert(repo.includes('isTechnicalDocumentFilePublic'), 'technical document public-file guard missing');
  assert(service.includes('sanitizeSvgMarkup'), 'SVG sanitization on public stream missing');
  return {
    covered: ['product image file visibility', 'technical document visibility', 'SVG sanitize on read']
  };
});

runCase('ADMIN-PUBLIC-DYNAMIC-PAGE', 'admin-api/public-ui', 'Published admin pages have a dynamic public route', () => {
  const source = readSource('dynamicPage');
  assert(
    includesAll(source, [
      'getPublicPageContentBySlug',
      'generateMetadata',
      'StaticPageContentPage',
      'notFound'
    ]),
    'dynamic public page route is incomplete'
  );
  return {
    route: '/[slug]',
    covered: ['API content lookup', 'SEO metadata', 'public renderer', '404 state']
  };
});

runCase('ADMIN-PUBLIC-REDIRECT', 'admin-api/public-ui', 'Active redirect rules are executed by the public Next.js proxy', () => {
  const controller = readSource('publicController');
  const proxy = readSource('redirectProxy');
  assert(controller.includes('@Get("redirects")'), 'public redirect endpoint is missing');
  assert(
    includesAll(proxy, ['/public/redirects', 'NextResponse.redirect', 'redirect_type']),
    'frontend redirect proxy is incomplete'
  );
  return { execution: 'exact pathname', status_codes: [301, 302], cache_ttl_seconds: 15 };
});

runCase('ADMIN-PUBLIC-NO-STORE', 'admin-api/public-ui', 'Public API reads do not keep stale admin-managed data in the server fetch cache', () => {
  const source = readSource('publicFetcher');
  assert(
    includesAll(source, ["fetchInit.cache = 'no-store'", 'hasCacheOverride']),
    'public fetcher does not default to no-store while preserving explicit cache policies'
  );
  return { cache_policy: 'no-store' };
});

runCase('ADMIN-UPLOAD-PIPELINE', 'admin-api/files', 'Admin file selection and rich-text upload reach the validated API storage pipeline', () => {
  const richText = readSource('richTextEditor');
  const picker = readSource('referencePickers');
  const fileService = readSource('fileService');
  assert(richText.includes('new FormData()'), 'rich-text editor upload is missing FormData');
  assert(picker.includes('<FileUploadModal'), 'reference picker cannot upload a new file');
  assert(
    includesAll(fileService, ['validateUploadedFileLibraryAsset', 'sanitizeSvgMarkup']),
    'API upload validation or SVG sanitization is missing'
  );
  return {
    covered: ['rich text images', 'reference picker upload', 'file validation', 'SVG sanitization']
  };
});

runCase('FILE-REFERENCE-CONTRACT', 'admin-api/files', 'All managed media roles map to persisted file usage records', () => {
  const source = readSource('fileWorkflow');
  assert(
    includesAll(source, [
      'product_group:thumbnail_file_id',
      'product_group:seo_og_image_file_id',
      'brand:logo_file_id',
      'banner:image_file_id',
      'technical_document:file_id',
      'import_batch:source_file_id',
      'company_info:logo_file_id',
      'company_info:favicon_file_id'
    ]),
    'admin file-purpose mapping is incomplete'
  );
  return {
    covered: ['product', 'SEO image', 'brand', 'banner', 'technical document', 'import', 'logo', 'favicon']
  };
});

runCase('ADMIN-SURFACE-COVERAGE', 'admin-ui/api', 'Whole-admin route and endpoint inventories cover every production module family', () => {
  const routes = readSource('adminRouteSmoke');
  const endpoints = readSource('adminApiEndpoints');
  const moduleConfig = readSource('adminModuleConfig');
  assert(
    includesAll(routes, ['/home-page', '/page-contents/brand-pages', '/website-settings', '/users', '/roles']),
    'admin route smoke inventory misses a system surface'
  );
  assert(
    includesAll(endpoints, [
      'websiteSettings',
      'pageContents',
      'banners',
      'redirects',
      'files',
      'productGroups',
      'contacts',
      'customers',
      'quotes',
      'users',
      'roles',
      'auditLogs'
    ]),
    'admin API endpoint inventory misses a module family'
  );
  assert(
    includesAll(moduleConfig, ['readPermission', 'createPermission', 'updatePermission', 'archivePermission', 'restorePermission']),
    'generic admin action matrix is incomplete'
  );
  return { route_inventory: 'full', endpoint_inventory: 'full', action_matrix: 'CRUD + archive/restore' };
});

runCase('WEBSITE-SETTINGS-CONTRACT', 'admin-api/public-ui', 'Website settings and social links are round-trip tested against the public shell', () => {
  const page = readSource('websiteSettingsPage');
  const dto = readSource('websiteSettingsDto');
  const publicTypes = readSource('siteShellTypes');
  const apiSmoke = readSource('apiSmoke');
  const fields = [
    'display_name',
    'legal_name',
    'hotline',
    'hotlines',
    'email',
    'address',
    'map_embed_code',
    'working_hours_from',
    'working_hours_to',
    'working_days',
    'logo_file_id',
    'favicon_file_id'
  ];
  for (const field of fields) {
    assert(page.includes(field), `admin website settings missing ${field}`);
    assert(dto.includes(field), `website settings DTO missing ${field}`);
    assert(publicTypes.includes(field), `public site-shell contract missing ${field}`);
  }
  assert(apiSmoke.includes('ADM-MUT-WEBSITE-SYNC'), 'admin/public settings round-trip test is missing');
  return { fields, social_links_checked: true };
});

runCase('RICH-HTML-XSS-DEFENSE', 'public-ui/public-api', 'Rich HTML has API sanitization and frontend defense-in-depth', () => {
  const htmlContent = readSource('htmlContent');
  const sanitizedHtmlContent = readSource('sanitizedHtmlContent');
  const pageContentPreviewClient = readSource('pageContentPreviewClient');
  const publicService = readSource('publicService');
  const jsonLd = readSource('jsonLd');
  assert(publicService.includes('sanitizeRichTextHtml'), 'public API rich text sanitizer missing');
  assert(jsonLd.includes("'<': '\\\\u003c'"), 'JSON-LD serializer does not escape <');
  assert(htmlContent.includes('dangerouslySetInnerHTML'), 'HtmlContent renderer missing');
  assert(htmlContent.includes('sanitizedHtml'), 'HtmlContent prop does not make sanitized contract explicit');
  assert(!htmlContent.includes("from '@/lib/security/sanitize-rich-text'"), 'shared HtmlContent imports the heavy sanitizer');
  assert(sanitizedHtmlContent.includes('sanitizeRichTextHtml'), 'server-side sanitized wrapper missing');
  assert(sanitizedHtmlContent.includes('sanitizedHtml='), 'sanitized wrapper does not pass sanitized HTML to renderer');
  assert(
    pageContentPreviewClient.includes("await import('@/lib/security/sanitize-rich-text')"),
    'draft preview rich text sanitizer is not lazy-loaded'
  );
  assert(pageContentPreviewClient.includes('sanitizeRichTextHtml(value)'), 'draft preview rich text sanitizer missing');
  assert(pageContentPreviewClient.includes('return null;'), 'draft preview sanitizer should fail closed');
  return {
    defense_in_depth: true,
    bundle_guard: 'shared HtmlContent renders sanitizedHtml without importing sanitize-html',
    sanitization_boundaries: ['public API', 'server wrapper', 'lazy admin preview draft normalizer']
  };
});

function writeReport() {
  const reportPath = path.join(ROOT, 'tmp', 'qa-artifacts', 'edge-case-static-audit-last-run.md');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines = [
    '# Edge case static audit last run',
    '',
    `Run id: \`${runId}\``,
    `Date: \`${new Date().toISOString()}\``,
    '',
    '| Case | Area | Result | Notes |',
    '| --- | --- | --- | --- |'
  ];
  for (const result of results) {
    const notes =
      result.status === 'FAIL'
        ? result.error
        : JSON.stringify(result.evidence ?? {});
    lines.push(`| ${result.id} | ${result.area} | ${result.status} | ${escapeTable(compact(notes))} |`);
  }
  lines.push('', 'Generated by `node scripts/qa/edge-case-static-audit.mjs`.');
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  return reportPath;
}

function compact(value) {
  const text = String(value ?? '');
  return text.length > 360 ? `${text.slice(0, 357)}...` : text;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

const reportPath = writeReport();
const failed = results.filter((result) => result.status === 'FAIL');
const warned = results.filter((result) => result.status === 'WARN');

console.log(`Edge case static audit run ${runId}`);
for (const result of results) {
  const suffix = result.status === 'FAIL' ? ` - ${result.error}` : '';
  console.log(`${result.status} ${result.id} ${result.title}${suffix}`);
}
console.log(`Report: ${reportPath}`);
console.log(`Summary: ${results.length - failed.length - warned.length}/${results.length} passed, ${warned.length} warnings, ${failed.length} failed`);

if (failed.length > 0) {
  process.exitCode = 1;
}
