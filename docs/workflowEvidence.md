# Chứng cứ code và ghi chú kỹ thuật cho bản thảo workflow

> Tài liệu này đi kèm [workflowAnalysis.md](workflowAnalysis.md). Liên kết chỉ tới mã **hiện tại** trong `frontend/`, `admin/`, `api/`, migration và test. Không dùng thư mục `docs/` đã xóa hoặc lịch sử Git làm nguồn yêu cầu. `F` = Frontend, `A` = Admin, `C` = Controller, `S` = Service, `R` = Repository, `D` = Database, `T` = test. Tên hàm sau link giúp kiểm tra đúng nhánh.

## Chứng cứ theo workflow

### E01

- **F:** [trang chủ](../frontend/src/app/page.tsx), [SiteHeader](../frontend/src/components/layout/SiteHeader.tsx), [SiteFooter](../frontend/src/components/layout/SiteFooter.tsx).
- **C/S/R:** [public.controller.ts](../api/src/modules/public/public.controller.ts) `site-shell`, `site-views`; [public.service.ts](../api/src/modules/public/public.service.ts) `getSiteShell`; [public.repository.ts](../api/src/modules/public/public.repository.ts) `activeMenuByPosition`, `publishedSystemPageSlugs`; [home-page.service.ts](../api/src/modules/home-page/home-page.service.ts) `getPublicLayout`.
- **D/T:** [schema DDL](../database/ddl/song_thanh_deployment_schema_20260730.sql) `company_info`, `menu`, `home_section`; [publicSiteShell.test.ts](../api/tests/unit/publicSiteShell.test.ts), [publicMenuTree.test.ts](../api/tests/unit/publicMenuTree.test.ts), [publicRouteVisibility.test.mjs](../frontend/tests/publicRouteVisibility.test.mjs).

### E02

- **F:** [trang danh sách](../frontend/src/app/san-pham/danh-sach/page.tsx), [trang chi tiết](../frontend/src/app/san-pham/[slug]/page.tsx), [ProductVariantSelector.tsx](../frontend/src/features/product-detail/ProductVariantSelector.tsx), [public-product-search.tsx](../frontend/src/features/product-search/public-product-search.tsx).
- **C/S/R:** [public.controller.ts](../api/src/modules/public/public.controller.ts) `product-categories`, `product-groups`, `search-suggestions`; [public.service.ts](../api/src/modules/public/public.service.ts) `listPublicProductGroups`, `getPublicProductGroupDetail`; [public.repository.ts](../api/src/modules/public/public.repository.ts) `listPublicProductGroups`, `listPublicVariants`, `listPublicTechnicalDocuments`.
- **T:** [productSearch.test.ts](../api/tests/unit/productSearch.test.ts), [public-facets.test.ts](../api/tests/unit/public-facets.test.ts), [publicPrice.test.ts](../api/tests/unit/publicPrice.test.ts), [publiccatalog.spec.ts](../admin/tests/e2e/publiccatalog.spec.ts) (E2E source, chưa chạy trong lần phân tích này).

### E03

- **F:** [thương hiệu](../frontend/src/app/doi-tac-thuong-hieu/page.tsx), [dịch vụ](../frontend/src/app/dich-vu/page.tsx), [dự án](../frontend/src/app/du-an/page.tsx), [tin tức](../frontend/src/app/tin-tuc/page.tsx), [trang động](../frontend/src/app/[slug]/page.tsx).
- **C/S/R:** [public.controller.ts](../api/src/modules/public/public.controller.ts) các route `brands/services/projects/news/page-contents`; [public.service.ts](../api/src/modules/public/public.service.ts) `getPublicBrandDetail`, `getPublicServiceDetail`, `getPublicProjectDetail`; [public.repository.ts](../api/src/modules/public/public.repository.ts) `findPublicBrandDetailBySlug`, `findPublicServiceBySlug`, `findPublicProjectBySlug`, `findPublicPageContentBySlug`.
- **T:** [publicRouteVisibility.test.mjs](../frontend/tests/publicRouteVisibility.test.mjs), [contentpages.spec.ts](../admin/tests/e2e/contentpages.spec.ts) (E2E source).

### E04

- **F:** [TechnicalDocuments.tsx](../frontend/src/features/product-detail/TechnicalDocuments.tsx), [public-file.ts](../frontend/src/lib/public-file.ts).
- **C/S/R:** [public.controller.ts](../api/src/modules/public/public.controller.ts) `files/:id` và `download-watermarked`; [public.service.ts](../api/src/modules/public/public.service.ts) `sendPublicFile`, `sendPublicWatermarkedProductImageDownload`; [public-product-file.repository.ts](../api/src/modules/public/public-product-file.repository.ts), [public.repository.ts](../api/src/modules/public/public.repository.ts) `findPublicFileById`, `listPublicTechnicalDocuments`.
- **T:** [publicFileAccess.test.ts](../api/tests/unit/publicFileAccess.test.ts), [publicRichFileAccess.test.ts](../api/tests/unit/publicRichFileAccess.test.ts), [imageProcessing.test.ts](../api/tests/unit/imageProcessing.test.ts).

### E05

- **F:** [QuoteRequestForm.tsx](../frontend/src/features/quote-request/QuoteRequestForm.tsx), [HomeQuoteRequestForm.tsx](../frontend/src/features/quote-request/HomeQuoteRequestForm.tsx), [quantityParser.ts](../frontend/src/features/quote-request/quantityParser.ts).
- **C/S/R:** [public.controller.ts](../api/src/modules/public/public.controller.ts) `POST quote-requests`; [public.dto.ts](../api/src/modules/public/public.dto.ts) `CreatePublicQuoteRequestDto`; [public.service.ts](../api/src/modules/public/public.service.ts) `createPublicQuoteRequest`; [public.repository.ts](../api/src/modules/public/public.repository.ts) `createPublicQuoteRequest`, `resolveCustomerProfileId`; [publicQuote.ts](../api/src/modules/public/publicQuote.ts), [publicQuotePrice.ts](../api/src/modules/public/publicQuotePrice.ts).
- **D/T:** [quotePriceSnapshot migration](../api/migrations/202610090002_quotePriceSnapshot.js), [quoteprojectcontext migration](../api/migrations/202608100001_quoteprojectcontext.js); [publicquotecontract.test.ts](../api/tests/unit/publicquotecontract.test.ts), [publicQuotePrice.test.ts](../api/tests/unit/publicQuotePrice.test.ts), [quotecontract.spec.ts](../admin/tests/e2e/quotecontract.spec.ts) (E2E source).

### E06

- **F:** [ContactForm.tsx](../frontend/src/features/contact-request/ContactForm.tsx), [trang liên hệ](../frontend/src/app/lien-he/page.tsx).
- **C/S/R:** [public.controller.ts](../api/src/modules/public/public.controller.ts) `POST contact-requests`; [public.dto.ts](../api/src/modules/public/public.dto.ts) `CreatePublicContactRequestDto`; [public.service.ts](../api/src/modules/public/public.service.ts) `createPublicContactRequest`; [public.repository.ts](../api/src/modules/public/public.repository.ts) `createPublicContactRequest`, `resolveCustomerProfileId`.
- **T:** [publicRequestMeta.test.ts](../api/tests/unit/publicRequestMeta.test.ts), [role-user-journeys.spec.ts](../admin/tests/e2e/role-user-journeys.spec.ts) (E2E source).

### E07

- **A:** [ContactQuoteListPage.tsx](../admin/src/features/contact/ContactQuoteListPage.tsx), [ContactQuoteDetailPage.tsx](../admin/src/features/contact/ContactQuoteDetailPage.tsx).
- **C/S/R:** [contact.controller.ts](../api/src/modules/contact/contact.controller.ts) danh sách, trạng thái, phân công, ghi chú, lưu trữ/khôi phục/xóa vĩnh viễn; [contact.service.ts](../api/src/modules/contact/contact.service.ts) `updateStatus`, `updateAssignee`, `createInternalNote`, `permanentlyDeleteContact`; [contact.repository.ts](../api/src/modules/contact/contact.repository.ts).
- **D/T:** [contact.types.ts](../api/src/modules/contact/contact.types.ts) trạng thái; [crm-domain-invariants-smoke.mjs](../scripts/qa/crm-domain-invariants-smoke.mjs), [role-user-journeys.spec.ts](../admin/tests/e2e/role-user-journeys.spec.ts) (chưa chạy trong lần này).

### E08

- **A:** [ContactQuoteListPage.tsx](../admin/src/features/contact/ContactQuoteListPage.tsx), [ContactQuoteDetailPage.tsx](../admin/src/features/contact/ContactQuoteDetailPage.tsx).
- **C/S/R:** [quote.controller.ts](../api/src/modules/quote/quote.controller.ts); [quote.service.ts](../api/src/modules/quote/quote.service.ts) `updateStatus`, `updateAssignee`, `createInternalNote`, `permanentlyDeleteQuote`; [quote.repository.ts](../api/src/modules/quote/quote.repository.ts) `listItems`, `listInternalNotes`.
- **D/T:** [quote.types.ts](../api/src/modules/quote/quote.types.ts), [quotePriceSnapshot migration](../api/migrations/202610090002_quotePriceSnapshot.js); [quotecontract.spec.ts](../admin/tests/e2e/quotecontract.spec.ts), [crm-domain-invariants-smoke.mjs](../scripts/qa/crm-domain-invariants-smoke.mjs) (chưa chạy trong lần này).

### E09

- **A:** [CustomerListPage.tsx](../admin/src/features/customer/CustomerListPage.tsx), [CustomerDetailPage.tsx](../admin/src/features/customer/CustomerDetailPage.tsx).
- **C/S/R:** [customer.controller.ts](../api/src/modules/customer/customer.controller.ts); [customer.service.ts](../api/src/modules/customer/customer.service.ts) `buildDetail`, `permanentlyDeleteCustomer`; [customer.repository.ts](../api/src/modules/customer/customer.repository.ts) `listInteractions`, `permanentlyDeleteWithGuard`; [public.repository.ts](../api/src/modules/public/public.repository.ts) `resolveCustomerProfileId`.
- **D/T:** [customer profile migration](../api/migrations/202605080001_create_customer_profile.js), [identity reconciliation migration](../api/migrations/202607130003_reconcile_customer_profiles_by_identity.js); [crm-domain-invariants-smoke.mjs](../scripts/qa/crm-domain-invariants-smoke.mjs) (chưa chạy trong lần này).

### E10

- **A:** [ProductCategoryNavigationPages.tsx](../admin/src/features/product-domain/ProductCategoryNavigationPages.tsx), [ProductDomainBusinessPages.tsx](../admin/src/features/product-domain/ProductDomainBusinessPages.tsx).
- **C/S/R:** [product-category.controller.ts](../api/src/modules/product-category/product-category.controller.ts), [brand.controller.ts](../api/src/modules/brand/brand.controller.ts); [product-category.service.ts](../api/src/modules/product-category/product-category.service.ts) `archiveCategory`, `assertReferencesUsable`; [brand.service.ts](../api/src/modules/brand/brand.service.ts) `createBrand`, `archiveBrand`; [product-category.repository.ts](../api/src/modules/product-category/product-category.repository.ts), [brand.repository.ts](../api/src/modules/brand/brand.repository.ts).
- **T:** [product-domain-invariants-smoke.mjs](../scripts/qa/product-domain-invariants-smoke.mjs), [productworkspace.spec.ts](../admin/tests/e2e/productworkspace.spec.ts) (chưa chạy trong lần này).

### E11

- **A:** [ProductCatalogWorkspace.tsx](../admin/src/features/product-domain/ProductCatalogWorkspace.tsx), [ProductInspector.tsx](../admin/src/features/product-domain/ProductInspector.tsx), [productReadiness.ts](../admin/src/features/product-domain/productReadiness.ts).
- **C/S/R:** [product-group.controller.ts](../api/src/modules/product-group/product-group.controller.ts); [product-group.service.ts](../api/src/modules/product-group/product-group.service.ts) `createProductGroup`, `updateProductGroup`, `bulkUpdateProductGroups`, `assertPublishReadiness`; [product-group.repository.ts](../api/src/modules/product-group/product-group.repository.ts) `archive`, `restore`; [workflow-approval.guard.ts](../api/src/common/workflow/workflow-approval.guard.ts).
- **T:** [publicEditorialUpdates.test.ts](../api/tests/unit/publicEditorialUpdates.test.ts), [publicContentReview.test.ts](../api/tests/unit/publicContentReview.test.ts), [productreadiness.spec.ts](../admin/tests/e2e/productreadiness.spec.ts) (test source; bài E2E chưa chạy).

### E12

- **A:** [ProductDomainBusinessPages.tsx](../admin/src/features/product-domain/ProductDomainBusinessPages.tsx), [ProductInspector.tsx](../admin/src/features/product-domain/ProductInspector.tsx), [businessStatus.ts](../admin/src/features/product-domain/businessStatus.ts).
- **C/S/R:** [product-variant.controller.ts](../api/src/modules/product-variant/product-variant.controller.ts); [product-variant.service.ts](../api/src/modules/product-variant/product-variant.service.ts) `createProductVariant`, `normalizeUpdateInput`, `assertPublishReadiness`, `archiveProductVariant`; [product-variant.repository.ts](../api/src/modules/product-variant/product-variant.repository.ts); [product-variant.guardrails.ts](../api/src/modules/product-variant/product-variant.guardrails.ts) `resolvePriceState`.
- **D/T:** [DDL](../database/ddl/song_thanh_deployment_schema_20260730.sql) cho cấu trúc giá/biến thể; [publicPrice.test.ts](../api/tests/unit/publicPrice.test.ts), [publicEditorialUpdates.test.ts](../api/tests/unit/publicEditorialUpdates.test.ts), [role-user-journeys.spec.ts](../admin/tests/e2e/role-user-journeys.spec.ts) (E2E chưa chạy).

### E13

- **A:** [ProductImageGalleryCard.tsx](../admin/src/features/product-domain/ProductImageGalleryCard.tsx), [ProductInspector.tsx](../admin/src/features/product-domain/ProductInspector.tsx).
- **C/S/R:** [product-group.controller.ts](../api/src/modules/product-group/product-group.controller.ts) gallery/highlight specs; [product-variant.controller.ts](../api/src/modules/product-variant/product-variant.controller.ts) attributes; [technical-document.controller.ts](../api/src/modules/technical-document/technical-document.controller.ts); [product-group.service.ts](../api/src/modules/product-group/product-group.service.ts) `replaceProductImages`, `createProductHighlightSpec`; [product-variant.service.ts](../api/src/modules/product-variant/product-variant.service.ts) `createVariantAttribute`; [technical-document.service.ts](../api/src/modules/technical-document/technical-document.service.ts); [public.repository.ts](../api/src/modules/public/public.repository.ts) `listPublicTechnicalDocuments`.
- **D/T:** [product highlights migration](../api/migrations/202605290003_create_product_highlight_specs.js), [product image variant migration](../api/migrations/202605210001_add_product_image_variant_link.js); [productQuickSpecs.test.mjs](../frontend/tests/productQuickSpecs.test.mjs), [publicEditorialUpdates.test.ts](../api/tests/unit/publicEditorialUpdates.test.ts).

### E14

- **A:** [ImportBatchCreatePage.tsx](../admin/src/features/import-workspace/ImportBatchCreatePage.tsx), [ImportColumnMappingPanel.tsx](../admin/src/features/import-workspace/ImportColumnMappingPanel.tsx), [ImportWorkbookPreview.tsx](../admin/src/features/import-workspace/ImportWorkbookPreview.tsx).
- **C/S/R:** [import-workspace.controller.ts](../api/src/modules/import-workspace/import-workspace.controller.ts) `intake/upload/confirm-mapping`; [import-workspace.service.ts](../api/src/modules/import-workspace/import-workspace.service.ts) `uploadImportBatch`, `confirmImportBatchMapping`, `stageWorkbookIntoBatch`; [import-workspace.repository.ts](../api/src/modules/import-workspace/import-workspace.repository.ts) `createImportBatch`, `createPendingProductGroup`, `createPendingVariant`; [workbook-reader.ts](../api/src/modules/import-workspace/intake/workbook-reader.ts), [import-workbook-upload.ts](../api/src/modules/import-workspace/import-workbook-upload.ts).
- **D/T:** [importSheet migration](../api/migrations/202610090003_importSheet.js), [import-workbook-reader.test.ts](../api/tests/unit/import-workbook-reader.test.ts), [importmapping.test.ts](../api/tests/unit/importmapping.test.ts), [domainimportux.spec.ts](../admin/tests/e2e/domainimportux.spec.ts) (E2E chưa chạy).

### E15

- **A:** [ImportDetailPage.tsx](../admin/src/features/import-workspace/ImportDetailPage.tsx) `approveSingleGroup`, `resolveConflict`, `ready`.
- **C/S/R:** [import-workspace.controller.ts](../api/src/modules/import-workspace/import-workspace.controller.ts) `review-transition`, `bulk-approve`, `conflicts`, `readiness`, `apply-preview`; [import-workspace.service.ts](../api/src/modules/import-workspace/import-workspace.service.ts) `reviewTransition`, `resolveConflict`, `evaluateImportBatchReadiness`; [import-workspace.readiness.ts](../api/src/modules/import-workspace/import-workspace.readiness.ts); [import-workspace.repository.ts](../api/src/modules/import-workspace/import-workspace.repository.ts) cập nhật dòng tạm/xung đột.
- **D/T:** [DDL](../database/ddl/song_thanh_deployment_schema_20260730.sql) `pending_*`, `data_conflict`, `conflict_resolution`; [import-domain-invariants-smoke.mjs](../scripts/qa/import-domain-invariants-smoke.mjs), [importmapping.test.ts](../api/tests/unit/importmapping.test.ts) (smoke chưa chạy).

### E16

- **A:** [ImportDetailPage.tsx](../admin/src/features/import-workspace/ImportDetailPage.tsx), [ImportWorkspacePage.tsx](../admin/src/features/import-workspace/ImportWorkspacePage.tsx).
- **C/S/R:** [import-workspace.controller.ts](../api/src/modules/import-workspace/import-workspace.controller.ts) `apply/archive/restore/DELETE`; [import-workspace.service.ts](../api/src/modules/import-workspace/import-workspace.service.ts) `applyImportBatch`, `deleteImportBatch`, `archiveImportBatch`; [import-workspace.repository.ts](../api/src/modules/import-workspace/import-workspace.repository.ts) `createOfficialProductGroup`, `createOfficialVariant`, `deleteImportBatchWorkspace`.
- **T:** [importcycleaudit.mjs](../scripts/qa/importcycleaudit.mjs), [import-domain-invariants-smoke.mjs](../scripts/qa/import-domain-invariants-smoke.mjs) (chưa chạy). Bằng chứng trạng thái bản ghi mới nằm trực tiếp ở `createOfficial*`, không suy từ schema.

### E17

- **A:** [PageContentEditor.tsx](../admin/src/features/website-content/page-content-studio/PageContentEditor.tsx), [contentReadiness.ts](../admin/src/features/website-content/page-content-studio/contentReadiness.ts), [NewsCategoryManagerCard.tsx](../admin/src/features/website-content/page-content-studio/NewsCategoryManagerCard.tsx).
- **F:** [trang tin](../frontend/src/app/tin-tuc/[slug]/page.tsx), [trang nội dung](../frontend/src/app/[slug]/page.tsx), [preview](../frontend/src/app/admin-preview/page-content/PageContentPreviewClient.tsx).
- **C/S/R:** [page-content.controller.ts](../api/src/modules/page-content/page-content.controller.ts), [news-category.controller.ts](../api/src/modules/news-category/news-category.controller.ts); [page-content.service.ts](../api/src/modules/page-content/page-content.service.ts) `assertPublishReadiness`; [page-content.repository.ts](../api/src/modules/page-content/page-content.repository.ts); [public.repository.ts](../api/src/modules/public/public.repository.ts) `findPublicPageContentBySlug`, `listPublicNews`.
- **T:** [pageContentGuardrails.test.ts](../api/tests/unit/pageContentGuardrails.test.ts), [contentUnpublish.test.ts](../api/tests/unit/contentUnpublish.test.ts), [page-content-lifecycle.spec.ts](../admin/tests/e2e/page-content-lifecycle.spec.ts) (E2E chưa chạy).

### E18

- **A/F:** [BrandPageManager.tsx](../admin/src/features/website-content/brand-pages/BrandPageManager.tsx), [BrandPagePreviewClient.tsx](../frontend/src/app/admin-preview/brand-page/BrandPagePreviewClient.tsx), [trang thương hiệu](../frontend/src/app/doi-tac-thuong-hieu/[slug]/page.tsx).
- **C/S/R:** [brand-page.controller.ts](../api/src/modules/brand-page/brand-page.controller.ts); [brand-page.service.ts](../api/src/modules/brand-page/brand-page.service.ts) `normalizeStats`, `normalizeFeaturedProductGroupIds`; [brand-page.repository.ts](../api/src/modules/brand-page/brand-page.repository.ts); [public.repository.ts](../api/src/modules/public/public.repository.ts) `findPublicBrandDetailBySlug`, `listPublicBrandStats`.
- **D/T:** [brand page migration](../api/migrations/202605170001_create_brand_page_tables.js), [publicEditorialUpdates.test.ts](../api/tests/unit/publicEditorialUpdates.test.ts), [brandPageSave.spec.ts](../admin/tests/e2e/brandPageSave.spec.ts) (E2E chưa chạy).

### E19

- **A/F:** [ServiceProjectDetailPage.tsx](../admin/src/features/product-domain/ServiceProjectDetailPage.tsx), [ServiceDetailPage.tsx](../frontend/src/features/services/ServiceDetailPage.tsx).
- **C/S/R:** [service.controller.ts](../api/src/modules/service/service.controller.ts); [service.service.ts](../api/src/modules/service/service.service.ts) `attachProductGroup`, `assertPublishReadiness`; [service.repository.ts](../api/src/modules/service/service.repository.ts); [public.repository.ts](../api/src/modules/public/public.repository.ts) `findPublicServiceBySlug`, `listPublicServiceRelatedProductGroups`.
- **T:** [publicEditorialUpdates.test.ts](../api/tests/unit/publicEditorialUpdates.test.ts), [servicedetail.spec.ts](../admin/tests/e2e/servicedetail.spec.ts) (E2E chưa chạy).

### E20

- **A/F:** [ServiceProjectDetailPage.tsx](../admin/src/features/product-domain/ServiceProjectDetailPage.tsx), [ProjectGalleryCard.tsx](../admin/src/features/product-domain/ProjectGalleryCard.tsx), [ProjectDetailPage.tsx](../frontend/src/features/projects/ProjectDetailPage.tsx).
- **C/S/R:** [project.controller.ts](../api/src/modules/project/project.controller.ts); [project.service.ts](../api/src/modules/project/project.service.ts) `attachGalleryImage`, `reorderGalleryImages`, `attachProductGroup`, `assertPublishReadiness`; [project.repository.ts](../api/src/modules/project/project.repository.ts); [public.repository.ts](../api/src/modules/public/public.repository.ts) `findPublicProjectBySlug`, `listPublicProjectGallery`.
- **D/T:** [project gallery migration](../api/migrations/202605200003_project_gallery_admin_surface.js), [publicEditorialUpdates.test.ts](../api/tests/unit/publicEditorialUpdates.test.ts), [projectdetail.spec.ts](../admin/tests/e2e/projectdetail.spec.ts) (E2E chưa chạy).

### E21

- **A/F:** [BannerDetailPage.tsx](../admin/src/features/website-content/BannerDetailPage.tsx), [HomeHeroBannerCarousel.tsx](../frontend/src/features/home/HomeHeroBannerCarousel.tsx).
- **C/S/R:** [banner.controller.ts](../api/src/modules/banner/banner.controller.ts); [banner.service.ts](../api/src/modules/banner/banner.service.ts); [banner.repository.ts](../api/src/modules/banner/banner.repository.ts); [public.repository.ts](../api/src/modules/public/public.repository.ts) `listPublicBanners`.
- **D/T:** [banner.types.ts](../api/src/modules/banner/banner.types.ts) chỉ có `status`, **không** có trường review/publish; [bannerPosition migration](../api/migrations/202610090001_bannerPosition.js); [page-content-lifecycle.spec.ts](../admin/tests/e2e/page-content-lifecycle.spec.ts) kiểm thử banner (E2E chưa chạy).

### E22

- **A/F:** [HomePageManager.tsx](../admin/src/features/home-page/HomePageManager.tsx), [trang chủ](../frontend/src/app/page.tsx).
- **C/S/R:** [home-page.controller.ts](../api/src/modules/home-page/home-page.controller.ts), [home-page.public.controller.ts](../api/src/modules/home-page/home-page.public.controller.ts); [home-page.service.ts](../api/src/modules/home-page/home-page.service.ts) `updateLayout`, `getPublicLayout`; [home-page.repository.ts](../api/src/modules/home-page/home-page.repository.ts) `replaceAll`.
- **D/T:** [home sections migration](../api/migrations/202606030001_create_home_sections.js), [homepageSave.spec.ts](../admin/tests/e2e/homepageSave.spec.ts) (E2E chưa chạy).

### E23

- **A/F:** [WebsiteSettingsPage.tsx](../admin/src/features/website-content/WebsiteSettingsPage.tsx), [WebsiteContentPages.tsx](../admin/src/features/website-content/WebsiteContentPages.tsx), [SiteHeader.tsx](../frontend/src/components/layout/SiteHeader.tsx).
- **C/S/R:** [website-settings.controller.ts](../api/src/modules/website-settings/website-settings.controller.ts), [menu.controller.ts](../api/src/modules/menu/menu.controller.ts); [website-settings.service.ts](../api/src/modules/website-settings/website-settings.service.ts), [menu.service.ts](../api/src/modules/menu/menu.service.ts); [website-settings.repository.ts](../api/src/modules/website-settings/website-settings.repository.ts), [menu.repository.ts](../api/src/modules/menu/menu.repository.ts); [public.service.ts](../api/src/modules/public/public.service.ts) `getSiteShell`.
- **T:** [publicMenuTree.test.ts](../api/tests/unit/publicMenuTree.test.ts), [publicSiteShell.test.ts](../api/tests/unit/publicSiteShell.test.ts), [menusave.spec.ts](../admin/tests/e2e/menusave.spec.ts) (E2E chưa chạy).

### E24

- **F:** [proxy.ts](../frontend/src/proxy.ts) `loadRedirects` và `proxy`.
- **C/S/R:** [redirect.controller.ts](../api/src/modules/redirect/redirect.controller.ts), [public.controller.ts](../api/src/modules/public/public.controller.ts) `redirects`; [redirect.service.ts](../api/src/modules/redirect/redirect.service.ts); [redirect.repository.ts](../api/src/modules/redirect/redirect.repository.ts) `listActivePublicRedirects`; [redirect.guardrails.ts](../api/src/modules/redirect/redirect.guardrails.ts).
- **T:** [core-guardrails.test.ts](../api/tests/unit/core-guardrails.test.ts) đường dẫn/type; chưa thấy E2E riêng xác nhận redirect trên runtime trong lần này.

### E25

- **A:** [FileLibraryZones.tsx](../admin/src/features/website-content/FileLibraryZones.tsx), [FileUploadModal.tsx](../admin/src/features/website-content/FileUploadModal.tsx), [FileDetailDrawer.tsx](../admin/src/features/website-content/FileDetailDrawer.tsx).
- **C/S/R:** [file.controller.ts](../api/src/modules/file/file.controller.ts); [file.service.ts](../api/src/modules/file/file.service.ts) `uploadFile`, `archiveFile`, `sendFilePreview`; [file.repository.ts](../api/src/modules/file/file.repository.ts) `usageCounts`, `archive`; [file-upload.ts](../api/src/modules/file/file-upload.ts).
- **D/T:** [file metadata purpose migration](../api/migrations/202604270001_add_file_metadata_purpose.js); [file-storage.test.ts](../api/tests/unit/file-storage.test.ts), [file-usage-atomicity-smoke.mjs](../scripts/qa/file-usage-atomicity-smoke.mjs) (smoke chưa chạy).

### E26

- **A:** [LoginForm.tsx](../admin/src/features/auth/LoginForm.tsx), [ProtectedRoute.tsx](../admin/src/features/auth/ProtectedRoute.tsx), [auth.api.ts](../admin/src/features/auth/auth.api.ts).
- **C/S/R:** [auth.controller.ts](../api/src/modules/auth/auth.controller.ts); [auth.service.ts](../api/src/modules/auth/auth.service.ts) `login`, `refresh`, `changePassword`; [auth.repository.ts](../api/src/modules/auth/auth.repository.ts) `getUserAccess`, quản lý refresh session; [auth.guard.ts](../api/src/common/auth/auth.guard.ts), [permission.guard.ts](../api/src/common/permissions/permission.guard.ts).
- **D/T:** [admin auth migration](../api/migrations/202604250001_create_admin_auth_tables.js), [oneUserRole migration](../api/migrations/202610010001_oneUserRole.js); [authSession.test.ts](../api/tests/unit/authSession.test.ts), [authRoleInvariant.test.ts](../api/tests/unit/authRoleInvariant.test.ts), [authBoundary.spec.ts](../admin/tests/e2e/authBoundary.spec.ts) (E2E chưa chạy).

### E27

- **A:** [AdminUsersPage.tsx](../admin/src/features/admin-users/AdminUsersPage.tsx), [AdminRolesPage.tsx](../admin/src/features/admin-roles/AdminRolesPage.tsx), [permissions.ts](../admin/src/lib/permissions.ts).
- **C/S/R:** [admin-user.controller.ts](../api/src/modules/admin-user/admin-user.controller.ts), [admin-role.controller.ts](../api/src/modules/admin-role/admin-role.controller.ts); [admin-user.service.ts](../api/src/modules/admin-user/admin-user.service.ts), [admin-role.service.ts](../api/src/modules/admin-role/admin-role.service.ts); [admin-user.repository.ts](../api/src/modules/admin-user/admin-user.repository.ts), [admin-role.repository.ts](../api/src/modules/admin-role/admin-role.repository.ts); [permission-seed.ts](../api/src/modules/admin-permission/permission-seed.ts).
- **T:** [adminAccess.test.ts](../api/tests/unit/adminAccess.test.ts), [permissionDependencies.test.ts](../api/tests/unit/permissionDependencies.test.ts), [singleRole.test.ts](../api/tests/unit/singleRole.test.ts), [singleRole.spec.ts](../admin/tests/e2e/singleRole.spec.ts) (E2E chưa chạy).

### E28

- **A:** [DashboardPage.tsx](../admin/src/features/dashboard/DashboardPage.tsx), [AuditLogList.tsx](../admin/src/features/system/AuditLogList.tsx), [AuditLogDetail.tsx](../admin/src/features/system/AuditLogDetail.tsx).
- **C/S/R:** [dashboard.controller.ts](../api/src/modules/dashboard/dashboard.controller.ts), [audit-log.controller.ts](../api/src/modules/audit-log/audit-log.controller.ts); [dashboard.service.ts](../api/src/modules/dashboard/dashboard.service.ts), [audit-log.service.ts](../api/src/modules/audit-log/audit-log.service.ts); [dashboard.repository.ts](../api/src/modules/dashboard/dashboard.repository.ts), [audit-log.repository.ts](../api/src/modules/audit-log/audit-log.repository.ts); [audit-trail.interceptor.ts](../api/src/common/audit/audit-trail.interceptor.ts).
- **D/T:** [daily views migrations](../api/migrations/202607130002_add_site_daily_views.js), [product daily views migration](../api/migrations/202607120001_add_product_group_daily_views.js); [audit-trail-integrity-smoke.mjs](../scripts/qa/audit-trail-integrity-smoke.mjs), [dashboard.spec.ts](../admin/tests/e2e/dashboard.spec.ts) (chưa chạy trong lần này).

### E29

- **A:** [ImportWorkspacePage.tsx](../admin/src/features/import-workspace/ImportWorkspacePage.tsx) `downloadCurrentExport`, `fetchProductGroupsForExport`, `fetchVariantsForGroups`, `fetchTechnicalDocumentsForExport`; [CustomerListPage.tsx](../admin/src/features/customer/CustomerListPage.tsx) `downloadCustomers`; [exportFile.ts](../admin/src/lib/exportFile.ts) `downloadExportFile`; [exportDateRange.ts](../admin/src/features/import-workspace/exportDateRange.ts).
- **C/S/R:** Nguồn dữ liệu dùng endpoint đọc của [product-group.controller.ts](../api/src/modules/product-group/product-group.controller.ts), [product-variant.controller.ts](../api/src/modules/product-variant/product-variant.controller.ts), [technical-document.controller.ts](../api/src/modules/technical-document/technical-document.controller.ts), [product-category.controller.ts](../api/src/modules/product-category/product-category.controller.ts), [brand.controller.ts](../api/src/modules/brand/brand.controller.ts), [customer.controller.ts](../api/src/modules/customer/customer.controller.ts). Ví dụ đường đi `list` qua [product-group.service.ts](../api/src/modules/product-group/product-group.service.ts)/[product-group.repository.ts](../api/src/modules/product-group/product-group.repository.ts), [technical-document.service.ts](../api/src/modules/technical-document/technical-document.service.ts)/[technical-document.repository.ts](../api/src/modules/technical-document/technical-document.repository.ts), [customer.service.ts](../api/src/modules/customer/customer.service.ts)/[customer.repository.ts](../api/src/modules/customer/customer.repository.ts). Không có endpoint export riêng.
- **T:** [domainimportux.spec.ts](../admin/tests/e2e/domainimportux.spec.ts) có kiểm tra hàm lọc khoảng ngày (E2E chưa chạy); chức năng tải tệp chưa được xác minh trên trình duyệt trong lần phân tích này.

## Đối chiếu chức năng để tránh thiếu/trùng

Script [generate-system-inventory.mjs](../scripts/qa/generate-system-inventory.mjs) đọc source hiện tại và ghi bản kê tạm vào `tmp/qa-artifacts/generated/`: **221 endpoint**, **27 nhóm controller/module** kể cả `health`, **47 route Admin**, **19 route Frontend**, **118 permission**, **62 bảng trong snapshot DDL** và **48 migration**. Bộ so quyền của script không báo thiếu hoặc thừa giữa permission seed, controller và hằng số Admin tại thời điểm chạy. Đây là kiểm kê tĩnh; 62 bảng DDL không đồng nghĩa 62 module nghiệp vụ.

| Controller/module API | Số route | Workflow chính | Ghi chú ranh giới |
| --- | ---: | --- | --- |
| `public` | 23 | WF01–WF06 | Đọc công khai, lượt xem, form, tệp |
| `home-page` | 3 | WF01, WF22 | Public + Admin |
| `product-category`, `brand` | 6 + 6 | WF10 | Phân loại/định danh, khác trang thương hiệu |
| `product-group`, `product-variant` | 15 + 12 | WF02, WF11–WF13 | Các thao tác con thuộc hồ sơ sản phẩm |
| `technical-document` | 6 | WF13 | `is_public` riêng |
| `import-workspace` | 22 | WF14–WF16 | Dữ liệu tạm và áp dụng tách khỏi xuất bản; WF29 đọc nguồn từ các module khác qua Admin |
| `contact`, `quote`, `customer` | 8 + 8 + 7 | WF05–WF09, WF29 | Hộp thư, hồ sơ khách và nguồn xuất dữ liệu |
| `page-content`, `news-category` | 6 + 6 | WF03, WF17 | Tin tức là `page_content` loại `news` |
| `brand-page` | 6 | WF03, WF18 | Trang thương hiệu khác bản ghi brand |
| `service`, `project` | 9 + 15 | WF03, WF19–WF20 | Nội dung và quan hệ sản phẩm |
| `banner` | 6 | WF21 | Chỉ `active/inactive`, không có workflow duyệt riêng |
| `menu`, `website-settings` | 11 + 7 | WF01, WF23 | Điều hướng và thông tin công ty |
| `redirect` | 6 | WF24 | Frontend proxy tiêu thụ route public |
| `file` | 11 | WF04, WF25 | Thư viện riêng, public file có cổng kiểm soát khác |
| `auth`, `admin-user`, `admin-role` | 5 + 6 + 6 | WF26–WF27 | Xác thực, vai trò và quyền |
| `dashboard`, `audit-log` | 1 + 2 | WF28 | Xem số liệu và nhật ký |
| `health` | 2 | Hỗ trợ vận hành | Không biến health check thành workflow nghiệp vụ |

**Đối chiếu route giao diện:** 47 route Admin từ `login`, `dashboard`, `users/roles`, `audit-logs`, `website-settings/home-page/menu/banners/redirects/page-contents/files`, `product-categories/brands/product-groups/product-variants/technical-documents/import`, `contacts/quotes/customers`, `services/projects` đều đã nằm trong các nhóm trên; `/import` còn chứa WF29 và `/customers` có nút xuất riêng; `/access-denied` và `/` Admin là điều hướng hệ thống của WF26. 19 route Frontend gồm `/`, `/san-pham*`, `/tim-kiem`, `/doi-tac-thuong-hieu*`, `/dich-vu*`, `/du-an*`, `/tin-tuc*`, `/gioi-thieu`, `/ho-so-nang-luc`, `/lien-he`, `/[slug]`, hai route `/admin-preview/*` đã được đặt vào WF01–WF04, WF17–WF20; preview là công cụ biên tập, không phải nội dung công khai thông thường.

| Route Admin trong `admin/src/app` | Số trang | Workflow |
| --- | ---: | --- |
| `/`, `/login`, `/access-denied` | 3 | WF26 |
| `/dashboard` | 1 | WF28 |
| `/users`, `/roles` | 2 | WF27 |
| `/audit-logs`, `/audit-logs/[id]` | 2 | WF28 |
| `/website-settings`, `/home-page` | 2 | WF23, WF22 |
| `/menu`, `/menu/[id]` | 2 | WF23 |
| `/banners`, `/banners/[id]` | 2 | WF21 |
| `/redirects`, `/redirects/[id]` | 2 | WF24 |
| `/page-contents`, `/page-contents/[id]` | 2 | WF17 |
| `/page-contents/brand-pages`, `/page-contents/brand-pages/[id]` | 2 | WF18 |
| `/files` | 1 | WF25 |
| `/product-categories`, `/product-categories/[id]`, `/product-categories/main`, `/product-categories/sub` | 4 | WF10 |
| `/brands`, `/brands/[id]` | 2 | WF10, WF18 |
| `/product-groups`, `/product-groups/[id]` | 2 | WF11–WF13 |
| `/product-variants`, `/product-variants/[id]` | 2 | WF12–WF13 |
| `/technical-documents`, `/technical-documents/[id]` | 2 | WF13 |
| `/import`, `/import/new`, `/import/[id]` | 3 | WF14–WF16, WF29 |
| `/contacts`, `/contacts/[id]` | 2 | WF07 |
| `/quotes`, `/quotes/[id]` | 2 | WF08 |
| `/customers`, `/customers/new`, `/customers/[id]` | 3 | WF09, WF29 |
| `/services`, `/services/[id]` | 2 | WF19 |
| `/projects`, `/projects/[id]` | 2 | WF20 |
| **Tổng** | **47** | |

| Route Frontend trong `frontend/src/app` | Số trang | Workflow |
| --- | ---: | --- |
| `/` | 1 | WF01, WF05 |
| `/san-pham`, `/san-pham/danh-sach`, `/san-pham/[slug]`, `/tim-kiem` | 4 | WF02, WF05 |
| `/doi-tac-thuong-hieu`, `/doi-tac-thuong-hieu/[slug]` | 2 | WF03 |
| `/dich-vu`, `/dich-vu/[slug]` | 2 | WF03, WF05–WF06 |
| `/du-an`, `/du-an/[slug]` | 2 | WF03 |
| `/tin-tuc`, `/tin-tuc/[slug]` | 2 | WF03 |
| `/gioi-thieu`, `/ho-so-nang-luc`, `/[slug]` | 3 | WF03 |
| `/lien-he` | 1 | WF06 |
| `/admin-preview/brand-page`, `/admin-preview/page-content` | 2 | WF17–WF18 |
| **Tổng** | **19** | |

**Tránh tính trùng:** Tạo/sửa/lưu trữ là thao tác trong mục đích của workflow, không có 1 workflow cho từng CRUD. WF02/WF03 là trải nghiệm **đọc** của khách; WF10–WF25 là **quản trị nguồn** của chính dữ liệu đó. WF14–WF16 chỉ xử lý **nhập**, WF29 chỉ **xuất**, còn WF11–WF12 xử lý **duyệt/xuất bản** bản ghi chính thức. WF04/WF25 cùng dùng tệp nhưng một bên là cấp công khai có điều kiện, một bên là thư viện nội bộ.

## Kết quả kiểm tra và giới hạn

- Đã chạy ngày 12/10/2026: API `npm.cmd run test:unit` **129/129 đạt**; Frontend `npm.cmd test` **16/16 đạt**; Admin unit `node --test tests/unit/*.test.mjs` **12/12 đạt**; `npm.cmd run typecheck` ở cả API, Admin, Frontend **đạt**. Đây là test unit/tĩnh theo mã hiện tại.
- Đã thử đọc `localhost:4000/health`, `localhost:3001/admin/login`, `localhost:3000` với timeout 3 giây; cả ba không trả lời trong thời gian đó. **Chưa xác minh runtime đang chạy, PostgreSQL/migration thực tế, E2E hoặc các smoke script có ghi dữ liệu.** Những file E2E/smoke dẫn trên là bằng chứng phạm vi kiểm thử có sẵn, không phải kết quả chạy của lần phân tích này.
- DDL ở `database/ddl/song_thanh_deployment_schema_20260730.sql` là snapshot cũ hơn migration mới nhất; mô tả hành vi ưu tiên controller/service/repository hiện tại và migration bổ sung. Cần kiểm tra DB môi trường bàn giao nếu muốn xác nhận constraint/triggers thực tế.
- [module-config.ts](../admin/src/features/module-config.ts) chứa vài nhãn/field tổng quát có thể cũ (ví dụ trường duyệt/xuất bản trong cấu hình banner). Với quy tắc nghiệp vụ, tài liệu này ưu tiên schema/types, service/repository và bộ lọc public đang được gọi.
- Nút “public-safe” trong WF29 áp dụng các tham số lọc của từng API quản trị; riêng tài liệu kỹ thuật bộ lọc ở trình xuất dùng `active` và `is_public`, không thực hiện đầy đủ cùng kiểm tra quan hệ như API cấp tệp công khai ở WF04. Vì vậy tên nút không phải chứng cứ tệp xuất đã an toàn để phát hành ra ngoài.
- Mã có một số hàm/script backfill, import một lần và bảng di sản; chúng không được xem là thao tác Admin thường ngày nếu không có route/controller/giao diện hiện hành.
