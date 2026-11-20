type ContentLifecycleLane =
  | 'missing'
  | 'draft'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'archived';

export type ContentIssueSeverity = 'blocking' | 'warning' | 'info';
type ContentIssueSource = 'api_guardrail' | 'content_quality' | 'lifecycle';

type ContentReadinessIssue = {
  action: {
    label: string;
    target: string;
  };
  code: string;
  detail: string;
  field: string | null;
  severity: ContentIssueSeverity;
  source: ContentIssueSource;
  title: string;
};

type ContentDestination = {
  href: string;
  label: string;
  state: 'live' | 'hidden' | 'archived';
};

export type ContentReadinessInput = {
  id?: unknown;
  title?: unknown;
  slug?: unknown;
  content_type?: unknown;
  content_html?: unknown;
  extra_blocks?: unknown;
  has_meaningful_body?: unknown;
  excerpt?: unknown;
  featured_image_file_id?: unknown;
  seo_title?: unknown;
  seo_description?: unknown;
  has_seo_title?: unknown;
  has_seo_description?: unknown;
  news_category_id?: unknown;
  published_at?: unknown;
  review_status?: unknown;
  publish_status?: unknown;
  deleted_at?: unknown;
};

export type ContentReadinessContext = {
  requireBody?: boolean;
  expectExcerpt?: boolean;
  expectFeaturedImage?: boolean;
  expectSeoDescription?: boolean;
  expectNewsCategory?: boolean;
  expectPublishedAt?: boolean;
  relatedDestinations?: Array<{ href: string; label: string }>;
};

export type ContentReadiness = {
  blockingIssues: ContentReadinessIssue[];
  canPublish: boolean;
  destinations: ContentDestination[];
  infoIssues: ContentReadinessIssue[];
  issues: ContentReadinessIssue[];
  lifecycleLane: ContentLifecycleLane;
  warningIssues: ContentReadinessIssue[];
};

export function getContentReadinessContext(mode: string): ContentReadinessContext {
  return {
    requireBody: mode !== 'products',
    expectExcerpt: true,
    // Public system/static pages render a complete text or banner fallback.
    // A missing cover is a meaningful editorial warning only for news cards.
    expectFeaturedImage: mode === 'news',
    expectSeoDescription: true,
    expectNewsCategory: mode === 'news',
    expectPublishedAt: mode === 'news'
  };
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function evaluateContentReadiness(
  input: ContentReadinessInput | null | undefined,
  context: ContentReadinessContext = {}
): ContentReadiness {
  if (!input) {
    const missing = issue({
      code: 'content.record.missing',
      severity: 'blocking',
      source: 'lifecycle',
      field: null,
      title: 'Chưa tạo nội dung',
      detail: 'Hãy tạo nội dung trước khi lưu, gửi duyệt hoặc xuất bản.',
      label: 'Tạo nội dung',
      target: 'form'
    });
    return buildResult('missing', [missing], []);
  }

  const issues: ContentReadinessIssue[] = [];
  const title = text(input.title);
  const slug = text(input.slug);
  const contentType = text(input.content_type);
  const reviewStatus = text(input.review_status);
  const publishStatus = text(input.publish_status);
  const archived = hasValue(input.deleted_at) || publishStatus === 'archived';

  if (!title) {
    issues.push(
      issue({
        code: 'content.title.required',
        severity: 'blocking',
        source: 'api_guardrail',
        field: 'title',
        title: 'Thiếu tiêu đề',
        detail: 'Nhập tiêu đề để người quản trị và khách truy cập nhận biết trang này.',
        label: 'Bổ sung tiêu đề',
        target: '#page-content-title'
      })
    );
  } else if (title.length > 255) {
    issues.push(
      issue({
        code: 'content.title.too_long',
        severity: 'blocking',
        source: 'api_guardrail',
        field: 'title',
        title: 'Tiêu đề vượt 255 ký tự',
        detail: `Tiêu đề hiện có ${title.length} ký tự.`,
        label: 'Rút gọn tiêu đề',
        target: '#page-content-title'
      })
    );
  }

  if (!slug) {
    issues.push(
      issue({
        code: 'content.slug.required',
        severity: 'blocking',
        source: 'api_guardrail',
        field: 'slug',
        title: 'Thiếu đường dẫn',
        detail: 'Mỗi nội dung cần một đường dẫn để có thể mở trên website.',
        label: 'Bổ sung đường dẫn',
        target: '#page-content-slug'
      })
    );
  } else {
    if (slug.length > 255) {
      issues.push(
        issue({
          code: 'content.slug.too_long',
          severity: 'blocking',
          source: 'api_guardrail',
          field: 'slug',
          title: 'Đường dẫn vượt 255 ký tự',
          detail: `Đường dẫn hiện có ${slug.length} ký tự. Hãy rút gọn còn tối đa 255 ký tự.`,
          label: 'Rút gọn đường dẫn',
          target: '#page-content-slug'
        })
      );
    }
    if (!SLUG_PATTERN.test(slug)) {
      issues.push(
        issue({
          code: 'content.slug.invalid',
          severity: 'blocking',
          source: 'api_guardrail',
          field: 'slug',
          title: 'Đường dẫn không đúng định dạng',
          detail: 'Chỉ dùng chữ thường không dấu, số và dấu gạch ngang giữa các từ.',
          label: 'Sửa đường dẫn',
          target: '#page-content-slug'
        })
      );
    }
  }

  if (contentType !== 'page' && contentType !== 'news') {
    issues.push(
      issue({
        code: 'content.type.invalid',
        severity: 'blocking',
        source: 'api_guardrail',
        field: 'content_type',
        title: 'Loại nội dung không hợp lệ',
        detail: 'Hệ thống hiện chỉ hỗ trợ trang tĩnh và bài tin tức.',
        label: 'Chọn lại loại nội dung',
        target: '#page-content-type'
      })
    );
  }

  const blockState = inspectExtraBlocks(input.extra_blocks);
  if (blockState.invalid) {
    issues.push(
      issue({
        code: 'content.blocks.invalid',
        severity: 'blocking',
        source: 'api_guardrail',
        field: 'extra_blocks',
        title: 'Có khối nội dung cần kiểm tra lại',
        detail: 'Mở Khối nội dung phụ và hoàn tất các trường đang được đánh dấu trước khi xuất bản.',
        label: 'Kiểm tra khối nội dung',
        target: '#page-section-blocks'
      })
    );
  }

  const hasMeaningfulBody =
    typeof input.has_meaningful_body === 'boolean'
      ? input.has_meaningful_body
      : hasMeaningfulHtml(input.content_html) || blockState.renderable;
  if (context.requireBody !== false && !hasMeaningfulBody) {
    issues.push(
      issue({
        code: 'content.body.required',
        severity: 'blocking',
        source: 'api_guardrail',
        field: 'content_html',
        title: 'Hồ sơ trang chưa đủ nội dung để xuất bản',
        detail: 'Phần do Trang nội dung quản lý đang trống. Hãy nhập nội dung chính hoặc thêm ít nhất một khối nội dung phụ.',
        label: 'Bổ sung nội dung',
        target: '#page-section-body'
      })
    );
  }

  if (hasDraftPlaceholder(input.content_html)) {
    issues.push(
      issue({
        code: 'content.body.placeholder',
        severity: 'warning',
        source: 'content_quality',
        field: 'content_html',
        title: 'Nội dung còn là bản mẫu',
        detail: 'Đoạn ghi tạm không hiển thị trên các trang danh mục. Hãy thay bằng nội dung thật trước khi giới thiệu cho khách.',
        label: 'Sửa nội dung trang',
        target: '#page-section-body'
      })
    );
  }

  if (!['draft', 'pending_review', 'approved', 'rejected'].includes(reviewStatus)) {
    issues.push(
      issue({
        code: 'lifecycle.review_status.invalid',
        severity: 'blocking',
        source: 'lifecycle',
        field: 'review_status',
        title: 'Trạng thái duyệt không hợp lệ',
        detail: 'Không thể xác định nội dung đang ở bước duyệt nào.',
        label: 'Chọn lại trạng thái duyệt',
        target: '#page-content-lifecycle'
      })
    );
  }
  if (!['unpublished', 'published', 'archived'].includes(publishStatus)) {
    issues.push(
      issue({
        code: 'lifecycle.publish_status.invalid',
        severity: 'blocking',
        source: 'lifecycle',
        field: 'publish_status',
        title: 'Trạng thái hiển thị không hợp lệ',
        detail: 'Không thể xác định nội dung đang ẩn, hiển thị hay lưu trữ.',
        label: 'Chọn lại trạng thái hiển thị',
        target: '#page-content-lifecycle'
      })
    );
  }

  if (archived) {
    issues.push(
      issue({
        code:
          publishStatus === 'published'
            ? 'lifecycle.archived_but_published'
            : 'lifecycle.archived',
        severity: 'blocking',
        source: 'lifecycle',
        field: 'publish_status',
        title:
          publishStatus === 'published'
            ? 'Nội dung lưu trữ vẫn đang hiển thị'
            : 'Nội dung đang lưu trữ',
        detail:
          publishStatus === 'published'
            ? 'Hãy khôi phục nội dung hoặc ẩn khỏi website trước khi tiếp tục.'
            : 'Khôi phục bản ghi trước khi đưa lại vào quy trình duyệt và xuất bản.',
        label: 'Khôi phục nội dung',
        target: '#page-content-lifecycle'
      })
    );
  } else if (publishStatus === 'published' && reviewStatus !== 'approved') {
    issues.push(
      issue({
        code: 'lifecycle.published_without_approval',
        severity: 'blocking',
        source: 'lifecycle',
        field: 'review_status',
        title: 'Đánh dấu xuất bản nhưng chưa được duyệt',
        detail: 'Trang không hiển thị trên website cho tới khi được duyệt.',
        label: 'Kiểm tra quy trình duyệt',
        target: '#page-content-lifecycle'
      })
    );
  } else if (reviewStatus !== 'approved') {
    issues.push(
      issue({
        code:
          reviewStatus === 'rejected'
            ? 'lifecycle.rejected'
            : 'lifecycle.approval.required',
        severity: 'blocking',
        source: 'lifecycle',
        field: 'review_status',
        title: reviewStatus === 'rejected' ? 'Nội dung đã bị từ chối' : 'Chưa hoàn tất duyệt',
        detail:
          reviewStatus === 'pending_review'
            ? 'Nội dung đang chờ người có quyền duyệt. Bạn không cần sửa thêm ở bước này.'
            : reviewStatus === 'rejected'
              ? 'Chỉnh nội dung theo phản hồi, lưu lại rồi bấm Gửi duyệt.'
              : 'Lưu nội dung trước, sau đó bấm Gửi duyệt ở thanh thao tác.',
        label:
          reviewStatus === 'rejected'
            ? 'Chỉnh sửa nội dung'
            : reviewStatus === 'pending_review'
              ? 'Xem trạng thái duyệt'
              : 'Đi tới thanh thao tác',
        target: '#page-content-lifecycle'
      })
    );
  }

  addQualityIssues(issues, input, context, contentType);

  const lifecycleLane = getLifecycleLane({ archived, publishStatus, reviewStatus });
  const destinations = buildDestinations(input, context, contentType, slug, archived);
  return buildResult(lifecycleLane, issues, destinations);
}

function addQualityIssues(
  issues: ContentReadinessIssue[],
  input: ContentReadinessInput,
  context: ContentReadinessContext,
  contentType: string
) {
  if (context.expectExcerpt && !text(input.excerpt)) {
    issues.push(qualityIssue('content.excerpt.missing', 'excerpt', 'Thiếu mô tả ngắn', 'Bổ sung mô tả ngắn'));
  }
  if (context.expectFeaturedImage && !text(input.featured_image_file_id)) {
    issues.push(
      qualityIssue(
        'content.featured_image.missing',
        'featured_image_file_id',
        'Thiếu ảnh đại diện',
        'Chọn ảnh đại diện'
      )
    );
  }
  const hasSeoDescription =
    typeof input.has_seo_description === 'boolean'
      ? input.has_seo_description
      : Boolean(text(input.seo_description));
  if (context.expectSeoDescription && !hasSeoDescription) {
    issues.push(
      qualityIssue(
        'content.seo_description.missing',
        'seo_description',
        'Thiếu mô tả SEO',
        'Bổ sung mô tả SEO'
      )
    );
  }
  if (text(input.seo_title).length > 255) {
    issues.push(
      qualityIssue(
        'content.seo_title.too_long',
        'seo_title',
        'Tiêu đề SEO vượt 255 ký tự',
        'Rút gọn tiêu đề SEO'
      )
    );
  }
  if (text(input.seo_description).length > 512) {
    issues.push(
      qualityIssue(
        'content.seo_description.too_long',
        'seo_description',
        'Mô tả SEO vượt 512 ký tự',
        'Rút gọn mô tả SEO'
      )
    );
  }
  if (contentType === 'news' && context.expectNewsCategory && !text(input.news_category_id)) {
    issues.push(
      qualityIssue('news.category.missing', 'news_category_id', 'Chưa chọn chuyên mục', 'Chọn chuyên mục')
    );
  }
  if (contentType === 'news' && context.expectPublishedAt && !text(input.published_at)) {
    issues.push(
      qualityIssue(
        'news.published_at.missing',
        'published_at',
        'Chưa đặt thời điểm bài viết',
        'Đặt thời điểm bài viết'
      )
    );
  }
}

function qualityIssue(code: string, field: string, title: string, label: string) {
  const targets: Record<string, string> = {
    excerpt: '#page-content-excerpt',
    featured_image_file_id: '#page-section-media',
    seo_title: '#page-content-seo-title',
    seo_description: '#page-content-seo-description',
    news_category_id: '#page-content-news-category',
    published_at: '#page-content-published-at'
  };
  const details: Record<string, string> = {
    excerpt: 'Mô tả ngắn đang trống. Bổ sung một đoạn tóm tắt để người đọc hiểu nhanh nội dung trang.',
    featured_image_file_id: 'Trang chưa có ảnh đại diện. Chọn một ảnh phù hợp tại mục hình ảnh.',
    seo_title: 'Tiêu đề SEO cần rút gọn còn tối đa 255 ký tự.',
    seo_description: code.endsWith('too_long')
      ? 'Mô tả SEO cần rút gọn còn tối đa 512 ký tự.'
      : 'Mô tả SEO đang trống. Bổ sung phần tóm tắt dùng khi tìm kiếm và chia sẻ liên kết.',
    news_category_id: 'Bài viết chưa có chuyên mục. Chọn chuyên mục tại phần thông tin tin tức.',
    published_at: 'Bài viết chưa có ngày đăng. Chọn ngày và giờ tại phần thông tin tin tức.'
  };
  return issue({
    code,
    severity: 'warning',
    source: 'content_quality',
    field,
    title,
    detail: details[field] ?? 'Bổ sung mục đang thiếu để nội dung đầy đủ hơn.',
    label,
    target: targets[field] ?? '#page-section-basic'
  });
}

function buildDestinations(
  input: ContentReadinessInput,
  context: ContentReadinessContext,
  contentType: string,
  slug: string,
  archived: boolean
): ContentDestination[] {
  if (!slug || !SLUG_PATTERN.test(slug) || !['page', 'news'].includes(contentType)) return [];
  const state = archived
    ? 'archived'
    : text(input.publish_status) === 'published' && text(input.review_status) === 'approved'
      ? 'live'
      : 'hidden';
  const primary: ContentDestination = {
    href: contentType === 'news' ? `/tin-tuc/${slug}` : `/${slug}`,
    label: contentType === 'news' ? 'Bài viết trên website' : 'Trang trên website',
    state
  };
  const destinations = [primary];
  for (const destination of context.relatedDestinations ?? []) {
    if (!destination.href || destinations.some((item) => item.href === destination.href)) continue;
    destinations.push({ ...destination, state });
  }
  return destinations;
}

function getLifecycleLane({
  archived,
  publishStatus,
  reviewStatus
}: {
  archived: boolean;
  publishStatus: string;
  reviewStatus: string;
}): ContentLifecycleLane {
  if (archived) return 'archived';
  if (publishStatus === 'published') return 'published';
  if (reviewStatus === 'rejected') return 'rejected';
  if (reviewStatus === 'pending_review') return 'review';
  if (reviewStatus === 'approved') return 'approved';
  return 'draft';
}

function inspectExtraBlocks(value: unknown): { invalid: boolean; renderable: boolean } {
  if (value === null || typeof value === 'undefined' || value === '') {
    return { invalid: false, renderable: false };
  }
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return { invalid: true, renderable: false };
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { invalid: true, renderable: false };
  }
  const blocks = (parsed as { blocks?: unknown }).blocks;
  if (typeof blocks === 'undefined') return { invalid: false, renderable: false };
  if (!Array.isArray(blocks)) return { invalid: true, renderable: false };
  return {
    invalid: false,
    renderable: blocks.some((rawBlock) => {
      if (!rawBlock || typeof rawBlock !== 'object' || Array.isArray(rawBlock)) return false;
      const block = rawBlock as Record<string, unknown>;
      if (block.type === 'image_card') return Boolean(text(block.image_file_id));
      return (
        (block.type === 'bullet_list' || block.type === 'card_grid') &&
        Array.isArray(block.items) &&
        block.items.length > 0
      );
    })
  };
}

function hasMeaningfulHtml(value: unknown) {
  if (typeof value !== 'string') return false;
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .trim().length > 0;
}

function hasDraftPlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value
    .replace(/<[^>]*>/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
  return ['noi dung dang cap nhat', 'noi dung intro', 'lorem ipsum', 'placeholder']
    .some((phrase) => normalized.includes(phrase));
}

function buildResult(
  lifecycleLane: ContentLifecycleLane,
  issues: ContentReadinessIssue[],
  destinations: ContentDestination[]
): ContentReadiness {
  const blockingIssues = issues.filter((item) => item.severity === 'blocking');
  return {
    lifecycleLane,
    canPublish: lifecycleLane !== 'archived' && blockingIssues.length === 0,
    issues,
    blockingIssues,
    warningIssues: issues.filter((item) => item.severity === 'warning'),
    infoIssues: issues.filter((item) => item.severity === 'info'),
    destinations
  };
}

function issue(input: {
  code: string;
  severity: ContentIssueSeverity;
  source: ContentIssueSource;
  field: string | null;
  title: string;
  detail: string;
  label: string;
  target: string;
}): ContentReadinessIssue {
  return {
    code: input.code,
    severity: input.severity,
    source: input.source,
    field: input.field,
    title: input.title,
    detail: input.detail,
    action: { label: input.label, target: input.target }
  };
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasValue(value: unknown) {
  return value !== null && typeof value !== 'undefined' && value !== '';
}
