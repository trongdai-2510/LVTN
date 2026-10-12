# Ke hoach trien khai Technical Commerce Workspace

> Ke hoach nay thay the checklist audit da hoan thanh. Moi phase de lai he thong o trang thai build/test duoc.

## Quyet dinh kien truc

- Dung entity va workflow hien co lam nen; feature moi la additive va co the rollback.
- Product Digital Twin va Publishing Control Tower duoc lam truoc bang read model/readiness function, tranh migration khong can thiet.
- Customer Project Workspace mo rong quote contract theo cach backward compatible.
- Phase Assistant dang tam gac; khong co endpoint hoac giao dien AI trong runtime cho den khi nguoi dung xac nhan lai pham vi.
- Shared interaction primitives duoc sua truoc de moi man moi dung cung accessibility contract.

## Phase 0: Nen tang an toan

### Task 1: Dialog va focus contract

- Sua modal bao gia va file detail overlay dung shared accessible dialog behavior.
- Acceptance: accessible name, initial focus, focus trap, Escape, restore focus va body lock deu pass.
- Verify: focused Playwright RED/GREEN, Axe khi overlay mo, typecheck admin/frontend.

### Task 2: Form va shell contract

- Sua Field association, required semantics va skip link hai shell.
- Acceptance: error/hint duoc doc theo control; skip link dua focus vao main.
- Verify: focused Playwright + typecheck.

### Task 3: Mobile collision

- Sua floating contact rail va hero pagination/CTA tren 320-390 px.
- Acceptance: khong che card/action, touch target >=44 px, safe area dung.
- Verify: screenshot 320/360/390, overflow/geometry assertions.

### Checkpoint 0

- Focused tests, build va public/admin smoke pass.

## Phase 1: Publishing Control Tower

### Task 4: Content readiness model

- Tao pure model tinh issue, severity, lifecycle lane va impact destinations tu record hien co.
- Acceptance: deterministic, issue co code/source/action, khong nuot error.
- Verify: unit tests bien 0/1/max, status mau thuan, record thieu.

### Task 5: Content queue shell

- Tai cau truc overview thanh queue + filter URL state + inspector, giu permission va action hien co.
- Acceptance: mot primary task, archived separation, loading/empty/error ro.
- Verify: E2E tim/loc/mo inspector va responsive.

### Task 6: Editor lifecycle bar

- Rut gon header, sticky action bar va impact/preview inspector.
- Acceptance: dirty state, review/publish separation, conflict/archive/restore khong doi nghiep vu.
- Verify: page-content lifecycle E2E va keyboard.

### Checkpoint 1

- 50 admin route smoke + page-content suite + screenshot 4 breakpoint pass.

## Phase 2: Product Digital Twin

### Task 7: Product readiness model

- Tao read model cho brand/category/variant/spec/image/document/public state.
- Acceptance: mot request/read path, issue co source/action, khong diem so vo can.
- Verify: unit + product invariant suite.

### Task 8: Product workspace shell

- Thay shortcut lap bang relationship summary, section navigation va impact inspector.
- Acceptance: product la owner chinh, action hierarchy ro, 320 px khong wall-of-shortcuts.
- Verify: product E2E + visual 4 breakpoint.

### Task 9: Variant va document context

- Route toan cuc van tim kiem; mo record co parent dua ve dung product context.
- Acceptance: back navigation va unsaved state khong mat; permission giu nguyen.
- Verify: deep-link/RBAC/E2E.

### Checkpoint 2

- Product invariant, admin routes, typecheck/build va performance comparison pass.

## Phase 3: Customer Project Workspace

### Task 10: Quantity parser RED/GREEN

- Dinh nghia parser va ambiguity cases truoc bang test.
- Acceptance: `1/2`, decimal/unit, unspecified, overflow, unicode va text bay deu deterministic.
- Verify: unit tests.

### Task 11: Additive quote migration va API contract

- Them project context/requirements va quantity fields, giu request cu hop le.
- Acceptance: migration up/down, DB constraints, API validation, audit/PII safe.
- Verify: unit + CRM invariant + contract smoke.

### Task 12: Public project workspace

- Bien quote list thanh inline project brief co ambiguity guard va draft state.
- Acceptance: khong modal cho luong chinh, mobile dung duoc, refresh khong mat draft trong pham vi da dinh.
- Verify: E2E customer journey, network failure recovery, Axe.

### Task 13: Admin project brief

- Hien nhu cau, raw input, interpreted value, unit va unresolved items trong quote detail.
- Acceptance: nhan vien biet chinh xac dieu gi khach viet va dieu gi he thong hieu.
- Verify: admin E2E/RBAC/responsive.

### Checkpoint 3

- End-user smoke, CRM invariants, quote E2E, build va DB audit pass.

## Phase 4: Guided Selection va Assistant (tam gac)

### Task 14: Guided selection model

- De xuat san pham bang rule minh bach tu filter/spec hien co.
- Acceptance: ly do phu hop, thong tin thieu va loai tru deu giai thich duoc.
- Verify: unit tests voi conflict/missing data.

### Task 15: Assistant contract va deterministic provider

- Tao schema intent/clarification/suggestion/source/confidence va local provider.
- Acceptance: chay khong can secret, prompt injection la data, khong write action.
- Verify: schema/security unit tests.

### Task 16: External provider tuy chon

- Them provider qua env, timeout/rate/token cap va fallback.
- Acceptance: malformed/timeout/429/500 khong mat draft; no PII log.
- Verify: fake provider integration + runtime config test.

### Task 17: Contextual assistant UI

- Dua suggestion vao field/product/project inspector, khong chatbot bubble.
- Neu thong so khop o cap bien the, suggestion va ho so phai giu dung product variant; link nguon mo dung model va tab thong so.
- Acceptance: nguoi dung phai chap nhan, co source/confidence, keyboard accessible.
- Verify: E2E accept/reject/failure/responsive.

### Checkpoint 4

- AI abuse cases, project journey, dependency/security audit va load comparison pass.

## Phase 5: Clean code va hardening

### Task 18: Tach hotspot theo boundary da duoc chung minh

- Tach component >200 dong chi khi feature boundary da co test.
- Acceptance: khong doi behavior; naming moi dung lien chu ASCII.
- Verify: characterization tests, dead-code, typecheck/build.

### Task 19: Error/loading/cache/observability

- Phan biet empty va outage, them route boundaries, request id va signal co cau truc.
- Acceptance: khong log secret/PII, retry/action ro, selective caching co freshness rule.
- Verify: dependency failure rehearsal, log hygiene, before/after load.

### Task 20: Full release gate

- Chay full QA, Chrome visual/a11y/network/performance va review P0-P3.
- Acceptance: khong test skip, khong console warning, migration rehearsal pass, report day du.

## Phase 6: UX retrofit theo runtime hien tai

### Task 21: Banner va menu workspace ro ngu canh

- Dong bo bo loc banner voi URL, hien thu tu va do phu anh desktop/mobile, preview dung ca hai breakpoint.
- Hien day du menu trong preview va tang kich thuoc cac nut sap xep/chinh sua.
- Acceptance: deep-link vi tri banner dung sau tai lai; sort order co input va validation; preview khong tu cat muc menu.
- Verify: focused E2E, typecheck va Chrome desktop/mobile.

### Task 22: Tach ba khu vuc trang noi dung theo y dinh cong viec

- Tach can xu ly, trang he thong va thu vien thanh cac view ro rang thay vi xep chong tren mot trang dai.
- Bao toan lane/kind/query tren URL va lifecycle hien co.
- Acceptance: moi view co mot muc tieu chinh, khong lap dieu huong, save/status luon nhin thay khi can.
- Verify: lifecycle E2E, keyboard, mobile va Chrome.

### Task 23: Giam tai thao tac trong cum san pham admin

- Uu tien cong viec thuong dung, gom trang thai lien quan va giam chieu dai/man hinh phai cuon.
- Khong doi API, quyen hoac ba trang thai nghiep vu hien co.
- Acceptance: loc, mo, sua va hieu trang thai san pham khong can doan.
- Verify: product admin smoke, Axe, responsive va Chrome.

### Task 24: Lam gon hanh trinh san pham public

- Gioi han preview san pham tren trang tong quan, cap chieu cao hero, mo rong luoi theo viewport va them phan hoi khi them vao danh sach.
- Acceptance: trang tong quan khong con render 80 san pham; 2K/4K dung khong gian; mobile co CTA ro va khong che noi dung.
- Verify: public E2E, network/image audit, cac breakpoint va Chrome.

### Task 25: UI release gate

- Chay typecheck, focused tests, regression suite lien quan, review code va kiem tra Chrome that.
- Acceptance: khong overflow ngang, target mobile toi thieu 44px, khong console error, URL/back/reload dung, bao cao truoc-sau co bang chung.

## Phase 7: Admin product workspace theo mock da xac nhan

### Task 26: Khoi phuc interaction contract cua mock admin

- Danh sach san pham la mot workspace master-detail: bang la be mat chinh, inspector co dinh ben phai, khong xep card KPI roi day bang xuong duoi.
- Thanh bulk action chi xuat hien khi co lua chon; khong lap nut nguy hiem tren moi hang.
- Luu tru nam trong ngu canh san pham dang chon, noi ro anh huong va kha nang khoi phuc.
- Acceptance: chon row doi inspector, mo ho so mot buoc, bulk bar theo ngu canh, desktop/mobile khong tran ngang.

### Task 27: Dong bo shell va mat do thong tin

- Giam chieu rong sidebar, mo rong workspace tren man hinh lon, giu typography va mau trang thai nhat quan.
- Desktop uu tien bang va inspector; mobile chuyen thanh danh sach gon voi thao tac chinh ro rang.

### Task 28: Dọn dữ liệu kiểm thử sau release gate

- Chỉ xóa bản ghi có dấu vết test rõ ràng sau khi kiểm tra quan hệ phụ thuộc.
- Chạy kiểm thử cuối trước, dọn sau; xác nhận không còn marker test và không tạo orphan.

## Dot kiem tra tiep theo: dong bo noi dung public va quyen so huu du lieu (tam thoi)

Day la pham vi kiem tra theo yeu cau moi, khong phai quyet dinh kien truc hay nguon su that nghiep vu da duoc duyet.

1. Doi chieu tung truong admin voi noi hien thi public. Slice dau: trang thuong hieu, anh chia se/xem truoc khong duoc tu dong bien thanh anh giao dien; noi dung mau/placeholder khong duoc lo ra public. Bao toan banner, logo, link va SEO hien co.
2. Ra soat trang tin chi tiet: bo cot phai/CTA trung lap, giu muc luc co the dung bang ban phim, noi dung va bai lien quan, giao dien dung tone nhat. Kiem tra 390/1440/2560 va khong tran ngang.
3. Lap ma tran cac route noi dung con lai (du an, dich vu, san pham, trang tinh) voi nguon du lieu, quyen sua, preview va CTA; sua theo vertical slice co kiem thu, khong tu them workflow/API.
4. Gate moi slice: regression RED/GREEN, typecheck/build, browser that desktop/mobile, console/network va accessibility; bao cao ro nhung phan con mo.

## Dot 2026-10-06: Quyen tong the va workflow noi dung (ke hoach da duoc nguoi dung xac nhan pham vi)

Nguon quyet dinh la trao doi hien tai va runtime, khong phai docs cu. Moi tai khoan co dung mot vai tro; Super Admin co toan quyen; chi Super Admin duoc tao/sua/khoa tai khoan, tao/sua/luu tru vai tro va cap quyen. Giu nguyen bo quyen mau, ke ca `audit_log.read`. Khong xoa tai khoan hay tu thu hoi quyen da luu. Quyen xem du lieu cua cac vai tro khac van do Super Admin cap.

### Slice A: Ranh gioi quan tri nguoi dung, vai tro va quyen

- Viet regression that bai truoc: vai tro khac du co du `admin_user.*`/`admin_role.*` van bi chan tren tung mutation; Super Admin qua duoc guard. Doi chieu controller va service.
- Dong bo nut thao tac trong Nguoi dung/Vai tro voi chinh sach tren; khong de nut cho phep mot thao tac API cam.
- Gate: unit guard/controller, audit endpoint-role, typecheck API/admin, luong UI vai tro khac va Super Admin. Khong sua du lieu role hien co.

### Slice B: Quyen hieu luc va phien dang nhap

- Kiem tra dung mot vai tro o login, refresh, request va rang buoc DB. Doi chieu quyen hieu luc voi quyen role, Super Admin voi toan catalog.
- Test doi role, thu hoi quyen, khoa tai khoan khi tab con mo; UI khong hien quyen cache cu neu `/auth/me` that bai. Kiem tra menu va tim kiem dieu huong khong dan den trang khong duoc phep.
- Gate: regression RED/GREEN, browser role matrix, khong tao cach nang quyen qua client.

### Slice C: Ma tran workflow tat ca trang noi dung

- Liet ke cac loai noi dung/route admin-preview-public hien co, permission de doc/sua/duyet/xuat ban/an/lưu tru, nguon du lieu va trang thai. Khong gan quy tac trang San pham cho moi trang bang suy dien.
- Moi nhom tim thay lech (vd nhap da public, an bi chan boi readiness, nut UI khac API) duoc xu ly nhu mot vertical slice voi test trang thai truoc/sau va browser admin/website. Khong them schema, endpoint, permission hoac workflow moi khi chua co xac nhan.
- Gate: route public khong lo noi dung chua duoc phep; preview phan anh ban nhap; an khoi website khong phu thuoc dieu kien xuat ban neu runtime tach hai thao tac.

### Slice D: UX cum He thong va danh sach Trang noi dung

- Audit cong viec thuc te, loading/error/empty, focus, mobile va vai tro chi doc truoc khi sua. Dung PRODUCT.md va UI token hien co; thiet ke lai phan danh sach va thao tac theo muc do uu tien, khong che nut bang CSS don thuan.
- Gate: duong viec chinh tren desktop/mobile, keyboard, screen reader, browser console/network sach; khong bien doi workflow khi doi giao dien.

### Checkpoint cuoi dot

- Chay unit, audit ma tran, typecheck/build, focused E2E va manual browser cho tung vai tro co mau quyen; review diff chi trong file lien quan.
- Bao cao ro tung slice hoan thanh va cac lech can nguoi dung quyet dinh. Ke hoach nay khong tu bien thanh dac ta nghiep vu moi.

## Rui ro va giam thieu

| Rui ro | Muc | Giam thieu |
| --- | --- | --- |
| Worktree co hon 100 file dang thay doi | Cao | Khong reset/rename rong; moi task gioi han file va chay gate tap trung. |
| Vision qua rong | Cao | Vertical slice va checkpoint; feature chua xong khong dua vao route chinh. |
| AI output sai/prompt injection | Cao | Schema, allowlist, deterministic fallback, no write authority, source/confidence. |
| Schema quote pha client cu | Cao | Additive fields, default/null safe, contract regression test. |
| Readiness rule thanh nghiep vu tu che | Cao | Chi ma hoa dieu kien hien co; rule moi phai co bang chung/user confirmation. |
| UI wow nhung kho dung | Trung binh | Product register, cognitive-load gate, keyboard/user-task test, no decorative motion. |
| Bundle/admin tang | Trung binh | Measure per checkpoint, lazy-load heavy inspector/editor, revert neutral optimization. |
