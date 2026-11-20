# Danh sách ca kiểm thử Playwright (UI và logic)

Ảnh chụp bằng chứng của đợt QA ngày 2026-10-06; đây là kiểm thử code/runtime hiện tại, không phải đặc tả nghiệp vụ được phê duyệt.

- Trước khi sửa/cập nhật test: 145 đạt, 16 lỗi, 1 quá giờ, 26 bỏ qua.
- Sau khi sửa/cập nhật test: 203 đạt.
- Baseline 188 ca được chạy với đầy đủ asset của bản sao. 14 ca base path riêng và ca menu mới chưa thuộc baseline đó.
- "Bỏ qua" ban đầu chủ yếu do nhóm kiểm thử chạy nối tiếp dừng sau lỗi đầu, không đồng nghĩa sản phẩm lỗi.
- Bộ Playwright gồm ca trình duyệt thật và ca kiểm tra logic thuần. Mỗi tên ca mô tả thao tác/kỳ vọng; nhấp mã nguồn ở cột cuối để xem chính xác thứ tự click, nhập, gửi request hoặc assert.

| # | Thao tác và điều kiện cần kiểm tra | Ban đầu | Sau cùng | Kịch bản thực thi |
| ---: | --- | --- | --- | --- |
| 1 | A11Y-01: login and representative admin routes satisfy WCAG A/AA automation | Lỗi | Đạt | [accessibility-security-responsive.spec.ts:78](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L78) |
| 2 | A11Y-02: representative public routes satisfy WCAG A/AA automation | Đạt | Đạt | [accessibility-security-responsive.spec.ts:96](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L96) |
| 3 | A11Y-03: mobile drawers trap focus, restore focus and pages do not overflow | Lỗi | Đạt | [accessibility-security-responsive.spec.ts:113](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L113) |
| 4 | RESP-UI-04: product and customer lists prioritize usable mobile data | Đạt | Đạt | [accessibility-security-responsive.spec.ts:157](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L157) |
| 5 | RESP-UI-06: import batches remain compact and keep destructive actions secondary | Đạt | Đạt | [accessibility-security-responsive.spec.ts:244](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L244) |
| 6 | A11Y-04: quote and file dialogs are named, trap focus and restore the opener | Đạt | Đạt | [accessibility-security-responsive.spec.ts:264](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L264) |
| 7 | A11Y-05: shell skip links move focus and admin field errors describe the control | Lỗi | Đạt | [accessibility-security-responsive.spec.ts:334](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L334) |
| 8 | RESP-UI-02: mobile contact actions stay collapsed until the customer opens them | Đạt | Đạt | [accessibility-security-responsive.spec.ts:373](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L373) |
| 9 | RESP-UI-03: mobile hero keeps carousel pagination clear of its quote action | Đạt | Đạt | [accessibility-security-responsive.spec.ts:402](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L402) |
| 10 | RESP-UI-05: product discovery stays concise and expands its grid on wide screens | Lỗi | Đạt | [accessibility-security-responsive.spec.ts:430](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L430) |
| 11 | SEC-UI-01: web surfaces and API emit baseline browser security headers | Đạt | Đạt | [accessibility-security-responsive.spec.ts:512](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L512) |
| 12 | SEC-UI-02: login refuses an external returnTo target | Đạt | Đạt | [accessibility-security-responsive.spec.ts:547](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L547) |
| 13 | SEC-UI-03: login returns to the complete internal path including its query | Đạt | Đạt | [accessibility-security-responsive.spec.ts:555](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L555) |
| 14 | RES-UI-01: contact form preserves input and recovers after a network failure | Đạt | Đạt | [accessibility-security-responsive.spec.ts:567](../admin/tests/e2e/accessibility-security-responsive.spec.ts#L567) |
| 15 | EXP-01, EXP-03, EXP-04, EXP-05: export tab renders in import workspace and loads references | Đạt | Đạt | [admin-export.spec.ts:75](../admin/tests/e2e/admin-export.spec.ts#L75) |
| 16 | EXP-02: an invalid session cannot open the export workspace | Lỗi | Đạt | [admin-export.spec.ts:106](../admin/tests/e2e/admin-export.spec.ts#L106) |
| 17 | EXP-CUSTOMER: customer workspace downloads a real readable .xlsx workbook | Bỏ qua | Đạt | [admin-export.spec.ts:121](../admin/tests/e2e/admin-export.spec.ts#L121) |
| 18 | EXP-06, EXP-08, EXP-20: product catalog export downloads a real multi-sheet .xlsx workbook | Bỏ qua | Đạt | [admin-export.spec.ts:139](../admin/tests/e2e/admin-export.spec.ts#L139) |
| 19 | EXP-05B: brand filter narrows parent and child category choices | Bỏ qua | Đạt | [admin-export.spec.ts:168](../admin/tests/e2e/admin-export.spec.ts#L168) |
| 20 | EXP-07: product catalog can export without variant requests | Bỏ qua | Đạt | [admin-export.spec.ts:193](../admin/tests/e2e/admin-export.spec.ts#L193) |
| 21 | EXP-09, EXP-11, EXP-12: parent category public-safe export includes child products and documents | Bỏ qua | Đạt | [admin-export.spec.ts:208](../admin/tests/e2e/admin-export.spec.ts#L208) |
| 22 | EXP-10, EXP-14, EXP-18: taxonomy export uses loaded references and creates two real worksheets | Bỏ qua | Đạt | [admin-export.spec.ts:252](../admin/tests/e2e/admin-export.spec.ts#L252) |
| 23 | EXP-15, EXP-19: technical document export keeps special text as a string in a real workbook | Bỏ qua | Đạt | [admin-export.spec.ts:276](../admin/tests/e2e/admin-export.spec.ts#L276) |
| 24 | EXP-21: one-table technical document export supports formula-safe CSV | Bỏ qua | Đạt | [admin-export.spec.ts:301](../admin/tests/e2e/admin-export.spec.ts#L301) |
| 25 | EXP-16: no matching product data shows an action error and does not download | Bỏ qua | Đạt | [admin-export.spec.ts:319](../admin/tests/e2e/admin-export.spec.ts#L319) |
| 26 | EXP-17: API read failure shows an error and blocks partial download | Bỏ qua | Đạt | [admin-export.spec.ts:333](../admin/tests/e2e/admin-export.spec.ts#L333) |
| 27 | login returns roles immediately so Super Admin capability is not stale | Đạt | Đạt | [adminroles.spec.ts:60](../admin/tests/e2e/adminroles.spec.ts#L60) |
| 28 | system role metadata is read-only while its permission matrix remains explicit | Đạt | Đạt | [adminroles.spec.ts:64](../admin/tests/e2e/adminroles.spec.ts#L64) |
| 29 | system audit history has usable filters and a readable mobile layout | Lỗi | Đạt | [adminroles.spec.ts:89](../admin/tests/e2e/adminroles.spec.ts#L89) |
| 30 | permission editor automatically keeps required read access and saves a clear matrix | Bỏ qua | Đạt | [adminroles.spec.ts:114](../admin/tests/e2e/adminroles.spec.ts#L114) |
| 31 | user assignment explains Super Admin impact before saving | Bỏ qua | Đạt | [adminroles.spec.ts:185](../admin/tests/e2e/adminroles.spec.ts#L185) |
| 32 | an existing token follows role changes and cannot reach unauthorized API routes | Bỏ qua | Đạt | [adminroles.spec.ts:198](../admin/tests/e2e/adminroles.spec.ts#L198) |
| 33 | Super Admin can edit own profile but cannot disable the active account | Bỏ qua | Đạt | [adminroles.spec.ts:354](../admin/tests/e2e/adminroles.spec.ts#L354) |
| 34 | reserved system write codes cannot be delegated and a reader cannot manage accounts | Bỏ qua | Đạt | [adminroles.spec.ts:391](../admin/tests/e2e/adminroles.spec.ts#L391) |
| 35 | role and user management remain usable on a narrow screen | Bỏ qua | Đạt | [adminroles.spec.ts:474](../admin/tests/e2e/adminroles.spec.ts#L474) |
| 36 | role and user workspaces meet WCAG A and AA checks | Bỏ qua | Đạt | [adminroles.spec.ts:487](../admin/tests/e2e/adminroles.spec.ts#L487) |
| 37 | topbar search carries a query into each searchable admin area | Chưa chạy | Đạt | [adminsearch.spec.ts:24](../admin/tests/e2e/adminsearch.spec.ts#L24) |
| 38 | editing a user confirms the save in a dialog instead of inside the form | Chưa chạy | Đạt | [adminuserssave.spec.ts:6](../admin/tests/e2e/adminuserssave.spec.ts#L6) |
| 39 | a generated temporary password is shown once in the creation result | Chưa chạy | Đạt | [adminuserssave.spec.ts:47](../admin/tests/e2e/adminuserssave.spec.ts#L47) |
| 40 | admin icons use the shared animated outline system without overflowing controls | Đạt | Đạt | [animatedicons.spec.ts:7](../admin/tests/e2e/animatedicons.spec.ts#L7) |
| 41 | admin shell exposes the current location and focuses quick navigation from the keyboard | Lỗi | Đạt | [animatedicons.spec.ts:37](../admin/tests/e2e/animatedicons.spec.ts#L37) |
| 42 | audit list opens the actual log detail and stays usable on mobile | Đạt | Đạt | [auditWorkspace.spec.ts:15](../admin/tests/e2e/auditWorkspace.spec.ts#L15) |
| 43 | a role without audit permission cannot open the log or fetch its data | Đạt | Đạt | [auditWorkspace.spec.ts:48](../admin/tests/e2e/auditWorkspace.spec.ts#L48) |
| 44 | a revoked admin session does not show cached system rights | Đạt | Đạt | [authBoundary.spec.ts:40](../admin/tests/e2e/authBoundary.spec.ts#L40) |
| 45 | verification outage blocks stale access but offers a retry | Đạt | Đạt | [authBoundary.spec.ts:48](../admin/tests/e2e/authBoundary.spec.ts#L48) |
| 46 | a sidebar group links to an allowed child when its parent is forbidden | Đạt | Đạt | [authBoundary.spec.ts:60](../admin/tests/e2e/authBoundary.spec.ts#L60) |
| 47 | an open tab loses both the page and its actions after role permissions are revoked | Đạt | Đạt | [authBoundary.spec.ts:79](../admin/tests/e2e/authBoundary.spec.ts#L79) |
| 48 | brand page save uses one result dialog rather than inline success text | Chưa chạy | Đạt | [brandPageSave.spec.ts:6](../admin/tests/e2e/brandPageSave.spec.ts#L6) |
| 49 | one contact launcher contains the saved quote list and contact channels | Đạt | Đạt | [contactwidget.spec.ts:6](../admin/tests/e2e/contactwidget.spec.ts#L6) |
| 50 | keyboard opening moves focus into the contact choices | Đạt | Đạt | [contactwidget.spec.ts:88](../admin/tests/e2e/contactwidget.spec.ts#L88) |
| 51 | contact panel fits narrow screens and returns to its launcher | Đạt | Đạt | [contactwidget.spec.ts:101](../admin/tests/e2e/contactwidget.spec.ts#L101) |
| 52 | contact launcher stays compact on the product catalog and closes on outside click | Đạt | Đạt | [contactwidget.spec.ts:145](../admin/tests/e2e/contactwidget.spec.ts#L145) |
| 53 | quote form separates selected products from contact details and adapts to mobile | Đạt | Đạt | [contactwidget.spec.ts:171](../admin/tests/e2e/contactwidget.spec.ts#L171) |
| 54 | clearing the quote list keeps keyboard focus inside the dialog | Đạt | Đạt | [contactwidget.spec.ts:210](../admin/tests/e2e/contactwidget.spec.ts#L210) |
| 55 | the page composer reorders, hides, previews, and restores project sections | Lỗi | Đạt | [contentlayout.spec.ts:22](../admin/tests/e2e/contentlayout.spec.ts#L22) |
| 56 | readiness actions take an editor directly to the field that needs work | Đạt | Đạt | [contentlayout.spec.ts:126](../admin/tests/e2e/contentlayout.spec.ts#L126) |
| 57 | system page setup explains sharing media and exposes brand profiles as a primary workspace | Đạt | Đạt | [contentlayout.spec.ts:159](../admin/tests/e2e/contentlayout.spec.ts#L159) |
| 58 | brand page editor uses four plain-language work areas and truthful readiness rules | Đạt | Đạt | [contentlayout.spec.ts:179](../admin/tests/e2e/contentlayout.spec.ts#L179) |
| 59 | brand page treats featured image as sharing media, not a visible banner | Đạt | Đạt | [contentownership.spec.ts:7](../admin/tests/e2e/contentownership.spec.ts#L7) |
| 60 | news detail is an editorial article without a right sidebar or repeated call action | Đạt | Đạt | [contentownership.spec.ts:23](../admin/tests/e2e/contentownership.spec.ts#L23) |
| 61 | admin news draft preview uses the public article layout without invented media | Đạt | Đạt | [contentownership.spec.ts:37](../admin/tests/e2e/contentownership.spec.ts#L37) |
| 62 | project and service previews do not expose unfinished editorial placeholder text | Đạt | Đạt | [contentownership.spec.ts:58](../admin/tests/e2e/contentownership.spec.ts#L58) |
| 63 | news index keeps categories and search beside the feed without a duplicate sidebar | Đạt | Đạt | [contentownership.spec.ts:80](../admin/tests/e2e/contentownership.spec.ts#L80) |
| 64 | brand directory and news article remain usable across phone, desktop and wide screens | Đạt | Đạt | [contentownership.spec.ts:110](../admin/tests/e2e/contentownership.spec.ts#L110) |
| 65 | project and service listings and details stay legible across phone, desktop and wide screens | Đạt | Đạt | [contentownership.spec.ts:151](../admin/tests/e2e/contentownership.spec.ts#L151) |
| 66 | project case study places its story heading above the reading column | Đạt | Đạt | [contentownership.spec.ts:205](../admin/tests/e2e/contentownership.spec.ts#L205) |
| 67 | project detail does not surface runtime console errors | Đạt | Đạt | [contentownership.spec.ts:222](../admin/tests/e2e/contentownership.spec.ts#L222) |
| 68 | mobile product filters keep focus inside while open and return it when closed | Đạt | Đạt | [contentownership.spec.ts:235](../admin/tests/e2e/contentownership.spec.ts#L235) |
| 69 | product, brand detail and static content routes do not break on phone or wide desktop | Lỗi | Đạt | [contentownership.spec.ts:256](../admin/tests/e2e/contentownership.spec.ts#L256) |
| 70 | published content pages remain usable and hidden pages stay unavailable on mobile | Lỗi | Đạt | [contentpages.spec.ts:24](../admin/tests/e2e/contentpages.spec.ts#L24) |
| 71 | published content pages remain usable and hidden pages stay unavailable on wide desktop | Lỗi | Đạt | [contentpages.spec.ts:24](../admin/tests/e2e/contentpages.spec.ts#L24) |
| 72 | brand directory uses a readable four-column desktop catalog instead of a dense logo wall | Đạt | Đạt | [contentpages.spec.ts:85](../admin/tests/e2e/contentpages.spec.ts#L85) |
| 73 | content readiness mirrors the backend publish guardrails | Đạt | Đạt | [contentreadiness.spec.ts:28](../admin/tests/e2e/contentreadiness.spec.ts#L28) |
| 74 | content readiness exposes blank, invalid and maximum-length boundaries | Đạt | Đạt | [contentreadiness.spec.ts:39](../admin/tests/e2e/contentreadiness.spec.ts#L39) |
| 75 | content readiness explains every issue without developer terminology | Đạt | Đạt | [contentreadiness.spec.ts:66](../admin/tests/e2e/contentreadiness.spec.ts#L66) |
| 76 | every editable issue points to a real editor section or control | Đạt | Đạt | [contentreadiness.spec.ts:81](../admin/tests/e2e/contentreadiness.spec.ts#L81) |
| 77 | content list filters parse hostile URL values into safe defaults | Đạt | Đạt | [contentreadiness.spec.ts:111](../admin/tests/e2e/contentreadiness.spec.ts#L111) |
| 78 | content list requests only include filters supported by the selected domain | Đạt | Đạt | [contentreadiness.spec.ts:124](../admin/tests/e2e/contentreadiness.spec.ts#L124) |
| 79 | content readiness reports contradictory lifecycle state instead of hiding it | Đạt | Đạt | [contentreadiness.spec.ts:143](../admin/tests/e2e/contentreadiness.spec.ts#L143) |
| 80 | content readiness gives archived records precedence and flags impossible public state | Đạt | Đạt | [contentreadiness.spec.ts:160](../admin/tests/e2e/contentreadiness.spec.ts#L160) |
| 81 | content readiness treats renderable structured blocks as a meaningful body | Đạt | Đạt | [contentreadiness.spec.ts:175](../admin/tests/e2e/contentreadiness.spec.ts#L175) |
| 82 | product catalog page may publish without editorial copy because catalog data supplies the page | Đạt | Đạt | [contentreadiness.spec.ts:196](../admin/tests/e2e/contentreadiness.spec.ts#L196) |
| 83 | news readiness keeps quality gaps visible without inventing publish blockers | Đạt | Đạt | [contentreadiness.spec.ts:212](../admin/tests/e2e/contentreadiness.spec.ts#L212) |
| 84 | unfinished template copy is an actionable warning, not an invented publish blocker | Đạt | Đạt | [contentreadiness.spec.ts:246](../admin/tests/e2e/contentreadiness.spec.ts#L246) |
| 85 | content readiness is deterministic and does not mutate its input | Đạt | Đạt | [contentreadiness.spec.ts:265](../admin/tests/e2e/contentreadiness.spec.ts#L265) |
| 86 | saving page content reports the result in a dialog instead of an inline banner | Chưa chạy | Đạt | [contentsave.spec.ts:6](../admin/tests/e2e/contentsave.spec.ts#L6) |
| 87 | super admin can save a product catalog page with empty editorial copy and sees a result | Chưa chạy | Đạt | [contentsave.spec.ts:58](../admin/tests/e2e/contentsave.spec.ts#L58) |
| 88 | super admin can approve and publish the catalog without editorial copy in one action | Chưa chạy | Đạt | [contentsave.spec.ts:111](../admin/tests/e2e/contentsave.spec.ts#L111) |
| 89 | unpublishing a visible page ignores draft readiness and keeps unsaved edits | Chưa chạy | Đạt | [contentsave.spec.ts:180](../admin/tests/e2e/contentsave.spec.ts#L180) |
| 90 | a visible page does not show a contradictory publish-readiness warning | Chưa chạy | Đạt | [contentsave.spec.ts:243](../admin/tests/e2e/contentsave.spec.ts#L243) |
| 91 | a live page stays in the displayed lane even when old editorial text is missing | Đạt | Đạt | [contentWorkflow.spec.ts:7](../admin/tests/e2e/contentWorkflow.spec.ts#L7) |
| 92 | a published flag without approval is not presented as live | Đạt | Đạt | [contentWorkflow.spec.ts:50](../admin/tests/e2e/contentWorkflow.spec.ts#L50) |
| 93 | hiding a published content item confirms the saved result after its row leaves the filter | Đạt | Đạt | [contentWorkflow.spec.ts:82](../admin/tests/e2e/contentWorkflow.spec.ts#L82) |
| 94 | dashboard traffic chart stays compact and zero days have no visible bar | Chưa chạy | Đạt | [dashboard.spec.ts:6](../admin/tests/e2e/dashboard.spec.ts#L6) |
| 95 | date range validation is inclusive and rejects a reversed range | Đạt | Đạt | [domainimportux.spec.ts:27](../admin/tests/e2e/domainimportux.spec.ts#L27) |
| 96 | service and project editors use one full-width editing flow | Đạt | Đạt | [domainimportux.spec.ts:50](../admin/tests/e2e/domainimportux.spec.ts#L50) |
| 97 | import workspace prioritizes the next action and supports a custom export date range | Đạt | Đạt | [domainimportux.spec.ts:86](../admin/tests/e2e/domainimportux.spec.ts#L86) |
| 98 | an unavailable preview never tells the user that an applied import failed to be created | Đạt | Đạt | [domainimportux.spec.ts:121](../admin/tests/e2e/domainimportux.spec.ts#L121) |
| 99 | new import uses a localized dropzone and derives a useful batch name | Đạt | Đạt | [domainimportux.spec.ts:136](../admin/tests/e2e/domainimportux.spec.ts#L136) |
| 100 | redesigned domain and import screens stay within mobile and wide viewports | Đạt | Đạt | [domainimportux.spec.ts:161](../admin/tests/e2e/domainimportux.spec.ts#L161) |
| 101 | public footer keeps its columns and link rows compact without mobile overflow | Lỗi | Đạt | [footerLayout.spec.ts:5](../admin/tests/e2e/footerLayout.spec.ts#L5) |
| 102 | saving the homepage confirms the result in a dialog instead of an inline message | Chưa chạy | Đạt | [homepageSave.spec.ts:6](../admin/tests/e2e/homepageSave.spec.ts#L6) |
| 103 | saving a menu reports success in a dialog and offers a return to the list | Chưa chạy | Đạt | [menusave.spec.ts:6](../admin/tests/e2e/menusave.spec.ts#L6) |
| 104 | a cached Super Admin session with missing roles reloads its access before showing the editor | Đạt | Đạt | [page-content-lifecycle.spec.ts:67](../admin/tests/e2e/page-content-lifecycle.spec.ts#L67) |
| 105 | the create hub exposes every page type and opens the matching editor | Đạt | Đạt | [page-content-lifecycle.spec.ts:79](../admin/tests/e2e/page-content-lifecycle.spec.ts#L79) |
| 106 | the publishing queue exposes deterministic lanes and keeps its filters in the URL | Đạt | Đạt | [page-content-lifecycle.spec.ts:121](../admin/tests/e2e/page-content-lifecycle.spec.ts#L121) |
| 107 | the content workspace separates workflow, system pages and the content library | Lỗi | Đạt | [page-content-lifecycle.spec.ts:198](../admin/tests/e2e/page-content-lifecycle.spec.ts#L198) |
| 108 | the banner workspace restores its placement from a deep link | Bỏ qua | Đạt | [page-content-lifecycle.spec.ts:239](../admin/tests/e2e/page-content-lifecycle.spec.ts#L239) |
| 109 | the banner workspace warns when ordering is ambiguous inside one placement | Bỏ qua | Đạt | [page-content-lifecycle.spec.ts:268](../admin/tests/e2e/page-content-lifecycle.spec.ts#L268) |
| 110 | the banner editor exposes ordering and desktop/mobile preview modes | Bỏ qua | Đạt | [page-content-lifecycle.spec.ts:309](../admin/tests/e2e/page-content-lifecycle.spec.ts#L309) |
| 111 | the publishing queue and lifecycle bar remain usable at four responsive boundaries | Bỏ qua | Đạt | [page-content-lifecycle.spec.ts:345](../admin/tests/e2e/page-content-lifecycle.spec.ts#L345) |
| 112 | news-category management exposes bounded fields and a recoverable archive flow | Bỏ qua | Đạt | [page-content-lifecycle.spec.ts:399](../admin/tests/e2e/page-content-lifecycle.spec.ts#L399) |
| 113 | the page editor validates deep blocks, previews draft content, and loads live data only on demand | Bỏ qua | Đạt | [page-content-lifecycle.spec.ts:448](../admin/tests/e2e/page-content-lifecycle.spec.ts#L448) |
| 114 | create, publish, edit, archive and restore a page through the admin UI | Bỏ qua | Đạt | [page-content-lifecycle.spec.ts:700](../admin/tests/e2e/page-content-lifecycle.spec.ts#L700) |
| 115 | two admin sessions cannot silently overwrite the same page content | Bỏ qua | Đạt | [page-content-lifecycle.spec.ts:878](../admin/tests/e2e/page-content-lifecycle.spec.ts#L878) |
| 116 | the content library separates archived records and keeps restore available | Bỏ qua | Đạt | [page-content-lifecycle.spec.ts:923](../admin/tests/e2e/page-content-lifecycle.spec.ts#L923) |
| 117 | product gallery follows the active variant from the first render | Lỗi | Đạt | [productdetail.spec.ts:7](../admin/tests/e2e/productdetail.spec.ts#L7) |
| 118 | switching a product attribute keeps specs and gallery on the same variant | Lỗi | Đạt | [productdetail.spec.ts:43](../admin/tests/e2e/productdetail.spec.ts#L43) |
| 119 | product actions and overview use the available width responsively | Đạt | Đạt | [productdetail.spec.ts:57](../admin/tests/e2e/productdetail.spec.ts#L57) |
| 120 | contact bubble remains available on a product detail page | Đạt | Đạt | [productdetail.spec.ts:85](../admin/tests/e2e/productdetail.spec.ts#L85) |
| 121 | gallery does not cover product configuration controls | Đạt | Đạt | [productDetailLayout.spec.ts:6](../admin/tests/e2e/productDetailLayout.spec.ts#L6) |
| 122 | a variant choice updates the selected configuration | Đạt | Đạt | [productDetailLayout.spec.ts:32](../admin/tests/e2e/productDetailLayout.spec.ts#L32) |
| 123 | gallery thumbnails change the main image and mobile controls stay usable | Đạt | Đạt | [productDetailLayout.spec.ts:45](../admin/tests/e2e/productDetailLayout.spec.ts#L45) |
| 124 | wide product view keeps every variant option clickable beside the gallery | Đạt | Đạt | [productDetailLayout.spec.ts:64](../admin/tests/e2e/productDetailLayout.spec.ts#L64) |
| 125 | changing variant keeps the previous product photo visible while the next one loads | Đạt | Đạt | [productDetailLayout.spec.ts:80](../admin/tests/e2e/productDetailLayout.spec.ts#L80) |
| 126 | a complete published product is ready and exposes every affected destination | Đạt | Đạt | [productreadiness.spec.ts:61](../admin/tests/e2e/productreadiness.spec.ts#L61) |
| 127 | required identity and classification fields use the same hard boundaries as the backend | Đạt | Đạt | [productreadiness.spec.ts:84](../admin/tests/e2e/productreadiness.spec.ts#L84) |
| 128 | text limits accept the exact backend maximum and reject the first value beyond it | Đạt | Đạt | [productreadiness.spec.ts:119](../admin/tests/e2e/productreadiness.spec.ts#L119) |
| 129 | workflow states gate publishing without being mislabeled as broken product data | Đạt | Đạt | [productreadiness.spec.ts:150](../admin/tests/e2e/productreadiness.spec.ts#L150) |
| 130 | archive and soft delete remain recoverable but never public | Đạt | Đạt | [productreadiness.spec.ts:175](../admin/tests/e2e/productreadiness.spec.ts#L175) |
| 131 | missing variants, gallery, documents and SEO are explicit quality warnings rather than invented publish blockers | Đạt | Đạt | [productreadiness.spec.ts:189](../admin/tests/e2e/productreadiness.spec.ts#L189) |
| 132 | existing variants with none public are distinguished from a product with no variants | Đạt | Đạt | [productreadiness.spec.ts:222](../admin/tests/e2e/productreadiness.spec.ts#L222) |
| 133 | a list projection never invents a zero public-variant count when that field was not loaded | Đạt | Đạt | [productreadiness.spec.ts:243](../admin/tests/e2e/productreadiness.spec.ts#L243) |
| 134 | a currently public legacy record stays in the public lane when it only lacks a republish requirement | Đạt | Đạt | [productreadiness.spec.ts:258](../admin/tests/e2e/productreadiness.spec.ts#L258) |
| 135 | optional quality suggestions do not inflate the required-work count shown in the catalogue | Đạt | Đạt | [productreadiness.spec.ts:276](../admin/tests/e2e/productreadiness.spec.ts#L276) |
| 136 | evaluation is deterministic and does not mutate the API records | Đạt | Đạt | [productreadiness.spec.ts:297](../admin/tests/e2e/productreadiness.spec.ts#L297) |
| 137 | business form helpers keep API conversion and validation in one boundary | Đạt | Đạt | [productreadiness.spec.ts:310](../admin/tests/e2e/productreadiness.spec.ts#L310) |
| 138 | variant price validation and status payloads retain their existing rules | Đạt | Đạt | [productreadiness.spec.ts:332](../admin/tests/e2e/productreadiness.spec.ts#L332) |
| 139 | product list navigation preserves supported pagination and rejects invalid URL state | Đạt | Đạt | [productreadiness.spec.ts:356](../admin/tests/e2e/productreadiness.spec.ts#L356) |
| 140 | product return navigation accepts only safe site-relative paths | Đạt | Đạt | [productreadiness.spec.ts:382](../admin/tests/e2e/productreadiness.spec.ts#L382) |
| 141 | the product list presents one compact work surface | Đạt | Đạt | [productworkspace.spec.ts:56](../admin/tests/e2e/productworkspace.spec.ts#L56) |
| 142 | a catalogue completion notice opens the exact section that needs input | Đạt | Đạt | [productworkspace.spec.ts:104](../admin/tests/e2e/productworkspace.spec.ts#L104) |
| 143 | the variant catalogue stays compact and searchable without loading every parent product | Đạt | Đạt | [productworkspace.spec.ts:124](../admin/tests/e2e/productworkspace.spec.ts#L124) |
| 144 | the variant record selects its parent product through bounded search | Đạt | Đạt | [productworkspace.spec.ts:150](../admin/tests/e2e/productworkspace.spec.ts#L150) |
| 145 | the category overview keeps large trees collapsed until an admin opens a branch | Đạt | Đạt | [productworkspace.spec.ts:179](../admin/tests/e2e/productworkspace.spec.ts#L179) |
| 146 | the product detail presents one compact product record instead of a wall of shortcuts | Đạt | Đạt | [productworkspace.spec.ts:204](../admin/tests/e2e/productworkspace.spec.ts#L204) |
| 147 | banner, service and project detail pages own their breadcrumbs without injected CSS | Đạt | Đạt | [productworkspace.spec.ts:322](../admin/tests/e2e/productworkspace.spec.ts#L322) |
| 148 | project case study remains composed from phone to ultrawide screens | Đạt | Đạt | [projectdetail.spec.ts:7](../admin/tests/e2e/projectdetail.spec.ts#L7) |
| 149 | project case study meets automated WCAG checks on desktop and mobile | Đạt | Đạt | [projectdetail.spec.ts:55](../admin/tests/e2e/projectdetail.spec.ts#L55) |
| 150 | catalog pagination keeps the current page at both boundaries | Đạt | Đạt | [publiccatalog.spec.ts:15](../admin/tests/e2e/publiccatalog.spec.ts#L15) |
| 151 | catalog listing keeps the same global header search as other public pages | Đạt | Đạt | [publiccatalog.spec.ts:30](../admin/tests/e2e/publiccatalog.spec.ts#L30) |
| 152 | public header only links to system pages exposed by the managed menu | Chưa chạy | Đạt | [publiccatalog.spec.ts:38](../admin/tests/e2e/publiccatalog.spec.ts#L38) |
| 153 | public favicon uses the configured image route without generic icon metadata | Đạt | Đạt | [publiccatalog.spec.ts:56](../admin/tests/e2e/publiccatalog.spec.ts#L56) |
| 154 | admin preview permits the local admin frame without opening normal pages to framing | Đạt | Đạt | [publiccatalog.spec.ts:67](../admin/tests/e2e/publiccatalog.spec.ts#L67) |
| 155 | catalog category tabs reference a real panel and support keyboard navigation | Đạt | Đạt | [publiccatalog.spec.ts:80](../admin/tests/e2e/publiccatalog.spec.ts#L80) |
| 156 | catalog cards stay compact on phones and fit each desktop breakpoint | Đạt | Đạt | [publiccatalog.spec.ts:99](../admin/tests/e2e/publiccatalog.spec.ts#L99) |
| 157 | product detail tabs fit phones and support Home and End | Đạt | Đạt | [publiccatalog.spec.ts:123](../admin/tests/e2e/publiccatalog.spec.ts#L123) |
| 158 | product explorer meets automated WCAG checks on desktop and mobile | Đạt | Đạt | [publiccatalog.spec.ts:142](../admin/tests/e2e/publiccatalog.spec.ts#L142) |
| 159 | product landing gives the managed banner full width without repeated search | Đạt | Đạt | [publiccatalog.spec.ts:154](../admin/tests/e2e/publiccatalog.spec.ts#L154) |
| 160 | image-only product campaigns fill their frame without cropping artwork on wide screens | Đạt | Đạt | [publiccatalog.spec.ts:191](../admin/tests/e2e/publiccatalog.spec.ts#L191) |
| 161 | mobile product campaign controls sit below the artwork | Đạt | Đạt | [publiccatalog.spec.ts:208](../admin/tests/e2e/publiccatalog.spec.ts#L208) |
| 162 | brand directory hides placeholder copy and renders only public admin data | Đạt | Đạt | [publiccatalog.spec.ts:226](../admin/tests/e2e/publiccatalog.spec.ts#L226) |
| 163 | brand detail uses public linked products to fill the hero without a fabricated banner | Đạt | Đạt | [publiccatalog.spec.ts:246](../admin/tests/e2e/publiccatalog.spec.ts#L246) |
| 164 | brand pages keep navigation within Song Thanh and do not expose source-only outbound links | Đạt | Đạt | [publiccatalog.spec.ts:256](../admin/tests/e2e/publiccatalog.spec.ts#L256) |
| 165 | brand products open the filtered catalog without changing the shared header | Đạt | Đạt | [publiccatalog.spec.ts:267](../admin/tests/e2e/publiccatalog.spec.ts#L267) |
| 166 | mobile catalog keeps one search, removable filters and a working quote action | Đạt | Đạt | [publiccatalog.spec.ts:277](../admin/tests/e2e/publiccatalog.spec.ts#L277) |
| 167 | project case study uses one responsive narrative flow without the legacy side rail | Đạt | Đạt | [publiccatalog.spec.ts:294](../admin/tests/e2e/publiccatalog.spec.ts#L294) |
| 168 | product gallery exposes every published image, including images after the fourth | Đạt | Đạt | [publiccatalog.spec.ts:317](../admin/tests/e2e/publiccatalog.spec.ts#L317) |
| 169 | requesting a quote keeps the customer on the product and opens the selected request | Đạt | Đạt | [publiccatalog.spec.ts:333](../admin/tests/e2e/publiccatalog.spec.ts#L333) |
| 170 | saving a product for a later combined request does not open the quote dialog | Đạt | Đạt | [publiccatalog.spec.ts:357](../admin/tests/e2e/publiccatalog.spec.ts#L357) |
| 171 | the retired quote workspace sends old links back to the product catalog | Đạt | Đạt | [publiccatalog.spec.ts:369](../admin/tests/e2e/publiccatalog.spec.ts#L369) |
| 172 | accepts only explicit whole quantities and normalizes harmless formatting | Đạt | Đạt | [quantityparser.spec.ts:8](../admin/tests/e2e/quantityparser.spec.ts#L8) |
| 173 | never guesses fractions, decimals, units, words, exponents or signed text | Đạt | Đạt | [quantityparser.spec.ts:26](../admin/tests/e2e/quantityparser.spec.ts#L26) |
| 174 | distinguishes missing, below-minimum and above-maximum values | Đạt | Đạt | [quantityparser.spec.ts:45](../admin/tests/e2e/quantityparser.spec.ts#L45) |
| 175 | rejects non-finite and fractional JavaScript numbers without rounding | Đạt | Đạt | [quantityparser.spec.ts:72](../admin/tests/e2e/quantityparser.spec.ts#L72) |
| 176 | quote API keeps legacy clients and stores explicit project interpretation | Đạt | Đạt | [quotecontract.spec.ts:23](../admin/tests/e2e/quotecontract.spec.ts#L23) |
| 177 | the quote form keeps ambiguous quantities visible and blocks submission without guessing | Đạt | Đạt | [quoterequestquantity.spec.ts:12](../admin/tests/e2e/quoterequestquantity.spec.ts#L12) |
| 178 | the product relation picker shows recognizable choices without technical identifiers | Đạt | Đạt | [referencepickers.spec.ts:22](../admin/tests/e2e/referencepickers.spec.ts#L22) |
| 179 | the shared file chooser stays usable on a 320px screen | Đạt | Đạt | [referencepickers.spec.ts:55](../admin/tests/e2e/referencepickers.spec.ts#L55) |
| 180 | the homepage manual picker makes selection order explicit | Đạt | Đạt | [referencepickers.spec.ts:76](../admin/tests/e2e/referencepickers.spec.ts#L76) |
| 181 | gợi ý tìm kiếm không tự che kết quả khi mở danh sách đã lọc | Quá giờ | Đạt | [role-user-journeys.spec.ts:24](../admin/tests/e2e/role-user-journeys.spec.ts#L24) |
| 182 | khách tìm sản phẩm, kiểm tra thông tin và gửi báo giá gắn đúng sản phẩm | Lỗi | Đạt | [role-user-journeys.spec.ts:33](../admin/tests/e2e/role-user-journeys.spec.ts#L33) |
| 183 | khách gửi liên hệ, kinh doanh lọc yêu cầu mới, ghi chú và khép trạng thái | Đạt | Đạt | [role-user-journeys.spec.ts:140](../admin/tests/e2e/role-user-journeys.spec.ts#L140) |
| 184 | nhân viên chỉ xem liên hệ chỉ thấy đúng phần việc, không thể đi vòng qua deep-link hoặc API | Đạt | Đạt | [role-user-journeys.spec.ts:240](../admin/tests/e2e/role-user-journeys.spec.ts#L240) |
| 185 | quản trị sản phẩm tạo bản nháp, thêm biến thể và không thể vô tình xuất bản khi thiếu điều kiện | Đạt | Đạt | [role-user-journeys.spec.ts:339](../admin/tests/e2e/role-user-journeys.spec.ts#L339) |
| 186 | quản lý nhập dữ liệu tải workbook, xác nhận mapping và chỉ tạo dữ liệu tạm để duyệt | Đạt | Đạt | [role-user-journeys.spec.ts:551](../admin/tests/e2e/role-user-journeys.spec.ts#L551) |
| 187 | a delegated role can inspect the permission matrix but cannot edit it | Đạt | Đạt | [rolesWorkspace.spec.ts:24](../admin/tests/e2e/rolesWorkspace.spec.ts#L24) |
| 188 | role permissions begin as compact groups, expand for editing and fit a phone | Đạt | Đạt | [rolesWorkspace.spec.ts:47](../admin/tests/e2e/rolesWorkspace.spec.ts#L47) |
| 189 | saving a role sends exactly the permissions shown in the matrix | Đạt | Đạt | [rolesWorkspace.spec.ts:79](../admin/tests/e2e/rolesWorkspace.spec.ts#L79) |
| 190 | service without a public image uses its real content instead of a generated visual | Đạt | Đạt | [servicedetail.spec.ts:5](../admin/tests/e2e/servicedetail.spec.ts#L5) |
| 191 | one user can select only one role in the account form | Đạt | Đạt | [singleRole.spec.ts:40](../admin/tests/e2e/singleRole.spec.ts#L40) |
| 192 | direct navigation does not expose pages absent from the assigned role | Đạt | Đạt | [singleRole.spec.ts:53](../admin/tests/e2e/singleRole.spec.ts#L53) |
| 193 | a delegated role can read users but cannot see management actions | Đạt | Đạt | [usersWorkspace.spec.ts:80](../admin/tests/e2e/usersWorkspace.spec.ts#L80) |
| 194 | the account list is concise and does not fetch four separate summaries | Đạt | Đạt | [usersWorkspace.spec.ts:88](../admin/tests/e2e/usersWorkspace.spec.ts#L88) |
| 195 | accounts use one readable card layout on desktop and phone | Đạt | Đạt | [usersWorkspace.spec.ts:99](../admin/tests/e2e/usersWorkspace.spec.ts#L99) |
| 196 | the account form chooses one role without a long card list | Đạt | Đạt | [usersWorkspace.spec.ts:109](../admin/tests/e2e/usersWorkspace.spec.ts#L109) |
| 197 | accounts remain readable and actionable at phone width | Đạt | Đạt | [usersWorkspace.spec.ts:120](../admin/tests/e2e/usersWorkspace.spec.ts#L120) |
| 198 | one card action opens account management without a clipped menu | Đạt | Đạt | [usersWorkspace.spec.ts:130](../admin/tests/e2e/usersWorkspace.spec.ts#L130) |
| 199 | search narrows accounts and clearing filters restores the list | Đạt | Đạt | [usersWorkspace.spec.ts:144](../admin/tests/e2e/usersWorkspace.spec.ts#L144) |
| 200 | a failed save stays in the account form with its error | Đạt | Đạt | [usersWorkspace.spec.ts:155](../admin/tests/e2e/usersWorkspace.spec.ts#L155) |
| 201 | account list and editor meet basic accessibility checks | Đạt | Đạt | [usersWorkspace.spec.ts:173](../admin/tests/e2e/usersWorkspace.spec.ts#L173) |
| 202 | website settings save uses a result dialog and does not rewrite an unchanged website link | Chưa chạy | Đạt | [websitesettingssave.spec.ts:6](../admin/tests/e2e/websitesettingssave.spec.ts#L6) |
| 203 | missing social-link permission blocks a changed Website URL before saving settings | Chưa chạy | Đạt | [websitesettingssave.spec.ts:83](../admin/tests/e2e/websitesettingssave.spec.ts#L83) |

Tổng: 203 ca được khai báo trong hai bộ chạy cuối.
