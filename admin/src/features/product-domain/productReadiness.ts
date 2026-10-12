type RecordMap = Record<string, unknown>;

type ProductReadinessLane =
  | 'needs_work'
  | 'draft'
  | 'review'
  | 'approved'
  | 'published'
  | 'inactive'
  | 'rejected'
  | 'archived';

export type ProductReadinessIssue = {
  code: string;
  severity: 'blocking' | 'warning';
  kind: 'data' | 'publication' | 'workflow' | 'quality';
  source:
    | 'identity'
    | 'classification'
    | 'media'
    | 'content'
    | 'variant'
    | 'document'
    | 'seo'
    | 'workflow';
  field: string;
  title: string;
  detail: string;
  action: string;
};

export type ProductReadiness = {
  lane: ProductReadinessLane;
  issues: ProductReadinessIssue[];
  blockingIssues: ProductReadinessIssue[];
  warningIssues: ProductReadinessIssue[];
  dataIssues: ProductReadinessIssue[];
  publicationIssues: ProductReadinessIssue[];
  workflowIssues: ProductReadinessIssue[];
  qualityIssues: ProductReadinessIssue[];
  catalogIssues: ProductReadinessIssue[];
  canPublish: boolean;
  isPublic: boolean;
};

export type ProductDestination = {
  code:
    | 'product_detail'
    | 'product_search'
    | 'category_listing'
    | 'service_relations'
    | 'project_relations'
    | 'quote_history';
  label: string;
  href: string | null;
  state: 'live' | 'hidden' | 'linked' | 'historical';
  detail: string;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME_MAX_LENGTH = 255;
const SLUG_MAX_LENGTH = 255;
const SEO_TITLE_MAX_LENGTH = 255;
const SEO_DESCRIPTION_MAX_LENGTH = 512;

export function evaluateProductReadiness(
  productGroup: RecordMap,
  dependencies: RecordMap = {}
): ProductReadiness {
  const issues: ProductReadinessIssue[] = [];
  const name = textValue(productGroup.name);
  const slug = textValue(productGroup.slug);
  const status = textValue(productGroup.status);
  const reviewStatus = textValue(productGroup.review_status);
  const publishStatus = textValue(productGroup.publish_status);
  const archived = Boolean(productGroup.deleted_at) || publishStatus === 'archived';

  if (!name) {
    issues.push(
      issue('product_name_missing', 'blocking', 'data', 'identity', 'name', 'Thiếu tên sản phẩm',
        'Tên là định danh chính trong quản trị và trên website.', 'Nhập tên sản phẩm')
    );
  } else if (name.length > NAME_MAX_LENGTH) {
    issues.push(
      issue('product_name_too_long', 'blocking', 'data', 'identity', 'name', 'Tên sản phẩm quá dài',
        `Tên chỉ được tối đa ${NAME_MAX_LENGTH} ký tự.`, 'Rút gọn tên sản phẩm')
    );
  }

  if (!slug || slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug)) {
    issues.push(
      issue('product_slug_invalid', 'blocking', 'data', 'identity', 'slug', 'Đường dẫn chưa hợp lệ',
        'Slug chỉ gồm chữ thường không dấu, số và dấu gạch nối; tối đa 255 ký tự.', 'Sửa đường dẫn')
    );
  }

  if (!textValue(productGroup.category_id)) {
    issues.push(
      issue('product_category_missing', 'blocking', 'data', 'classification', 'category_id',
        'Thiếu danh mục sản phẩm', 'Sản phẩm phải thuộc một danh mục cấp 2 đang dùng.', 'Chọn danh mục con')
    );
  } else if (
    !textValue(productGroup.category_level_1_id) ||
    !textValue(productGroup.category_level_2_id)
  ) {
    issues.push(
      issue('product_category_path_invalid', 'blocking', 'data', 'classification', 'category_level_1_id',
        'Cây danh mục chưa đầy đủ', 'Cần đủ danh mục cấp 1 và cấp 2 để sản phẩm xuất hiện đúng khu vực.',
        'Kiểm tra cây danh mục')
    );
  }

  if (!textValue(productGroup.thumbnail_file_id)) {
    issues.push(
      issue('product_thumbnail_missing', 'blocking', 'publication', 'media', 'thumbnail_file_id',
        'Thiếu ảnh chính', 'Cần chọn ảnh đại diện trước khi đưa sản phẩm lên website.', 'Chọn ảnh chính')
    );
  }

  if (!textValue(productGroup.short_description)) {
    issues.push(
      issue('product_short_description_missing', 'blocking', 'publication', 'content', 'short_description',
        'Thiếu mô tả ngắn', 'Cần có mô tả ngắn để khách hàng hiểu nhanh sản phẩm trước khi xem chi tiết.',
        'Bổ sung mô tả ngắn')
    );
  }

  if (!archived && status !== 'active') {
    issues.push(
      issue('product_publish_requires_active', 'blocking', 'workflow', 'workflow', 'status',
        'Sản phẩm đang tạm ngưng', 'Chỉ sản phẩm đang hoạt động mới được xuất bản.',
        'Chuyển sang đang hoạt động')
    );
  }

  if (!archived && reviewStatus !== 'approved') {
    const reviewMessage = reviewStatus === 'pending_review'
      ? {
          title: 'Đang chờ duyệt',
          detail: 'Hồ sơ đã gửi và đang chờ người có quyền duyệt quyết định.',
          action: 'Xem trạng thái duyệt'
        }
      : reviewStatus === 'rejected'
        ? {
            title: 'Bị từ chối duyệt',
            detail: 'Xem lại hồ sơ và gửi duyệt lại trước khi xuất bản.',
            action: 'Gửi duyệt lại'
          }
        : {
            title: 'Chưa gửi duyệt',
            detail: 'Hồ sơ cần được gửi và duyệt trước khi xuất bản.',
            action: 'Gửi duyệt'
          };
    issues.push(
      issue('product_publish_requires_approval', 'blocking', 'workflow', 'workflow', 'review_status',
        reviewMessage.title, reviewMessage.detail, reviewMessage.action)
    );
  }

  if (archived) {
    issues.push(
      issue('product_archived', 'blocking', 'workflow', 'workflow', 'publish_status', 'Sản phẩm đang lưu trữ',
        'Bản ghi vẫn có thể khôi phục nhưng không được hiển thị công khai.', 'Khôi phục sản phẩm')
    );
  }

  const activeVariants = countValue(dependencies.active_variants);
  const publicPriceSummary = optionalRecord(productGroup.public_price_summary);
  const publicVariants = optionalCountValue(publicPriceSummary?.public_variant_count);
  if (activeVariants === 0) {
    issues.push(
      issue('product_variant_missing', 'warning', 'quality', 'variant', 'variants', 'Chưa có biến thể',
        'Khách hàng chưa có mã hoặc cấu hình cụ thể để lựa chọn.', 'Thêm biến thể')
    );
  } else if (publicVariants === 0) {
    issues.push(
      issue('product_variant_not_public', 'warning', 'quality', 'variant', 'variants',
        'Chưa có biến thể công khai', `${activeVariants} biến thể đang dùng nhưng chưa biến thể nào hiển thị công khai.`,
        'Kiểm tra trạng thái biến thể')
    );
  }

  if (countValue(dependencies.active_images) === 0) {
    issues.push(
      issue('product_gallery_missing', 'warning', 'quality', 'media', 'images', 'Chưa có thư viện ảnh',
        'Ảnh chính vẫn có thể hiển thị, nhưng khách chưa xem được các góc hoặc cấu hình khác.',
        'Thêm ảnh sản phẩm')
    );
  }

  if (countValue(dependencies.active_documents) === 0) {
    issues.push(
      issue('product_document_missing', 'warning', 'quality', 'document', 'documents', 'Chưa có tài liệu kỹ thuật',
        'Không chặn xuất bản vì một số sản phẩm không có tài liệu riêng.', 'Thêm tài liệu nếu có')
    );
  }

  const seoTitle = textValue(productGroup.seo_title);
  if (!seoTitle) {
    issues.push(
      issue('product_seo_title_missing', 'warning', 'quality', 'seo', 'seo_title', 'Thiếu tiêu đề SEO',
        'Website sẽ phải dùng tên sản phẩm làm tiêu đề tìm kiếm.', 'Bổ sung tiêu đề SEO')
    );
  } else if (seoTitle.length > SEO_TITLE_MAX_LENGTH) {
    issues.push(
      issue('product_seo_title_too_long', 'blocking', 'data', 'seo', 'seo_title', 'Tiêu đề SEO quá dài',
        `Tiêu đề SEO chỉ được tối đa ${SEO_TITLE_MAX_LENGTH} ký tự.`, 'Rút gọn tiêu đề SEO')
    );
  }

  const seoDescription = textValue(productGroup.seo_description);
  if (!seoDescription) {
    issues.push(
      issue('product_seo_description_missing', 'warning', 'quality', 'seo', 'seo_description', 'Thiếu mô tả SEO',
        'Kết quả tìm kiếm chưa có mô tả được quản lý riêng.', 'Bổ sung mô tả SEO')
    );
  } else if (seoDescription.length > SEO_DESCRIPTION_MAX_LENGTH) {
    issues.push(
      issue('product_seo_description_too_long', 'blocking', 'data', 'seo', 'seo_description',
        'Mô tả SEO quá dài', `Mô tả SEO chỉ được tối đa ${SEO_DESCRIPTION_MAX_LENGTH} ký tự.`,
        'Rút gọn mô tả SEO')
    );
  }

  const blockingIssues = issues.filter((item) => item.severity === 'blocking');
  const warningIssues = issues.filter((item) => item.severity === 'warning');
  const dataIssues = issues.filter((item) => item.kind === 'data');
  const publicationIssues = issues.filter((item) => item.kind === 'publication');
  const workflowIssues = issues.filter((item) => item.kind === 'workflow');
  const qualityIssues = issues.filter((item) => item.kind === 'quality');
  const catalogIssues = [...dataIssues, ...publicationIssues];
  const isPublic =
    !archived &&
    status === 'active' &&
    reviewStatus === 'approved' &&
    publishStatus === 'published';

  return {
    lane: resolveLane({ archived, dataIssues, isPublic, reviewStatus, status }),
    issues,
    blockingIssues,
    warningIssues,
    dataIssues,
    publicationIssues,
    workflowIssues,
    qualityIssues,
    catalogIssues,
    canPublish: !archived && blockingIssues.length === 0,
    isPublic
  };
}

export function getProductReadinessContext(
  productGroup: RecordMap,
  dependencies: RecordMap = {}
) {
  const readiness = evaluateProductReadiness(productGroup, dependencies);
  const slug = textValue(productGroup.slug);
  const publicHref = slug ? `/san-pham/${encodeURIComponent(slug)}` : null;
  const publicState = readiness.isPublic ? 'live' : 'hidden';
  const destinations: ProductDestination[] = [
    {
      code: 'product_detail',
      label: 'Trang chi tiết sản phẩm',
      href: publicHref,
      state: publicState,
      detail: readiness.isPublic ? 'Khách hàng có thể mở trực tiếp.' : 'Chưa hiển thị công khai.'
    },
    {
      code: 'product_search',
      label: 'Tìm kiếm sản phẩm',
      href: '/tim-kiem',
      state: publicState,
      detail: readiness.isPublic ? 'Có thể xuất hiện trong kết quả tìm kiếm.' : 'Bị loại khỏi kết quả công khai.'
    },
    {
      code: 'category_listing',
      label: 'Danh sách theo danh mục',
      href: '/san-pham/danh-sach',
      state: publicState,
      detail: categoryPath(productGroup)
    }
  ];

  const serviceCount = countValue(dependencies.active_service_relations);
  if (serviceCount > 0) {
    destinations.push({
      code: 'service_relations',
      label: 'Dịch vụ liên quan',
      href: null,
      state: 'linked',
      detail: `${serviceCount} dịch vụ đang liên kết sản phẩm này.`
    });
  }

  const projectCount = countValue(dependencies.active_project_relations);
  if (projectCount > 0) {
    destinations.push({
      code: 'project_relations',
      label: 'Dự án liên quan',
      href: null,
      state: 'linked',
      detail: `${projectCount} dự án đang liên kết sản phẩm này.`
    });
  }

  const quoteCount = countValue(dependencies.active_quote_items);
  if (quoteCount > 0) {
    destinations.push({
      code: 'quote_history',
      label: 'Yêu cầu báo giá đã ghi nhận',
      href: null,
      state: 'historical',
      detail: `${quoteCount} dòng yêu cầu đang tham chiếu sản phẩm này.`
    });
  }

  return { readiness, destinations };
}

function issue(
  code: string,
  severity: ProductReadinessIssue['severity'],
  kind: ProductReadinessIssue['kind'],
  source: ProductReadinessIssue['source'],
  field: string,
  title: string,
  detail: string,
  action: string
): ProductReadinessIssue {
  return { code, severity, kind, source, field, title, detail, action };
}

function resolveLane(input: {
  archived: boolean;
  dataIssues: ProductReadinessIssue[];
  isPublic: boolean;
  reviewStatus: string;
  status: string;
}): ProductReadinessLane {
  if (input.archived) return 'archived';
  if (input.isPublic) return 'published';
  if (input.dataIssues.length > 0) return 'needs_work';
  if (input.status === 'inactive') return 'inactive';
  if (input.reviewStatus === 'rejected') return 'rejected';
  if (input.reviewStatus === 'pending_review') return 'review';
  if (input.reviewStatus === 'approved') return 'approved';
  return 'draft';
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function countValue(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function optionalRecord(value: unknown): RecordMap | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : null;
}

function optionalCountValue(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
}

function categoryPath(productGroup: RecordMap) {
  const level1 = textValue(productGroup.category_level_1_name);
  const level2 = textValue(productGroup.category_level_2_name);
  if (level1 && level2) return `${level1} → ${level2}`;
  return 'Cây danh mục chưa đầy đủ.';
}
