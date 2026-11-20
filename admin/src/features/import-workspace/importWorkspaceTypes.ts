import { type ExportDateField } from './exportDateRange';

export type ImportRow = Record<string, unknown>;

export type WorkspaceTab = 'import' | 'export';

export type ExportPurpose = 'roundtrip' | 'internal_review' | 'public_share' | 'catalog_pdf';

export type ExportTemplateKey = 'product_catalog' | 'taxonomy_brand' | 'technical_documents' | 'customers' | 'future_data';

export type ExportScope = 'all' | 'condition';

export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

export type BatchListQueryState = {
  page: number;
  q: string;
  status: string;
  deletedScope: string;
};

export type ExportDataStatus = 'all' | 'active' | 'inactive';

export type CustomerExportSourceKind = 'all' | 'contact' | 'quote' | 'both';

export type CustomerExportDeletedScope = 'active' | 'deleted' | 'all';

export type CustomerExportColumnOptions = {
  includeContacts: boolean;
  includeQuotes: boolean;
  includeLastInteraction: boolean;
  includeSystemInfo: boolean;
};

export type ExportFilterState = {
  brandId: string;
  categoryParentId: string;
  categoryChildId: string;
  status: ExportDataStatus;
  customerQuery: string;
  customerSourceKind: CustomerExportSourceKind;
  customerDeletedScope: CustomerExportDeletedScope;
  customerIncludeContacts: boolean;
  customerIncludeQuotes: boolean;
  customerIncludeLastInteraction: boolean;
  customerIncludeSystemInfo: boolean;
  dateField: ExportDateField;
  dateFrom: string;
  dateTo: string;
};

export type ExportQueryFilterState = {
  brandId: string;
  categoryId: string;
  status: ExportDataStatus;
};

export const EXPORT_PAGE_SIZE = 100;

export const EXPORT_MAX_PAGES = 80;

export const exportPurposes: Array<{
  key: ExportPurpose;
  title: string;
  description: string;
  recommendedFormat: ExportFormat;
  badge: string;
}> = [
  {
    key: 'roundtrip',
    title: 'Xuất để nhập lại',
    description: 'Giữ tên và mã sản phẩm đã nhập để hỗ trợ đối chiếu dữ liệu.',
    recommendedFormat: 'xlsx',
    badge: 'Khuyên dùng'
  },
  {
    key: 'internal_review',
    title: 'Kiểm tra nội bộ',
    description: 'Xuất dữ liệu kèm trạng thái duyệt, hiển thị và thông tin cần rà soát.',
    recommendedFormat: 'xlsx',
    badge: 'Đầy đủ cột'
  },
  {
    key: 'public_share',
    title: 'Gửi đối tác',
    description: 'Chỉ lấy bản ghi đang hoạt động, đã duyệt và đã xuất bản.',
    recommendedFormat: 'xlsx',
    badge: 'Công khai'
  },
  {
    key: 'catalog_pdf',
    title: 'Làm danh mục giới thiệu',
    description: 'Dành cho tệp trình bày, ưu tiên ảnh, thông số và cấu trúc danh mục.',
    recommendedFormat: 'pdf',
    badge: 'Không nhập lại'
  }
];

export const exportFormats: Array<{
  key: ExportFormat;
  title: string;
  description: string;
}> = [
  {
    key: 'xlsx',
    title: 'Excel',
    description: 'Phù hợp nhất cho dữ liệu nhiều sheet và nhập lại.'
  },
  {
    key: 'csv',
    title: 'CSV',
    description: 'Gọn, dùng cho dữ liệu phẳng, không hợp với nhiều biến thể.'
  },
  {
    key: 'pdf',
    title: 'PDF',
    description: 'Chỉ để xem, gửi hoặc in, không dùng làm nguồn nhập lại.'
  }
];
