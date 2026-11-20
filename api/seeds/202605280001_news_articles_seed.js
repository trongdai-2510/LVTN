/**
 * Seed: Bài viết tin tức mẫu — Song Thanh B2B Thiết bị điện công nghiệp
 * Tỷ lệ: 5 Kỹ thuật | 2 Tin tức | 1 Sự kiện
 */

exports.seed = async function (knex) {
  // Xóa bài thông báo cũ (đã loại bỏ khỏi danh sách)
  await knex('page_content')
    .where('slug', 'song-thanh-cap-nhat-kho-hang-thiet-bi-dong-cat-cap-dien-den-led')
    .delete();

  // Lấy ID các chuyên mục
  const categories = await knex('news_category')
    .whereIn('slug', ['ky-thuat', 'tin-tuc', 'su-kien'])
    .select('id', 'slug');

  const catId = {};
  for (const c of categories) catId[c.slug] = c.id;

  if (!catId['ky-thuat']) {
    console.warn('[seed] Chưa có chuyên mục news_category. Chạy migration trước.');
    return;
  }

  const articles = [
    // ───────────────────────────────────────────────
    // KỸ THUẬT 1
    // ───────────────────────────────────────────────
    {
      slug: 'phan-biet-mcb-mccb-acb-rccb-rcbo-trong-he-thong-dien-ha-the',
      title: 'Phân biệt MCB, MCCB, ACB, RCCB, RCBO trong hệ thống điện hạ thế',
      excerpt: 'MCB, MCCB, ACB, RCCB, RCBO — mỗi loại thiết bị đóng cắt có nhiệm vụ và phạm vi ứng dụng khác nhau. Hiểu đúng để chọn đúng, tránh quá tải và đảm bảo an toàn cho hệ thống điện nhà xưởng, tòa nhà và công trình.',
      category: 'ky-thuat',
      is_featured: true,
      published_at: '2026-05-10T07:00:00.000Z',
      seo_title: 'Phân biệt MCB, MCCB, ACB, RCCB, RCBO | Hướng dẫn kỹ thuật | Song Thanh',
      seo_description: 'Tìm hiểu sự khác nhau giữa MCB, MCCB, ACB, RCCB và RCBO. Hướng dẫn chọn đúng loại thiết bị đóng cắt cho hệ thống điện hạ thế nhà xưởng và tòa nhà.',
      content_html: `<h2>Tại sao cần phân biệt các thiết bị đóng cắt?</h2>
<p>Hệ thống điện hạ thế trong nhà xưởng và công trình sử dụng nhiều loại thiết bị đóng cắt khác nhau. Việc chọn sai loại không chỉ gây lãng phí chi phí mà còn tiềm ẩn nguy cơ quá tải, chập điện và hỏa hoạn. Bài viết này giải thích ngắn gọn đặc điểm, công dụng và phạm vi ứng dụng của từng loại.</p>

<h2>MCB — Miniature Circuit Breaker</h2>
<p><strong>MCB</strong> (cầu dao tự động thu nhỏ) là thiết bị đóng cắt phổ biến nhất, dùng bảo vệ quá tải và ngắn mạch cho mạch điện dân dụng và công nghiệp nhỏ.</p>
<ul>
  <li>Dòng điện định mức: 1 A đến 125 A</li>
  <li>Dòng cắt ngắn mạch: 6 kA đến 10 kA (tùy loại)</li>
  <li>Ứng dụng: tủ điện sinh hoạt, văn phòng, xưởng sản xuất nhỏ</li>
</ul>
<p>MCB không có chức năng bảo vệ dòng rò (rò điện ra đất). Nếu cần bảo vệ người dùng trước giật điện, phải ghép thêm RCCB hoặc dùng RCBO.</p>

<h2>MCCB — Moulded Case Circuit Breaker</h2>
<p><strong>MCCB</strong> (cầu dao tự động dạng khối) là bước nâng cấp từ MCB, phù hợp cho hệ thống điện công nghiệp có tải lớn hơn.</p>
<ul>
  <li>Dòng điện định mức: 16 A đến 1600 A</li>
  <li>Dòng cắt ngắn mạch: 18 kA đến 200 kA (tùy loại và nhà sản xuất)</li>
  <li>Ứng dụng: tủ điện tổng nhà xưởng, bảo vệ máy biến áp, đường dây cáp lớn</li>
</ul>
<p>MCCB cho phép chỉnh định dòng cắt (adjustable trip unit), giúp bảo vệ linh hoạt hơn MCB. Khi chọn MCCB cho nhà xưởng, cần xem ba thông số: dòng định mức (In), dòng cắt ngắn mạch (Icu), và loại bảo vệ (TM — nhiệt từ hay điện tử).</p>

<h2>ACB — Air Circuit Breaker</h2>
<p><strong>ACB</strong> (cầu dao không khí) là thiết bị đóng cắt cỡ lớn, dùng cho tủ tổng và đầu nguồn trong các nhà máy, tòa nhà cao tầng hoặc hệ thống phân phối điện quy mô lớn.</p>
<ul>
  <li>Dòng điện định mức: 630 A đến 6300 A</li>
  <li>Dòng cắt ngắn mạch: lên đến 150 kA</li>
  <li>Ứng dụng: tủ đầu nguồn, trạm biến áp hạ áp, hệ thống UPS lớn</li>
</ul>
<p>ACB thường có chức năng lấy ra và đẩy vào (draw-out) để bảo trì không cần cắt toàn bộ hệ thống. Giá thành cao hơn MCCB nhiều lần, chỉ dùng khi thực sự cần dòng lớn.</p>

<h2>RCCB — Residual Current Circuit Breaker</h2>
<p><strong>RCCB</strong> (aptomat chống giật) chỉ bảo vệ dòng rò, không có chức năng cắt quá tải hay ngắn mạch. Phải ghép nối tiếp với MCB hoặc MCCB để bảo vệ đồng thời.</p>
<ul>
  <li>Dòng rò ngưỡng cắt: 10 mA, 30 mA, 100 mA, 300 mA (tùy ứng dụng)</li>
  <li>30 mA: bảo vệ người — dùng cho ổ cắm, chiếu sáng, thiết bị có tiếp xúc nước</li>
  <li>100–300 mA: bảo vệ đám cháy do rò điện</li>
</ul>

<h2>RCBO — Residual Current Breaker with Overcurrent</h2>
<p><strong>RCBO</strong> kết hợp chức năng của MCB và RCCB trong một thiết bị: vừa cắt quá tải/ngắn mạch, vừa cắt dòng rò. Giải pháp gọn nhẹ, tiết kiệm không gian tủ điện.</p>
<ul>
  <li>Thích hợp cho mạch đơn lẻ: phòng tắm, nhà bếp, máy bơm, thiết bị ngoài trời</li>
  <li>Dòng định mức: 6 A đến 63 A</li>
  <li>Dòng rò: 10 mA hoặc 30 mA</li>
</ul>

<h2>Bảng so sánh nhanh</h2>
<table>
  <thead>
    <tr><th>Thiết bị</th><th>Quá tải / Ngắn mạch</th><th>Dòng rò (rò đất)</th><th>Dòng max thông dụng</th></tr>
  </thead>
  <tbody>
    <tr><td>MCB</td><td>✓</td><td>✗</td><td>125 A</td></tr>
    <tr><td>MCCB</td><td>✓</td><td>✗</td><td>1600 A</td></tr>
    <tr><td>ACB</td><td>✓</td><td>Tùy option</td><td>6300 A</td></tr>
    <tr><td>RCCB</td><td>✗</td><td>✓</td><td>125 A</td></tr>
    <tr><td>RCBO</td><td>✓</td><td>✓</td><td>63 A</td></tr>
  </tbody>
</table>

<h2>Tóm tắt cách chọn</h2>
<p>Nguyên tắc đơn giản để chọn thiết bị đóng cắt phù hợp:</p>
<ul>
  <li>Tải nhỏ (dưới 100 A), không cần bảo vệ rò: dùng <strong>MCB</strong></li>
  <li>Tải công nghiệp lớn (trên 100 A): dùng <strong>MCCB</strong></li>
  <li>Đầu nguồn tủ tổng, máy biến áp (trên 630 A): dùng <strong>ACB</strong></li>
  <li>Cần bảo vệ người, khu vực ẩm ướt: thêm <strong>RCCB</strong> hoặc dùng <strong>RCBO</strong></li>
  <li>Mạch đơn cần đơn giản gọn nhẹ: dùng <strong>RCBO</strong></li>
</ul>
<p>Song Thanh cung cấp đầy đủ thiết bị đóng cắt từ các thương hiệu LS Electric, CHINT, Schneider Electric. Liên hệ để được tư vấn chọn đúng sản phẩm theo yêu cầu kỹ thuật của công trình.</p>`
    },

    // ───────────────────────────────────────────────
    // KỸ THUẬT 2
    // ───────────────────────────────────────────────
    {
      slug: 'cach-chon-mccb-cho-tu-dien-nha-xuong-nhung-thong-so-quan-trong',
      title: 'Cách chọn MCCB cho tủ điện nhà xưởng: những thông số quan trọng cần xem',
      excerpt: 'Chọn MCCB không chỉ dựa vào ampe. Dòng cắt ngắn mạch (Icu), loại trip unit, cấp bảo vệ và khả năng phối hợp bảo vệ là những yếu tố quyết định an toàn và tuổi thọ hệ thống điện nhà xưởng.',
      category: 'ky-thuat',
      is_featured: false,
      published_at: '2026-05-12T07:00:00.000Z',
      seo_title: 'Cách chọn MCCB cho tủ điện nhà xưởng | Thông số kỹ thuật | Song Thanh',
      seo_description: 'Hướng dẫn chi tiết cách chọn MCCB (cầu dao tự động khối) cho tủ điện nhà xưởng: dòng định mức, dòng cắt Icu, trip unit nhiệt từ và điện tử.',
      content_html: `<h2>MCCB là gì và tại sao nhà xưởng cần dùng?</h2>
<p>MCCB (Moulded Case Circuit Breaker — cầu dao tự động dạng khối) là thiết bị bảo vệ quá tải và ngắn mạch cho mạch điện công nghiệp có tải trung bình đến lớn. Khác với MCB chỉ đến 125 A, MCCB có thể xử lý dòng từ 16 A đến 1600 A và chịu được dòng ngắn mạch rất cao.</p>
<p>Trong tủ điện nhà xưởng, MCCB thường dùng tại các vị trí:</p>
<ul>
  <li>Đầu nguồn tủ điện phân phối tầng/khu vực</li>
  <li>Bảo vệ mạch cấp điện cho máy móc thiết bị nặng (máy nén khí, máy hàn, động cơ lớn)</li>
  <li>Bảo vệ đường cáp chính từ trạm biến áp xuống tủ tổng</li>
</ul>

<h2>Thông số 1 — Dòng định mức (In)</h2>
<p>Đây là thông số đầu tiên nhưng <strong>không phải thông số duy nhất</strong> cần xem. Dòng định mức phải lớn hơn dòng làm việc cực đại của phụ tải, nhưng không nên chọn quá lớn vì sẽ mất đi khả năng bảo vệ.</p>
<p>Công thức thực tế:</p>
<p><em>In ≥ 1,25 × I_tải_cực_đại</em></p>
<p>Ví dụ: tải 3 pha cộng lại 150 A → chọn MCCB 200 A.</p>

<h2>Thông số 2 — Dòng cắt ngắn mạch (Icu)</h2>
<p><strong>Icu (Ultimate breaking capacity)</strong> là khả năng cắt dòng ngắn mạch lớn nhất mà MCCB có thể chịu được. Đây là thông số quan trọng nhất để đảm bảo an toàn.</p>
<p>Nếu dòng ngắn mạch thực tế tại điểm lắp đặt lớn hơn Icu của MCCB, khi xảy ra sự cố MCCB sẽ bị phá hủy thay vì cắt điện an toàn — nguy cơ hỏa hoạn rất cao.</p>
<p>Cách tính dòng ngắn mạch tại điểm lắp đặt cần dựa vào tổng trở hệ thống hoặc tham khảo kỹ sư điện thiết kế. Tuy nhiên, nguyên tắc thực tế:</p>
<ul>
  <li>Cuối tủ phân phối nhỏ, tải nhẹ: Icu ≥ 10 kA là đủ</li>
  <li>Tủ tổng nhà xưởng nhỏ: Icu ≥ 25 kA</li>
  <li>Gần trạm biến áp hoặc hệ thống mạnh: Icu ≥ 36 kA đến 50 kA</li>
</ul>

<h2>Thông số 3 — Loại Trip Unit (bộ ngắt)</h2>
<p>Trip unit là bộ phận phát lệnh cắt khi có sự cố. Có hai loại chính:</p>
<ul>
  <li><strong>TM (Thermal Magnetic — nhiệt từ)</strong>: Dòng cắt cố định, không điều chỉnh được. Kinh tế, phù hợp cho tải đơn giản ổn định.</li>
  <li><strong>Electronic Trip Unit</strong>: Dòng cắt điều chỉnh được, có thể chỉnh riêng ngưỡng quá tải (Ir) và ngắn mạch (Im). Linh hoạt cho tải phức tạp hoặc hệ thống cần phối hợp bảo vệ chặt chẽ.</li>
</ul>

<h2>Thông số 4 — Cấp bảo vệ IP</h2>
<p>MCCB lắp trong tủ điện tiêu chuẩn không cần IP cao (IP20 là đủ). Tuy nhiên nếu lắp ngoài tủ, gần nước hoặc trong môi trường bụi nhiều, cần MCCB có cấp IP54 hoặc cao hơn, hoặc bổ sung hộp bảo vệ phù hợp.</p>

<h2>Thông số 5 — Khả năng phối hợp bảo vệ (Selective Coordination)</h2>
<p>Trong hệ thống nhiều cấp bảo vệ (tủ tổng → tủ phân phối → tủ máy), khi sự cố xảy ra chỉ nên cắt thiết bị gần sự cố nhất, không cắt toàn bộ hệ thống. Để đạt điều này, MCCB các cấp phải được chọn phối hợp với nhau về dòng cắt và thời gian trễ.</p>

<h2>Sai lầm phổ biến khi chọn MCCB</h2>
<ul>
  <li>Chọn theo ampe mà không kiểm tra Icu → nguy hiểm khi sự cố</li>
  <li>Chọn MCCB giá rẻ không rõ nguồn gốc → thông số thực tế thấp hơn nhãn</li>
  <li>Dùng MCCB quá lớn để "an toàn" → mất tác dụng bảo vệ tải nhỏ hơn</li>
  <li>Không tính đến dòng khởi động của động cơ → MCCB cắt nhầm khi khởi động</li>
</ul>
<p>Liên hệ Song Thanh để được hỗ trợ tra cứu thông số và chọn đúng MCCB cho dự án của bạn.</p>`
    },

    // ───────────────────────────────────────────────
    // KỸ THUẬT 3
    // ───────────────────────────────────────────────
    {
      slug: 'cach-chon-tiet-dien-cap-dien-cho-nha-xuong',
      title: 'Cách chọn tiết diện cáp điện cho nhà xưởng: 5 yếu tố kỹ sư cần kiểm tra',
      excerpt: 'Chọn sai tiết diện cáp là nguyên nhân phổ biến dẫn đến nóng cáp, sụt áp và hỏa hoạn. Bài viết này hướng dẫn 5 yếu tố cần kiểm tra khi chọn cáp điện cho nhà xưởng, khu công nghiệp và công trình dân dụng.',
      category: 'ky-thuat',
      is_featured: false,
      published_at: '2026-05-14T07:00:00.000Z',
      seo_title: 'Cách chọn tiết diện cáp điện nhà xưởng | 5 yếu tố quan trọng | Song Thanh',
      seo_description: 'Hướng dẫn chọn tiết diện cáp điện cho nhà xưởng: khả năng chịu dòng, sụt áp, nhiệt độ môi trường, cách đi cáp và tổng tải.',
      content_html: `<h2>Tại sao việc chọn tiết diện cáp lại quan trọng?</h2>
<p>Cáp điện bị chọn sai tiết diện (quá nhỏ) sẽ phát nhiệt liên tục khi mang tải, dẫn đến già hóa cách điện nhanh, tăng nguy cơ chập điện và hỏa hoạn. Ngược lại, chọn tiết diện quá lớn gây lãng phí chi phí vật liệu đáng kể trong các công trình lớn.</p>

<h2>Yếu tố 1 — Dòng điện làm việc cực đại (I_tải)</h2>
<p>Đây là yếu tố cơ bản nhất. Tiết diện cáp phải đảm bảo khả năng chịu dòng (Iz) lớn hơn dòng tải cực đại với hệ số an toàn:</p>
<p><em>Iz ≥ I_tải × 1,25</em></p>
<p>Bảng tra chuẩn IEC 60364 / TCVN 9207 cho biết khả năng chịu dòng theo tiết diện cáp và cách lắp đặt. Ví dụ: cáp Cu/XLPE 3×16 mm² đi trong ống ngầm đất chịu được khoảng 70–80 A, trong khi cùng tiết diện đi trong không khí thoáng hơn chịu được khoảng 85–95 A.</p>

<h2>Yếu tố 2 — Sụt áp cho phép</h2>
<p>Điện áp tại đầu cuối tải phải đảm bảo trong giới hạn cho phép. TCVN quy định sụt áp từ nguồn đến tải không vượt quá <strong>5%</strong> cho toàn bộ đường dây (nguồn → tủ tổng → tủ phân phối → ổ cắm/thiết bị).</p>
<p>Khi đường cáp dài (trên 50 m), sụt áp thường là yếu tố quyết định tiết diện, không phải dòng tải. Công thức đơn giản:</p>
<p><em>ΔU% = (√3 × L × I × cos φ) / (γ × A × U) × 100</em></p>
<p>Trong đó: L = chiều dài cáp (m), I = dòng tải (A), cos φ = hệ số công suất, γ = độ dẫn điện của đồng (56 m/Ω.mm²), A = tiết diện (mm²).</p>
<p>Công cụ tính sụt áp online hoặc phần mềm như ECalc giúp tính nhanh hơn cho từng mạch.</p>

<h2>Yếu tố 3 — Cách lắp đặt và nhiệt độ môi trường</h2>
<p>Khả năng tản nhiệt của cáp phụ thuộc vào cách lắp đặt:</p>
<ul>
  <li><strong>Đi trong ống nhựa / ống thép ngầm đất</strong>: khả năng tản nhiệt kém nhất, dòng chịu tải giảm khoảng 15–25%</li>
  <li><strong>Đi trong máng cáp, nhiều lớp cáp</strong>: cần nhân hệ số giảm dòng (derating factor) theo số lượng cáp chồng nhau</li>
  <li><strong>Đi trong không khí thoáng, một mình</strong>: khả năng tải tốt nhất</li>
</ul>
<p>Nếu nhiệt độ môi trường cao hơn 30°C (tiêu chuẩn), khả năng chịu dòng của cáp giảm theo hệ số hiệu chỉnh nhiệt độ. Nhà xưởng ở Việt Nam vào mùa hè có thể đạt 40–45°C, cần áp dụng hệ số bù nhiệt khi tính toán.</p>

<h2>Yếu tố 4 — Loại cáp (lõi đồng hay nhôm, CV/CXV/CVV)</h2>
<ul>
  <li><strong>Cáp lõi đồng</strong>: dẫn điện tốt hơn (~56 m/Ω.mm²), uốn dễ, tuổi thọ cao hơn. Chi phí cao hơn nhôm.</li>
  <li><strong>Cáp lõi nhôm</strong>: nhẹ hơn, rẻ hơn. Dùng cho đường dây trung thế và dây nổi. Cần tiết diện lớn hơn đồng khoảng 1,6 lần để cùng khả năng tải.</li>
  <li><strong>CV</strong> (Cu/PVC): phổ biến, dùng cho hạ thế trong nhà và công trình thông thường</li>
  <li><strong>CXV</strong> (Cu/XLPE/PVC): cách điện XLPE chịu nhiệt tốt hơn, dùng cho công trình yêu cầu cao hoặc ngoài trời</li>
  <li><strong>CVV</strong>: có vỏ bảo vệ PVC bên ngoài, đi ngầm đất trực tiếp</li>
  <li><strong>Cáp chống cháy</strong> (Fire Resistant): bắt buộc cho mạch thoát hiểm, báo cháy, chiếu sáng sự cố</li>
</ul>

<h2>Yếu tố 5 — Bảo vệ ngắn mạch phối hợp với cầu dao</h2>
<p>Cáp phải được bảo vệ bởi thiết bị đóng cắt (MCB/MCCB) có dòng định mức không lớn hơn khả năng chịu dòng của cáp. Nếu MCCB 160 A bảo vệ đoạn cáp chỉ chịu được 100 A, cáp sẽ quá nhiệt trước khi MCCB kịp cắt.</p>
<p>Nguyên tắc: <em>Iz_cáp ≥ In_cầu dao</em></p>

<h2>Ví dụ thực tế</h2>
<p>Máy nén khí 3 pha, 380 V, 22 kW, cos φ = 0,85, hiệu suất η = 0,92. Khoảng cách từ tủ điện đến máy: 40 m, lắp trong máng cáp riêng.</p>
<ul>
  <li>I = P / (√3 × U × cos φ × η) = 22000 / (1,732 × 380 × 0,85 × 0,92) ≈ 42 A</li>
  <li>Dòng tải cần chịu: 42 × 1,25 = 52,5 A → Cáp Cu/XLPE 3×10 mm² (Iz ≈ 60 A trong máng)</li>
  <li>Kiểm tra sụt áp 40 m với 42 A → khoảng 2% → đạt yêu cầu</li>
</ul>
<p>Song Thanh cung cấp cáp điện CADIVI, LS-Vina và Trần Phú đủ tiêu chuẩn TCVN. Liên hệ để nhận báo giá theo khối lượng công trình.</p>`
    },

    // ───────────────────────────────────────────────
    // KỸ THUẬT 4
    // ───────────────────────────────────────────────
    {
      slug: 'cach-chon-bien-tan-cho-bom-quat-trong-nha-may',
      title: 'Cách chọn biến tần cho bơm và quạt trong nhà máy',
      excerpt: 'Biến tần giúp tiết kiệm điện đáng kể cho bơm và quạt bằng cách điều chỉnh tốc độ theo nhu cầu thực tế. Bài viết hướng dẫn các thông số cần nắm và cách chọn biến tần phù hợp.',
      category: 'ky-thuat',
      is_featured: false,
      published_at: '2026-05-16T07:00:00.000Z',
      seo_title: 'Cách chọn biến tần cho bơm quạt nhà máy | Tiết kiệm điện | Song Thanh',
      seo_description: 'Hướng dẫn chọn biến tần (VFD/inverter) cho bơm nước và quạt thông gió: công suất, dòng tải, loại tải, chế độ điều khiển và tính năng bảo vệ.',
      content_html: `<h2>Tại sao nên dùng biến tần cho bơm và quạt?</h2>
<p>Bơm và quạt là hai loại tải <strong>tiêu thụ điện lớn nhất</strong> trong nhà máy, chiếm 20–40% tổng hóa đơn điện. Hầu hết bơm và quạt được thiết kế cho công suất cực đại nhưng thực tế chạy non tải phần lớn thời gian. Dùng biến tần để điều chỉnh tốc độ theo nhu cầu thực giúp tiết kiệm năng lượng rất đáng kể nhờ <strong>quy luật lũy thừa</strong>: công suất tiêu thụ tỷ lệ với lũy thừa 3 của tốc độ.</p>
<p>Ví dụ: giảm tốc độ bơm xuống 80% → công suất giảm còn 51% (0,8³ = 0,512). Tiết kiệm gần 50% điện.</p>

<h2>Thông số 1 — Công suất và dòng tải động cơ</h2>
<p>Biến tần phải có công suất định mức bằng hoặc lớn hơn công suất động cơ. Cần dùng thông số <strong>dòng điện định mức</strong> (A) để đối chiếu chính xác, vì biến tần và động cơ từ các hãng khác nhau có thể có hệ số công suất khác nhau.</p>
<p>Nguyên tắc: <em>I_biến_tần ≥ I_động_cơ × 1,1</em> (hệ số an toàn 10%)</p>

<h2>Thông số 2 — Loại tải (Bơm/quạt vs Tải nặng)</h2>
<p>Biến tần có hai loại chính:</p>
<ul>
  <li><strong>Loại Normal Duty (ND)</strong>: tải bơm, quạt — mômen khởi động thấp, quá tải ngắn hạn 110% trong 60 giây</li>
  <li><strong>Loại Heavy Duty (HD)</strong>: máy nén, băng tải, cần trục — mômen khởi động cao, quá tải 150% trong 60 giây</li>
</ul>
<p>Bơm và quạt phù hợp với loại <strong>Normal Duty</strong>. Chọn nhầm Heavy Duty không sai, nhưng sẽ tốn tiền hơn không cần thiết.</p>

<h2>Thông số 3 — Chế độ điều khiển</h2>
<ul>
  <li><strong>V/f (Scalar)</strong>: đơn giản, phù hợp bơm quạt tải nhẹ. Không cần encoder.</li>
  <li><strong>Vector không cảm biến (Sensorless Vector)</strong>: điều khiển chính xác hơn, phù hợp bơm cần áp suất ổn định.</li>
  <li><strong>Closed-loop Vector</strong>: cần encoder, dùng khi yêu cầu điều khiển tốc độ và mômen rất chính xác (không cần cho bơm/quạt thông thường).</li>
</ul>

<h2>Thông số 4 — Tính năng bơm tích hợp</h2>
<p>Các biến tần hiện đại cho bơm thường có sẵn:</p>
<ul>
  <li><strong>PID controller</strong> tích hợp: tự động duy trì áp suất, lưu lượng ổn định theo setpoint từ cảm biến</li>
  <li><strong>Chế độ ngủ/thức (Sleep/Wake)</strong>: tự tắt biến tần khi không có nhu cầu, tiết kiệm thêm điện chờ</li>
  <li><strong>Bảo vệ chạy khô</strong>: phát hiện thiếu nước, bảo vệ bơm tự động</li>
  <li><strong>Soft-fill</strong>: khởi động chậm để tránh búa thủy lực trong đường ống</li>
</ul>

<h2>Thông số 5 — Môi trường lắp đặt</h2>
<ul>
  <li>Nhiệt độ môi trường: tiêu chuẩn 40°C. Trên 40°C cần giảm tải (derating) hoặc chọn biến tần cấp cao hơn.</li>
  <li>Độ ẩm và bụi: nhà xưởng bụi nhiều cần biến tần IP54 hoặc lắp trong tủ có điều hòa/làm mát riêng.</li>
  <li>Nhiễu điện từ: lắp bộ lọc EMC đầu vào nếu cùng mạch điện với thiết bị nhạy cảm (PLC, cảm biến).</li>
</ul>

<h2>Thương hiệu biến tần phổ biến tại Việt Nam</h2>
<p>Tùy ngân sách và yêu cầu kỹ thuật:</p>
<ul>
  <li><strong>Mitsubishi Electric FR-D700/F800</strong>: chất lượng cao, hỗ trợ kỹ thuật tốt, phổ biến trong sản xuất</li>
  <li><strong>Siemens Sinamics G120/G130</strong>: tích hợp tốt với hệ thống Siemens, phù hợp dây chuyền tự động hóa</li>
  <li><strong>LS Electric iS7/iP5A</strong>: cân bằng giá/chất lượng tốt, bảo hành và hỗ trợ địa phương mạnh</li>
</ul>
<p>Song Thanh tư vấn và cung cấp biến tần phù hợp cho từng ứng dụng. Liên hệ để nhận báo giá và hỗ trợ kỹ thuật.</p>`
    },

    // ───────────────────────────────────────────────
    // KỸ THUẬT 5
    // ───────────────────────────────────────────────
    {
      slug: 'chon-den-led-highbay-cho-nha-xuong-lumen-ip-goc-chieu',
      title: 'Chọn đèn LED highbay cho nhà xưởng: lumen, IP, góc chiếu và nhiệt độ màu',
      excerpt: 'Chiếu sáng nhà xưởng ảnh hưởng trực tiếp đến năng suất lao động và chi phí điện. Bài viết giải thích các thông số quan trọng khi chọn đèn LED highbay: quang thông, hiệu suất, IP, góc chiếu và nhiệt độ màu.',
      category: 'ky-thuat',
      is_featured: false,
      published_at: '2026-05-18T07:00:00.000Z',
      seo_title: 'Chọn đèn LED highbay nhà xưởng: lumen, IP, góc chiếu | Song Thanh',
      seo_description: 'Hướng dẫn chọn đèn LED highbay cho nhà xưởng và nhà kho: lumen, hiệu suất lm/W, cấp bảo vệ IP, góc chiếu và nhiệt độ màu phù hợp cho từng khu vực.',
      content_html: `<h2>Tại sao cần chọn kỹ đèn LED cho nhà xưởng?</h2>
<p>Chiếu sáng nhà xưởng chiếm 15–25% tổng tiêu thụ điện của nhà máy. Chọn đèn LED highbay đúng thông số không chỉ tiết kiệm điện so với đèn metal halide hay huỳnh quang truyền thống (tiết kiệm 50–70%) mà còn đảm bảo độ rọi đồng đều, giảm lỗi sản phẩm và tăng năng suất lao động.</p>

<h2>Thông số 1 — Quang thông (lumen) và hiệu suất (lm/W)</h2>
<p><strong>Lumen (lm)</strong> là tổng lượng ánh sáng đèn phát ra. Không nên so sánh đèn theo watt vì cùng công suất nhưng hiệu suất khác nhau sẽ cho ánh sáng rất khác nhau.</p>
<p>Chỉ số cần quan tâm là <strong>lm/W (hiệu suất phát quang)</strong>:</p>
<ul>
  <li>Đèn LED phổ thông: 100–130 lm/W</li>
  <li>Đèn LED chất lượng tốt: 140–160 lm/W</li>
  <li>Đèn LED cao cấp: trên 170 lm/W</li>
</ul>
<p>Ví dụ: đèn 100W, 150 lm/W sẽ sáng hơn đèn 100W, 100 lm/W tới 50%. Luôn so sánh lm/W, không chỉ watt.</p>

<h2>Thông số 2 — Độ rọi yêu cầu (Lux)</h2>
<p>Tiêu chuẩn TCVN 7114 quy định mức độ rọi tối thiểu theo loại công việc:</p>
<ul>
  <li>Kho chứa hàng, lối đi: 100–200 lux</li>
  <li>Sản xuất thông thường (lắp ráp, gia công): 300–500 lux</li>
  <li>Kiểm tra chất lượng, công việc chi tiết: 750–1000 lux</li>
</ul>
<p>Để tính số lượng đèn cần thiết theo diện tích và chiều cao trần, cần dùng phần mềm DIALux hoặc nhờ đơn vị chiếu sáng tính toán photometric.</p>

<h2>Thông số 3 — Cấp bảo vệ IP</h2>
<p>IP (Ingress Protection) cho biết khả năng chống bụi và nước:</p>
<ul>
  <li><strong>IP65</strong>: chống bụi hoàn toàn, chịu được tia nước phun. Phù hợp cho đa số nhà xưởng sản xuất.</li>
  <li><strong>IP66</strong>: chống nước áp lực mạnh. Dùng cho khu vực rửa xe, vệ sinh áp lực cao.</li>
  <li><strong>IP67/IP68</strong>: chịu ngâm nước. Dùng cho hầm, cống, khu vực ngập tràn.</li>
</ul>
<p>Trong nhà xưởng bình thường khô ráo, IP65 là đủ và phổ biến nhất.</p>

<h2>Thông số 4 — Góc chiếu (Beam Angle)</h2>
<p>Góc chiếu quyết định phân bố ánh sáng trên diện tích chiếu:</p>
<ul>
  <li><strong>60° hoặc hẹp hơn</strong>: tập trung sáng mạnh ở điểm ngay dưới đèn. Dùng cho nhà xưởng trần cao (trên 8m), kho rack cao.</li>
  <li><strong>90°–120°</strong>: phân bố đều, phù hợp đa số nhà xưởng chiều cao 5–8m.</li>
  <li><strong>Trên 120°</strong>: chiếu rộng, dùng cho không gian thấp hoặc cần trải đều ánh sáng.</li>
</ul>
<p>Nguyên tắc: trần càng cao thì nên chọn góc chiếu càng hẹp để đảm bảo đủ lux tại sàn.</p>

<h2>Thông số 5 — Nhiệt độ màu (CCT)</h2>
<ul>
  <li><strong>3000K (trắng ấm)</strong>: ánh sáng vàng nhẹ, ít dùng trong công nghiệp</li>
  <li><strong>4000K (trắng trung tính)</strong>: phù hợp cho văn phòng trong xưởng, khu vực nghỉ ngơi</li>
  <li><strong>5000K–6500K (trắng lạnh/ban ngày)</strong>: phổ biến nhất cho nhà xưởng sản xuất, kiểm tra chất lượng, kho. Giúp công nhân tỉnh táo, phân biệt màu sắc tốt hơn.</li>
</ul>

<h2>Thông số 6 — Chỉ số hoàn màu CRI</h2>
<p>CRI (Color Rendering Index) đánh giá khả năng hiển thị màu sắc thật của đèn. CRI ≥ 80 là đủ cho đa số nhà xưởng. CRI ≥ 90 cần cho kiểm tra màu sắc sản phẩm (ngành dệt may, in ấn, sơn).</p>

<h2>Tuổi thọ và bảo hành</h2>
<p>Đèn LED chất lượng có tuổi thọ L70 ≥ 50.000 giờ (quang thông còn 70% sau 50.000 giờ). Rạng Đông và Duhal — hai thương hiệu Việt Nam uy tín — đều công bố tuổi thọ và bảo hành rõ ràng. Chọn đèn có nhãn hiệu rõ ràng, có công bố thông số quang học kiểm định độc lập.</p>
<p>Song Thanh cung cấp đèn LED highbay Rạng Đông và Duhal. Liên hệ để được tư vấn và thiết kế chiếu sáng phù hợp cho nhà xưởng của bạn.</p>`
    },

    // ───────────────────────────────────────────────
    // TIN TỨC 1
    // ───────────────────────────────────────────────
    {
      slug: 'qcvn-25-2025-bct-an-toan-dien-diem-doanh-nghiep-can-quan-tam',
      title: 'QCVN 25:2025/BCT về an toàn điện: những điểm doanh nghiệp sử dụng điện cần quan tâm',
      excerpt: 'Bộ Công Thương ban hành QCVN 25:2025/BCT — quy chuẩn kỹ thuật quốc gia về an toàn điện, thay thế nhiều quy định cũ. Doanh nghiệp có hệ thống điện công nghiệp cần nắm rõ các yêu cầu mới để đảm bảo tuân thủ và an toàn.',
      category: 'tin-tuc',
      is_featured: false,
      published_at: '2026-05-20T07:00:00.000Z',
      seo_title: 'QCVN 25:2025/BCT an toàn điện: doanh nghiệp cần quan tâm gì? | Song Thanh',
      seo_description: 'Tổng hợp những điểm quan trọng trong QCVN 25:2025/BCT về an toàn điện: yêu cầu kiểm tra thiết bị, bảo trì hệ thống điện nhà xưởng, tiêu chuẩn an toàn bắt buộc.',
      content_html: `<h2>QCVN 25:2025/BCT là gì?</h2>
<p>QCVN 25:2025/BCT là Quy chuẩn kỹ thuật quốc gia về an toàn điện, do Bộ Công Thương ban hành năm 2025 để thay thế các quy định trước đó. Quy chuẩn này áp dụng cho <strong>tất cả tổ chức, cá nhân sản xuất, kinh doanh, sử dụng điện</strong> tại Việt Nam, bao gồm nhà máy, khu công nghiệp, tòa nhà thương mại và các cơ sở sản xuất.</p>

<h2>Phạm vi áp dụng chính</h2>
<p>QCVN 25:2025/BCT quy định yêu cầu an toàn điện cho:</p>
<ul>
  <li>Lắp đặt, vận hành và bảo trì hệ thống điện hạ thế và trung thế</li>
  <li>Thiết bị điện và dây dẫn sử dụng trong công trình</li>
  <li>Biện pháp bảo vệ chống điện giật, chống cháy do điện</li>
  <li>Kiểm tra, thử nghiệm hệ thống điện định kỳ</li>
</ul>

<h2>Yêu cầu mới đáng chú ý đối với nhà máy</h2>
<h3>1. Kiểm tra định kỳ hệ thống điện</h3>
<p>Doanh nghiệp phải thực hiện kiểm tra, thử nghiệm hệ thống điện theo chu kỳ quy định. Với hệ thống điện công nghiệp, kiểm tra định kỳ phải được thực hiện bởi đơn vị có chứng chỉ năng lực phù hợp và lập biên bản kiểm tra lưu hồ sơ.</p>

<h3>2. Tiếp địa và chống sét</h3>
<p>Quy chuẩn siết chặt yêu cầu về hệ thống tiếp địa: điện trở tiếp địa phải đo định kỳ, đặc biệt sau mùa mưa. Hệ thống chống sét phải được kiểm tra và chứng nhận định kỳ theo TCVN/IEC 62305.</p>

<h3>3. Thiết bị bảo vệ dòng rò (RCCB/RCBO)</h3>
<p>Bắt buộc lắp thiết bị bảo vệ dòng rò cho các mạch điện trong khu vực ẩm ướt, bể bơi, nhà tắm, phòng vệ sinh và các khu vực có nguy cơ giật điện cao. Ngưỡng 30 mA cho bảo vệ cá nhân.</p>

<h3>4. Nhãn cảnh báo và biển hiệu an toàn</h3>
<p>Tất cả tủ điện, thiết bị điện trung/hạ thế đều phải có nhãn cảnh báo điện áp nguy hiểm, biển hiệu "Cấm vào nếu không có phép", "Nguy hiểm — điện cao thế" theo quy cách tiêu chuẩn.</p>

<h2>Hậu quả của việc không tuân thủ</h2>
<p>Theo quy định hiện hành, vi phạm quy chuẩn an toàn điện có thể bị xử phạt hành chính từ vài triệu đến hàng trăm triệu đồng, đình chỉ hoạt động, hoặc chịu trách nhiệm pháp lý nếu xảy ra tai nạn. Ngoài ra, bảo hiểm tài sản có thể từ chối bồi thường nếu hệ thống điện không đáp ứng tiêu chuẩn.</p>

<h2>Doanh nghiệp nên làm gì ngay?</h2>
<ul>
  <li>Kiểm tra lại hồ sơ hệ thống điện: có đầy đủ bản vẽ hoàn công, biên bản nghiệm thu không?</li>
  <li>Rà soát lịch bảo trì và kiểm tra định kỳ: còn hạn không?</li>
  <li>Kiểm tra hệ thống tiếp địa và chống sét trước mùa mưa</li>
  <li>Đánh giá lại hệ thống bảo vệ dòng rò tại các khu vực ẩm</li>
  <li>Cập nhật nhãn cảnh báo và biển hiệu an toàn</li>
</ul>
<p>Song Thanh cung cấp thiết bị điện đạt tiêu chuẩn và hỗ trợ tư vấn kỹ thuật cho doanh nghiệp muốn nâng cấp hệ thống điện phù hợp QCVN 25:2025/BCT. Liên hệ để được hỗ trợ.</p>`
    },

    // ───────────────────────────────────────────────
    // TIN TỨC 2
    // ───────────────────────────────────────────────
    {
      slug: 'nha-may-can-kiem-tra-gi-truoc-mua-cao-diem-dien',
      title: 'Nhà máy cần kiểm tra gì để tránh quá tải điện trong mùa cao điểm?',
      excerpt: 'Mùa nắng nóng từ tháng 4 đến tháng 7 là thời điểm hệ thống điện nhà máy chịu áp lực cao nhất. Danh sách kiểm tra giúp bộ phận kỹ thuật chủ động phòng ngừa sự cố trước khi xảy ra.',
      category: 'tin-tuc',
      is_featured: false,
      published_at: '2026-05-22T07:00:00.000Z',
      seo_title: 'Kiểm tra hệ thống điện nhà máy trước mùa cao điểm | Song Thanh',
      seo_description: 'Danh sách kiểm tra hệ thống điện nhà máy trước mùa nắng nóng: thiết bị đóng cắt, cáp điện, máy biến áp, hệ thống làm mát tủ điện và chương trình điều chỉnh phụ tải.',
      content_html: `<h2>Vì sao mùa cao điểm là rủi ro với hệ thống điện nhà máy?</h2>
<p>Mùa nắng nóng (tháng 4–7) kéo theo nhu cầu làm mát tăng mạnh, nhiệt độ môi trường cao và phụ tải điện cả hệ thống tăng đột biến. Đây là thời điểm nhiều sự cố điện nhất trong năm: cháy cáp, trip MCCB/ACB, quá nhiệt máy biến áp, sụt áp cục bộ và mất điện cục bộ.</p>
<p>EVN thường kêu gọi doanh nghiệp điều chỉnh phụ tải (DR — Demand Response) trong giờ cao điểm (9h30–11h30 và 17h–20h). Nhà máy chuẩn bị tốt sẽ vừa tránh được sự cố, vừa có thể tham gia chương trình DR để nhận hỗ trợ từ EVN.</p>

<h2>Danh sách kiểm tra — Trước mùa cao điểm</h2>
<h3>1. Máy biến áp</h3>
<ul>
  <li>Kiểm tra nhiệt độ cuộn dây và dầu cách điện (nếu biến áp dầu)</li>
  <li>Kiểm tra quạt làm mát tự động — chạy thử, vệ sinh cánh quạt và vỏ tản nhiệt</li>
  <li>Vệ sinh lưới thông gió, kiểm tra xem có vật cản xung quanh không</li>
  <li>Đọc và ghi lại thông số phụ tải hiện tại (% so với định mức)</li>
</ul>

<h3>2. Tủ điện tổng và phân phối</h3>
<ul>
  <li>Đo nhiệt độ các điểm đấu nối bằng súng nhiệt hồng ngoại — phát hiện điểm nóng bất thường (trên 60°C cần kiểm tra lại tiếp xúc)</li>
  <li>Kiểm tra quạt và bộ điều nhiệt tủ điện — thay quạt nếu cần</li>
  <li>Vệ sinh bụi trong tủ (đặc biệt tủ ở khu vực xưởng nhiều bụi)</li>
  <li>Kiểm tra khớp nối và đấu dây đầu cáp — siết lại nếu lỏng</li>
</ul>

<h3>3. Hệ thống cáp và thanh cái</h3>
<ul>
  <li>Kiểm tra trực quan cáp dọc theo máng: phát hiện vỏ cháy sém, biến dạng, bị kẹp cơ học</li>
  <li>Đo nhiệt độ thanh cái bằng camera nhiệt nếu có — nhiệt độ trên 70°C là dấu hiệu cần xử lý</li>
  <li>Kiểm tra lại tải trên từng mạch so với dung lượng cáp — nếu đã lắp thêm thiết bị mới, cần tính lại</li>
</ul>

<h3>4. Thiết bị đóng cắt (MCB, MCCB, ACB)</h3>
<ul>
  <li>Thử nghiệm cơ cấu đóng cắt: đóng/cắt thử xem có trơn tru không</li>
  <li>Kiểm tra mức dòng cài đặt: có còn phù hợp với tải hiện tại không?</li>
  <li>ACB: kiểm tra bộ nạp lò xo, tiếp điểm và hệ thống trip thử nghiệm (nếu có)</li>
</ul>

<h3>5. Hệ thống tiếp địa</h3>
<ul>
  <li>Đo điện trở tiếp địa — mùa khô nóng thường làm tăng điện trở đất, cần đạt ≤4 Ω (hoặc theo thiết kế)</li>
  <li>Kiểm tra cọc tiếp địa không bị ăn mòn quá mức</li>
</ul>

<h3>6. UPS và nguồn dự phòng</h3>
<ul>
  <li>Kiểm tra dung lượng và thời gian lưu điện thực tế của UPS</li>
  <li>Thử nghiệm tự động chuyển nguồn (ATS) nếu có máy phát</li>
  <li>Kiểm tra acquy UPS — acquy già sẽ mất dung lượng trong điều kiện nhiệt cao</li>
</ul>

<h2>Tham gia chương trình điều chỉnh phụ tải (DR)</h2>
<p>EVN và các Tổng Công ty Điện lực có chương trình hỗ trợ doanh nghiệp giảm tải trong giờ cao điểm. Nhà máy đăng ký tham gia sẽ nhận được hỗ trợ kỹ thuật và có thể được giảm giá điện hoặc hỗ trợ đầu tư thiết bị tiết kiệm năng lượng.</p>
<p>Liên hệ EVN hoặc Tổng Công ty Điện lực khu vực để biết chi tiết chương trình DR áp dụng cho doanh nghiệp bạn.</p>

<h2>Kết luận</h2>
<p>15–20% sự cố điện có thể phòng tránh được bằng kiểm tra định kỳ. Đầu tư 1–2 ngày kiểm tra trước mùa cao điểm có thể tránh được sự cố dừng sản xuất kéo dài nhiều ngày và chi phí sửa chữa lớn hơn nhiều.</p>
<p>Song Thanh cung cấp thiết bị đóng cắt, cáp điện và phụ kiện tủ điện sẵn kho. Liên hệ để được hỗ trợ nhanh cho nhu cầu bảo trì và nâng cấp hệ thống điện trước mùa cao điểm.</p>`
    },

    // ───────────────────────────────────────────────
    // SỰ KIỆN 1
    // ───────────────────────────────────────────────
    {
      slug: 'lich-trien-lam-nganh-dien-nang-luong-tu-dong-hoa-2026',
      title: 'Lịch triển lãm ngành điện, năng lượng và tự động hóa tại Việt Nam năm 2026',
      excerpt: 'Tổng hợp các triển lãm quốc tế và khu vực về thiết bị điện, năng lượng và tự động hóa sẽ diễn ra tại Việt Nam trong năm 2026. Cơ hội để kỹ sư, nhà thầu và doanh nghiệp cập nhật công nghệ mới nhất.',
      category: 'su-kien',
      is_featured: false,
      published_at: '2026-05-08T07:00:00.000Z',
      seo_title: 'Lịch triển lãm ngành điện, tự động hóa Việt Nam 2026 | Song Thanh',
      seo_description: 'Danh sách triển lãm thiết bị điện, năng lượng và tự động hóa tại Việt Nam 2026: Vietnam ETE, Automation World, VIAF, VIMF, MTA Vietnam — địa điểm, thời gian và nội dung.',
      content_html: `<h2>Tổng quan triển lãm ngành điện và tự động hóa 2026</h2>
<p>Năm 2026, Việt Nam tiếp tục là điểm đến của nhiều triển lãm quốc tế về thiết bị điện, năng lượng và tự động hóa công nghiệp. Đây là cơ hội để kỹ sư điện, nhà thầu, ban quản lý nhà máy và các doanh nghiệp phân phối thiết bị cập nhật xu hướng công nghệ mới nhất, gặp gỡ nhà sản xuất và so sánh sản phẩm trực tiếp.</p>

<h2>Vietnam ETE & Greenergy Expo 2026</h2>
<p><strong>Thời gian:</strong> 15–17 tháng 7 năm 2026<br>
<strong>Địa điểm:</strong> SECC — Trung tâm Hội chợ và Triển lãm Sài Gòn, TP.HCM</p>
<p>Vietnam ETE là triển lãm quốc tế lớn nhất về thiết bị điện và năng lượng tại Việt Nam. Triển lãm quy tụ hàng trăm doanh nghiệp trong nước và quốc tế, trưng bày các nhóm sản phẩm:</p>
<ul>
  <li>Thiết bị điện hạ thế và trung thế: MCB, MCCB, ACB, contactor, relay, tủ điện</li>
  <li>Cáp điện và phụ kiện đường dây</li>
  <li>Thiết bị chiếu sáng công nghiệp và năng lượng</li>
  <li>Năng lượng tái tạo: điện mặt trời, lưu trữ năng lượng</li>
  <li>Hệ thống điện thông minh (Smart Grid, EMS)</li>
</ul>

<h2>Automation World Vietnam 2026</h2>
<p><strong>Thời gian:</strong> 09–11 tháng 9 năm 2026<br>
<strong>Địa điểm:</strong> VEC — Trung tâm Hội chợ Triển lãm Việt Nam, Hà Nội</p>
<p>Triển lãm chuyên sâu về tự động hóa công nghiệp, nhà máy thông minh và công nghệ Industry 4.0:</p>
<ul>
  <li>PLC, HMI, SCADA và hệ thống điều khiển tự động</li>
  <li>Biến tần, servo, động cơ công nghiệp</li>
  <li>Robot công nghiệp và cobots</li>
  <li>Cảm biến, vision system, IIoT</li>
  <li>Phần mềm quản lý sản xuất (MES, ERP tích hợp)</li>
</ul>

<h2>VIAF — Vietnam Industrial Automation Fiesta 2026</h2>
<p><strong>Thời gian:</strong> Dự kiến quý 3/2026 — theo dõi trang chủ để cập nhật<br>
<strong>Địa điểm:</strong> TP.HCM và Hà Nội (tổ chức song song)</p>
<p>VIAF tập trung vào tự động hóa trong công nghiệp chế biến, chế tạo, bao gồm các khu công nghiệp lớn như Bình Dương, Đồng Nai, Hải Phòng, Bắc Ninh. Triển lãm phù hợp cho kỹ sư và nhà quản lý nhà máy muốn tìm hiểu giải pháp nâng cấp dây chuyền.</p>

<h2>VIMF — Vietnam Industrial & Manufacturing Fair 2026</h2>
<p><strong>Thời gian:</strong> Nhiều kỳ trong năm theo cụm công nghiệp địa phương<br>
<strong>Địa điểm:</strong> Hải Phòng, Bình Dương, Bắc Ninh, Đà Nẵng</p>
<p>VIMF là chuỗi triển lãm lưu động đến các khu công nghiệp lớn, tập trung vào:</p>
<ul>
  <li>Máy móc và thiết bị gia công sản xuất</li>
  <li>Tự động hóa và robot cho SME</li>
  <li>Vật liệu và linh kiện công nghiệp</li>
</ul>

<h2>MTA Vietnam 2026</h2>
<p><strong>Thời gian:</strong> 01–04 tháng 7 năm 2026<br>
<strong>Địa điểm:</strong> SECC, TP.HCM</p>
<p>MTA Vietnam chuyên về cơ khí chính xác và thiết bị sản xuất công nghiệp, gián tiếp liên quan đến điện công nghiệp qua các giải pháp tự động hóa và gia công kim loại.</p>

<h2>Lợi ích khi tham quan triển lãm</h2>
<ul>
  <li>Gặp gỡ trực tiếp nhà sản xuất để so sánh sản phẩm và giá cả</li>
  <li>Xem trình diễn thiết bị thực tế, không chỉ qua catalogue</li>
  <li>Tham dự hội thảo kỹ thuật miễn phí đi kèm triển lãm</li>
  <li>Cập nhật xu hướng công nghệ mới nhất trong ngành</li>
  <li>Xây dựng quan hệ với các nhà cung cấp và đối tác tiềm năng</li>
</ul>
<p>Song Thanh sẽ cập nhật thông tin tham gia triển lãm của mình tại mục Sự kiện. Theo dõi website để không bỏ lỡ các chương trình ưu đãi dành riêng cho khách tham quan triển lãm.</p>`
    },

  ];

  // Xóa bài đã có (để chạy seed nhiều lần không bị lỗi duplicate)
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
  console.log(`[seed] Đã thêm ${rows.length} bài viết tin tức mẫu.`);
};
