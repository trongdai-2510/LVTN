/**
 * Seed: Bài viết tin tức bổ sung — dữ liệu thực từ nguồn chính thức
 * - Cập nhật lại 2 bài từ part1 (QCVN, sự kiện) với số liệu chính xác
 * - Thêm 2 bài mới: Luật Điện lực 2024 + Tiết kiệm điện / Điều chỉnh phụ tải
 */

exports.seed = async function (knex) {
  const categories = await knex('news_category')
    .whereIn('slug', ['ky-thuat', 'tin-tuc', 'su-kien', 'thong-bao'])
    .select('id', 'slug');

  const catId = {};
  for (const c of categories) catId[c.slug] = c.id;

  if (!catId['tin-tuc']) {
    console.warn('[seed] Chưa có chuyên mục news_category. Chạy migration trước.');
    return;
  }

  const articles = [
    // ───────────────────────────────────────────────
    // SỰ KIỆN — CẬP NHẬT với số liệu thực
    // ───────────────────────────────────────────────
    {
      slug: 'lich-trien-lam-nganh-dien-nang-luong-tu-dong-hoa-2026',
      title: 'Lịch triển lãm ngành điện, năng lượng và tự động hóa tại Việt Nam năm 2026',
      excerpt: 'Tổng hợp lịch và thông tin chi tiết các triển lãm quốc tế về thiết bị điện, năng lượng và tự động hóa tại Việt Nam trong năm 2026 — từ Vietnam ETE, MTA Vietnam, Automation World đến VIMF.',
      category: 'su-kien',
      is_featured: false,
      published_at: '2026-05-08T07:00:00.000Z',
      seo_title: 'Lịch triển lãm ngành điện, tự động hóa Việt Nam 2026 | Ngày và địa điểm | Song Thanh',
      seo_description: 'Lịch và thông tin đầy đủ các triển lãm thiết bị điện, năng lượng và tự động hóa 2026: MTA Vietnam (1-4/7), Vietnam ETE (15-17/7), Automation World (9-11/9), VIMF Bình Dương (17-19/6), Bắc Ninh (4-6/11).',
      content_html: `<h2>Tổng quan triển lãm ngành điện và tự động hóa 2026</h2>
<p>Năm 2026 có ít nhất <strong>5 triển lãm quốc tế lớn</strong> về thiết bị điện, năng lượng và tự động hóa công nghiệp tổ chức tại Việt Nam. Đây là cơ hội để kỹ sư điện, nhà thầu, kỹ thuật viên và ban quản lý nhà máy tiếp cận trực tiếp với nhà sản xuất, xem trình diễn thiết bị thực tế và tham gia hội thảo kỹ thuật miễn phí.</p>

<h2>MTA Vietnam 2026 — Cơ khí chính xác & Tự động hóa</h2>
<p><strong>Thời gian:</strong> 1–4 tháng 7 năm 2026 (4 ngày)<br>
<strong>Địa điểm:</strong> SECC — 799 Nguyễn Văn Linh, Tân Mỹ, TP.HCM (Hall A1, A2 &amp; B1)<br>
<strong>Giờ mở cửa:</strong> Theo lịch tham quan chính thức<br>
<strong>Đăng ký:</strong> <a href="https://visit.mtavietnam.com/en" target="_blank" rel="noopener">visit.mtavietnam.com</a> — miễn phí, nhận quà khi đăng ký nhóm</p>
<p><strong>Quy mô:</strong> MTA Vietnam lần thứ 22, với hơn 450 nhà triển lãm từ 21+ quốc gia và vùng lãnh thổ, diện tích 13.200 m², dự kiến trên 13.100 khách tham quan thương mại.</p>
<p><strong>Nội dung:</strong> Máy CNC, thiết bị gia công chính xác, robot và tự động hóa sản xuất, thiết bị đo lường, phần mềm quản lý sản xuất. Phục vụ ngành hàng không vũ trụ, ô tô, điện tử, thiết bị y tế và gia công kim loại.</p>
<p><em>Có xe shuttle miễn phí từ Bình Dương, Đồng Nai, Long An và Bình Phước.</em></p>

<h2>Vietnam ETE & Greenergy Expo 2026 — Thiết bị điện & Năng lượng</h2>
<p><strong>Thời gian:</strong> 15–17 tháng 7 năm 2026 (3 ngày)<br>
<strong>Địa điểm:</strong> SECC — 799 Nguyễn Văn Linh, Quận 7, TP.HCM<br>
<strong>Vào cửa:</strong> Miễn phí (đăng ký trước hoặc tại cổng)<br>
<strong>Website:</strong> <a href="https://vietnam-ete.com.vn" target="_blank" rel="noopener">vietnam-ete.com.vn</a></p>
<p><strong>Quy mô:</strong> Triển lãm quốc tế lớn nhất về thiết bị điện và năng lượng tại Việt Nam, với hàng trăm nhà triển lãm trong nước và quốc tế, kèm hội thảo kỹ thuật và B2B networking.</p>
<p><strong>Nhóm sản phẩm trưng bày:</strong></p>
<ul>
  <li>Thiết bị điện hạ thế và trung thế: MCB, MCCB, ACB, contactor, relay bảo vệ, tủ điện</li>
  <li>Cáp điện, máng cáp và phụ kiện đường dây</li>
  <li>Chiếu sáng công nghiệp: đèn LED nhà xưởng, đèn đường, đèn thông minh</li>
  <li>Năng lượng tái tạo: điện mặt trời mái nhà, hệ thống lưu trữ năng lượng (BESS)</li>
  <li>Hệ thống điện thông minh: Smart Grid, Energy Management System (EMS)</li>
  <li>Thiết bị đo lường điện và bảo vệ hệ thống</li>
</ul>

<h2>VIMF 2026 — Triển lãm Công nghiệp & Sản xuất Việt Nam</h2>
<p>VIMF là chuỗi triển lãm lưu động đến 3 cụm công nghiệp lớn nhất cả nước, phù hợp cho doanh nghiệp không ở TP.HCM hay Hà Nội.</p>
<table>
  <thead>
    <tr><th>Kỳ</th><th>Thời gian</th><th>Địa điểm</th></tr>
  </thead>
  <tbody>
    <tr><td>VIMF Bình Dương (Phía Nam)</td><td>17–19 tháng 6, 2026</td><td>WTC Expo International, TP.HCM</td></tr>
    <tr><td>VIMF Bắc Ninh (Phía Bắc)</td><td>4–6 tháng 11, 2026</td><td>Kinh Bắc Cultural Center, Bắc Ninh</td></tr>
  </tbody>
</table>
<p><em>(Kỳ Hải Phòng 15–17/4/2026 đã diễn ra.)</em></p>
<p>VIMF tập trung vào máy móc sản xuất, linh kiện công nghiệp, tự động hóa cho SME và công nghiệp hỗ trợ. Phù hợp cho nhà máy trong cụm KCN Bình Dương, Đồng Nai, Bắc Ninh, Hải Phòng.</p>

<h2>Automation World Vietnam 2026 — Tự động hóa & Nhà máy thông minh</h2>
<p><strong>Thời gian:</strong> 9–11 tháng 9 năm 2026 (3 ngày, Thứ 4 đến Thứ 6)<br>
<strong>Địa điểm:</strong> VEC Hall 1 — Trung tâm Hội chợ Triển lãm Việt Nam, Hà Nội<br>
<strong>Đặt gian hàng:</strong> 0826 768 468</p>
<p><strong>Quy mô dự kiến:</strong> 175 nhà triển lãm, 350 gian hàng, 10.000 khách tham quan.</p>
<p><strong>6 nhóm chủ đề:</strong></p>
<ul>
  <li><strong>Smart Factory Automation</strong> — PLC, SCADA, DCS, hệ thống điều khiển quá trình</li>
  <li><strong>Smart Vision</strong> — Camera công nghiệp, machine vision, kiểm tra chất lượng tự động</li>
  <li><strong>Smart Robotics &amp; Mobility</strong> — Robot công nghiệp, cobot, AGV/AMR</li>
  <li><strong>Smart Logistics</strong> — Kho thông minh, băng tải tự động, WMS</li>
  <li><strong>Electronics Manufacturing &amp; Smart Components</strong> — Linh kiện điện tử, cảm biến, biến tần</li>
  <li><strong>AI Connect</strong> — AI trong sản xuất, phân tích dữ liệu nhà máy, IIoT</li>
</ul>
<p><em>Kèm theo: Hội thảo kỹ thuật, Business Matching 1:1, Awesome Night networking.</em></p>

<h2>Lợi ích khi tham quan</h2>
<ul>
  <li>Gặp trực tiếp đại diện kỹ thuật từ nhà sản xuất — hỏi kỹ hơn catalogue</li>
  <li>Xem demo thiết bị thực tế: robot, PLC, biến tần chạy thật tại gian hàng</li>
  <li>Tham dự hội thảo kỹ thuật miễn phí kèm theo triển lãm</li>
  <li>Nhận catalogue, sample và báo giá trực tiếp tại chỗ</li>
  <li>So sánh nhiều thương hiệu trong cùng một ngày</li>
</ul>
<p>Song Thanh sẽ cập nhật thông tin tham gia triển lãm của mình tại mục Sự kiện. Liên hệ để biết các ưu đãi dành riêng cho khách hàng của Song Thanh khi tham quan.</p>`
    },

    // ───────────────────────────────────────────────
    // TIN TỨC — CẬP NHẬT với số thông tư thật
    // ───────────────────────────────────────────────
    {
      slug: 'qcvn-25-2025-bct-an-toan-dien-diem-doanh-nghiep-can-quan-tam',
      title: 'QCVN 25:2025/BCT về an toàn điện: những điểm doanh nghiệp sử dụng điện cần quan tâm',
      excerpt: 'Thông tư 41/2025/TT-BCT ngày 22/6/2025 chính thức ban hành QCVN 25:2025/BCT, có hiệu lực từ ngày 8/8/2025 — thay thế Thông tư 39/2020/TT-BCT. Doanh nghiệp có hệ thống điện công nghiệp cần rà soát tuân thủ theo quy chuẩn mới này.',
      category: 'tin-tuc',
      is_featured: false,
      published_at: '2026-05-20T07:00:00.000Z',
      seo_title: 'QCVN 25:2025/BCT — Thông tư 41/2025/TT-BCT an toàn điện | Song Thanh',
      seo_description: 'Thông tư 41/2025/TT-BCT ban hành QCVN 25:2025/BCT, hiệu lực 8/8/2025. Những yêu cầu mới về an toàn điện mà doanh nghiệp và nhà thầu điện cần tuân thủ.',
      content_html: `<h2>Quy chuẩn mới về an toàn điện — QCVN 25:2025/BCT</h2>
<p>Ngày <strong>22 tháng 6 năm 2025</strong>, Bộ Công Thương ban hành <strong>Thông tư số 41/2025/TT-BCT</strong> kèm Quy chuẩn kỹ thuật quốc gia về an toàn điện <strong>QCVN 25:2025/BCT</strong>. Quy chuẩn có <strong>hiệu lực thi hành từ ngày 8 tháng 8 năm 2025</strong> và thay thế toàn bộ Thông tư 39/2020/TT-BCT trước đây.</p>
<p>Đây là văn bản pháp quy quan trọng nhất về an toàn điện trong hơn 5 năm qua, áp dụng bắt buộc cho tất cả tổ chức và cá nhân hoạt động trong lĩnh vực điện tại Việt Nam.</p>

<h2>Phạm vi áp dụng</h2>
<p>QCVN 25:2025/BCT áp dụng cho:</p>
<ul>
  <li>Lắp đặt, vận hành và bảo trì hệ thống điện hạ thế và trung thế</li>
  <li>Thiết bị điện và dây dẫn sử dụng trong công trình dân dụng và công nghiệp</li>
  <li>Biện pháp bảo vệ chống điện giật, chống cháy do điện</li>
  <li>Kiểm tra, thử nghiệm hệ thống điện định kỳ</li>
  <li>Nhà máy, khu công nghiệp, tòa nhà thương mại và cơ sở sản xuất</li>
</ul>

<h2>Những yêu cầu mới đáng chú ý</h2>
<h3>1. Kiểm tra định kỳ — có biên bản lưu hồ sơ</h3>
<p>Doanh nghiệp phải thực hiện kiểm tra, thử nghiệm hệ thống điện theo chu kỳ quy định bởi đơn vị có chứng chỉ năng lực phù hợp. Biên bản kiểm tra phải được lập và lưu hồ sơ, sẵn sàng xuất trình khi cơ quan có thẩm quyền kiểm tra.</p>

<h3>2. Hệ thống tiếp địa — đo điện trở định kỳ</h3>
<p>Điện trở tiếp địa phải được đo định kỳ, đặc biệt sau mùa mưa vì đất khô làm tăng điện trở. Hệ thống chống sét phải được kiểm tra và chứng nhận theo TCVN/IEC 62305. Yêu cầu hồ sơ đo lường và chứng nhận rõ ràng hơn so với quy định cũ.</p>

<h3>3. Thiết bị bảo vệ dòng rò (RCCB/RCBO) — bắt buộc theo khu vực</h3>
<p>Bắt buộc lắp RCCB hoặc RCBO ≤30 mA cho:</p>
<ul>
  <li>Mạch điện trong khu vực ẩm ướt, bể bơi, phòng tắm, nhà vệ sinh</li>
  <li>Ổ cắm ngoài trời hoặc trong khu vực tiếp xúc nước</li>
  <li>Thiết bị điện công suất thấp có vỏ kim loại nối đất</li>
</ul>

<h3>4. Nhãn cảnh báo và biển hiệu an toàn — quy cách tiêu chuẩn</h3>
<p>Tất cả tủ điện, thiết bị điện trung/hạ thế phải có nhãn cảnh báo điện áp nguy hiểm và biển hiệu an toàn theo đúng quy cách: màu sắc, kích thước, vị trí gắn theo tiêu chuẩn ISO 3864 và TCVN tương ứng.</p>

<h3>5. Thay đổi so với Thông tư 39/2020</h3>
<p>Thông tư 41/2025/TT-BCT siết chặt hơn về tài liệu kiểm tra, bổ sung yêu cầu cụ thể cho hệ thống điện trong nhà máy sản xuất có nguy cơ cháy nổ và cập nhật theo các tiêu chuẩn IEC mới nhất.</p>

<h2>Hậu quả của việc không tuân thủ</h2>
<p>Vi phạm QCVN 25:2025/BCT có thể bị:</p>
<ul>
  <li>Xử phạt hành chính từ vài triệu đến hàng trăm triệu đồng</li>
  <li>Đình chỉ hoạt động sản xuất kinh doanh</li>
  <li>Chịu trách nhiệm pháp lý nếu xảy ra tai nạn điện</li>
  <li>Bảo hiểm tài sản từ chối bồi thường nếu hệ thống không đạt tiêu chuẩn</li>
</ul>

<h2>Doanh nghiệp cần làm gì ngay?</h2>
<ul>
  <li>Kiểm tra hồ sơ hệ thống điện: bản vẽ hoàn công, biên bản nghiệm thu còn đầy đủ không?</li>
  <li>Rà soát lịch kiểm tra định kỳ — đặc biệt nếu hệ thống đã lắp đặt từ trước 8/8/2025</li>
  <li>Đánh giá hệ thống tiếp địa và chống sét: đo điện trở nếu chưa đo trong năm</li>
  <li>Kiểm tra RCCB/RCBO tại các khu vực ẩm: có lắp đủ và đúng ngưỡng 30 mA chưa?</li>
  <li>Cập nhật nhãn cảnh báo và biển hiệu an toàn theo quy cách mới</li>
</ul>
<p>Song Thanh cung cấp thiết bị bảo vệ dòng rò (RCCB, RCBO) đúng chuẩn từ LS Electric, CHINT và Schneider. Liên hệ để được hỗ trợ tư vấn nâng cấp hệ thống điện phù hợp QCVN 25:2025/BCT.</p>`
    },

    // ───────────────────────────────────────────────
    // TIN TỨC MỚI — Luật Điện lực 2024
    // ───────────────────────────────────────────────
    {
      slug: 'luat-dien-luc-61-2024-qh15-nhung-dieu-doanh-nghiep-su-dung-dien-can-biet',
      title: 'Luật Điện lực số 61/2024/QH15: những điều doanh nghiệp sử dụng điện lớn cần biết',
      excerpt: 'Luật Điện lực mới (số 61/2024/QH15) được Quốc hội thông qua ngày 30/11/2024, có hiệu lực từ 1/2/2025. Luật mang lại nhiều thay đổi về thị trường điện, giá điện và cơ hội cho doanh nghiệp đầu tư điện mặt trời tự dùng.',
      category: 'tin-tuc',
      is_featured: false,
      published_at: '2026-05-23T07:00:00.000Z',
      seo_title: 'Luật Điện lực 61/2024/QH15: doanh nghiệp cần biết gì? | Song Thanh',
      seo_description: 'Tóm tắt Luật Điện lực số 61/2024/QH15 (hiệu lực 1/2/2025): thay đổi về thị trường điện, cơ chế giá hai thành phần, điện mặt trời tự dùng và quản lý nhu cầu điện cho doanh nghiệp.',
      content_html: `<h2>Luật Điện lực 2024 — thay đổi lớn sau gần 20 năm</h2>
<p>Ngày <strong>30 tháng 11 năm 2024</strong>, tại Kỳ họp thứ 8, Quốc hội khóa XV thông qua <strong>Luật Điện lực số 61/2024/QH15</strong>. Luật có <strong>hiệu lực từ ngày 1 tháng 2 năm 2025</strong>, thay thế Luật Điện lực 2004 và các lần sửa đổi trước đó.</p>
<p>Đây là lần cải cách pháp lý toàn diện nhất trong lĩnh vực điện lực Việt Nam kể từ 2004. Đối với doanh nghiệp sử dụng điện trong sản xuất, có 5 điểm quan trọng cần nắm.</p>

<h2>Điểm 1 — Thị trường điện cạnh tranh: cơ hội mua điện trực tiếp</h2>
<p>Luật mở rộng cơ chế thị trường điện cạnh tranh, cho phép khách hàng sử dụng điện lớn <strong>mua điện trực tiếp từ các nhà sản xuất điện tái tạo</strong> thông qua hợp đồng mua bán điện trực tiếp (DPPA). Doanh nghiệp có thể chủ động đàm phán giá với nhà máy điện gió, điện mặt trời thay vì chỉ mua qua EVN.</p>
<p>Cơ chế này phù hợp đặc biệt cho nhà máy có nhu cầu điện lớn và muốn đảm bảo nguồn điện xanh cho yêu cầu ESG/xuất khẩu.</p>

<h2>Điểm 2 — Cơ chế giá hai thành phần</h2>
<p>Luật bổ sung cơ chế <strong>giá điện hai thành phần</strong> (bipartite tariff): tách riêng phần <em>công suất đặt trước (capacity charge)</em> và phần <em>điện năng tiêu thụ (energy charge)</em>. Mô hình này phổ biến ở nhiều nước và phản ánh đúng hơn chi phí thực của hệ thống điện.</p>
<p>Với giá hai thành phần, doanh nghiệp có hệ số sử dụng công suất thấp (mua nhiều điện vào giờ thấp điểm) sẽ được hưởng lợi, trong khi doanh nghiệp dùng điện tập trung vào giờ cao điểm sẽ chịu chi phí công suất cao hơn. Đây là động lực mạnh để chuyển dịch ca sản xuất.</p>

<h2>Điểm 3 — Điện mặt trời mái nhà tự sản tự tiêu: hành lang pháp lý rõ hơn</h2>
<p>Luật bổ sung toàn bộ quy định về điện năng lượng tái tạo, trong đó có <strong>điện mặt trời mái nhà tự sản xuất, tự tiêu thụ</strong> (không bán lại lưới). Mô hình này được khuyến khích và có hành lang pháp lý rõ ràng hơn để doanh nghiệp triển khai mà không lo vướng thủ tục.</p>
<p>Chỉ thị 10/CT-TTg ngày 30/3/2026 của Thủ tướng Chính phủ cũng tiếp tục nhấn mạnh đẩy mạnh điện mặt trời mái nhà tự dùng trong khu công nghiệp và doanh nghiệp sản xuất.</p>

<h2>Điểm 4 — Quản lý nhu cầu điện (DSM) được luật hóa</h2>
<p>Quản lý nhu cầu phía khách hàng (Demand Side Management — DSM) lần đầu được quy định chính thức trong Luật Điện lực. Doanh nghiệp tiêu thụ điện lớn (từ một ngưỡng nhất định) có <strong>nghĩa vụ tham gia chương trình quản lý nhu cầu điện</strong> theo yêu cầu của cơ quan quản lý nhà nước.</p>
<p>Đây là cơ sở pháp lý cho chương trình Điều chỉnh phụ tải (DR) mà EVN đang triển khai, với lợi ích cho doanh nghiệp tham gia như giảm hóa đơn điện và hỗ trợ đầu tư thiết bị tiết kiệm năng lượng.</p>

<h2>Điểm 5 — An ninh cung cấp điện và xử lý tình huống cấp bách</h2>
<p>Luật bổ sung cơ chế xử lý tình huống cấp bách khi nguồn cung điện bị đe dọa: Bộ trưởng Công Thương có quyền huy động nhà máy điện ngoài kế hoạch và yêu cầu doanh nghiệp giảm tải khẩn cấp. Doanh nghiệp cần có kế hoạch phản ứng với các kịch bản giảm tải đột xuất, đặc biệt khu vực có phụ tải lớn.</p>

<h2>Văn bản hướng dẫn — 29 nghị định và thông tư</h2>
<p>Để Luật có hiệu lực đầy đủ, Chính phủ cần ban hành <strong>29 văn bản hướng dẫn</strong> (nghị định, thông tư). Nhiều văn bản đã được ban hành từ đầu 2025, nhưng doanh nghiệp cần theo dõi cập nhật từ Bộ Công Thương để nắm các quy định chi tiết áp dụng cho ngành và quy mô của mình.</p>

<h2>Tóm tắt — doanh nghiệp nên làm gì?</h2>
<ul>
  <li>Tìm hiểu về cơ chế DPPA nếu doanh nghiệp có nhu cầu điện lớn và muốn mua điện xanh</li>
  <li>Đánh giá khả năng lắp điện mặt trời mái nhà tự dùng: giảm hóa đơn điện và đáp ứng yêu cầu ESG</li>
  <li>Đăng ký tham gia chương trình DR với EVN địa phương: tiết kiệm được từ vài chục đến hàng trăm triệu/năm</li>
  <li>Theo dõi Bộ Công Thương để cập nhật văn bản hướng dẫn chi tiết phù hợp ngành của mình</li>
</ul>
<p>Song Thanh cung cấp thiết bị điện tiêu chuẩn và hỗ trợ tư vấn kỹ thuật cho doanh nghiệp muốn nâng cấp hệ thống điện theo yêu cầu của Luật Điện lực 2024. Liên hệ để được hỗ trợ.</p>`
    },

    // ───────────────────────────────────────────────
    // TIN TỨC MỚI — Tiết kiệm điện / Điều chỉnh phụ tải DR
    // ───────────────────────────────────────────────
    {
      slug: 'chuong-trinh-dieu-chinh-phu-tai-dien-dr-doanh-nghiep-tiet-kiem-duoc-bao-nhieu',
      title: 'Chương trình điều chỉnh phụ tải điện (DR): doanh nghiệp tiết kiệm được bao nhiêu?',
      excerpt: 'Hàng nghìn doanh nghiệp tại Việt Nam đã tham gia chương trình điều chỉnh phụ tải điện (Demand Response) của EVN. Công ty Nhôm Việt Ý tiết kiệm 450 triệu đồng/năm; PECC2 giảm 43% điện năng. Cách đăng ký và lợi ích cụ thể.',
      category: 'tin-tuc',
      is_featured: false,
      published_at: '2026-05-26T07:00:00.000Z',
      seo_title: 'Chương trình DR điều chỉnh phụ tải điện: tiết kiệm bao nhiêu? | Song Thanh',
      seo_description: 'Tìm hiểu chương trình Điều chỉnh phụ tải điện (Demand Response) của EVN: cách đăng ký, lợi ích thực tế, ví dụ doanh nghiệp tiết kiệm 450 triệu đồng/năm và cách tối ưu hóa hệ thống điện nhà máy.',
      content_html: `<h2>Điều chỉnh phụ tải điện (DR) là gì?</h2>
<p>Điều chỉnh phụ tải điện (Demand Response — DR) là chương trình do EVN và các Tổng Công ty Điện lực triển khai, <strong>khuyến khích doanh nghiệp chủ động giảm sử dụng điện trong giờ cao điểm</strong> để góp phần ổn định hệ thống điện quốc gia.</p>
<p>Giờ cao điểm thường từ <strong>9h30–11h30</strong> và <strong>17h00–20h00</strong> các ngày làm việc — đây là thời điểm hệ thống điện chịu áp lực nhất, đặc biệt vào mùa nắng nóng.</p>

<h2>Lợi ích thực tế từ doanh nghiệp đã tham gia</h2>
<h3>Công ty Nhôm Việt Ý — tiết kiệm 450 triệu đồng/năm</h3>
<p>Bằng cách giảm sản lượng điện từ 330.000 kWh xuống 300.000 kWh/tháng (tiết giảm 15% trong giờ cao điểm), Công ty Nhôm Việt Ý <strong>tiết kiệm được khoảng 450 triệu đồng mỗi năm</strong> từ chương trình DR. Kết quả này đạt được mà không ảnh hưởng đáng kể đến sản lượng sản xuất.</p>
<h3>Công ty Cơ Khí Thành Công — điều chỉnh ca sản xuất</h3>
<p>Công ty điều chỉnh thời gian vận hành các máy tiêu thụ điện lớn muộn hơn 30–60 phút, tránh trùng giờ cao điểm. Kết quả: vừa đảm bảo an toàn hệ thống, vừa giảm hóa đơn điện hàng tháng.</p>
<h3>PECC2 — tiết kiệm 43% điện năng</h3>
<p>Trung tâm Đổi mới Sáng tạo PECC2 áp dụng giải pháp thiết kế tòa nhà xanh kết hợp quản lý năng lượng thông minh, đạt mức <strong>tiết kiệm 43%</strong> tổng điện năng tiêu thụ so với tòa nhà tương đương truyền thống.</p>

<h2>Cách đăng ký tham gia chương trình DR</h2>
<p>Quy trình đăng ký tham gia chương trình DR:</p>
<ol>
  <li>Liên hệ <strong>Tổng Công ty Điện lực khu vực</strong> quản lý điểm sử dụng của doanh nghiệp (EVN HCM, EVN Hà Nội, PC tỉnh…)</li>
  <li>Đề xuất cam kết giảm tải: bao nhiêu kW và trong khung giờ nào</li>
  <li>Ký thỏa thuận tham gia DR với đơn vị điện lực</li>
  <li>Lắp đặt hoặc kết nối hệ thống đo đếm phù hợp (nếu cần)</li>
  <li>Nhận hỗ trợ từ EVN: giảm giá điện, hỗ trợ kiểm toán năng lượng hoặc đầu tư thiết bị</li>
</ol>

<h2>Các biện pháp giảm tải phổ biến cho nhà máy</h2>
<h3>1. Dịch chuyển ca sản xuất</h3>
<p>Chuyển các công đoạn tiêu thụ điện lớn (lò nung, máy nén khí, hệ thống điện phân) sang giờ thấp điểm (sau 20h hoặc trước 9h30). Đây là giải pháp đơn giản nhất, không cần đầu tư thêm thiết bị.</p>
<h3>2. Lắp hệ thống lưu trữ năng lượng (BESS)</h3>
<p>Pin lưu trữ nạp điện vào giờ thấp điểm, xả ra dùng trong giờ cao điểm. Phù hợp khi doanh nghiệp không thể thay đổi lịch sản xuất. Chi phí đầu tư ban đầu cao nhưng hoàn vốn trong 3–5 năm.</p>
<h3>3. Điện mặt trời mái nhà tự dùng</h3>
<p>Hệ thống điện mặt trời phát điện vào ban ngày (9h–15h) — trùng với giờ cao điểm buổi sáng. Vừa giảm mua điện lưới giờ cao điểm, vừa đáp ứng yêu cầu ESG/xuất khẩu.</p>
<h3>4. Tối ưu hóa thiết bị tiêu thụ điện lớn</h3>
<p>Lắp biến tần cho bơm, quạt, máy nén khí để giảm tiêu thụ điện khoảng 30–50%. Đây là đầu tư có thời gian hoàn vốn ngắn nhất (1–3 năm).</p>

<h2>Chỉ thị 10/CT-TTg 2026 — tín hiệu từ Chính phủ</h2>
<p>Chỉ thị 10/CT-TTg ngày 30/3/2026 của Thủ tướng Chính phủ tiếp tục nhấn mạnh nhiệm vụ tăng cường tiết kiệm điện và phát triển điện mặt trời mái nhà trong khu công nghiệp. Doanh nghiệp chủ động tham gia sẽ được đánh giá tốt hơn trong các chính sách hỗ trợ và ưu đãi phát triển bền vững.</p>

<h2>Hỗ trợ từ VNEEP — Chương trình tiết kiệm năng lượng quốc gia</h2>
<p>VNEEP (Chương trình quốc gia về sử dụng năng lượng tiết kiệm và hiệu quả) cung cấp miễn phí:</p>
<ul>
  <li>Kiểm toán năng lượng tại nhà máy</li>
  <li>Tài liệu hướng dẫn triển khai hệ thống quản lý năng lượng (EnMS)</li>
  <li>Đào tạo quản lý năng lượng (kỹ sư năng lượng)</li>
  <li>Dự án hỗ trợ đầu tư thiết bị tiết kiệm năng lượng cho SME</li>
</ul>
<p>Trang thông tin: <a href="https://tietkiemnangluong.com.vn" target="_blank" rel="noopener">tietkiemnangluong.com.vn</a> | ĐT: 024.22202358</p>

<h2>Kết luận — bắt đầu từ đâu?</h2>
<p>Doanh nghiệp mới bắt đầu nên ưu tiên:</p>
<ol>
  <li><strong>Kiểm toán năng lượng</strong> để biết thiết bị nào tiêu thụ nhiều nhất</li>
  <li><strong>Lắp biến tần</strong> cho bơm/quạt — hoàn vốn nhanh nhất</li>
  <li><strong>Đăng ký DR</strong> với EVN địa phương — không tốn tiền, giảm ngay hóa đơn</li>
  <li><strong>Đánh giá điện mặt trời mái nhà</strong> — nếu mái đủ diện tích trống</li>
</ol>
<p>Song Thanh cung cấp biến tần, thiết bị đo điện và tư vấn kỹ thuật cho dự án tiết kiệm điện. Liên hệ để được hỗ trợ đánh giá ban đầu miễn phí.</p>`
    }
  ];

  // Xóa bài đã có để tránh duplicate
  const slugs = articles.map((a) => a.slug);
  await knex('page_content').whereIn('slug', slugs).delete();

  const rows = articles.map((a) => ({
    title: a.title,
    slug: a.slug,
    content_type: 'news',
    excerpt: a.excerpt,
    content_html: a.content_html,
    seo_title: a.seo_title,
    seo_description: a.seo_description,
    review_status: 'approved',
    publish_status: 'published',
    is_featured: a.is_featured,
    published_at: new Date(a.published_at),
    news_category_id: catId[a.category] ?? null,
    featured_image_file_id: null
  }));

  await knex('page_content').insert(rows);
  console.log(`[seed] Đã thêm/cập nhật ${rows.length} bài viết (part 2).`);
};
