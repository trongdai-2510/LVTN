# Checklist trien khai

- [x] Task 1: Dialog va focus contract.
- [x] Task 2: Form va shell contract.
- [x] Task 3: Mobile collision.
- [x] Checkpoint 0: Nen tang an toan.
- [x] Task 4: Content readiness model.
- [x] Task 5: Content queue shell.
- [x] Task 6: Editor lifecycle bar.
- [x] Checkpoint 1: Publishing Control Tower.
- [x] Task 7: Product readiness model.
- [x] Task 8: Product workspace shell.
- [x] Task 9: Variant va document context.
- [x] Checkpoint 2: Product Digital Twin.
- [x] Task 10: Quantity parser.
- [x] Task 11: Quote migration va API contract.
- [x] Task 12: Public project workspace.
- [x] Task 13: Admin project brief.
- [x] Checkpoint 3: Customer Project Workspace.
- [x] Task 14: Guided selection model.
- [ ] Task 15: Assistant contract va deterministic provider (tam gac, chua duoc phep trien khai).
- [ ] Task 16: External provider tuy chon.
- [ ] Task 17: Contextual assistant UI (tam gac, khong hien tren website hien tai).
- [ ] Checkpoint 4: Guided Selection va Assistant.
- [ ] Task 18: Tach hotspot theo boundary.
- [ ] Task 19: Error/loading/cache/observability.
- [ ] Task 20: Full release gate.
- [x] Task 21: Banner va menu workspace ro ngu canh.
- [x] Task 22: Tach ba khu vuc trang noi dung theo y dinh cong viec.
- [x] Task 23: Giam tai thao tac trong cum san pham admin.
- [x] Task 24: Lam gon hanh trinh san pham public tren mobile, desktop va man hinh rong.
- [x] Task 25: UI release gate tren Chrome va cac moc 320/390/768/1024/1440/2560/3840.
- [ ] Task 26: Khoi phuc product workspace master-detail theo mock admin da xac nhan.
- [ ] Task 27: Dong bo admin shell va responsive density.
- [ ] Task 28: Dọn dữ liệu AI/test sau release gate.

## Dot 2026-10-06: Quyen va workflow noi dung

- [x] A1: Test RED va API chi Super Admin mutate Nguoi dung/Vai tro/Quyen; GET van theo quyen doc hien tai.
- [x] A2: Admin an/vo hieu hoa dung cac thao tac mutate cho vai tro khac; test UI va audit role-endpoint.
- [x] Checkpoint A: API/admin typecheck, unit, audit va browser vai tro khac + Super Admin (mocked UI; DB-integrated E2E chua chay vi teardown hard-delete nhan QA tren nhieu bang).
- [ ] B1: Kiem tra mot vai tro, quyen hieu luc va thu hoi phien sau doi role/khoa tai khoan.
- [ ] B2: Fail-closed auth UI, sidebar/mobile/quick nav va action theo quyen; test browser.
- [ ] Checkpoint B: role matrix khong co duong nang quyen hoac menu dan den 403.
- [ ] C1: Lap ma tran runtime admin-preview-public cho tat ca nhom Trang noi dung va module co workflow xuat ban.
- [ ] C2: Sua tung lech duoc chung minh theo slice co test RED/GREEN, khong suy dien quy tac moi.
- [ ] Checkpoint C: nhap/an/xuat ban phan anh dung tren website va preview.
- [ ] D1: Redesign cum He thong sau khi action policy on dinh.
- [ ] D2: Redesign trang dau Trang noi dung sau khi ma tran workflow on dinh.
- [ ] Checkpoint D: browser responsive/keyboard/a11y, build va review diff.

## Quy tac hoan thanh moi task

## Dot dong bo public/admin dang lam (chua hoan thanh tong the)

- [x] Trang thuong hieu public: tach anh chia se/xem truoc khoi anh giao dien; chan placeholder; kiem thu Chrome.
- [x] Tin tuc public: loai cot phai va CTA goi trung/lap o danh sach va chi tiet; giu muc luc, share, bai lien quan; kiem thu responsive/a11y.
- [x] Preview bai tin admin: dung chung bo cuc voi public va khong tao khung anh gia khi khong co anh (kiem thu postMessage nhap).
- [x] Preview trang du an/dich vu: khong lo noi dung ban mau; admin canh bao va dan toi cho sua, khong tu tao publish blocker.
- [x] Chi tiet du an: bo cot tieu de sticky tao khoang trong; doc bai theo mot cot rong, test bo cuc RED/GREEN.
- [x] Doi chieu route danh sach/chi tiet du an va dich vu o 390/1440/2560 px, khong overflow/pageerror; sua loi tuong phan nhan so dich vu.
- [x] Kiem tra biên 320/390/2560/3840 px cho san pham, thuong hieu chi tiet va trang tinh; sua focus drawer, heading va search landmark mobile.
- [ ] Ma tran nguon du lieu va quyen sua cho cac route du an, dich vu, san pham, trang tinh; doi chieu admin-preview-public.
- [ ] Regression va review tap trung, ghi ro nhung pham vi chua xac nhan/chua hoan thanh.

## Quy tac hoan thanh moi task

- Test RED truoc GREEN cho behavior moi/bug fix.
- Typecheck/build va focused test pass sau thay doi.
- Browser-facing change phai xem tren Chrome, console/network sach.
- File moi dung ten lien chu ASCII, khong dau gach noi.
- Khong sua workflow ngoai dac ta va khong ghi de thay doi khong thuoc task.
