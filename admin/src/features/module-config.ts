import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';

type ModuleColumn = {
  key: string;
  label: string;
  kind?: 'date' | 'status' | 'text';
};

export interface ModuleConfig {
  key: string;
  title: string;
  subtitle?: string;
  listPath: string;
  detailPath?: string;
  endpoint: string;
  readPermission: string;
  createPermission?: string;
  updatePermission?: string;
  archivePermission?: string;
  restorePermission?: string;
  columns: ModuleColumn[];
  fields: Array<{ key: string; label: string; multiline?: boolean; readOnly?: boolean }>;
  createDisabledReason?: string;
  notes?: string;
}

export const moduleConfigs = {
  pageContents: {
    key: 'pageContents',
    title: 'Trang nội dung',
    subtitle: 'Bài viết, trang giới thiệu, dịch vụ — toàn bộ nội dung tĩnh của website.',
    listPath: '/page-contents',
    detailPath: '/page-contents',
    endpoint: endpoints.songThanh.pageContents,
    readPermission: PERMISSIONS.pageContentRead,
    createPermission: PERMISSIONS.pageContentCreate,
    updatePermission: PERMISSIONS.pageContentUpdate,
    archivePermission: PERMISSIONS.pageContentArchive,
    restorePermission: PERMISSIONS.pageContentRestore,
    columns: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'slug', label: 'Đường dẫn URL' },
      { key: 'status', label: 'Trạng thái', kind: 'status' },
      { key: 'review_status', label: 'Duyệt', kind: 'status' },
      { key: 'publish_status', label: 'Xuất bản', kind: 'status' },
      { key: 'updated_at', label: 'Cập nhật', kind: 'date' }
    ],
    fields: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'slug', label: 'Slug' },
      { key: 'excerpt', label: 'Tóm tắt', multiline: true },
      { key: 'content', label: 'Nội dung', multiline: true },
      { key: 'content_type', label: 'Loại nội dung' },
      { key: 'thumbnail_file_id', label: 'Tệp ảnh đại diện' },
      { key: 'seo_title', label: 'SEO title' },
      { key: 'seo_description', label: 'SEO description', multiline: true },
      { key: 'seo_og_image_file_id', label: 'Ảnh chia sẻ SEO' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'review_status', label: 'Trạng thái duyệt' },
      { key: 'publish_status', label: 'Trạng thái xuất bản' }
    ]
  },
  banners: {
    key: 'banners',
    title: 'Banner',
    subtitle: 'Ảnh quảng cáo và banner trên website — tiêu đề, hình ảnh, liên kết, lịch đăng.',
    listPath: '/banners',
    detailPath: '/banners',
    endpoint: endpoints.songThanh.banners,
    readPermission: PERMISSIONS.bannerRead,
    createPermission: PERMISSIONS.bannerCreate,
    updatePermission: PERMISSIONS.bannerUpdate,
    archivePermission: PERMISSIONS.bannerArchive,
    restorePermission: PERMISSIONS.bannerRestore,
    columns: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'position', label: 'Vị trí' },
      { key: 'status', label: 'Trạng thái', kind: 'status' },
      { key: 'publish_status', label: 'Xuất bản', kind: 'status' },
      { key: 'updated_at', label: 'Cập nhật', kind: 'date' }
    ],
    fields: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'subtitle', label: 'Phụ đề' },
      { key: 'description', label: 'Mô tả', multiline: true },
      { key: 'image_file_id', label: 'Ảnh desktop' },
      { key: 'mobile_image_file_id', label: 'Ảnh mobile' },
      { key: 'link_url', label: 'Liên kết' },
      { key: 'link_label', label: 'Nhãn liên kết' },
      { key: 'position', label: 'Vị trí' },
      { key: 'start_at', label: 'Bắt đầu' },
      { key: 'end_at', label: 'Kết thúc' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'review_status', label: 'Trạng thái duyệt' },
      { key: 'publish_status', label: 'Trạng thái xuất bản' }
    ]
  },
  redirects: {
    key: 'redirects',
    title: 'Chuyển hướng URL',
    subtitle: 'Khi đường dẫn cũ thay đổi, tạo chuyển hướng để khách truy cập không gặp lỗi.',
    listPath: '/redirects',
    detailPath: '/redirects',
    endpoint: endpoints.songThanh.redirects,
    readPermission: PERMISSIONS.redirectRead,
    createPermission: PERMISSIONS.redirectCreate,
    updatePermission: PERMISSIONS.redirectUpdate,
    archivePermission: PERMISSIONS.redirectArchive,
    restorePermission: PERMISSIONS.redirectRestore,
    columns: [
      { key: 'from_path', label: 'Từ đường dẫn' },
      { key: 'to_path', label: 'Đến đường dẫn' },
      { key: 'redirect_type', label: 'Loại' },
      { key: 'status', label: 'Trạng thái', kind: 'status' },
      { key: 'updated_at', label: 'Cập nhật', kind: 'date' }
    ],
    fields: [
      { key: 'from_path', label: 'Từ đường dẫn' },
      { key: 'to_path', label: 'Đến đường dẫn' },
      { key: 'redirect_type', label: 'Loại chuyển hướng' },
      { key: 'status', label: 'Trạng thái' }
    ]
  },
  productCategories: {
    key: 'productCategories',
    title: 'Danh mục sản phẩm',
    subtitle: 'Phân loại sản phẩm theo danh mục chính và danh mục con.',
    listPath: '/product-categories',
    detailPath: '/product-categories',
    endpoint: endpoints.songThanh.productCategories,
    readPermission: PERMISSIONS.productCategoryRead,
    createPermission: PERMISSIONS.productCategoryCreate,
    updatePermission: PERMISSIONS.productCategoryUpdate,
    archivePermission: PERMISSIONS.productCategoryArchive,
    restorePermission: PERMISSIONS.productCategoryRestore,
    columns: [
      { key: 'name', label: 'Tên danh mục' },
      { key: 'slug', label: 'Đường dẫn URL' },
      { key: 'parent_id', label: 'Danh mục cha' },
      { key: 'status', label: 'Trạng thái', kind: 'status' },
      { key: 'updated_at', label: 'Cập nhật', kind: 'date' }
    ],
    fields: [
      { key: 'name', label: 'Tên danh mục' },
      { key: 'slug', label: 'Slug' },
      { key: 'parent_id', label: 'Danh mục cha' },
      { key: 'description', label: 'Mô tả', multiline: true },
      { key: 'thumbnail_file_id', label: 'Ảnh đại diện' },
      { key: 'seo_title', label: 'SEO title' },
      { key: 'seo_description', label: 'SEO description', multiline: true },
      { key: 'status', label: 'Trạng thái' }
    ]
  },
  brands: {
    key: 'brands',
    title: 'Thương hiệu',
    subtitle: 'Các thương hiệu sản phẩm đang kinh doanh và phân phối.',
    listPath: '/brands',
    detailPath: '/brands',
    endpoint: endpoints.songThanh.brands,
    readPermission: PERMISSIONS.brandRead,
    createPermission: PERMISSIONS.brandCreate,
    updatePermission: PERMISSIONS.brandUpdate,
    archivePermission: PERMISSIONS.brandArchive,
    restorePermission: PERMISSIONS.brandRestore,
    columns: [
      { key: 'name', label: 'Thương hiệu' },
      { key: 'slug', label: 'Đường dẫn URL' },
      { key: 'status', label: 'Trạng thái', kind: 'status' },
      { key: 'updated_at', label: 'Cập nhật', kind: 'date' }
    ],
    fields: [
      { key: 'name', label: 'Tên thương hiệu' },
      { key: 'slug', label: 'Slug' },
      { key: 'description', label: 'Mô tả', multiline: true },
      { key: 'logo_file_id', label: 'Logo' },
      { key: 'website_url', label: 'Website' },
      { key: 'status', label: 'Trạng thái' }
    ]
  },
  productGroups: {
    key: 'productGroups',
    title: 'Sản phẩm',
    subtitle: 'Tên, hình ảnh, mô tả và phân loại sản phẩm. Thông tin giá quản lý ở phần Biến thể.',
    listPath: '/product-groups',
    detailPath: '/product-groups',
    endpoint: endpoints.songThanh.productGroups,
    readPermission: PERMISSIONS.productGroupRead,
    createPermission: PERMISSIONS.productGroupCreate,
    updatePermission: PERMISSIONS.productGroupUpdate,
    archivePermission: PERMISSIONS.productGroupArchive,
    restorePermission: PERMISSIONS.productGroupRestore,
    columns: [
      { key: 'name', label: 'Sản phẩm' },
      { key: 'slug', label: 'Đường dẫn URL' },
      { key: 'category_name', label: 'Danh mục' },
      { key: 'brand_name', label: 'Thương hiệu' },
      { key: 'variant_count', label: 'Biến thể' },
      { key: 'review_status', label: 'Duyệt', kind: 'status' },
      { key: 'publish_status', label: 'Xuất bản', kind: 'status' },
      { key: 'status', label: 'Trạng thái', kind: 'status' }
    ],
    fields: [
      { key: 'name', label: 'Tên nhóm' },
      { key: 'slug', label: 'Slug' },
      { key: 'category_id', label: 'Danh mục' },
      { key: 'brand_id', label: 'Thương hiệu' },
      { key: 'sort_order', label: 'Thứ tự' },
      { key: 'short_description', label: 'Mô tả ngắn', multiline: true },
      { key: 'detailed_description', label: 'Mô tả chi tiết', multiline: true },
      { key: 'thumbnail_file_id', label: 'Ảnh đại diện' },
      { key: 'seo_title', label: 'SEO title' },
      { key: 'seo_description', label: 'SEO description', multiline: true },
      { key: 'seo_og_image_file_id', label: 'Ảnh chia sẻ SEO' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'review_status', label: 'Trạng thái duyệt' },
      { key: 'publish_status', label: 'Trạng thái xuất bản' }
    ],
  },
  productVariants: {
    key: 'productVariants',
    title: 'Biến thể / SKU',
    subtitle: 'Mã SKU, tên biến thể và thông tin giá của từng sản phẩm.',
    listPath: '/product-variants',
    detailPath: '/product-variants',
    endpoint: endpoints.songThanh.productVariants,
    readPermission: PERMISSIONS.productVariantRead,
    createPermission: PERMISSIONS.productVariantCreate,
    updatePermission: PERMISSIONS.productVariantUpdate,
    archivePermission: PERMISSIONS.productVariantArchive,
    restorePermission: PERMISSIONS.productVariantRestore,
    columns: [
      { key: 'variant_name', label: 'Biến thể' },
      { key: 'product_group_name', label: 'Nhóm sản phẩm' },
      { key: 'sku', label: 'SKU' },
      { key: 'public_price_mode', label: 'Chế độ giá', kind: 'status' },
      { key: 'public_price_amount', label: 'Giá công khai' },
      { key: 'review_status', label: 'Duyệt', kind: 'status' },
      { key: 'publish_status', label: 'Xuất bản', kind: 'status' },
      { key: 'status', label: 'Trạng thái', kind: 'status' }
    ],
    fields: [
      { key: 'product_group_id', label: 'Nhóm sản phẩm' },
      { key: 'variant_name', label: 'Tên biến thể' },
      { key: 'sku', label: 'SKU' },
      { key: 'external_code', label: 'Mã ngoài' },
      { key: 'model_code', label: 'Mã model' },
      { key: 'public_price_mode', label: 'Chế độ giá' },
      { key: 'public_price_amount', label: 'Giá công khai' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'review_status', label: 'Trạng thái duyệt' },
      { key: 'publish_status', label: 'Trạng thái xuất bản' }
    ],
  },
  technicalDocuments: {
    key: 'technicalDocuments',
    title: 'Tài liệu kỹ thuật',
    subtitle: 'Catalogue, datasheet và tài liệu kỹ thuật đính kèm với sản phẩm.',
    listPath: '/technical-documents',
    detailPath: '/technical-documents',
    endpoint: endpoints.songThanh.technicalDocuments,
    readPermission: PERMISSIONS.technicalDocumentRead,
    createPermission: PERMISSIONS.technicalDocumentCreate,
    updatePermission: PERMISSIONS.technicalDocumentUpdate,
    archivePermission: PERMISSIONS.technicalDocumentArchive,
    restorePermission: PERMISSIONS.technicalDocumentRestore,
    columns: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'document_type', label: 'Loại' },
      { key: 'product_group_name', label: 'Nhóm sản phẩm' },
      { key: 'version', label: 'Phiên bản' },
      { key: 'is_public', label: 'Công khai', kind: 'status' },
      { key: 'status', label: 'Trạng thái', kind: 'status' },
      { key: 'updated_at', label: 'Cập nhật', kind: 'date' }
    ],
    fields: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'document_type', label: 'Loại tài liệu' },
      { key: 'file_id', label: 'Tệp đính kèm' },
      { key: 'product_group_id', label: 'Nhóm sản phẩm' },
      { key: 'version', label: 'Phiên bản' },
      { key: 'is_public', label: 'Công khai' },
      { key: 'status', label: 'Trạng thái' }
    ]
  },
  services: {
    key: 'services',
    title: 'Dịch vụ',
    subtitle: 'Tên, mô tả và ảnh từng nhóm dịch vụ hiển thị trên /dich-vu. Viết theo nhu cầu khách hàng, hero đầu trang sửa ở Banner.',
    listPath: '/services',
    detailPath: '/services',
    endpoint: endpoints.songThanh.services,
    readPermission: PERMISSIONS.serviceRead,
    createPermission: PERMISSIONS.serviceCreate,
    updatePermission: PERMISSIONS.serviceUpdate,
    archivePermission: PERMISSIONS.serviceArchive,
    restorePermission: PERMISSIONS.serviceRestore,
    columns: [
      { key: 'title', label: 'Dịch vụ' },
      { key: 'slug', label: 'Đường dẫn URL' },
      { key: 'status', label: 'Trạng thái', kind: 'status' },
      { key: 'publish_status', label: 'Xuất bản', kind: 'status' }
    ],
    fields: sharedContentFields('Dịch vụ')
  },
  projects: {
    key: 'projects',
    title: 'Dự án',
    subtitle: 'Công trình, dự án đã triển khai — hình ảnh thực tế và thông tin khách hàng.',
    listPath: '/projects',
    detailPath: '/projects',
    endpoint: endpoints.songThanh.projects,
    readPermission: PERMISSIONS.projectRead,
    createPermission: PERMISSIONS.projectCreate,
    updatePermission: PERMISSIONS.projectUpdate,
    archivePermission: PERMISSIONS.projectArchive,
    restorePermission: PERMISSIONS.projectRestore,
    columns: [
      { key: 'title', label: 'Dự án' },
      { key: 'client_name', label: 'Khách hàng' },
      { key: 'project_year', label: 'Năm' },
      { key: 'status', label: 'Trạng thái', kind: 'status' }
    ],
    fields: [
      ...sharedContentFields('Dự án'),
      { key: 'client_name', label: 'Khách hàng' },
      { key: 'location', label: 'Địa điểm' },
      { key: 'project_year', label: 'Năm dự án' }
    ]
  },
  files: {
    key: 'files',
    title: 'Thư viện tệp',
    subtitle: 'Ảnh, tài liệu và file đã tải lên hệ thống.',
    listPath: '/files',
    endpoint: endpoints.songThanh.files,
    readPermission: PERMISSIONS.fileRead,
    createPermission: PERMISSIONS.fileCreate,
    archivePermission: PERMISSIONS.fileArchive,
    restorePermission: PERMISSIONS.fileRestore,
    createDisabledReason: undefined,
    columns: [
      { key: 'original_name', label: 'Tên gốc' },
      { key: 'mime_type', label: 'MIME' },
      { key: 'size_bytes', label: 'Dung lượng' },
      { key: 'status', label: 'Trạng thái', kind: 'status' },
      { key: 'created_at', label: 'Tạo lúc', kind: 'date' }
    ],
    fields: []
  },
  auditLogs: {
    key: 'auditLogs',
    title: 'Nhật ký hệ thống',
    subtitle: 'Lịch sử thay đổi dữ liệu — ai làm gì và khi nào.',
    listPath: '/audit-logs',
    detailPath: '/audit-logs',
    endpoint: endpoints.songThanh.auditLogs,
    readPermission: PERMISSIONS.auditLogRead,
    columns: [
      { key: 'action', label: 'Hành động' },
      { key: 'entity_type', label: 'Loại dữ liệu' },
      { key: 'entity_id', label: 'ID bản ghi' },
      { key: 'actor_name', label: 'Người thực hiện' },
      { key: 'created_at', label: 'Thời điểm', kind: 'date' }
    ],
    fields: [
      { key: 'actor_name', label: 'Người thực hiện', readOnly: true },
      { key: 'actor_email', label: 'Email người thực hiện', readOnly: true },
      { key: 'action', label: 'Hành động', readOnly: true },
      { key: 'entity_type', label: 'Loại dữ liệu', readOnly: true },
      { key: 'entity_id', label: 'ID bản ghi', readOnly: true },
      { key: 'old_value', label: 'Giá trị cũ', multiline: true, readOnly: true },
      { key: 'new_value', label: 'Giá trị mới', multiline: true, readOnly: true },
      { key: 'changed_fields', label: 'Trường thay đổi', multiline: true, readOnly: true }
    ]
  },
  contacts: {
    key: 'contacts',
    title: 'Liên hệ',
    subtitle: 'Tin nhắn từ khách hàng qua form liên hệ. Cập nhật trạng thái và ghi chú xử lý.',
    listPath: '/contacts',
    detailPath: '/contacts',
    endpoint: endpoints.songThanh.contacts,
    readPermission: PERMISSIONS.contactRead,
    updatePermission: PERMISSIONS.contactUpdateStatus,
    columns: [
      { key: 'full_name', label: 'Người liên hệ' },
      { key: 'company_name', label: 'Công ty' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Trạng thái', kind: 'status' },
      { key: 'created_at', label: 'Gửi lúc', kind: 'date' }
    ],
    fields: [
      { key: 'full_name', label: 'Họ tên', readOnly: true },
      { key: 'company_name', label: 'Công ty', readOnly: true },
      { key: 'email', label: 'Email', readOnly: true },
      { key: 'phone', label: 'Điện thoại', readOnly: true },
      { key: 'subject', label: 'Chủ đề', readOnly: true },
      { key: 'message', label: 'Nội dung', multiline: true, readOnly: true },
      { key: 'status', label: 'Trạng thái xử lý' },
      { key: 'assigned_to', label: 'Phân công' }
    ],
  },
  quotes: {
    key: 'quotes',
    title: 'Yêu cầu báo giá',
    subtitle: 'Yêu cầu báo giá từ khách hàng — xem sản phẩm yêu cầu, cập nhật trạng thái và ghi chú.',
    listPath: '/quotes',
    detailPath: '/quotes',
    endpoint: endpoints.songThanh.quotes,
    readPermission: PERMISSIONS.quoteRead,
    updatePermission: PERMISSIONS.quoteUpdateStatus,
    columns: [
      { key: 'customer_name', label: 'Khách hàng' },
      { key: 'company_name', label: 'Công ty' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Trạng thái', kind: 'status' },
      { key: 'created_at', label: 'Gửi lúc', kind: 'date' }
    ],
    fields: [
      { key: 'customer_name', label: 'Khách hàng', readOnly: true },
      { key: 'company_name', label: 'Công ty', readOnly: true },
      { key: 'email', label: 'Email', readOnly: true },
      { key: 'phone', label: 'Điện thoại', readOnly: true },
      { key: 'message', label: 'Nội dung', multiline: true, readOnly: true },
      { key: 'status', label: 'Trạng thái xử lý' },
      { key: 'assigned_to', label: 'Phân công' }
    ],
  }
} satisfies Record<string, ModuleConfig>;

function sharedContentFields(label: string) {
  return [
    { key: 'title', label: `Tiêu đề ${label.toLowerCase()}` },
    { key: 'slug', label: 'Slug' },
    { key: 'summary', label: 'Tóm tắt', multiline: true },
    { key: 'description', label: 'Mô tả', multiline: true },
    { key: 'content', label: 'Nội dung', multiline: true },
    { key: 'image_file_id', label: 'Tệp hình ảnh' },
    { key: 'seo_title', label: 'SEO title' },
    { key: 'seo_description', label: 'SEO description', multiline: true },
    { key: 'seo_og_image_file_id', label: 'Ảnh chia sẻ SEO' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'review_status', label: 'Trạng thái duyệt' },
    { key: 'publish_status', label: 'Trạng thái xuất bản' }
  ];
}
