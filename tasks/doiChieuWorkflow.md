# Đối chiếu nội bộ cho bản đề xuất workflow

> Tài liệu này dùng để kiểm tra phạm vi trước khi chốt với người dùng. Không đưa kèm bản trình giảng viên [deXuatDeTaiWorkflow.md](deXuatDeTaiWorkflow.md). Mã `C` dưới đây là workflow trong bản phân tích hiện trạng [workflowAnalysis.md](../docs/workflowAnalysis.md); mã `WF` là workflow mới. Những link nguồn trỏ tới source hiện có, không dùng tài liệu đã xóa hoặc lịch sử Git làm yêu cầu.

## Cách chọn ranh giới

- Giữ riêng một workflow khi người thực hiện có **mục tiêu và kết quả** khác rõ rệt, như khách gửi liên hệ khác khách gửi yêu cầu tư vấn/báo giá; nhân viên xử lý hai loại yêu cầu cũng dùng dữ liệu và danh sách riêng.
- Gộp các bước cùng một kết quả: chọn tệp, ghép cột, rà soát, xử lý trùng, áp dụng dữ liệu đều thuộc **WF07 Nhập sản phẩm từ Excel**.
- Gộp sản phẩm, mẫu mã, ảnh, thông số và tài liệu trong **WF06** vì đó là các phần của hồ sơ sản phẩm trước khi khách xem.
- Giữ riêng dịch vụ, dự án và trang thương hiệu: mục đích giới thiệu và thông tin cần nhập khác nhau, dù đều dùng bước duyệt/công bố.
- Đưa tệp, chuyển hướng, xuất dữ liệu, trang tổng quan và nhật ký vào chức năng hỗ trợ; chúng không phải kết quả nghiệp vụ chính của khách hoặc nhân viên trong đề xuất này.
- Coi duyệt nội bộ, công bố cho khách, ngừng hiển thị và lưu trữ là các quyết định khác nhau. Banner chỉ bật/tắt theo trạng thái riêng; không thêm bước duyệt banner.

## Bảng đối chiếu 29 workflow cũ

| Cũ | Mới hoặc phần hỗ trợ | Xử lý | Lý do và chứng cứ source |
| --- | --- | --- | --- |
| C01 Xem trang chủ và điều hướng | WF01, WF12 | Tách theo tác nhân | Khách xem nội dung ở WF01; nhân viên sắp xếp thông tin ở WF12. [Frontend trang chủ](../frontend/src/app/page.tsx), [HomePageManager](../admin/src/features/home-page/HomePageManager.tsx), [E01](../docs/workflowEvidence.md#e01). |
| C02 Tìm và xem sản phẩm | WF02 | Giữ mục tiêu | Đây là hành trình tìm hiểu sản phẩm của khách, khác công việc biên tập. [Trang chi tiết sản phẩm](../frontend/src/app/san-pham/[slug]/page.tsx), [E02](../docs/workflowEvidence.md#e02). |
| C03 Xem thương hiệu, dịch vụ, dự án, tin tức, trang | WF01 | Gộp | Cùng mục tiêu tìm hiểu thông tin đã công bố; các nhánh loại nội dung nêu trong bước/ngoại lệ. [Public service](../api/src/modules/public/public.service.ts), [E03](../docs/workflowEvidence.md#e03). |
| C04 Tải tệp công khai | WF01, WF02; chức năng tệp | Chuyển thành bước/hỗ trợ | Khách mở tài liệu trong khi xem nội dung hoặc sản phẩm; cấp tệp có điều kiện, không tự biến mọi tệp thành công khai. [Public product file repository](../api/src/modules/public/public-product-file.repository.ts), [E04](../docs/workflowEvidence.md#e04). |
| C05 Gửi tư vấn/báo giá | WF04 | Giữ mục tiêu | Yêu cầu có thể có nhiều sản phẩm hoặc không có sản phẩm; kết quả là một yêu cầu chờ theo dõi. [QuoteRequestForm](../frontend/src/features/quote-request/QuoteRequestForm.tsx), [E05](../docs/workflowEvidence.md#e05). |
| C06 Gửi liên hệ | WF03 | Giữ mục tiêu | Form và dữ liệu liên hệ khác yêu cầu tư vấn/báo giá. [ContactForm](../frontend/src/features/contact-request/ContactForm.tsx), [E06](../docs/workflowEvidence.md#e06). |
| C07 Xử lý liên hệ | WF13 | Giữ mục tiêu | Nhân viên xem, phân công, ghi chú và phân loại một liên hệ đã nhận. [Contact service](../api/src/modules/contact/contact.service.ts), [E07](../docs/workflowEvidence.md#e07). |
| C08 Xử lý báo giá | WF14 | Giữ mục tiêu | Có dòng sản phẩm, số lượng và giá công khai được ghi khi khách gửi; yêu cầu tư vấn chung cũng nằm đây. [Quote service](../api/src/modules/quote/quote.service.ts), [E08](../docs/workflowEvidence.md#e08). |
| C09 Hồ sơ khách, lịch sử | WF15; bước liên kết trong WF03, WF04 | Giữ mục tiêu, đưa phần tự động vào luồng gửi | Nhân viên có kết quả riêng là hồ sơ và lịch sử để tra cứu; hệ thống liên kết hồ sơ khi nhận form. [Customer service](../api/src/modules/customer/customer.service.ts), [Public repository](../api/src/modules/public/public.repository.ts), [E09](../docs/workflowEvidence.md#e09). |
| C10 Danh mục và thương hiệu | WF05 | Giữ mục tiêu | Chuẩn bị phân loại cho sản phẩm; trang giới thiệu thương hiệu là WF09. [Product category service](../api/src/modules/product-category/product-category.service.ts), [Brand service](../api/src/modules/brand/brand.service.ts), [E10](../docs/workflowEvidence.md#e10). |
| C11 Hồ sơ sản phẩm | WF06 | Gộp với C12–C13 | Sản phẩm được xem/công bố cùng thông tin biến thể và tài liệu liên quan. [Product group service](../api/src/modules/product-group/product-group.service.ts), [E11](../docs/workflowEvidence.md#e11). |
| C12 Biến thể, mã, giá | WF06 | Gộp với C11 | Mẫu mã là phần của sản phẩm nhưng có điều kiện công bố riêng; WF06 nêu rõ ngoại lệ này. [Product variant service](../api/src/modules/product-variant/product-variant.service.ts), [E12](../docs/workflowEvidence.md#e12). |
| C13 Ảnh, thông số, tài liệu | WF06; chức năng tệp | Gộp/đưa vào hỗ trợ | Đây là dữ liệu bổ sung cho sản phẩm; thư viện tệp là công cụ dùng chung. [Technical document service](../api/src/modules/technical-document/technical-document.service.ts), [E13](../docs/workflowEvidence.md#e13). |
| C14 Tiếp nhận tệp, ghép cột | WF07 | Gộp với C15–C16 | Bước đầu của một lô nhập, chưa tạo sản phẩm chính thức. [Import service](../api/src/modules/import-workspace/import-workspace.service.ts), [E14](../docs/workflowEvidence.md#e14). |
| C15 Rà soát, xử lý xung đột | WF07 | Gộp với C14–C16 | Quyết định dùng/bỏ dòng nằm giữa bước xem trước và áp dụng. [Import readiness](../api/src/modules/import-workspace/import-workspace.readiness.ts), [E15](../docs/workflowEvidence.md#e15). |
| C16 Áp dụng lô nhập | WF07; chuyển tiếp WF06 | Gộp | Kết quả của nhập là dữ liệu chính thức chưa tự công bố; công bố do WF06 đảm nhiệm. [Import repository](../api/src/modules/import-workspace/import-workspace.repository.ts), [E16](../docs/workflowEvidence.md#e16). |
| C17 Trang nội dung, tin tức | WF08 | Giữ mục tiêu | Bài viết và trang cùng luồng biên tập, duyệt, công bố; chuyên mục tin là dữ liệu phụ. [Page content service](../api/src/modules/page-content/page-content.service.ts), [E17](../docs/workflowEvidence.md#e17). |
| C18 Trang chi tiết thương hiệu | WF09 | Giữ riêng | Khác bản ghi thương hiệu phân loại sản phẩm; có nội dung, số liệu và sản phẩm nổi bật riêng. [Brand page service](../api/src/modules/brand-page/brand-page.service.ts), [E18](../docs/workflowEvidence.md#e18). |
| C19 Dịch vụ | WF10 | Giữ riêng | Giới thiệu dịch vụ với nội dung và sản phẩm liên quan; không trộn với hồ sơ dự án. [Service service](../api/src/modules/service/service.service.ts), [E19](../docs/workflowEvidence.md#e19). |
| C20 Dự án | WF11 | Giữ riêng | Dự án cần địa điểm, năm, mô tả, ảnh chính và có bộ ảnh riêng. [Project service](../api/src/modules/project/project.service.ts), [E20](../docs/workflowEvidence.md#e20). |
| C21 Banner | WF12 | Gộp với C22–C23 | Là một phần của việc sắp xếp thông tin website. Banner không có bước duyệt/công bố nội dung riêng. [Banner types](../api/src/modules/banner/banner.types.ts), [E21](../docs/workflowEvidence.md#e21). |
| C22 Bố cục trang chủ | WF12 | Gộp với C21, C23 | Bật/tắt và sắp thứ tự khu vực là cách trình bày website, không công bố thay nội dung nguồn. [Home page service](../api/src/modules/home-page/home-page.service.ts), [E22](../docs/workflowEvidence.md#e22). |
| C23 Thông tin website, menu | WF12 | Gộp với C21–C22 | Cùng kết quả là thông tin doanh nghiệp và điều hướng được trình bày nhất quán. [Website settings service](../api/src/modules/website-settings/website-settings.service.ts), [Menu service](../api/src/modules/menu/menu.service.ts), [E23](../docs/workflowEvidence.md#e23). |
| C24 Chuyển hướng URL cũ | Chức năng hỗ trợ của WF12/WF01 | Chuyển thành hỗ trợ | Chỉ cần khi đổi đường dẫn; không phải mục đích giới thiệu hoặc tiếp nhận yêu cầu độc lập. [Redirect service](../api/src/modules/redirect/redirect.service.ts), [E24](../docs/workflowEvidence.md#e24). |
| C25 Thư viện tệp | Chức năng hỗ trợ của WF06, WF08–WF12 | Chuyển thành hỗ trợ | Tệp được dùng trong nhiều nội dung; quyền cấp tệp công khai là vấn đề riêng với tải tệp nội bộ. [File service](../api/src/modules/file/file.service.ts), [E25](../docs/workflowEvidence.md#e25). |
| C26 Đăng nhập, phiên | WF16; chức năng hỗ trợ xác thực | Gộp với C27 | Đăng nhập là điều kiện để nhân viên thực hiện quyền, không cần quy trình nghiệp vụ độc lập ở bản đề xuất. [Auth service](../api/src/modules/auth/auth.service.ts), [E26](../docs/workflowEvidence.md#e26). |
| C27 Tài khoản, vai trò, quyền | WF16 | Giữ mục tiêu | Cấp phạm vi làm việc cho nhân viên là kết quả quản trị độc lập. [Admin user service](../api/src/modules/admin-user/admin-user.service.ts), [Admin role service](../api/src/modules/admin-role/admin-role.service.ts), [E27](../docs/workflowEvidence.md#e27). |
| C28 Dashboard, nhật ký | Chức năng hỗ trợ | Chuyển thành hỗ trợ | Phục vụ theo dõi, đối chiếu sau các thao tác; không phải luồng làm việc chính của khách. [Dashboard service](../api/src/modules/dashboard/dashboard.service.ts), [Audit log service](../api/src/modules/audit-log/audit-log.service.ts), [E28](../docs/workflowEvidence.md#e28). |
| C29 Xuất bảng tính | Chức năng hỗ trợ | Chuyển thành hỗ trợ | Tải bản dữ liệu ra để đối chiếu, không thay đổi nghiệp vụ sản phẩm/khách hàng. [ImportWorkspacePage](../admin/src/features/import-workspace/ImportWorkspacePage.tsx), [Export file](../admin/src/lib/exportFile.ts), [E29](../docs/workflowEvidence.md#e29). |

## Phủ chức năng không tách workflow

| Phần hệ thống | Nơi thể hiện trong bản đề xuất |
| --- | --- |
| Website công khai, tìm kiếm, nội dung, tài liệu | WF01–WF02, Phần V |
| Gửi biểu mẫu công khai | WF03–WF04 |
| Danh mục, thương hiệu, sản phẩm, biến thể, giá, ảnh, thông số | WF05–WF07 |
| Trang/bài viết, trang thương hiệu, dịch vụ, dự án | WF08–WF11 |
| Bố cục, banner, menu, thông tin doanh nghiệp, chuyển hướng | WF12, Phần V |
| Liên hệ, yêu cầu tư vấn/báo giá, hồ sơ khách | WF13–WF15 |
| Tài khoản, quyền, xác thực, nhật ký và số liệu | WF16, Phần V |
| Xuất dữ liệu và quản lý tệp | Phần V |

## Đối chiếu cấu trúc dữ liệu và kiểm thử có sẵn

Các đường dẫn dưới đây giúp kiểm tra những quy tắc dễ bị diễn đạt sai. Chúng chỉ là bằng chứng về cấu trúc và kịch bản kiểm thử trong repository, không chứng minh môi trường bàn giao đã vận hành đúng.

| Workflow liên quan | Dữ liệu hiện có | Kịch bản kiểm thử liên quan |
| --- | --- | --- |
| WF02, WF05–WF07 | [DDL triển khai](../database/ddl/song_thanh_deployment_schema_20260730.sql), [miền dữ liệu sản phẩm](../api/migrations/202604280001_add_product_domain_contexts.js), [trang tính nhập hàng](../api/migrations/202610090003_importSheet.js) | [Tìm sản phẩm](../api/tests/unit/productSearch.test.ts), [ghép dữ liệu nhập](../api/tests/unit/importmapping.test.ts), [điều kiện công bố sản phẩm](../admin/tests/e2e/productreadiness.spec.ts) |
| WF03–WF04, WF13–WF15 | [Hồ sơ khách](../api/migrations/202605080001_create_customer_profile.js), [ngữ cảnh yêu cầu tư vấn](../api/migrations/202608100001_quoteprojectcontext.js), [giá ghi nhận lúc gửi](../api/migrations/202610090002_quotePriceSnapshot.js) | [Giá ghi nhận khi gửi](../api/tests/unit/publicQuotePrice.test.ts), [biểu mẫu yêu cầu](../api/tests/unit/publicquotecontract.test.ts) |
| WF08–WF12 | [Trang thương hiệu](../api/migrations/202605170001_create_brand_page_tables.js), [nội dung dịch vụ và dự án](../api/migrations/202605140002_add_service_project_content_fields.js), [khu vực trang chủ](../api/migrations/202606030001_create_home_sections.js) | [Duyệt nội dung công khai](../api/tests/unit/publicContentReview.test.ts), [ngừng hiển thị](../api/tests/unit/contentUnpublish.test.ts), [nội dung trang](../api/tests/unit/pageContentGuardrails.test.ts) |
| WF16 | [Bảng tài khoản và quyền](../api/migrations/202604250001_create_admin_auth_tables.js), [một vai trò cho mỗi tài khoản](../api/migrations/202610010001_oneUserRole.js) | [Một vai trò](../api/tests/unit/singleRole.test.ts), [quyền duyệt và công bố](../api/tests/unit/workflow-approval.guard.test.ts) |

## Điểm cần người dùng xác nhận trước khi chốt

1. **Tên pháp lý/cách viết tên công ty:** Trao đổi trước dùng “Song Thành”, còn yêu cầu mới viết “Song Thanh”. Bản dành cho giảng viên tạm dùng tên đã được người dùng chọn trước đó; cần xác nhận tên chính thức trên bìa luận văn.
2. **Mức độ trình bày quy trình chăm sóc sau khi nhận yêu cầu:** Source có tình trạng xử lý, phân công và ghi chú; không có bằng chứng cho việc hệ thống tự gửi email, lập báo giá thương mại hoặc quản lý đơn hàng. Tài liệu chỉ nêu nhân viên theo dõi, không hứa thêm các bước đó.
3. **Nhập tệp qua đường dẫn nội bộ:** Ngoài tải tệp từ giao diện, source còn có cách đọc đường dẫn local. Không đưa vào bản trình giảng viên cho đến khi người dùng xác nhận đây là phạm vi sử dụng thông thường.
4. **Cách duyệt khi quản trị viên cấp cao sửa nội dung đã đăng:** Source cho phép sửa trực tiếp trong một số trường hợp; bản đề xuất chỉ nêu trường hợp nhân viên sửa nội dung quan trọng cần duyệt lại. Nếu muốn chính sách duyệt chung bắt buộc cho mọi người, đó sẽ là yêu cầu mới cần xác nhận.
5. **Mức bắt buộc của ảnh, mô tả, biến thể, tài liệu và thông tin tối ưu tìm kiếm:** Mỗi loại nội dung có điều kiện chặn khác nhau; một số điều chỉ là cảnh báo chất lượng. Không được hiểu câu “đủ điều kiện” trong bản giảng viên là mọi trường đều bắt buộc.
6. **Dữ liệu triển khai thật:** Snapshot trong [DDL](../database/ddl/song_thanh_deployment_schema_20260730.sql) cũ hơn một số migration. Chưa kiểm tra cơ sở dữ liệu môi trường bàn giao để xác nhận cấu trúc và dữ liệu thực tế.

## Mức kiểm chứng

- Hai tài liệu phân tích hiện trạng trong `docs/` là tài liệu mới tạo trong cuộc trao đổi này, **chưa được người dùng xác nhận là nguồn sự thật**; từng quyết định chính ở bảng trên có link tới source hiện tại để đối chiếu.
- Trong lần phân tích trước, bài kiểm thử đơn vị và kiểm tra kiểu đã đạt, nhưng runtime, cơ sở dữ liệu triển khai và các kịch bản xuyên suốt chưa được xác minh. Bản trình giảng viên không khẳng định hệ thống đã chạy hoặc đã hoàn thành.
