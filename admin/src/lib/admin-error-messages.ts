import { ApiClientError } from '@/lib/api-client';

export type AdminErrorContext =
  | 'generic'
  | 'load'
  | 'save'
  | 'action'
  | 'file-upload'
  | 'import-load'
  | 'import-upload'
  | 'import-action'
  | 'file-load'
  | 'file-action'
  | 'website-settings'
  | 'social-links'
  | 'module-load'
  | 'module-save'
  | 'module-action'
  | 'contact-quote-load'
  | 'contact-quote-action';

export interface AdminErrorPresentation {
  title: string;
  message: string;
  suggestedAction?: string;
  technicalDetail?: string;
}

type NormalizedError = {
  status?: number;
  code?: string;
  message: string;
  details?: Record<string, unknown>;
};

type PresentationDefaults = Omit<AdminErrorPresentation, 'technicalDetail'>;

const CONTEXT_DEFAULTS: Record<AdminErrorContext, PresentationDefaults> = {
  generic: {
    title: 'Không thể hoàn tất thao tác',
    message: 'Hệ thống chưa xử lý được yêu cầu vừa rồi.',
    suggestedAction: 'Thử lại sau ít phút hoặc kiểm tra lại dữ liệu đầu vào.'
  },
  load: {
    title: 'Không tải được dữ liệu',
    message: 'Hệ thống chưa lấy được dữ liệu cần hiển thị cho màn hình này.',
    suggestedAction: 'Tải lại trang hoặc thử lại sau ít phút.'
  },
  save: {
    title: 'Không lưu được dữ liệu',
    message: 'Hệ thống chưa ghi nhận được thay đổi bạn vừa nhập.',
    suggestedAction: 'Kiểm tra lại dữ liệu bắt buộc rồi thử lưu lại.'
  },
  action: {
    title: 'Không thực hiện được thao tác',
    message: 'Yêu cầu vừa rồi chưa được hệ thống xử lý thành công.',
    suggestedAction: 'Kiểm tra trạng thái hiện tại của bản ghi rồi thử lại.'
  },
  'file-upload': {
    title: 'Không tải được tệp lên',
    message: 'Hệ thống chưa ghi nhận được file bạn vừa chọn vào Kho tệp.',
    suggestedAction: 'Kiểm tra lại định dạng, dung lượng file và thử tải lên lại.'
  },
  'import-load': {
    title: 'Không tải được dữ liệu nhập',
    message: 'Hệ thống chưa lấy được thông tin lô nhập hoặc dữ liệu tạm.',
    suggestedAction: 'Tải lại màn hình hoặc quay lại danh sách lô nhập để thử lại.'
  },
  'import-upload': {
    title: 'Không tạo được lô nhập',
    message: 'Hệ thống chưa đọc được tệp dữ liệu bạn vừa chọn.',
    suggestedAction: 'Kiểm tra định dạng tệp, dung lượng và khoảng dòng rồi thử lại.'
  },
  'import-action': {
    title: 'Chưa hoàn tất thao tác với lô nhập',
    message: 'Thao tác vừa rồi chưa được thực hiện.',
    suggestedAction: 'Mở mục Kiểm tra sẵn sàng, xử lý các vấn đề được chỉ ra rồi thử lại.'
  },
  'file-load': {
    title: 'Không tải được chi tiết tệp',
    message: 'Hệ thống chưa lấy được thông tin hoặc nơi đang sử dụng tệp.',
    suggestedAction: 'Chọn lại tệp hoặc tải lại danh sách.'
  },
  'file-action': {
    title: 'Không thực hiện được thao tác với tệp',
    message: 'Hệ thống chưa hoàn tất thao tác lưu trữ hoặc khôi phục tệp.',
    suggestedAction: 'Kiểm tra nơi sử dụng của tệp rồi thử lại.'
  },
  'website-settings': {
    title: 'Không lưu được cấu hình website',
    message: 'Hệ thống chưa cập nhật được cấu hình website.',
    suggestedAction: 'Kiểm tra lại các trường bắt buộc rồi thử lưu lại.'
  },
  'social-links': {
    title: 'Không cập nhật được liên kết mạng xã hội',
    message: 'Hệ thống chưa xử lý được thay đổi cho liên kết mạng xã hội.',
    suggestedAction: 'Kiểm tra lại URL, trạng thái và thử lại.'
  },
  'module-load': {
    title: 'Không tải được chi tiết bản ghi',
    message: 'Hệ thống chưa lấy được dữ liệu chi tiết để hiển thị biểu mẫu.',
    suggestedAction: 'Tải lại màn hình hoặc quay lại danh sách để thử lại.'
  },
  'module-save': {
    title: 'Không lưu được bản ghi',
    message: 'Hệ thống chưa ghi nhận được thay đổi cho bản ghi này.',
    suggestedAction: 'Kiểm tra dữ liệu nhập và thử lưu lại.'
  },
  'module-action': {
    title: 'Không cập nhật được trạng thái bản ghi',
    message: 'Hệ thống chưa hoàn tất thao tác lưu trữ hoặc khôi phục.',
    suggestedAction: 'Kiểm tra trạng thái hiện tại của bản ghi rồi thử lại.'
  },
  'contact-quote-load': {
    title: 'Không tải được yêu cầu',
    message: 'Hệ thống chưa lấy được thông tin yêu cầu để xử lý.',
    suggestedAction: 'Tải lại màn hình hoặc quay lại danh sách để thử lại.'
  },
  'contact-quote-action': {
    title: 'Không cập nhật được yêu cầu',
    message: 'Hệ thống chưa lưu được thay đổi trạng thái hoặc ghi chú nội bộ.',
    suggestedAction: 'Kiểm tra lại quyền thao tác và thử lại.'
  }
};

export function formatAdminError(
  error: unknown,
  context: AdminErrorContext = 'generic'
): AdminErrorPresentation {
  const normalized = normalizeError(error);
  const base = CONTEXT_DEFAULTS[context];
  const lowerMessage = normalized.message.toLowerCase();
  const websiteContentError = mapWebsiteContentError(normalized);

  if (websiteContentError) {
    return websiteContentError;
  }

  if (isImportUnreadableWorkbook(normalized)) {
    return withTechnicalDetail(
      {
        title: 'Không đọc được file Excel',
        message:
          'Hệ thống chưa đọc được file vừa tải lên. Hãy kiểm tra file có đúng định dạng .xlsx hoặc .csv và thử lại.',
        suggestedAction: 'Chọn lại một tệp Excel hoặc CSV khác.'
      },
      normalized
    );
  }

  if (
    lowerMessage.includes('chi ho tro workbook .xlsx') ||
    lowerMessage.includes('file type') ||
    lowerMessage.includes('mime')
  ) {
    return withTechnicalDetail(
      {
        title: 'Định dạng tệp chưa được hỗ trợ',
        message: 'Nhập dữ liệu chỉ nhận tệp Excel .xlsx hoặc CSV .csv.',
        suggestedAction: 'Chọn lại tệp đúng định dạng rồi thử lại.'
      },
      normalized
    );
  }

  if (
    lowerMessage.includes('20 mb') ||
    lowerMessage.includes('25 mb') ||
    lowerMessage.includes('qua gioi han') ||
    lowerMessage.includes('file too large')
  ) {
    return withTechnicalDetail(
      {
        title: 'Tệp vượt quá dung lượng cho phép',
        message: 'Tệp tải lên lớn hơn giới hạn hiện tại của hệ thống.',
        suggestedAction: 'Tách dữ liệu thành các tệp nhỏ hơn rồi thử lại.'
      },
      normalized
    );
  }

  if (
    lowerMessage.includes('chon file de tai len kho tep') ||
    lowerMessage.includes('file tai len dang rong') ||
    lowerMessage.includes('kieu file') ||
    lowerMessage.includes('khong phu hop voi .') ||
    lowerMessage.includes('chi ho tro anh')
  ) {
    return withTechnicalDetail(
      {
        title: 'File tải lên chưa hợp lệ',
        message:
          'Kho tệp chỉ nhận các định dạng ảnh, tài liệu và bảng tính được hệ thống hỗ trợ.',
        suggestedAction:
          'Chọn lại file đúng định dạng, kiểm tra dung lượng rồi thử tải lên lại.'
      },
      normalized
    );
  }

  if (
    lowerMessage.includes('row_ranges') ||
    lowerMessage.includes('khoang dong') ||
    lowerMessage.includes('token')
  ) {
    return withTechnicalDetail(
      {
        title: 'Khoảng dòng chưa hợp lệ',
        message: 'Hệ thống chưa hiểu phần khoảng dòng bạn đã nhập.',
        suggestedAction: 'Nhập theo dạng 2-8, mỗi dòng hoặc mỗi mục là một khoảng.'
      },
      normalized
    );
  }

  if (
    lowerMessage.includes('header row') ||
    lowerMessage.includes('column') ||
    lowerMessage.includes('worksheet') ||
    lowerMessage.includes('selected data rows')
  ) {
    return withTechnicalDetail(
      {
        title: 'Tệp chưa có dữ liệu phù hợp để nhập',
        message:
          'Hệ thống chưa tìm thấy dòng tiêu đề hoặc dòng dữ liệu phù hợp trong tệp này.',
        suggestedAction: 'Kiểm tra trang tính đầu tiên, tên cột và các dòng dữ liệu rồi thử lại.'
      },
      normalized
    );
  }

  if (normalized.status === 401 || normalized.code === 'UNAUTHORIZED') {
    return withTechnicalDetail(
      {
        title: 'Phiên đăng nhập không còn hiệu lực',
        message: 'Bạn cần đăng nhập lại để tiếp tục thao tác này.',
        suggestedAction: 'Tải lại trang hoặc đăng nhập lại.'
      },
      normalized
    );
  }

  if (normalized.status === 403 || normalized.code === 'FORBIDDEN') {
    return withTechnicalDetail(
      {
        title: 'Bạn chưa có quyền thực hiện thao tác này',
        message: 'Tài khoản hiện tại không được phép thực hiện yêu cầu vừa rồi.',
        suggestedAction: 'Liên hệ quản trị viên nếu bạn cần quyền này.'
      },
      normalized
    );
  }

  if (
    lowerMessage.includes('parent product category was not found')
  ) {
    return withTechnicalDetail(
      {
        title: 'Thiếu danh mục cấp 1 cha',
        message: 'Vui lòng chọn danh mục cấp 1 cha.',
        suggestedAction:
          'Chọn lại một danh mục cấp 1 đang hoạt động rồi thử lưu lại.'
      },
      normalized
    );
  }

  if (
    lowerMessage.includes('referenced level-1 product category was not found')
  ) {
    return withTechnicalDetail(
      {
        title: 'Thiếu danh mục cấp 1',
        message: 'Vui lòng chọn danh mục cấp 1 / Lớp ông hợp lệ.',
        suggestedAction:
          'Chọn lại một danh mục cấp 1 đang hoạt động rồi thử lưu lại.'
      },
      normalized
    );
  }

  if (lowerMessage.includes('referenced product category was not found')) {
    return withTechnicalDetail(
      {
        title: 'Thiếu danh mục',
        message: 'Vui lòng chọn danh mục.',
        suggestedAction: 'Chọn lại danh mục phù hợp rồi thử lưu lại.'
      },
      normalized
    );
  }

  if (lowerMessage.includes('referenced product group was not found')) {
    return withTechnicalDetail(
      {
        title: 'Thiếu nhóm sản phẩm',
        message: 'Vui lòng chọn nhóm sản phẩm.',
        suggestedAction: 'Chọn lại nhóm sản phẩm phù hợp rồi thử lưu lại.'
      },
      normalized
    );
  }

  if (
    lowerMessage.includes('referenced product variant was not found') ||
    lowerMessage.includes('referenced brand was not found') ||
    lowerMessage.includes('referenced logo file was not found') ||
    lowerMessage.includes('referenced thumbnail file was not found') ||
    lowerMessage.includes('referenced seo image file was not found') ||
    lowerMessage.includes('referenced file metadata was not found')
  ) {
    return withTechnicalDetail(
      {
        title: 'Bản ghi liên kết không còn tồn tại',
        message: 'Bản ghi liên kết không còn tồn tại. Hãy chọn lại.',
        suggestedAction:
          'Chọn lại thương hiệu, biến thể hoặc tệp đính kèm rồi thử lưu lại.'
      },
      normalized
    );
  }

  if (normalized.status === 404 || normalized.code === 'NOT_FOUND') {
    return withTechnicalDetail(
      {
        title: 'Không tìm thấy dữ liệu cần thao tác',
        message:
          'Bản ghi hoặc tài nguyên bạn đang thao tác không còn tồn tại hoặc đã đổi trạng thái.',
        suggestedAction: 'Quay lại danh sách và chọn lại bản ghi.'
      },
      normalized
    );
  }

  if (normalized.status === 409 && normalized.code === 'IMPORT_NOT_READY') {
    return withTechnicalDetail(
      {
        title: 'Chưa thể áp dụng lô nhập',
        message: 'Lô nhập chưa đủ điều kiện để áp dụng vào dữ liệu chính thức.',
        suggestedAction:
          'Kiểm tra dữ liệu tạm, duyệt các dòng hợp lệ, sau đó chuyển lô sang trạng thái sẵn sàng áp dụng.'
      },
      normalized
    );
  }

  if (normalized.code === 'IMPORT_STAGING_ALREADY_CREATED') {
    return withTechnicalDetail(
      {
        title: 'Lô nhập này đã có dữ liệu tạm',
        message:
          'Lô nhập đã tạo dữ liệu tạm ở bước trước, nên không thể xác nhận lại cột dữ liệu từ màn hình này.',
        suggestedAction:
          'Mở dữ liệu tạm để tiếp tục duyệt. Nếu cần đổi cách ghép cột, hãy tạo lại lô từ tệp nguồn.'
      },
      normalized
    );
  }

  if (normalized.code === 'IMPORT_SOURCE_WORKBOOK_MISSING') {
    return withTechnicalDetail(
      {
        title: 'Không còn tệp nguồn',
        message:
          'Tệp nguồn của lô nhập này không còn khả dụng để xác nhận lại các cột.',
        suggestedAction:
          'Tải tệp lên lại để tạo lô nhập mới, sau đó xác nhận cách ghép cột.'
      },
      normalized
    );
  }

  if (normalized.code === 'IMPORT_MAIN_CATEGORY_REQUIRED') {
    return withTechnicalDetail(
      {
        title: 'Thiếu cột danh mục chính',
        message: 'Vui lòng chọn cột cho Danh mục chính trước khi tạo dữ liệu tạm.',
        suggestedAction:
          'Chọn lại cột Danh mục chính trong bước xác nhận cột dữ liệu rồi thử lại.'
      },
      normalized
    );
  }

  if (normalized.code === 'IMPORT_MAIN_CATEGORY_NOT_BOOTSTRAPPED') {
    return withTechnicalDetail(
      {
        title: 'Chưa có danh mục chính tương ứng',
        message:
          'Danh mục chính trong dữ liệu tạm chưa tồn tại trong dữ liệu chính thức, nên chưa thể áp dụng lô nhập.',
        suggestedAction:
          'Tạo hoặc đồng bộ danh mục chính trước, rồi quay lại áp dụng lô nhập.'
      },
      normalized
    );
  }

  if (normalized.code === 'IMPORT_CATEGORY_REQUIRED') {
    return withTechnicalDetail(
      {
        title: 'Thiếu danh mục con',
        message:
          'Dữ liệu tạm còn thiếu danh mục con nên chưa thể áp dụng vào dữ liệu chính thức.',
        suggestedAction:
          'Rà soát lại dữ liệu tạm của nhóm sản phẩm tương ứng và bổ sung danh mục con trước khi áp dụng.'
      },
      normalized
    );
  }

  if (normalized.code === 'IMPORT_CATEGORY_NOT_BOOTSTRAPPED') {
    return withTechnicalDetail(
      {
        title: 'Chưa có danh mục con tương ứng',
        message:
          'Danh mục con trong dữ liệu tạm chưa tồn tại dưới danh mục chính tương ứng, nên lô nhập chưa thể áp dụng.',
        suggestedAction:
          'Tạo hoặc đồng bộ danh mục con đúng nhánh trước, rồi quay lại áp dụng lô nhập.'
      },
      normalized
    );
  }

  if (normalized.code === 'IMPORT_PARENT_GROUP_NOT_APPLIED') {
    return withTechnicalDetail(
      {
        title: 'Biến thể chưa có nhóm sản phẩm chính thức',
        message:
          'Có biến thể tạm chưa gắn được với nhóm sản phẩm chính thức nên lô nhập chưa thể áp dụng.',
        suggestedAction:
          'Mở Nhóm sản phẩm tạm, hoàn tất liên kết còn thiếu rồi thử áp dụng lại.'
      },
      normalized
    );
  }

  if (normalized.code === 'IMPORT_APPLY_FAILED') {
    const failedStage =
      typeof normalized.details?.failed_stage === 'string'
        ? normalized.details.failed_stage
        : null;
    return withTechnicalDetail(
      {
        title: 'Chưa áp dụng được lô nhập',
        message: failedStage
          ? `Quá trình dừng ở bước “${formatImportApplyStage(failedStage)}”.`
          : 'Quá trình áp dụng chưa hoàn tất.',
        suggestedAction:
          'Mở Kiểm tra sẵn sàng, xử lý mục đang bị chặn rồi thử áp dụng lại.'
      },
      normalized
    );
  }

  if (
    normalized.status === 409 &&
    normalized.code === 'IMPORT_DELETE_FORBIDDEN_APPLIED'
  ) {
    return withTechnicalDetail(
      {
        title: 'Không xóa được lô đã áp dụng',
        message:
          'Lô nhập này đã ghi dữ liệu vào danh mục chính thức, nên không thể xóa cứng từ màn hình này.',
        suggestedAction:
          'Chỉ xóa các lô nhập chưa áp dụng. Nếu cần dọn môi trường test, hãy dùng script reset dữ liệu.'
      },
      normalized
    );
  }

  if (
    normalized.code === 'PRODUCT_CATEGORY_SLUG_CONFLICT' ||
    normalized.code === 'BRAND_SLUG_CONFLICT' ||
    normalized.code === 'PRODUCT_GROUP_SLUG_CONFLICT'
  ) {
    return withTechnicalDetail(
      {
        title: 'Đường dẫn đã bị trùng',
        message:
          'Đường dẫn này đã được dùng. Hãy đổi tên hoặc chỉnh trong tùy chọn nâng cao.',
        suggestedAction: 'Chỉnh lại tên hoặc slug rồi thử lưu lại.'
      },
      normalized
    );
  }

  if (
    normalized.code === 'PRODUCT_GROUP_CATEGORY_LEVEL_INVALID' ||
    normalized.code === 'BRAND_PRIMARY_CATEGORY_LEVEL_INVALID'
  ) {
    return withTechnicalDetail(
      {
        title: 'Sai cấp danh mục',
        message:
          'Danh mục đang chọn không đúng cấp cần dùng cho thao tác này.',
        suggestedAction:
          'Chọn lại Danh mục cấp 1 / Lớp ông hoặc Danh mục cấp 2 / Lớp cha cho đúng.'
      },
      normalized
    );
  }

  if (normalized.code === 'PRODUCT_GROUP_PUBLISH_REQUIRES_ACTIVE_STATUS') {
    return withTechnicalDetail(
      {
        title: 'Chưa thể xuất bản sản phẩm',
        message:
          'Trạng thái sử dụng phải là “Đang hoạt động” trước khi chuyển sang “Đã xuất bản”.',
        suggestedAction:
          'Đổi “Trạng thái” sang “Đang hoạt động”, sau đó lưu lại.'
      },
      normalized
    );
  }

  if (normalized.code === 'PRODUCT_GROUP_PUBLISH_REQUIRES_APPROVED_REVIEW') {
    return withTechnicalDetail(
      {
        title: 'Chưa thể xuất bản sản phẩm',
        message:
          'Trạng thái duyệt phải là “Đã duyệt” trước khi chuyển sang “Đã xuất bản”.',
        suggestedAction:
          'Đổi “Trạng thái duyệt” sang “Đã duyệt”, sau đó lưu lại.'
      },
      normalized
    );
  }

  if (normalized.code === 'PRODUCT_GROUP_PUBLISH_REQUIRES_THUMBNAIL') {
    return withTechnicalDetail(
      {
        title: 'Chưa thể xuất bản sản phẩm',
        message:
          'Sản phẩm cần có “Ảnh chính” trước khi chuyển sang “Đã xuất bản”.',
        suggestedAction:
          'Chọn ảnh chính hợp lệ cho sản phẩm rồi lưu lại.'
      },
      normalized
    );
  }

  if (
    normalized.code === 'PRODUCT_GROUP_BRAND_CONTEXT_MISSING' ||
    normalized.code === 'PRODUCT_GROUP_BRAND_CONTEXT_INVALID'
  ) {
    return withTechnicalDetail(
      {
        title: 'Thương hiệu không thuộc danh mục cấp 1 đã chọn',
        message:
          'Thương hiệu này không nằm trong ngữ cảnh Danh mục cấp 1 đang chọn.',
        suggestedAction:
          'Chọn lại Danh mục cấp 1 hoặc chọn thương hiệu khác phù hợp.'
      },
      normalized
    );
  }

  if (normalized.code === 'PRODUCT_VARIANT_PUBLISH_REQUIRES_ACTIVE_STATUS') {
    return withTechnicalDetail(
      {
        title: 'Chưa thể xuất bản biến thể',
        message:
          'Trạng thái sử dụng phải là “Đang hoạt động” trước khi chuyển sang “Đã xuất bản”.',
        suggestedAction:
          'Đổi “Trạng thái” sang “Đang hoạt động”, sau đó lưu lại.'
      },
      normalized
    );
  }

  if (normalized.code === 'PRODUCT_VARIANT_PUBLISH_REQUIRES_APPROVED_REVIEW') {
    return withTechnicalDetail(
      {
        title: 'Chưa thể xuất bản biến thể',
        message:
          'Trạng thái duyệt phải là “Đã duyệt” trước khi chuyển sang “Đã xuất bản”.',
        suggestedAction:
          'Đổi “Trạng thái duyệt” sang “Đã duyệt”, sau đó lưu lại.'
      },
      normalized
    );
  }

  if (normalized.code === 'PRODUCT_VARIANT_MOVE_BLOCKED_BY_DOCUMENTS') {
    return withTechnicalDetail(
      {
        title: 'Chưa thể chuyển biến thể sang nhóm khác',
        message:
          'Biến thể đang được tài liệu kỹ thuật sử dụng nên việc chuyển nhóm sẽ làm sai liên kết sản phẩm.',
        suggestedAction:
          'Gỡ liên kết hoặc lưu trữ các tài liệu kỹ thuật của biến thể trước, sau đó thử chuyển nhóm lại.'
      },
      normalized
    );
  }

  if (normalized.code === 'TECHNICAL_DOCUMENT_VARIANT_GROUP_MISMATCH') {
    return withTechnicalDetail(
      {
        title: 'Biến thể không thuộc nhóm sản phẩm đã chọn',
        message: 'Biến thể đang chọn không nằm trong nhóm sản phẩm này.',
        suggestedAction:
          'Chọn lại biến thể đúng với nhóm sản phẩm rồi thử lưu lại.'
      },
      normalized
    );
  }

  if (
    normalized.code === 'PRODUCT_VARIANT_CONFLICT' &&
    (lowerMessage.includes('sku is already in use') ||
      lowerMessage.includes('external_code is already in use') ||
      lowerMessage.includes('model_code is already in use'))
  ) {
    return withTechnicalDetail(
      {
        title: 'Mã định danh đã bị trùng',
        message:
          lowerMessage.includes('sku')
            ? 'SKU này đã tồn tại. Hãy để trống để hệ thống tự tạo hoặc nhập SKU khác.'
            : 'Mã định danh này đã tồn tại. Hãy nhập lại giá trị khác.',
        suggestedAction:
          'Để trống SKU để hệ thống tự tạo hoặc chỉnh lại mã trùng rồi thử lưu lại.'
      },
      normalized
    );
  }

  if (normalized.code === 'ADMIN_USER_CHANGED_DURING_EDIT') {
    return withTechnicalDetail(
      {
        title: 'Tài khoản đã được cập nhật ở nơi khác',
        message: 'Thông tin đang mở không còn là bản mới nhất nên thay đổi chưa được lưu.',
        suggestedAction: 'Đóng cửa sổ này, mở lại tài khoản để xem dữ liệu mới rồi chỉnh sửa tiếp.'
      },
      normalized
    );
  }

  if (normalized.code === 'ADMIN_USER_LAST_SUPER_ADMIN_BLOCKED') {
    return withTechnicalDetail(
      {
        title: 'Cần giữ ít nhất một Super Admin',
        message: 'Không thể khóa hoặc gỡ quyền của Super Admin đang hoạt động cuối cùng.',
        suggestedAction: 'Gán Super Admin cho một tài khoản khác trước khi thay đổi tài khoản này.'
      },
      normalized
    );
  }

  if (normalized.code === 'ADMIN_ROLE_PROTECTED_METADATA_LOCKED') {
    return withTechnicalDetail(
      {
        title: 'Vai trò hệ thống không sửa được thông tin cơ bản',
        message: 'Tên, mô tả và trạng thái của vai trò này được hệ thống quản lý.',
        suggestedAction: 'Nếu cần điều chỉnh quyền, hãy mở phần Ma trận quyền của vai trò.'
      },
      normalized
    );
  }

  if (normalized.status === 409) {
    return withTechnicalDetail(
      {
        title: 'Dữ liệu hiện tại không cho phép thao tác này',
        message:
          'Yêu cầu vừa rồi bị chặn vì trạng thái hiện tại hoặc quan hệ phụ thuộc chưa phù hợp.',
        suggestedAction: 'Kiểm tra cảnh báo trên màn hình rồi thử lại.'
      },
      normalized
    );
  }

  if (!normalized.status && !normalized.code && normalized.message.trim()) {
    const visibleMessage = looksTechnicalMessage(normalized.message)
      ? base.message
      : normalized.message.trim();
    return withTechnicalDetail(
      {
        title: base.title,
        message: visibleMessage,
        suggestedAction: base.suggestedAction
      },
      normalized,
      { hideTechnicalWhenSameAsMessage: true }
    );
  }

  if (normalized.status === 400 || normalized.code === 'VALIDATION_ERROR') {
    const visibleMessage = looksTechnicalMessage(normalized.message)
      ? base.message
      : normalized.message.trim() || base.message;
    return withTechnicalDetail(
      {
        title: base.title,
        message: visibleMessage,
        suggestedAction: base.suggestedAction
      },
      normalized,
      { hideTechnicalWhenSameAsMessage: true }
    );
  }

  if (isNetworkError(normalized.message)) {
    return withTechnicalDetail(
      {
        title: 'Kết nối đang bị gián đoạn',
        message: 'Hệ thống chưa thể hoàn tất thao tác do kết nối tạm thời bị gián đoạn.',
        suggestedAction: 'Kiểm tra kết nối mạng rồi bấm thử lại.'
      },
      normalized
    );
  }

  if (normalized.status && normalized.status >= 500) {
    return withTechnicalDetail(
      {
        title: 'Hệ thống đang gặp lỗi xử lý',
        message:
          'Yêu cầu vừa rồi đã tới máy chủ nhưng chưa được xử lý thành công.',
        suggestedAction: 'Thử lại sau ít phút. Nếu lỗi vẫn lặp lại, báo cho người phụ trách hệ thống.'
      },
      normalized
    );
  }

  return withTechnicalDetail(base, normalized, {
    hideTechnicalWhenSameAsMessage: true
  });
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof ApiClientError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: '' };
}

function formatImportApplyStage(value: string) {
  const normalized = value.trim().toLowerCase();
  const labels: Record<string, string> = {
    categories: 'tạo danh mục',
    product_categories: 'tạo danh mục',
    product_groups: 'tạo nhóm sản phẩm',
    groups: 'tạo nhóm sản phẩm',
    product_variants: 'tạo biến thể sản phẩm',
    variants: 'tạo biến thể sản phẩm',
    documents: 'liên kết tài liệu',
    finalize: 'hoàn tất lô nhập'
  };
  return labels[normalized] || 'xử lý dữ liệu';
}

function mapWebsiteContentError(
  error: NormalizedError
): AdminErrorPresentation | null {
  const lowerMessage = error.message.toLowerCase();
  const field =
    typeof error.details?.field === 'string' ? error.details.field : undefined;

  const friendlyServerError = withTechnicalDetail(
    {
      title: 'Hệ thống đang gặp lỗi xử lý',
      message: 'Hệ thống chưa xử lý được yêu cầu vừa rồi.',
      suggestedAction: 'Thử lại sau ít phút. Nếu lỗi vẫn lặp lại, báo cho người phụ trách hệ thống.'
    },
    error
  );

  if (error.status && error.status >= 500) {
    return friendlyServerError;
  }

  if (
    lowerMessage.includes('display_name must be a non-blank string') ||
    field === 'display_name'
  ) {
    return withTechnicalDetail(
      {
        title: 'Thiếu tên hiển thị',
        message: 'Tên hiển thị không được để trống.',
        suggestedAction: 'Nhập Tên hiển thị rồi lưu lại.'
      },
      error
    );
  }

  if (field === 'legal_name' && lowerMessage.includes('non-blank string')) {
    return withTechnicalDetail(
      {
        title: 'Thiếu tên pháp lý',
        message: 'Tên pháp lý không được để trống.',
        suggestedAction: 'Nhập Tên pháp lý rồi lưu lại.'
      },
      error
    );
  }

  if (field === 'hotline' && lowerMessage.includes('non-blank string')) {
    return withTechnicalDetail(
      {
        title: 'Thiếu hotline',
        message: 'Hotline không được để trống.',
        suggestedAction: 'Nhập số hotline rồi lưu lại.'
      },
      error
    );
  }

  if (field === 'email') {
    return withTechnicalDetail(
      {
        title: 'Email chưa hợp lệ',
        message:
          lowerMessage.includes('non-blank string')
            ? 'Email không được để trống.'
            : 'Email chưa đúng định dạng.',
        suggestedAction: 'Kiểm tra lại email công ty rồi lưu lại.'
      },
      error
    );
  }

  if (field === 'address' && lowerMessage.includes('non-blank string')) {
    return withTechnicalDetail(
      {
        title: 'Thiếu địa chỉ',
        message: 'Địa chỉ không được để trống.',
        suggestedAction: 'Nhập địa chỉ công ty rồi lưu lại.'
      },
      error
    );
  }

  if (
    lowerMessage.includes('slug must be lowercase and hyphen-separated') ||
    (field === 'slug' &&
      (lowerMessage.includes('lowercase') || lowerMessage.includes('hyphen')))
  ) {
    return withTechnicalDetail(
      {
        title: 'Đường dẫn chưa hợp lệ',
        message: 'Đường dẫn chỉ nên dùng chữ thường, số và dấu gạch ngang.',
        suggestedAction: 'Chỉnh lại slug rồi lưu lại.'
      },
      error
    );
  }

  if (
    error.code === 'PAGE_CONTENT_SLUG_CONFLICT' ||
    error.code === 'REDIRECT_FROM_PATH_CONFLICT' ||
    lowerMessage.includes('slug is already in use') ||
    lowerMessage.includes('from_path is already in use')
  ) {
    return withTechnicalDetail(
      {
        title: 'Đường dẫn đã được sử dụng',
        message: 'Đường dẫn này đã được sử dụng.',
        suggestedAction: 'Chỉnh lại đường dẫn rồi lưu lại.'
      },
      error
    );
  }

  if (
    error.code === 'PRODUCT_GROUP_VERSION_CONFLICT' ||
    error.code === 'PRODUCT_VARIANT_VERSION_CONFLICT' ||
    error.code === 'TECHNICAL_DOCUMENT_VERSION_CONFLICT'
  ) {
    return withTechnicalDetail(
      {
        title: 'Dữ liệu sản phẩm đã được cập nhật ở nơi khác',
        message:
          'Bản đang mở không còn là phiên bản mới nhất nên hệ thống đã chặn ghi đè để tránh mất dữ liệu.',
        suggestedAction:
          'Tải lại trang để nhận dữ liệu mới nhất, đối chiếu thay đổi rồi chỉnh sửa và lưu lại.'
      },
      error
    );
  }

  if (error.code === 'PAGE_CONTENT_VERSION_CONFLICT') {
    return withTechnicalDetail(
      {
        title: 'Nội dung đã được người khác cập nhật',
        message:
          'Bản đang mở không còn là phiên bản mới nhất nên hệ thống đã chặn ghi đè để tránh mất dữ liệu.',
        suggestedAction:
          'Tải lại trang để nhận nội dung mới nhất, đối chiếu thay đổi rồi chỉnh sửa và lưu lại.'
      },
      error
    );
  }

  if (
    lowerMessage.includes('self redirect is not allowed') ||
    lowerMessage.includes('redirect loop is not allowed')
  ) {
    return withTechnicalDetail(
      {
        title: 'Quy tắc chuyển hướng chưa hợp lệ',
        message: 'Không thể tạo chuyển hướng trỏ về chính nó hoặc tạo vòng lặp.',
        suggestedAction: 'Kiểm tra lại đường dẫn nguồn và đích rồi lưu lại.'
      },
      error
    );
  }

  if (
    field === 'from_path' ||
    field === 'to_path' ||
    lowerMessage.includes('must start with /.')
  ) {
    return withTechnicalDetail(
      {
        title: 'Đường dẫn chưa hợp lệ',
        message: 'Đường dẫn không hợp lệ.',
        suggestedAction: 'Đường dẫn nội bộ phải bắt đầu bằng dấu /.'
      },
      error
    );
  }

  if (
    field === 'file' &&
    typeof error.details?.extension === 'string'
  ) {
    return withTechnicalDetail(
      {
        title: 'Định dạng tệp chưa được hỗ trợ',
        message: 'Tệp đã chọn không thuộc các định dạng Kho tệp hỗ trợ.',
        suggestedAction: 'Chọn ảnh, PDF, Word, Excel hoặc CSV rồi tải lên lại.'
      },
      error
    );
  }

  if (
    field === 'image_file_id' ||
    field === 'featured_image_file_id' ||
    field === 'seo_og_image_file_id' ||
    field === 'logo_file_id' ||
    field === 'favicon_file_id' ||
    field === 'file'
  ) {
    return withTechnicalDetail(
      {
        title: 'Thiếu tệp',
        message: 'Vui lòng chọn tệp.',
        suggestedAction: 'Chọn lại tệp từ Kho tệp hoặc tải tệp mới lên.'
      },
      error
    );
  }

  if (
    lowerMessage.includes('referenced image file was not found') ||
    lowerMessage.includes('referenced featured image file was not found') ||
    lowerMessage.includes('referenced seo image file was not found') ||
    lowerMessage.includes('referenced logo file was not found') ||
    lowerMessage.includes('referenced favicon file was not found')
  ) {
    return withTechnicalDetail(
      {
        title: 'Tệp đã chọn không còn khả dụng',
        message: 'Tệp đã chọn không còn khả dụng. Vui lòng chọn lại tệp.',
        suggestedAction: 'Mở lại Kho tệp và chọn một tệp đang hoạt động.'
      },
      error
    );
  }

  if (
    lowerMessage.includes('must be a valid url') ||
    lowerMessage.includes('must use http or https') ||
    lowerMessage.includes('external link_target must be a valid url') ||
    lowerMessage.includes('external link_target must use http or https')
  ) {
    return withTechnicalDetail(
      {
        title: 'Liên kết chưa hợp lệ',
        message: 'Đường dẫn không hợp lệ.',
        suggestedAction: 'Kiểm tra lại URL và bảo đảm dùng http hoặc https.'
      },
      error
    );
  }

  if (
    lowerMessage.includes('internal link_target must start with /.') ||
    lowerMessage.includes('anchor link_target must start with #.') ||
    lowerMessage.includes('link_target is required when link_type is not none') ||
    lowerMessage.includes('link_target is required when link_type is not group')
  ) {
    return withTechnicalDetail(
      {
        title: 'Đích liên kết chưa hợp lệ',
        message: 'Đường dẫn không hợp lệ.',
        suggestedAction:
          'Liên kết nội bộ phải bắt đầu bằng /, liên kết mỏ neo phải bắt đầu bằng #.'
      },
      error
    );
  }

  if (
    error.code === 'PAGE_CONTENT_CONFLICT' &&
    lowerMessage.includes('must be approved before publish_status can be published')
  ) {
    return withTechnicalDetail(
      {
        title: 'Chưa thể xuất bản trang',
        message: 'Trang cần được duyệt trước khi xuất bản.',
        suggestedAction: 'Đổi trạng thái duyệt sang Đã duyệt rồi lưu lại.'
      },
      error
    );
  }

  if (
    error.code === 'MENU_POSITION_CONFLICT' ||
    lowerMessage.includes('another active menu already uses position')
  ) {
    return withTechnicalDetail(
      {
        title: 'Vị trí menu đã được dùng',
        message: 'Vị trí này đã có menu khác đang hoạt động.',
        suggestedAction: 'Chọn vị trí khác hoặc lưu trữ menu đang dùng vị trí này.'
      },
      error
    );
  }

  if (
    error.code === 'MENU_ITEM_ARCHIVE_BLOCKED' ||
    lowerMessage.includes('menu item has active child items')
  ) {
    return withTechnicalDetail(
      {
        title: 'Chưa thể lưu trữ mục menu',
        message: 'Mục menu này vẫn còn mục con đang hoạt động.',
        suggestedAction: 'Lưu trữ hoặc chuyển các mục con trước khi lưu trữ mục cha.'
      },
      error
    );
  }

  if (
    lowerMessage.includes('menu item cannot be its own parent') ||
    lowerMessage.includes('ancestor loop')
  ) {
    return withTechnicalDetail(
      {
        title: 'Cấu trúc menu chưa hợp lệ',
        message: 'Không thể tạo vòng lặp trong cây menu.',
        suggestedAction: 'Chọn lại mục cha hợp lệ rồi lưu lại.'
      },
      error
    );
  }

  if (
    lowerMessage.includes('file metadata is still used by active records') ||
    error.code === 'FILE_ARCHIVE_BLOCKED'
  ) {
    return withTechnicalDetail(
      {
        title: 'Chưa thể lưu trữ tệp',
        message: 'Tệp này vẫn đang được bản ghi hoạt động sử dụng.',
        suggestedAction: 'Gỡ liên kết ở bản ghi đang dùng tệp trước khi lưu trữ.'
      },
      error
    );
  }

  return null;
}

function isImportUnreadableWorkbook(error: NormalizedError) {
  const message = error.message.toLowerCase();
  return (
    message.includes('source_workbook_path is not a readable .xlsx file.') ||
    message.includes('khong doc duoc file vua tai len') ||
    message.includes('khong doc duoc workbook') ||
    message.includes('missing required zip entry')
  );
}

function isNetworkError(message: string) {
  const value = message.toLowerCase();
  return (
    value.includes('failed to fetch') ||
    value.includes('networkerror') ||
    value.includes('network request failed') ||
    value.includes('khong the ket noi')
  );
}

function withTechnicalDetail(
  presentation: PresentationDefaults,
  error: NormalizedError,
  options: { hideTechnicalWhenSameAsMessage?: boolean } = {}
): AdminErrorPresentation {
  const technicalDetail = buildTechnicalDetail(
    error,
    presentation.message,
    options.hideTechnicalWhenSameAsMessage
  );
  return {
    ...presentation,
    technicalDetail
  };
}

function buildTechnicalDetail(
  error: NormalizedError,
  visibleMessage: string,
  hideWhenSameAsMessage = false
) {
  const parts: string[] = [];

  if (error.status) parts.push(`HTTP ${error.status}`);
  if (error.code) parts.push(`code: ${error.code}`);
  if (
    error.message &&
    (!hideWhenSameAsMessage ||
      normalizeWhitespace(error.message) !== normalizeWhitespace(visibleMessage))
  ) {
    parts.push(error.message);
  }
  if (error.details && Object.keys(error.details).length > 0) {
    parts.push(JSON.stringify(error.details, null, 2));
  }

  return parts.length > 0 ? parts.join('\n') : undefined;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function looksTechnicalMessage(message: string) {
  const value = message.trim().toLowerCase();
  if (!value) return false;
  return [
    'source_workbook_path',
    'row_ranges',
    'mime',
    'uuid',
    'must ',
    'must be',
    'validation',
    'invalid request payload',
    'zip entry',
    'worksheet',
    'http ',
    'parser',
    'field:',
    'token "',
    'constraint'
  ].some((token) => value.includes(token));
}
