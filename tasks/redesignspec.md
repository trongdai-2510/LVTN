# Dac ta tai thiet ke san pham

> Tai lieu nay duoc tao sau khi nguoi dung xac nhan huong Song Thanh Technical Commerce Workspace. Day la dac ta trien khai cho code/runtime hien tai, khong khoi phuc tai lieu cu trong `docs/`.

## Muc tieu

Chuyen he thong website va quan tri hien tai thanh mot nen tang B2B ky thuat gom bon trai nghiem lien ket:

1. Publishing Control Tower giup bien tap vien biet viec can lam, trang thai duyet, noi public bi anh huong va khac biet truoc/sau khi xuat ban.
2. Product Digital Twin gom san pham, bien the, thong so, hinh anh, tai lieu, thuong hieu, danh muc va trang thai public vao mot workspace co mot owner ro rang.
3. Customer Project Workspace cho khach mo ta nhu cau du an, so sanh san pham, ghi so luong/don vi va gui mot ho so tu van co cau truc.
4. Explainable Assistant chuyen yeu cau tu nhien thanh de xuat co cau truc, dan nguon, bao muc tin cay va khong tu ghi du lieu.

## Nguoi dung

- Bien tap noi dung: can biet noi dung nao can xu ly va thay doi se anh huong dau.
- Quan ly danh muc: can sua san pham, bien the, thong so va tai lieu ma khong mat context.
- Nhan vien kinh doanh: can tiep nhan mot ho so nhu cau ro rang thay vi tin nhan tu do kho phan loai.
- Khach B2B, nha thau va nguoi mua: can tim san pham theo dieu kien ky thuat va gui yeu cau khong bi hieu sai.

## Nguyen tac san pham

- Du lieu co cau truc va runtime hien tai la nguon su that.
- Moi de xuat phai cho biet nguon, anh huong va dieu gi chua chac chan.
- Review status va publish status luon tach biet.
- AI chi de xuat; moi thay doi du lieu va hanh dong xuat ban do nguoi co quyen xac nhan.
- Khong dung mo hinh gio hang, gia giam, ton kho ao hoac urgency cua ecommerce.
- Mot tac vu chi co mot duong chinh; shortcut khong duoc tao them owner nghiep vu.
- Khong nuot loi API thanh empty state.
- Khong dung modal neu inline/progressive disclosure giai quyet tot hon.

## Huong thiet ke

### Canh su dung

Nhan vien Song Thanh lam viec tren man hinh 27 inch trong van phong sang, can kiem tra du lieu nhanh va khong duoc xuat ban nham. Khach hang dung laptop hoac dien thoai tai cong trinh, can hieu thong tin ky thuat ma khong phai hoc cau truc danh muc noi bo.

### Ngon ngu thi giac

- Admin: restrained light product UI, nen trang nga xanh, navy ky thuat, blueprint blue cho action/focus, amber chi cho rui ro co hanh dong.
- Public workspace: technical editorial, dam chat B2B nhung khong ecommerce.
- Uu tien split pane, table, timeline, relationship map va inspector; han che card va khong long card.
- Motion 150-250 ms chi de bao trang thai, reveal context hoac thay doi quan he.
- Typography de doc, so lieu dung tabular figures, focus ring ro, touch target toi thieu 44 px.

## Pham vi chuc nang

### Publishing Control Tower

- Hien thi mot hang doi cong viec gom can bo sung, cho duyet, da duyet, da xuat ban va luu tru.
- Tim kiem va loc bang URL state de co the chia se/deep-link.
- Moi row co loai noi dung, owner, review status, publish status, so van de va thoi diem cap nhat.
- Inspector hien thi noi public bi anh huong, ly do chua san sang va thay doi chinh.
- Editor co action bar co dinh, mot action chinh, cac action con gom theo lifecycle.
- Preview va before/after khong cho phep public data chua duyet bi lo.

### Product Digital Twin

- Mot workspace chi tiet san pham la owner chinh cua bien the va tai lieu gan voi san pham.
- Route danh sach bien the/tai lieu van ton tai nhu man tim kiem toan cuc, nhung mo ban ghi phai dua ve context san pham khi co product group.
- Relationship summary duoc tinh tu du lieu that: brand, category, variants, specs, images, documents, public status.
- Readiness rules la ham thuan, co test va tra ve issue co code, severity, label, source path.
- Khong cho xuat ban neu vi pham dieu kien nghiep vu hien tai; khong tu them dieu kien moi vao backend neu chua co bang chung.
- Inspector cho biet noi public hien co va warning, khong dung diem so trang tri khong giai thich duoc.

### Customer Project Workspace

- Quote request duoc mo rong theo cach additive de giu client cu.
- Ho so gom ten du an, boi canh, cac yeu cau co cau truc, san pham da chon va thong tin lien he.
- Quantity luu raw input, numeric value neu da xac nhan, unit va interpretation state.
- `1/2` va chuoi tuong tu khong duoc tu parse thanh 0.5 hay 1/2 san pham. UI phai yeu cau nguoi dung chon cach hieu.
- Khach co the de `chua xac dinh` thay vi bi ep nhap mot so gia.
- Submit chi thanh cong khi tat ca ambiguity bat buoc da duoc giai quyet.
- Admin quote detail hien project brief, nguon nhap va cac muc can xac nhan.

### Explainable Assistant

- Co provider interface ro rang va deterministic rule engine luon chay duoc khi khong co external key.
- External model la enrichment tuy chon qua bien moi truong; timeout, token cap, rate limit va schema validation bat buoc.
- Output chi gom intent/clarification/suggestion/source/confidence theo allowlist schema.
- Khong dua secret, token, full PII hoac du lieu nguoi khac vao prompt.
- Khong thuc thi SQL, HTML, shell, file path hoac write action tu output model.
- UI khong dung chatbot bubble; suggestion nam ngay trong context cua field/workspace.

## Contract so luong

Trang thai:

- `unspecified`: khach chua biet so luong.
- `confirmed`: numeric value va unit da ro.
- `ambiguous`: raw input co nhieu cach hieu, chua duoc submit.

Quy tac:

- So nguyen duong voi unit `cai`, `bo`, `cuon`, `met` duoc chap nhan theo gioi han database.
- So thap phan chi hop le voi unit cho phep chia nho nhu `met` hoac `cuon`; khong hop le voi `cai`/`bo`.
- Phan so, dau gach, cum `mot hai`, `khoang`, `tam` va text khong chuan phai qua bo phan tich ambiguity.
- Raw input luon duoc giu de nhan vien biet khach da viet gi.
- Backend lap lai validation; client validation khong phai security boundary.

## Bao mat va tin cay

- Trust boundaries: public forms, admin input, file metadata, database, external model output.
- Tat ca input co max length, enum allowlist va payload size cap.
- Public assistant/quote endpoints co throttle; log khong chua full message, phone, email hoac prompt.
- Moi AI response co request id va provider mode, khong log noi dung nhay cam.
- Loi provider khong lam mat quote draft; deterministic validation van hoat dong.
- Migration additive co `down`, index can thiet va khong hard-delete.

## Hieu nang

- Khong tang qua 5% JS build corpus cua route dai dien neu khong co ly do do duoc.
- Relationship/readiness duoc tinh server hoac bang ham thuan memoizable; khong tao request waterfall theo tung variant.
- Danh sach va relation lon co pagination/progressive disclosure.
- External assistant timeout ngan va co cancel; khong chan submit deterministic.
- Sau moi phase chay lai baseline theo cung dieu kien.

## Chien luoc test

- Unit: quantity parser, readiness rules, assistant schema, impact mapping.
- API/integration: backward compatibility quote, invalid/ambiguous input, RBAC, conflict, rate limit va provider failure.
- E2E Chrome: keyboard, focus, responsive 320/768/1024/1440, content publish, product workspace, project brief va submit.
- Visual: screenshot 4 breakpoint cho cac man trong tam.
- Error states: 400/401/403/404/409/422/429/500, timeout, malformed model output, empty/large data.
- Security: dependency audit, header, safe navigation, prompt injection strings va output encoding.

## Quy uoc ma nguon

- File moi dung ten lien chu ASCII: `ProjectWorkspace.tsx`, `quantityParser.ts`, `assistantSchema.ts`.
- Khong dung dau gach noi trong ten file moi; khong dat ten co tu `generated`, `final`, `new`, `v2`, `ai` neu no khong mo ta domain.
- Component tap trung mot job, muc tieu duoi 200 dong; container tach khoi presentation khi co fetch/state phuc tap.
- Khong tao utility cho mot lan dung; khong truu tuong hoa truoc khi co it nhat ba use case.
- Tat ca interface ngoai bien co type va validation.

## Tieu chi hoan thanh

- Tat ca luong hien tai trong QA suite van pass.
- Cac assertion accessibility da fail trong audit deu pass.
- Content, product va project workspace chay voi database QA co lap va du lieu that.
- Moi behavior moi co unit/integration/E2E phu hop, khong skip test.
- Typecheck, build, dead-code gate, dependency audit va runtime log hygiene dat.
- Chrome khong co console error/warning; network request co status/shape dung.
- 320/768/1024/1440 khong overflow, khong che action, keyboard order hop ly.
- AI deterministic mode chay khong can secret; external mode chi bat khi cau hinh du va output dung schema.
- Bao cao cuoi cung liet ke file, contract, migration, test, loi da sua, gioi han con lai va before/after metric.

## Khong lam

- Khong viet lai framework, auth hay database tu dau.
- Khong doi website thanh san thuong mai dien tu.
- Khong de AI tu xuat ban, tu sua database hoac tu gui yeu cau.
- Khong them claim thuong hieu/doi tac/du an khong co du lieu xac minh.
- Khong doi ten hang loat route/file cu chi de dong bo naming.
