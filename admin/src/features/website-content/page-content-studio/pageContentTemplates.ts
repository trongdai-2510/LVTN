'use client';

export type PageContentMode =
  | 'about'
  | 'products'
  | 'capability_profile'
  | 'services'
  | 'projects'
  | 'brands'
  | 'contact'
  | 'news_index'
  | 'news'
  | 'generic';

export type PageContentTemplate = {
  id: string;
  mode: PageContentMode;
  group: 'system' | 'news' | 'custom';
  label: string;
  shortLabel: string;
  slug: string;
  publicPath: string;
  contentType: 'page' | 'news';
  description: string;
  formTitle: string;
  titlePlaceholder: string;
  excerptPlaceholder: string;
  bodyLabel: string;
  bodyHint: string;
  imageLabel: string;
  imageHint: string;
  seoHint: string;
  primarySource: string;
  relatedModules: Array<{ label: string; href: string; description: string }>;
  defaultContent?: PageContentTemplateDefaults;
};


type PageContentTemplateDefaults = {
  title?: string;
  excerpt?: string;
  content_html?: string;
  seo_title?: string;
  seo_description?: string;
};

export type PageTemplateBlock = {
  id: string;
  title: string;
  owner: 'this_page' | 'module' | 'settings' | 'template';
  ownerLabel: string;
  required?: boolean;
  href?: string;
  description?: string;
  items?: Array<{ title: string; description?: string }>;
};

const ABOUT_FALLBACK_SUMMARY =
  'Song Thanh cung cấp thiết bị điện, vật tư công nghiệp và giải pháp kỹ thuật cho công trình, doanh nghiệp và hệ thống điện công nghiệp.';

const ABOUT_FALLBACK_CONTENT_HTML = [
  '<p>Song Thanh là đơn vị cung cấp thiết bị điện và vật tư công nghiệp phục vụ nhu cầu công trình, doanh nghiệp và hệ thống điện công nghiệp.</p>',
  '<p>Chúng tôi tập trung vào việc tổ chức danh mục sản phẩm rõ ràng, hỗ trợ khách hàng tra cứu thông tin, trao đổi yêu cầu kỹ thuật và gửi yêu cầu báo giá một cách thuận tiện.</p>'
].join('\n');

const CORE_CAPABILITY_TEMPLATE_BLOCK: PageTemplateBlock = {
  id: 'about-core-capabilities',
  title: 'Năng lực cốt lõi',
  owner: 'template',
  ownerLabel: 'Nội dung dự phòng của website',
  description:
    'Website chỉ dùng block mẫu này khi trang Giới thiệu chưa có khối nội dung phụ. Khi thêm bất kỳ khối phụ nào, toàn bộ vùng mẫu này được thay bằng các khối đã nhập trong trang.',
  items: [
    {
      title: 'Thiết bị điện',
      description: 'Danh mục thiết bị đóng cắt, điều khiển, đo lường và phụ kiện cho hệ thống điện công trình.'
    },
    {
      title: 'Vật tư công nghiệp',
      description: 'Vật tư thi công, lắp đặt và bảo trì phục vụ doanh nghiệp, nhà thầu và công trình kỹ thuật.'
    },
    {
      title: 'Giải pháp kỹ thuật',
      description: 'Hỗ trợ chọn cấu hình sản phẩm theo nhu cầu sử dụng, môi trường lắp đặt và yêu cầu vận hành.'
    },
    {
      title: 'Tra cứu & báo giá',
      description: 'Tổ chức dữ liệu sản phẩm để khách hàng tra cứu, so sánh và gửi yêu cầu báo giá thuận tiện.'
    }
  ]
};

const PAGE_TEMPLATE_BLOCKS: Partial<Record<PageContentMode, PageTemplateBlock[]>> = {
  about: [
    {
      id: 'about-hero',
      title: 'Hero giới thiệu',
      owner: 'module',
      ownerLabel: 'Banner',
      required: true,
      href: '/banners?position=gioi-thieu'
    },
    {
      id: 'about-company-content',
      title: 'Nội dung công ty',
      owner: 'this_page',
      ownerLabel: 'Sửa tại màn này',
      required: true
    },
    CORE_CAPABILITY_TEMPLATE_BLOCK,
    {
      id: 'about-contact',
      title: 'Pháp nhân & liên hệ',
      owner: 'settings',
      ownerLabel: 'Cấu hình website',
      href: '/website-settings'
    },
    {
      id: 'about-brands',
      title: 'Thương hiệu sản phẩm',
      owner: 'module',
      ownerLabel: 'Thương hiệu',
      href: '/brands'
    }
  ],
  products: [
    {
      id: 'products-hero',
      title: 'Banner chiến dịch sản phẩm',
      owner: 'module',
      ownerLabel: 'Banner',
      href: '/banners?position=san-pham',
      description: 'Chiến dịch nằm đầu trang sản phẩm. Quản lý ảnh và CTA tại Banner để website lấy đúng dữ liệu đã công khai.'
    },
    {
      id: 'products-catalog',
      title: 'Giới thiệu và tra cứu sản phẩm',
      owner: 'this_page',
      ownerLabel: 'Trang này + Cụm sản phẩm',
      required: true,
      href: '/product-groups',
      description: 'Tiêu đề và mô tả được sửa tại màn này; ô tìm kiếm, danh mục, thương hiệu và sản phẩm lấy từ Cụm sản phẩm.'
    },
    {
      id: 'products-supporting',
      title: 'Nội dung hỗ trợ tra cứu',
      owner: 'this_page',
      ownerLabel: 'Khối nội dung phụ',
      description: 'Hướng dẫn chọn hàng, lưu ý kỹ thuật hoặc lối tắt đến các nhóm sản phẩm thường được hỏi.'
    }
  ],
  capability_profile: [
    {
      id: 'capability-hero',
      title: 'Hero hồ sơ năng lực',
      owner: 'module',
      ownerLabel: 'Banner',
      required: true,
      href: '/banners?position=ho-so-nang-luc',
      description: 'Banner đầu trang hồ sơ năng lực. Đây là chỗ quản lý ảnh banner, khác với ảnh đại diện/chia sẻ của trang nội dung.'
    },
    {
      id: 'capability-intro',
      title: 'Lời mở đầu hồ sơ năng lực',
      owner: 'this_page',
      ownerLabel: 'Sửa tại màn này',
      description: 'Tiêu đề, mô tả ngắn, nội dung giới thiệu, SEO và các khối phụ hiển thị trước phần xem hồ sơ.'
    },
    {
      id: 'capability-supporting',
      title: 'Điểm nhấn năng lực',
      owner: 'this_page',
      ownerLabel: 'Khối nội dung phụ',
      description: 'Tóm tắt năng lực, phạm vi cung cấp hoặc các bằng chứng đã được xác thực trước phần hồ sơ.'
    },
    {
      id: 'capability-document',
      title: 'PDF và ảnh từng trang hồ sơ',
      owner: 'template',
      ownerLabel: 'Asset website hiện có',
      required: true,
      description: 'Contract hiện chưa có field PDF riêng cho Page Content, nên file PDF và ảnh từng trang vẫn dùng asset hiện có của website.'
    }
  ],
  services: [
    {
      id: 'services-hero',
      title: 'Hero dịch vụ',
      owner: 'module',
      ownerLabel: 'Banner',
      required: true,
      href: '/banners?position=dich-vu',
      description: 'Ảnh và CTA đầu trang. Dùng ảnh bối cảnh dịch vụ, đội ngũ, công trình hoặc hỗ trợ kỹ thuật, không dùng ảnh sản phẩm rời nếu dễ gây hiểu nhầm.'
    },
    {
      id: 'services-intro',
      title: 'Lời mở đầu trang dịch vụ',
      owner: 'this_page',
      ownerLabel: 'Sửa tại màn này',
      required: true,
      description: 'Một đoạn ngắn nói cho khách biết Song Thanh hỗ trợ những nhu cầu dịch vụ nào.'
    },
    {
      id: 'services-list',
      title: 'Danh sách dịch vụ',
      owner: 'module',
      ownerLabel: 'Dịch vụ',
      required: true,
      href: '/services',
      description: 'Tên, mô tả và ảnh đại diện của từng dịch vụ. Nội dung nên viết theo nhu cầu khách hàng.'
    },
    {
      id: 'services-when',
      title: 'Khi nào cần liên hệ',
      owner: 'module',
      ownerLabel: 'Dịch vụ',
      href: '/services',
      description: 'Tổng hợp dấu hiệu và tình huống thực tế từ trường “Khi nào cần liên hệ” của từng dịch vụ.'
    },
    {
      id: 'services-process',
      title: 'Quy trình & thông tin cần chuẩn bị',
      owner: 'this_page',
      ownerLabel: 'Khối nội dung phụ',
      description: 'Khi chưa có khối phụ, website dùng mẫu quy trình và thông tin cần chuẩn bị. Các khối phụ tại màn này sẽ thay vùng mẫu đó.'
    },
    {
      id: 'services-story',
      title: 'Nội dung tư vấn mở rộng',
      owner: 'this_page',
      ownerLabel: 'Nội dung chính',
      description: 'Nội dung biên tập mở rộng được nhập trong trường nội dung chính của trang Dịch vụ.'
    },
    {
      id: 'services-cta',
      title: 'CTA liên hệ',
      owner: 'settings',
      ownerLabel: 'Cấu hình website',
      href: '/website-settings',
      description: 'Hotline và thông tin liên hệ lấy từ cấu hình website. Chữ CTA dùng mẫu cố định của giao diện.'
    }
  ],
  projects: [
    {
      id: 'projects-hero',
      title: 'Hero trang dự án',
      owner: 'module',
      ownerLabel: 'Banner',
      href: '/banners?position=du-an',
      description: 'Ảnh và CTA đầu trang dự án.'
    },
    {
      id: 'projects-evidence',
      title: 'Lời mở đầu danh mục dự án',
      owner: 'this_page',
      ownerLabel: 'Sửa tại màn này',
      required: true,
      description: 'Tiêu đề, mô tả ngắn và nội dung giới thiệu của danh mục. Ảnh đầu trang lấy từ Banner; các dự án hiển thị lấy từ module Dự án.'
    },
    {
      id: 'projects-list',
      title: 'Hồ sơ dự án',
      owner: 'module',
      ownerLabel: 'Dự án',
      required: true,
      href: '/projects',
      description: 'Tên, khách hàng, địa điểm, mô tả, ảnh, câu chuyện triển khai và nhóm sản phẩm liên quan lấy từ từng hồ sơ. Chỉ mô tả phần Song Thanh thực hiện khi có thông tin đã xác nhận.'
    },
    {
      id: 'projects-story',
      title: 'Nội dung chứng minh bổ sung',
      owner: 'this_page',
      ownerLabel: 'Nội dung & khối phụ',
      description: 'Các bằng chứng, tiêu chí triển khai hoặc nội dung biên tập bổ sung cho toàn bộ danh mục dự án.'
    },
    {
      id: 'projects-cta',
      title: 'CTA dự án',
      owner: 'template',
      ownerLabel: 'Đang dùng mẫu website',
      description: 'Khối liên hệ cuối trang hiện dùng nội dung cố định của website; trang này chỉ đổi thứ tự hoặc ẩn khối, chưa sửa được câu chữ.'
    }
  ],
  brands: [
    {
      id: 'brands-hero',
      title: 'Hero trang thương hiệu',
      owner: 'module',
      ownerLabel: 'Banner',
      required: true,
      href: '/banners?position=doi-tac-thuong-hieu',
      description: 'Ảnh và CTA đầu trang thương hiệu. Quản lý bằng module Banner để giữ cùng một luồng với các hero website khác.'
    },
    {
      id: 'brands-intro',
      title: 'Lời giới thiệu thương hiệu',
      owner: 'this_page',
      ownerLabel: 'Sửa tại màn này',
      required: true
    },
    {
      id: 'brands-grid',
      title: 'Logo và mô tả thương hiệu',
      owner: 'module',
      ownerLabel: 'Thương hiệu',
      required: true,
      href: '/brands'
    },
    {
      id: 'brands-supporting',
      title: 'Hướng dẫn chọn thương hiệu',
      owner: 'this_page',
      ownerLabel: 'Nội dung & khối phụ',
      description: 'Giải thích cách tra cứu hãng và mối liên hệ giữa thương hiệu với nhóm sản phẩm.'
    },
    {
      id: 'brands-cta',
      title: 'CTA liên hệ',
      owner: 'template',
      ownerLabel: 'Đang dùng mẫu website',
      description: 'Khối liên hệ cuối trang hiện dùng nội dung cố định của website; trang này chỉ đổi thứ tự hoặc ẩn khối, chưa sửa được câu chữ.'
    }
  ],
  news_index: [
    {
      id: 'news-index-hero',
      title: 'Hero trang tin tức',
      owner: 'module',
      ownerLabel: 'Banner',
      href: '/banners?position=tin-tuc',
      description: 'Ảnh và CTA đầu trang tin tức.'
    },
    {
      id: 'news-index-intro',
      title: 'Lời mở đầu trang tin tức',
      owner: 'this_page',
      ownerLabel: 'Sửa tại màn này',
      required: true,
      description: 'Tiêu đề, mô tả ngắn, nội dung giới thiệu và SEO cho landing tin tức.'
    },
    {
      id: 'news-index-feed',
      title: 'Dòng tin & chuyên mục',
      owner: 'module',
      ownerLabel: 'Tin tức',
      required: true,
      href: '/page-contents',
      description: 'Bài nổi bật, các bài mới và chuyên mục được tổ chức thành một không gian đọc, không phải lưới thẻ chung chung.'
    },
    {
      id: 'news-index-supporting',
      title: 'Nội dung tòa soạn bổ sung',
      owner: 'this_page',
      ownerLabel: 'Nội dung & khối phụ',
      description: 'Lời dẫn chuyên môn, chủ đề cần ưu tiên hoặc khối nội dung phụ của landing Tin tức.'
    }
  ],
  contact: [
    {
      id: 'contact-hero',
      title: 'Hero trang liên hệ',
      owner: 'module',
      ownerLabel: 'Banner',
      required: true,
      href: '/banners?position=lien-he',
      description: 'Ảnh và CTA đầu trang liên hệ.'
    },
    {
      id: 'contact-intro',
      title: 'Tiêu đề và SEO',
      owner: 'this_page',
      ownerLabel: 'Sửa tại màn này',
      required: true
    },
    {
      id: 'contact-request',
      title: 'Bàn tiếp nhận liên hệ',
      owner: 'template',
      ownerLabel: 'Form & kênh liên hệ',
      required: true,
      description: 'Form, hotline, email và địa chỉ được đặt cùng ngữ cảnh để khách chọn cách liên hệ phù hợp.'
    },
    {
      id: 'contact-map',
      title: 'Địa chỉ & bản đồ',
      owner: 'settings',
      ownerLabel: 'Cấu hình website',
      href: '/website-settings',
      description: 'Thông tin vị trí công khai. Yêu cầu khách đã gửi chỉ được quản lý nội bộ, không thuộc bố cục website.'
    }
  ]
};

export const SYSTEM_PAGE_TEMPLATES: PageContentTemplate[] = [
  {
    id: 'about',
    mode: 'about',
    group: 'system',
    label: 'Giới thiệu công ty',
    shortLabel: 'Giới thiệu',
    slug: 'gioi-thieu',
    publicPath: '/gioi-thieu',
    contentType: 'page',
    description: 'Chỉnh nội dung công ty, ảnh giới thiệu và SEO cho trang Giới thiệu.',
    formTitle: 'Chỉnh trang Giới thiệu',
    titlePlaceholder: 'Công ty Song Thanh',
    excerptPlaceholder: 'Một đoạn ngắn giới thiệu Song Thanh, không lặp hotline/email.',
    bodyLabel: 'Nội dung giới thiệu công ty',
    bodyHint: 'Viết phần kể chuyện công ty, định hướng cung cấp và năng lực tư vấn. Không ghi số liệu nếu chưa xác thực.',
    imageLabel: 'Ảnh công ty',
    imageHint: 'Ảnh này dùng trong khối Công ty Song Thanh. Hero/banner quản lý ở Banner.',
    seoHint: 'Tối ưu cho tên công ty, thiết bị điện và vật tư công nghiệp.',
    primarySource: 'Màn này quản lý tiêu đề, phần giới thiệu, ảnh công ty, khối nội dung phụ và SEO. Banner, thông tin liên hệ và thương hiệu được cập nhật ở các khu vực liên quan.',
    relatedModules: [
      { label: 'Banner', href: '/banners?position=gioi-thieu', description: 'Hero trang giới thiệu' },
      { label: 'Cấu hình website', href: '/website-settings', description: 'Pháp nhân, hotline, email, địa chỉ' },
      { label: 'Thương hiệu', href: '/brands', description: 'Logo và trạng thái brand' }
    ],
    defaultContent: {
      title: 'Công ty Song Thanh',
      excerpt: ABOUT_FALLBACK_SUMMARY,
      content_html: ABOUT_FALLBACK_CONTENT_HTML,
      seo_title: 'Giới thiệu Công ty Song Thanh',
      seo_description: ABOUT_FALLBACK_SUMMARY
    }
  },
  {
    id: 'products',
    mode: 'products',
    group: 'system',
    label: 'Sản phẩm',
    shortLabel: 'Sản phẩm',
    slug: 'san-pham',
    publicPath: '/san-pham',
    contentType: 'page',
    description: 'Chỉnh hero, lời mở đầu, ảnh chia sẻ và SEO cho trang sản phẩm. Danh mục và nhóm sản phẩm vẫn quản lý ở module sản phẩm.',
    formTitle: 'Chỉnh trang Sản phẩm',
    titlePlaceholder: 'Danh mục sản phẩm',
    excerptPlaceholder: 'Một đoạn ngắn giới thiệu cách khách tra cứu danh mục và nhóm sản phẩm Song Thanh.',
    bodyLabel: 'Lời giới thiệu trang sản phẩm',
    bodyHint: 'Viết ngắn gọn về phạm vi sản phẩm và cách khách nên bắt đầu tra cứu. Không thêm giỏ hàng, khuyến mãi hoặc thông tin e-commerce.',
    imageLabel: 'Ảnh chia sẻ & xem trước',
    imageHint: 'Ảnh này chỉ dùng khi chia sẻ đường dẫn hoặc xem trước; banner đầu trang được quản lý tại mục Banner.',
    seoHint: 'Tối ưu cho danh mục sản phẩm, thiết bị điện, vật tư công nghiệp và nhu cầu tra cứu sản phẩm Song Thanh.',
    primarySource: 'Màn này quản lý lời mở đầu, khối nội dung phụ, ảnh chia sẻ và SEO. Banner, danh mục và danh sách sản phẩm được cập nhật ở các khu vực liên quan.',
    relatedModules: [
      { label: 'Banner', href: '/banners?position=san-pham', description: 'Hero trang sản phẩm' },
      { label: 'Danh mục sản phẩm', href: '/product-categories', description: 'Cây danh mục public' },
      { label: 'Thương hiệu', href: '/brands', description: 'Logo, tên hãng và trạng thái brand public' },
      { label: 'Sản phẩm', href: '/product-groups', description: 'Product group public, ảnh, mô tả và trạng thái hiển thị' },
      { label: 'Biến thể / SKU', href: '/product-variants', description: 'Model, mã hàng và cấu hình cụ thể của từng sản phẩm' },
      { label: 'Tài liệu kỹ thuật', href: '/technical-documents', description: 'Catalogue, datasheet và tài liệu gắn với sản phẩm' },
      { label: 'Nhập dữ liệu', href: '/import', description: 'Luồng import kiểm soát, không đưa raw data thẳng ra public' }
    ],
    defaultContent: {
      title: 'Danh mục sản phẩm',
      excerpt: 'Tra cứu nhóm sản phẩm, thương hiệu và danh mục thiết bị điện, vật tư công nghiệp đang được Song Thanh tổ chức cho khách hàng doanh nghiệp và công trình.',
      content_html: '<p>Khách hàng có thể bắt đầu từ danh mục sản phẩm, lọc theo nhóm nhu cầu hoặc đi vào danh sách sản phẩm để xem mô tả, thương hiệu và thông tin liên hệ tư vấn.</p>',
      seo_title: 'Sản phẩm thiết bị điện và vật tư công nghiệp | Song Thanh',
      seo_description: 'Tra cứu danh mục sản phẩm, nhóm sản phẩm, thương hiệu thiết bị điện và vật tư công nghiệp đang được Song Thanh quản lý trên website.'
    }
  },
  {
    id: 'capability-profile',
    mode: 'capability_profile',
    group: 'system',
    label: 'Hồ sơ năng lực',
    shortLabel: 'Hồ sơ năng lực',
    slug: 'ho-so-nang-luc',
    publicPath: '/ho-so-nang-luc',
    contentType: 'page',
    description: 'Chỉnh hero/banner, lời mở đầu, nội dung phụ và SEO cho trang hồ sơ năng lực.',
    formTitle: 'Chỉnh trang Hồ sơ năng lực',
    titlePlaceholder: 'Hồ sơ năng lực',
    excerptPlaceholder: 'Một đoạn ngắn giới thiệu tài liệu hồ sơ năng lực Song Thanh.',
    bodyLabel: 'Lời giới thiệu hồ sơ năng lực',
    bodyHint: 'Viết phần mô tả ngắn trước khu vực xem hồ sơ. Không ghi số liệu, dự án hoặc chứng nhận nếu chưa được xác thực.',
    imageLabel: 'Ảnh đại diện trang hồ sơ năng lực',
    imageHint: 'Dùng cho chia sẻ link hoặc khối phụ. Banner đầu trang quản lý ở Banner vị trí ho-so-nang-luc.',
    seoHint: 'Tối ưu cho hồ sơ năng lực Song Thanh, năng lực cung cấp thiết bị điện và vật tư công nghiệp.',
    primarySource: 'Màn này quản lý tiêu đề, mô tả, khối nội dung phụ và SEO. Banner được quản lý riêng; PDF và ảnh từng trang hiện vẫn lấy từ dữ liệu website hiện có.',
    relatedModules: [
      { label: 'Banner', href: '/banners?position=ho-so-nang-luc', description: 'Hero trang hồ sơ năng lực' },
      { label: 'Kho tệp', href: '/files', description: 'Quản lý metadata file dùng cho ảnh chia sẻ và khối phụ' }
    ],
    defaultContent: {
      title: 'Hồ sơ năng lực',
      excerpt: 'Tài liệu tổng hợp năng lực, thông tin doanh nghiệp và các nhóm sản phẩm, dịch vụ chính của Song Thanh.',
      content_html: '<p>Hồ sơ năng lực giúp khách hàng xem nhanh thông tin doanh nghiệp, phạm vi cung cấp và các nhóm sản phẩm, dịch vụ chính của Song Thanh trước khi trao đổi nhu cầu cụ thể.</p>',
      seo_title: 'Hồ sơ năng lực | Song Thanh',
      seo_description: 'Xem và tải hồ sơ năng lực Song Thanh, tài liệu tổng hợp thông tin doanh nghiệp, sản phẩm và dịch vụ chính.'
    }
  },
  {
    id: 'services',
    mode: 'services',
    group: 'system',
    label: 'Dịch vụ',
    shortLabel: 'Dịch vụ',
    slug: 'dich-vu',
    publicPath: '/dich-vu',
    contentType: 'page',
    description: 'Chỉnh lời mở đầu và ảnh chia sẻ trang dịch vụ. Hero nằm ở Banner, từng dịch vụ nằm ở module Dịch vụ.',
    formTitle: 'Chỉnh trang Dịch vụ',
    titlePlaceholder: 'Dịch vụ kỹ thuật cho công trình và doanh nghiệp',
    excerptPlaceholder: 'Một câu trả lời nhanh: Song Thanh hỗ trợ khách chọn thiết bị, phương án, bảo trì hay vận hành như thế nào.',
    bodyLabel: 'Lời giới thiệu dịch vụ',
    bodyHint: 'Viết cho khách hàng đọc. Nêu nhu cầu được hỗ trợ, khi nào nên liên hệ và thông tin nên gửi. Không viết kiểu mô tả hệ thống hoặc quy trình nội bộ.',
    imageLabel: 'Ảnh đại diện trang dịch vụ',
    imageHint: 'Dùng khi chia sẻ link. Hero/banner quản lý ở Banner. Nếu chọn ảnh ở đây, ưu tiên ảnh bối cảnh dịch vụ hoặc đội ngũ, không dùng ảnh sản phẩm đơn lẻ.',
    seoHint: 'Tập trung vào dịch vụ thiết bị điện, vật tư công nghiệp và tư vấn kỹ thuật.',
    primarySource: 'Màn này quản lý lời mở đầu, ảnh chia sẻ và SEO. Banner, từng dịch vụ và thông tin kêu gọi liên hệ được cập nhật ở các khu vực liên quan.',
    relatedModules: [
      { label: 'Banner', href: '/banners?position=dich-vu', description: 'Hero trang dịch vụ, ảnh và CTA đầu trang' },
      { label: 'Dịch vụ', href: '/services', description: 'Quản lý tên, mô tả và ảnh từng dịch vụ hiển thị ngoài website' },
      { label: 'Cấu hình website', href: '/website-settings', description: 'Thông tin liên hệ CTA' }
    ],
    defaultContent: {
      title: 'Dịch vụ kỹ thuật cho công trình và doanh nghiệp',
      excerpt: 'Xem các dịch vụ đang được Song Thanh công khai và trao đổi nhu cầu cụ thể để chọn hướng hỗ trợ phù hợp.',
      content_html: '<p>Khách hàng có thể bắt đầu bằng nhu cầu của công trình hoặc hệ thống đang vận hành. Hãy xem phạm vi từng dịch vụ và gửi thông tin sẵn có để trao đổi phương án phù hợp.</p>',
      seo_title: 'Dịch vụ kỹ thuật thiết bị điện | Song Thanh',
      seo_description: 'Dịch vụ tư vấn, thiết kế, bảo trì và hướng dẫn vận hành thiết bị điện, vật tư công nghiệp và hệ thống kỹ thuật từ Song Thanh.'
    }
  },
  {
    id: 'projects',
    mode: 'projects',
    group: 'system',
    label: 'Dự án',
    shortLabel: 'Dự án',
    slug: 'du-an',
    publicPath: '/du-an',
    contentType: 'page',
    description: 'Chỉnh phần mở đầu trang dự án. Dự án thật nằm ở module Dự án.',
    formTitle: 'Chỉnh trang Dự án',
    titlePlaceholder: 'Dự án và công trình tiêu biểu',
    excerptPlaceholder: 'Một đoạn nói rõ phạm vi dự án hoặc năng lực đã được xác thực.',
    bodyLabel: 'Lời dẫn trang dự án',
    bodyHint: 'Không bịa khách hàng, địa điểm, quy mô hoặc chứng nhận.',
    imageLabel: 'Ảnh đại diện trang dự án',
    imageHint: 'Ưu tiên ảnh công trình thật nếu có quyền sử dụng.',
    seoHint: 'Tối ưu cho dự án thiết bị điện, vật tư công trình và năng lực cung cấp.',
    primarySource: 'Màn này quản lý lời mở đầu, khối nội dung phụ và SEO. Banner và danh sách dự án được cập nhật ở các khu vực liên quan.',
    relatedModules: [
      { label: 'Banner', href: '/banners?position=du-an', description: 'Hero trang dự án' },
      { label: 'Dự án', href: '/projects', description: 'Quản lý hồ sơ dự án public' }
    ],
    defaultContent: {
      title: 'Dự án đã thực hiện',
      excerpt: 'Khám phá các hồ sơ công trình và nhóm thiết bị liên quan đã được Song Thanh công khai.',
      seo_title: 'Dự án và hồ sơ năng lực | Song Thanh',
      seo_description: 'Xem dự án, công trình tiêu biểu và năng lực cung cấp thiết bị điện, vật tư công nghiệp của Song Thanh.'
    }
  },
  {
    id: 'brands',
    mode: 'brands',
    group: 'system',
    label: 'Thương hiệu sản phẩm',
    shortLabel: 'Thương hiệu',
    slug: 'doi-tac-thuong-hieu',
    publicPath: '/doi-tac-thuong-hieu',
    contentType: 'page',
    description: 'Chỉnh lời giới thiệu trang thương hiệu. Hero/banner quản lý ở Banner, logo và danh sách brand nằm ở module Thương hiệu.',
    formTitle: 'Chỉnh trang Thương hiệu sản phẩm',
    titlePlaceholder: 'Thương hiệu sản phẩm',
    excerptPlaceholder: 'Một câu giải thích đây là danh sách thương hiệu trong catalog.',
    bodyLabel: 'Lời giới thiệu thương hiệu',
    bodyHint: 'Viết trung tính, không claim đối tác chính thức nếu chưa xác nhận.',
    imageLabel: 'Ảnh chia sẻ & xem trước',
    imageHint: 'Ảnh này chỉ dùng khi chia sẻ đường dẫn hoặc xem trước; logo từng hãng và banner đầu trang được quản lý ở khu vực riêng.',
    seoHint: 'Tối ưu cho thương hiệu thiết bị điện, đèn LED và vật tư công nghiệp.',
    primarySource: 'Màn này quản lý lời mở đầu, ảnh chia sẻ và SEO. Banner, logo và trạng thái từng thương hiệu được cập nhật ở các khu vực liên quan.',
    relatedModules: [
      { label: 'Banner', href: '/banners?position=doi-tac-thuong-hieu', description: 'Hero trang thương hiệu' },
      { label: 'Thương hiệu', href: '/brands', description: 'Logo, slug và trạng thái brand' },
      { label: 'Trang thương hiệu chi tiết', href: '/page-contents/brand-pages', description: 'Hồ sơ, nguồn xác thực và nội dung riêng của từng brand' }
    ],
    defaultContent: {
      title: 'Thương hiệu sản phẩm',
      excerpt: 'Danh sách thương hiệu sản phẩm trong catalog Song Thanh, phục vụ nhu cầu tra cứu thiết bị điện và vật tư công nghiệp.',
      seo_title: 'Thương hiệu sản phẩm | Song Thanh',
      seo_description: 'Tra cứu các thương hiệu sản phẩm thiết bị điện, đèn LED và vật tư công nghiệp trong catalog Song Thanh.'
    }
  },
  {
    id: 'news-index',
    mode: 'news_index',
    group: 'system',
    label: 'Trang Tin tức',
    shortLabel: 'Tin tức',
    slug: 'tin-tuc',
    publicPath: '/tin-tuc',
    contentType: 'page',
    description: 'Chỉnh hero, lời mở đầu, nội dung phụ và SEO cho trang danh sách tin tức. Bài viết vẫn tạo bằng template Bài tin tức / SEO.',
    formTitle: 'Chỉnh trang Tin tức',
    titlePlaceholder: 'Tin tức & Sự kiện',
    excerptPlaceholder: 'Một đoạn ngắn giới thiệu khu vực tin tức, hướng dẫn hoặc cập nhật sản phẩm.',
    bodyLabel: 'Lời giới thiệu trang tin tức',
    bodyHint: 'Viết ngắn gọn về loại nội dung khách có thể tìm thấy. Không thay thế nội dung từng bài viết.',
    imageLabel: 'Ảnh đại diện trang tin tức',
    imageHint: 'Dùng cho chia sẻ link. Banner đầu trang quản lý ở Banner vị trí tin-tuc.',
    seoHint: 'Tối ưu cho tin tức kỹ thuật, hướng dẫn chọn sản phẩm và cập nhật từ Song Thanh.',
    primarySource: 'Màn này quản lý tiêu đề trang tin, mô tả, khối nội dung phụ và SEO. Banner và danh sách bài viết đã xuất bản được lấy từ các khu vực liên quan.',
    relatedModules: [
      { label: 'Banner', href: '/banners?position=tin-tuc', description: 'Hero trang tin tức' },
      { label: 'Bài tin tức', href: '/page-contents', description: 'Tạo và quản lý các bài viết content_type=news' }
    ],
    defaultContent: {
      title: 'Tin tức & Sự kiện',
      excerpt: 'Cập nhật thông tin kỹ thuật, hướng dẫn lựa chọn sản phẩm và các nội dung mới từ Song Thanh.',
      content_html: '<p>Khu vực tin tức tổng hợp các bài viết hướng dẫn, cập nhật sản phẩm và nội dung kỹ thuật giúp khách hàng tham khảo trước khi trao đổi nhu cầu cụ thể.</p>',
      seo_title: 'Tin tức | Song Thanh',
      seo_description: 'Tin tức kỹ thuật, hướng dẫn chọn sản phẩm và cập nhật mới từ Song Thanh.'
    }
  },
  {
    id: 'contact',
    mode: 'contact',
    group: 'system',
    label: 'Liên hệ',
    shortLabel: 'Liên hệ',
    slug: 'lien-he',
    publicPath: '/lien-he',
    contentType: 'page',
    description: 'Trang liên hệ lấy hero từ Banner, nội dung mở đầu từ Page Content, dữ liệu liên hệ từ Cấu hình website và form public.',
    formTitle: 'Chỉnh trang Liên hệ',
    titlePlaceholder: 'Liên hệ Song Thanh',
    excerptPlaceholder: 'Một câu ngắn hướng khách gửi nhu cầu hoặc gọi trực tiếp.',
    bodyLabel: 'Lời mở đầu bổ sung',
    bodyHint: 'Không nhập lại hotline/email/địa chỉ ở đây. Các dữ liệu đó nằm trong Cấu hình website.',
    imageLabel: 'Ảnh chia sẻ trang liên hệ',
    imageHint: 'Dùng cho chia sẻ link. Ảnh hero đầu trang quản lý ở Banner vị trí lien-he.',
    seoHint: 'Tối ưu cho tên công ty, khu vực và nhu cầu liên hệ báo giá.',
    primarySource: 'Màn này quản lý phần giới thiệu và SEO. Banner, hotline, email, địa chỉ, giờ làm việc và bản đồ được cập nhật ở các khu vực liên quan.',
    relatedModules: [
      { label: 'Banner', href: '/banners?position=lien-he', description: 'Ảnh hero trang liên hệ' },
      { label: 'Cấu hình website', href: '/website-settings', description: 'Hotline, email, bản đồ' },
      { label: 'Liên hệ', href: '/contacts', description: 'Yêu cầu khách gửi từ public form' }
    ],
    defaultContent: {
      title: 'Liên hệ với chúng tôi',
      excerpt: 'Gửi nhu cầu tư vấn, báo giá hoặc thông tin kỹ thuật để đội ngũ Song Thanh phản hồi qua hotline hoặc email.',
      seo_title: 'Liên hệ Song Thanh',
      seo_description: 'Liên hệ Song Thanh để gửi nhu cầu tư vấn thiết bị điện, vật tư công nghiệp hoặc yêu cầu báo giá.'
    }
  }
];

const NEWS_TEMPLATE: PageContentTemplate = {
  id: 'news',
  mode: 'news',
  group: 'news',
  label: 'Bài tin tức / SEO',
  shortLabel: 'Tin tức',
  slug: '',
  publicPath: '/tin-tuc',
  contentType: 'news',
  description: 'Viết bài hướng dẫn, kiến thức hoặc nội dung SEO có giá trị thật.',
  formTitle: 'Viết bài tin tức',
  titlePlaceholder: 'Cách chọn công suất đèn LED cho công trình',
  excerptPlaceholder: 'Tóm tắt 1-2 câu để hiện trong danh sách tin và kết quả tìm kiếm.',
  bodyLabel: 'Nội dung bài viết',
  bodyHint: 'Bài viết nên có các mục rõ ràng, ví dụ kỹ thuật và liên kết nội bộ khi phù hợp.',
  imageLabel: 'Ảnh đại diện bài viết',
  imageHint: 'Ảnh hoặc sơ đồ có ích, không dùng ảnh quá chung chung.',
  seoHint: 'SEO title và description bám đúng nội dung bài, không nhồi từ khóa.',
  primarySource: 'Màn này quản lý toàn bộ nội dung bài viết, ảnh đại diện và SEO.',
  relatedModules: []
};

const GENERIC_TEMPLATE: PageContentTemplate = {
  id: 'generic',
  mode: 'generic',
  group: 'custom',
  label: 'Trang tĩnh khác',
  shortLabel: 'Trang tĩnh',
  slug: '',
  publicPath: '/',
  contentType: 'page',
  description: 'Tạo trang phụ đơn giản khi chưa có template hệ thống riêng.',
  formTitle: 'Tạo trang tĩnh',
  titlePlaceholder: 'Chính sách hoặc trang thông tin',
  excerptPlaceholder: 'Một đoạn ngắn giải thích trang này dùng để làm gì.',
  bodyLabel: 'Nội dung trang',
  bodyHint: 'Viết nội dung rõ ràng, tránh text nội bộ, placeholder hoặc dữ liệu chưa xác thực.',
  imageLabel: 'Ảnh đại diện',
  imageHint: 'Dùng cho chia sẻ link và các block cần thumbnail.',
  seoHint: 'Bổ sung SEO nếu trang có mục tiêu tìm kiếm rõ.',
  primarySource: 'Màn này quản lý tiêu đề, mô tả ngắn, nội dung, ảnh đại diện và SEO.',
  relatedModules: []
};

export const CREATE_TEMPLATE_GROUPS = [
  {
    title: 'Trang hệ thống',
    description: 'Các trang public chính có layout cố định theo thiết kế website.',
    templates: SYSTEM_PAGE_TEMPLATES
  },
  {
    title: 'Nội dung khác',
    description: 'Bài viết tin tức, hướng dẫn chọn sản phẩm hoặc trang phụ đơn giản.',
    templates: [NEWS_TEMPLATE, GENERIC_TEMPLATE]
  }
];

const ALL_PAGE_CONTENT_TEMPLATES: PageContentTemplate[] = [
  ...SYSTEM_PAGE_TEMPLATES,
  NEWS_TEMPLATE,
  GENERIC_TEMPLATE
];

export function findPageContentTemplate(value?: string | null) {
  if (!value) return null;
  return (
    ALL_PAGE_CONTENT_TEMPLATES.find(
      (template) => template.id === value || template.slug === value || template.mode === value
    ) ?? null
  );
}

export function getPageTemplate(form: Record<string, string>) {
  if ((form.content_type || 'page') === 'news') return NEWS_TEMPLATE;
  const slug = form.slug?.trim() ?? '';
  return SYSTEM_PAGE_TEMPLATES.find((item) => item.slug === slug) ?? GENERIC_TEMPLATE;
}

export function buildTemplatePatch(template: PageContentTemplate): Record<string, string> {
  const defaults = template.defaultContent ?? {};
  return {
    content_type: template.contentType,
    slug: template.slug,
    title: template.group === 'system' ? defaults.title ?? template.shortLabel : '',
    excerpt: defaults.excerpt ?? '',
    content_html: defaults.content_html ?? '',
    seo_title: defaults.seo_title ?? '',
    seo_description: defaults.seo_description ?? '',
    review_status: 'draft',
    publish_status: 'unpublished'
  };
}

export function getTemplateBlocks(template: PageContentTemplate) {
  return PAGE_TEMPLATE_BLOCKS[template.mode] ?? [];
}

export function buildPublicPath(form: Record<string, string>) {
  const slug = form.slug?.trim();
  if (!slug) return '';
  if ((form.content_type || 'page') === 'news') return `/tin-tuc/${slug}`;
  return `/${slug}`;
}
