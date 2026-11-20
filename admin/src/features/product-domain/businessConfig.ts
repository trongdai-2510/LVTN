import type { ComponentType } from 'react';

import { Boxes, FileText, FolderTree, Package, Tag } from '@/components/icons';
import { endpoints } from '@/lib/api-endpoints';
import { PERMISSIONS } from '@/lib/permissions';
import type { BusinessKind } from './businessTypes';

export type BusinessConfig = {
  title: string;
  singular: string;
  subtitle?: string;
  note?: string;
  listPath: string;
  endpoint: string;
  nestedKey: string;
  icon: ComponentType<{ className?: string }>;
  createPermission: string;
  updatePermission: string;
  archivePermission: string;
  restorePermission: string;
  readPermission: string;
  createLabel: string;
};

export const BUSINESS_CONFIGS: Record<BusinessKind, BusinessConfig> = {
  category: {
    title: 'Danh mục sản phẩm',
    singular: 'danh mục',
    subtitle: 'Phân loại sản phẩm theo danh mục chính và danh mục con.',
    listPath: '/product-categories',
    endpoint: endpoints.songThanh.productCategories,
    nestedKey: 'category',
    icon: FolderTree,
    createPermission: PERMISSIONS.productCategoryCreate,
    updatePermission: PERMISSIONS.productCategoryUpdate,
    archivePermission: PERMISSIONS.productCategoryArchive,
    restorePermission: PERMISSIONS.productCategoryRestore,
    readPermission: PERMISSIONS.productCategoryRead,
    createLabel: 'Tạo danh mục'
  },
  brand: {
    title: 'Thương hiệu',
    singular: 'thương hiệu',
    subtitle: 'Các thương hiệu sản phẩm đang kinh doanh và phân phối.',
    note: 'Ẩn thương hiệu sẽ làm các sản phẩm gắn thương hiệu đó không hiển thị ngoài website, nhưng dữ liệu vẫn còn trong admin và có thể hiện lại.',
    listPath: '/brands',
    endpoint: endpoints.songThanh.brands,
    nestedKey: 'brand',
    icon: Tag,
    createPermission: PERMISSIONS.brandCreate,
    updatePermission: PERMISSIONS.brandUpdate,
    archivePermission: PERMISSIONS.brandArchive,
    restorePermission: PERMISSIONS.brandRestore,
    readPermission: PERMISSIONS.brandRead,
    createLabel: 'Tạo thương hiệu'
  },
  productGroup: {
    title: 'Sản phẩm',
    singular: 'sản phẩm',
    subtitle: 'Theo dõi hồ sơ, mức sẵn sàng và trạng thái hiển thị trong một không gian làm việc.',
    note: 'Biến thể và tài liệu kỹ thuật chỉnh sửa trong trang chi tiết sản phẩm.',
    listPath: '/product-groups',
    endpoint: endpoints.songThanh.productGroups,
    nestedKey: 'product_group',
    icon: Boxes,
    createPermission: PERMISSIONS.productGroupCreate,
    updatePermission: PERMISSIONS.productGroupUpdate,
    archivePermission: PERMISSIONS.productGroupArchive,
    restorePermission: PERMISSIONS.productGroupRestore,
    readPermission: PERMISSIONS.productGroupRead,
    createLabel: 'Tạo sản phẩm'
  },
  productVariant: {
    title: 'Biến thể / SKU',
    singular: 'biến thể / SKU',
    subtitle: 'Cấu hình bán được cụ thể, có mã SKU, model, giá và thông số riêng.',
    listPath: '/product-variants',
    endpoint: endpoints.songThanh.productVariants,
    nestedKey: 'product_variant',
    icon: Package,
    createPermission: PERMISSIONS.productVariantCreate,
    updatePermission: PERMISSIONS.productVariantUpdate,
    archivePermission: PERMISSIONS.productVariantArchive,
    restorePermission: PERMISSIONS.productVariantRestore,
    readPermission: PERMISSIONS.productVariantRead,
    createLabel: 'Thêm biến thể / SKU'
  },
  technicalDocument: {
    title: 'Tài liệu kỹ thuật',
    singular: 'tài liệu kỹ thuật',
    subtitle: 'Catalogue, datasheet và tài liệu kỹ thuật đính kèm với sản phẩm.',
    listPath: '/technical-documents',
    endpoint: endpoints.songThanh.technicalDocuments,
    nestedKey: 'technical_document',
    icon: FileText,
    createPermission: PERMISSIONS.technicalDocumentCreate,
    updatePermission: PERMISSIONS.technicalDocumentUpdate,
    archivePermission: PERMISSIONS.technicalDocumentArchive,
    restorePermission: PERMISSIONS.technicalDocumentRestore,
    readPermission: PERMISSIONS.technicalDocumentRead,
    createLabel: 'Thêm thủ công'
  }
};
