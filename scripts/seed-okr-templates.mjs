import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ===== Mapping nhóm thư viện -> role slug =====
const ROLE_MAP = {
  'NHAN_VIEN_KINH_DOANH': 'KINH_DOANH',
  'MARKETING_KIEM_THIET_KE': 'KINH_DOANH', // Marketing dùng chung KD (hoặc tạo role riêng sau)
  'KHO': 'KHO',
  'TONG_HOP_KHO': 'KHO', // Tổng hợp Kho dùng chung KHO
  'BAO_HANH': 'KHO', // Bảo hành dùng chung KHO (hoặc tách sau)
  'KE_TOAN': 'KẾ_TOÁN',
  'LAI_XE_KIEM_HO_TRO_KHO': 'KHO',
};

// ===== Library parsed from user message =====
const LIBRARY = [
  {
    group: 'NHAN_VIEN_KINH_DOANH', groupLabel: 'V. NHÂN VIÊN KINH DOANH', roleGroup: 'NHAN_VIEN_KINH_DOANH',
    objectives: [
      { name: 'MỤC TIÊU 1 – ĐẠT DOANH SỐ', krs: ['Đạt doanh số X.', 'Đạt X% kế hoạch.', 'Tăng trưởng X% so với kỳ trước.', 'Tăng doanh số nhóm sản phẩm trọng tâm X%.', 'Duy trì doanh số tối thiểu X/tháng.'] },
      { name: 'MỤC TIÊU 2 – PHÁT TRIỂN KHÁCH HÀNG MỚI', krs: ['Tiếp cận X khách hàng mới.', 'Gặp trực tiếp X khách hàng.', 'Báo giá X khách hàng.', 'Có X khách hàng mua thử.', 'Có X khách hàng mới phát sinh doanh thu.'] },
      { name: 'MỤC TIÊU 3 – TĂNG DOANH SỐ KHÁCH CŨ', krs: ['X khách hàng được chăm sóc định kỳ.', 'X khách hàng tăng doanh số.', 'Tăng doanh thu khách cũ X%.', 'X khách hàng mua thêm sản phẩm mới.', 'X% khách hàng trọng điểm duy trì mua hàng.'] },
      { name: 'MỤC TIÊU 4 – GIẢM MẤT KHÁCH', krs: ['100% khách giảm doanh số được xác định nguyên nhân.', 'X khách hàng có nguy cơ ngừng mua được xử lý.', 'X khách hàng được khôi phục.', 'Giảm số khách ngừng mua X%.', '100% nguyên nhân mất khách quan trọng được báo cáo.'] },
      { name: 'MỤC TIÊU 5 – KÍCH HOẠT CƠ HỘI BÁN HÀNG', krs: ['X cơ hội bán hàng được ghi nhận.', 'X% cơ hội được theo đến kết quả.', 'X% khách hàng quan tâm được phản hồi đúng hạn.', 'X đề xuất nhu cầu khách hàng được gửi về công ty.', 'X cơ hội được chuyển thành doanh thu.'] },
    ]
  },
  {
    group: 'MARKETING_KIEM_THIET_KE', groupLabel: 'V. MARKETING KIÊM THIẾT KẾ', roleGroup: 'MARKETING_KIEM_THIET_KE',
    objectives: [
      { name: 'MỤC TIÊU 1 – HỖ TRỢ KINH DOANH HIỆU QUẢ HƠN', krs: ['Hoàn thành X tài liệu hỗ trợ bán hàng.', 'X% yêu cầu quan trọng được hoàn thành đúng hạn.', 'X% tài liệu được kinh doanh sử dụng.', 'Giảm số lần sửa trung bình X%.', 'X tài liệu được cải tiến dựa trên phản hồi thực tế.'] },
      { name: 'MỤC TIÊU 2 – TĂNG HIỆU QUẢ NỘI DUNG MARKETING', krs: ['Hoàn thành X nội dung.', 'Tăng lượng tiếp cận X%.', 'Tăng mức tương tác X%.', 'Tạo X lượt quan tâm.', 'X nội dung đạt hiệu quả cao được phân tích.'] },
      { name: 'MỤC TIÊU 3 – NÂNG CAO CHẤT LƯỢNG THIẾT KẾ', krs: ['X% thiết kế đúng nhận diện.', 'Giảm thời gian hoàn thành X%.', 'Giảm số lần sửa lại X%.', 'X% yêu cầu có mục tiêu rõ trước khi thiết kế.', 'X thiết kế được sử dụng hiệu quả trong thực tế.'] },
      { name: 'MỤC TIÊU 4 – QUẢN LÝ TÀI NGUYÊN MARKETING', krs: ['100% file quan trọng được lưu trữ đúng nơi.', '100% tài liệu mới được phân loại.', 'X% tài nguyên có thể tìm thấy nhanh.', 'Giảm thất lạc file xuống X trường hợp.', 'Hoàn thiện thư viện tài liệu dùng chung.'] },
      { name: 'MỤC TIÊU 5 – CẢI TIẾN LIÊN TỤC', krs: ['Tổng hợp X phản hồi.', 'X vấn đề được phát hiện.', 'X phương án cải tiến được đề xuất.', 'X cải tiến được áp dụng.', 'Đo lại hiệu quả sau cải tiến.'] },
    ]
  },
  {
    group: 'KHO', groupLabel: 'VI. KHO', roleGroup: 'KHO',
    objectives: [
      { name: 'MỤC TIÊU 1 – XUẤT HÀNG NHANH VÀ CHÍNH XÁC', krs: ['X% đơn xuất đúng.', 'Giảm lỗi xuất nhầm X%.', 'X% đơn xuất đúng thời gian.', 'Giảm số đơn bị xử lý lại X%.', 'X% hàng xuất được kiểm tra đầy đủ.'] },
      { name: 'MỤC TIÊU 2 – KIỂM SOÁT HÀNG TỒN', krs: ['100% hàng tồn lâu được thống kê.', '100% hàng tồn lâu được cảnh báo.', 'X% hàng tồn lâu có hướng xử lý.', 'Giảm giá trị hàng tồn lâu X%.', 'Không để hàng tồn nghiêm trọng không được báo cáo.'] },
      { name: 'MỤC TIÊU 3 – KIỂM SOÁT CHẤT LƯỢNG HÀNG TRONG KHO', krs: ['100% hàng thiếu phẩm chất được ghi nhận.', 'X% hàng có dấu hiệu xuống cấp được phát hiện sớm.', 'Giảm hàng hỏng trong kho X%.', 'X vấn đề chất lượng được cảnh báo.', '100% hàng bất thường có hướng xử lý.'] },
      { name: 'MỤC TIÊU 4 – NÂNG CAO TỔ CHỨC KHO', krs: ['X% hàng được sắp xếp đúng vị trí.', 'Giảm thời gian tìm hàng X%.', '100% khu vực kho có tiêu chuẩn sắp xếp.', 'X lần kiểm tra kho đạt yêu cầu.', 'X cải tiến bố trí được áp dụng.'] },
      { name: 'MỤC TIÊU 5 – PHÁT HIỆN VÀ XỬ LÝ VẤN ĐỀ', krs: ['X vấn đề được phát hiện chủ động.', '100% vấn đề nghiêm trọng được báo kịp thời.', 'X% vấn đề được theo đến kết quả.', 'Giảm vấn đề lặp lại X%.', 'X đề xuất cải tiến được áp dụng.'] },
    ]
  },
  {
    group: 'TONG_HOP_KHO', groupLabel: 'VII. TỔNG HỢP KHO', roleGroup: 'TONG_HOP_KHO',
    objectives: [
      { name: 'MỤC TIÊU 1 – XỬ LÝ ĐƠN HÀNG CHÍNH XÁC', krs: ['X% đơn được kiểm tra đầy đủ.', 'Giảm lỗi đơn X%.', 'Giảm đơn phải sửa lại X%.', 'X% đơn hoàn thành đúng thời gian.', 'Giảm sai sót thông tin X%.'] },
      { name: 'MỤC TIÊU 2 – GIẢM ĐIỂM NGHẼN TRONG XỬ LÝ ĐƠN', krs: ['Thống kê 100% đơn chậm.', 'Xác định nguyên nhân X% đơn chậm.', 'Giảm thời gian xử lý đơn X%.', 'X điểm nghẽn được cải tiến.', 'Giảm số đơn tồn X%.'] },
      { name: 'MỤC TIÊU 3 – GIẢM LỖI LẶP LẠI', krs: ['Thống kê X nhóm lỗi.', 'Xác định nguyên nhân X% lỗi lặp lại.', 'X giải pháp phòng ngừa được áp dụng.', 'Giảm lỗi lặp lại X%.', 'Đo lại hiệu quả sau cải tiến.'] },
      { name: 'MỤC TIÊU 4 – NÂNG CAO HIỆU QUẢ PHỐI HỢP', krs: ['X% thông tin đơn hàng được chuyển đúng và đủ.', 'Giảm phát sinh do thiếu thông tin X%.', 'X vấn đề liên phòng ban được cảnh báo.', 'X% vấn đề được phản hồi đúng hạn.', 'Giảm công việc phải xử lý lại X%.'] },
      { name: 'MỤC TIÊU 5 – CHỦ ĐỘNG CẢNH BÁO VẤN ĐỀ', krs: ['100% vấn đề quan trọng được ghi nhận.', 'X% vấn đề có người phụ trách.', 'X% vấn đề được theo đến kết quả.', 'X vấn đề lặp lại được cải tiến.', 'Không để vấn đề lớn chỉ được phát hiện khi đã quá muộn.'] },
    ]
  },
  {
    group: 'BAO_HANH', groupLabel: 'VIII. BẢO HÀNH', roleGroup: 'BAO_HANH',
    objectives: [
      { name: 'MỤC TIÊU 1 – GIẢM TỒN KHO BẢO HÀNH', krs: ['Giảm số lượng tồn bảo hành từ X xuống Y.', 'Giảm giá trị hàng tồn bảo hành X%.', 'X% hàng bảo hành được xử lý trong thời gian mục tiêu.', 'Giảm số hàng tồn quá X ngày.', '100% hàng tồn lâu có người phụ trách.'] },
      { name: 'MỤC TIÊU 2 – PHÁT HIỆN SỚM LỖI SẢN PHẨM', krs: ['100% lỗi được ghi nhận theo sản phẩm.', 'Phát hiện X trường hợp lỗi bất thường.', '100% lỗi nghi ngờ theo lô được cảnh báo.', 'X% lỗi lặp lại được báo cho bộ phận liên quan.', 'Giảm tỷ lệ lỗi lặp lại X%.'] },
      { name: 'MỤC TIÊU 3 – TĂNG TỐC ĐỘ XỬ LÝ BẢO HÀNH', krs: ['Giảm thời gian xử lý trung bình từ X xuống Y.', 'X% trường hợp xử lý đúng hạn.', 'Giảm số trường hợp chậm X%.', '100% trường hợp chậm có nguyên nhân.', 'X% vấn đề chậm được cải tiến.'] },
      { name: 'MỤC TIÊU 4 – NÂNG CAO HIỆU QUẢ NHÀ CUNG CẤP', krs: ['X nhà cung cấp được theo dõi thời gian xử lý.', 'X% yêu cầu bảo hành được phản hồi đúng hạn.', 'Giảm thời gian chờ X%.', 'X vấn đề được yêu cầu nhà cung cấp cải thiện.', 'Có dữ liệu đánh giá định kỳ nhà cung cấp.'] },
      { name: 'MỤC TIÊU 5 – BIẾN DỮ LIỆU BẢO HÀNH THÀNH CẢNH BÁO', krs: ['Báo cáo lỗi định kỳ.', 'Báo cáo sản phẩm lỗi tăng bất thường.', 'Báo cáo lỗi theo lô.', 'Báo cáo tồn bảo hành.', 'X cảnh báo được đưa ra trước khi thành vấn đề lớn.'] },
    ]
  },
  {
    group: 'KE_TOAN', groupLabel: 'IX. KẾ TOÁN', roleGroup: 'KE_TOAN',
    objectives: [
      { name: 'MỤC TIÊU 1 – KIỂM SOÁT CÔNG NỢ', krs: ['Giảm công nợ quá hạn X%.', 'X% khách hàng quá hạn được cảnh báo.', 'X% công nợ lớn được theo dõi.', 'X% công nợ được thu đúng kế hoạch.', 'Không để công nợ rủi ro lớn không được cảnh báo.'] },
      { name: 'MỤC TIÊU 2 – KIỂM SOÁT DÒNG TIỀN', krs: ['Lập kế hoạch dòng tiền định kỳ.', 'Theo dõi X% khoản thu dự kiến.', 'Theo dõi X% khoản chi dự kiến.', 'Cảnh báo nguy cơ thiếu tiền trước X ngày.', 'Giảm chênh lệch dự kiến và thực tế X%.'] },
      { name: 'MỤC TIÊU 3 – KIỂM SOÁT CHI PHÍ', krs: ['X% khoản chi được phân loại.', 'X% khoản chi bất thường được cảnh báo.', 'Giảm X% chi phí không hiệu quả.', 'X đề xuất tiết kiệm chi phí.', 'Đo hiệu quả sau cải tiến.'] },
      { name: 'MỤC TIÊU 4 – ĐẢM BẢO CHÍNH XÁC VÀ ĐÚNG HẠN', krs: ['X% báo cáo đúng hạn.', 'Giảm lỗi số liệu X%.', 'Giảm sai sót chứng từ X%.', 'X% đối chiếu hoàn thành đúng hạn.', 'X vấn đề lặp lại được cải tiến.'] },
      { name: 'MỤC TIÊU 5 – CẢNH BÁO RỦI RO TÀI CHÍNH', krs: ['X cảnh báo công nợ.', 'X cảnh báo dòng tiền.', 'X cảnh báo chi phí.', '100% rủi ro lớn được báo cáo.', 'X% cảnh báo được theo đến hướng xử lý.'] },
    ]
  },
  {
    group: 'LAI_XE_KIEM_HO_TRO_KHO', groupLabel: 'X. LÁI XE KIÊM HỖ TRỢ KHO', roleGroup: 'LAI_XE_KIEM_HO_TRO_KHO',
    objectives: [
      { name: 'MỤC TIÊU 1 – PHỤC VỤ CÔNG TÁC AN TOÀN VÀ ĐÚNG GIỜ', krs: ['X% chuyến công tác đúng giờ.', '0 tai nạn do lỗi chủ quan.', 'X% lịch xe được chuẩn bị trước.', 'X% yêu cầu đưa đón được đáp ứng đúng kế hoạch.', 'Giảm số lần ảnh hưởng công tác do vấn đề xe.'] },
      { name: 'MỤC TIÊU 2 – ĐẢM BẢO XE LUÔN SẴN SÀNG', krs: ['100% lịch bảo dưỡng được theo dõi.', '100% đăng kiểm và bảo hiểm được theo dõi.', 'X% bảo dưỡng thực hiện đúng hạn.', '100% dấu hiệu bất thường được báo sớm.', 'Giảm sự cố xe hỏng đột xuất xuống X.'] },
      { name: 'MỤC TIÊU 3 – QUẢN LÝ XE HIỆU QUẢ', krs: ['Theo dõi 100% chi phí xe.', 'Theo dõi nhiên liệu định kỳ.', 'Giảm tiêu hao bất thường X%.', 'Xe được kiểm tra định kỳ.', 'Xe luôn sạch sẽ và đủ điều kiện phục vụ công tác.'] },
      { name: 'MỤC TIÊU 4 – SỬ DỤNG HIỆU QUẢ THỜI GIAN KHÔNG CÓ LỊCH XE', krs: ['100% thời gian không có lịch được chủ động bố trí công việc.', 'Hoàn thành X nhiệm vụ hỗ trợ kho.', 'X% công việc hỗ trợ hoàn thành đúng yêu cầu.', 'Chủ động kiểm tra công việc quản lý xe trước khi hỗ trợ kho.', 'Không để thời gian làm việc bị lãng phí do chờ lịch xe.'] },
      { name: 'MỤC TIÊU 5 – CHỦ ĐỘNG PHÁT HIỆN VÀ XỬ LÝ RỦI RO', krs: ['100% bất thường của xe được ghi nhận.', 'X% vấn đề được xử lý trước khi gây gián đoạn.', '100% rủi ro nghiêm trọng được báo ngay.', 'X vấn đề được đề xuất hướng xử lý.', 'Giảm số sự cố lặp lại X%.'] },
    ]
  },
];

async function ensureCategory(slug, name, description) {
  const { data: existing } = await supabase.from('categories').select('id, slug').eq('slug', slug).maybeSingle();
  if (existing) {
    console.log(`Category ${slug} exists: ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await supabase.from('categories').insert({ slug, name, description }).select('id').single();
  if (error) { console.error(`Create category ${slug} failed:`, error.message); throw error; }
  console.log(`Created category ${slug}: ${data.id}`);
  return data.id;
}

const catOId = await ensureCategory('okr_o_template', 'O mẫu (OKRs)', 'Thư viện Objective mẫu — Admin quản lý, gán theo vai trò. Nhân viên chọn rồi chỉnh lại trong form OKR.');
const catKrId = await ensureCategory('okr_kr_template', 'KR mẫu (OKRs)', 'Thư viện Key Result mẫu — Admin quản lý, gán theo vai trò. Nhân viên chọn rồi chỉnh lại.');

// Clear old items for these 2 categories (idempotent re-run)
await supabase.from('category_items').delete().in('category_id', [catOId, catKrId]);
console.log('Cleared old items for okr templates');

// Insert O and KR items
let sort = 0;
let oCount = 0, krCount = 0;
for (const grp of LIBRARY) {
  const roleName = ROLE_MAP[grp.roleGroup] ?? 'KINH_DOANH';
  for (const obj of grp.objectives) {
    sort++;
    const oName = obj.name.replace('MỤC TIÊU ', '').trim(); // e.g. "1 – ĐẠT DOANH SỐ"
    const { error: e1 } = await supabase.from('category_items').insert({
      category_id: catOId,
      code: '',
      name: oName,
      description: grp.groupLabel,
      sort_order: sort,
      active: true,
      extra: { role: roleName, group: grp.group, groupLabel: grp.groupLabel, roleGroup: grp.roleGroup },
    });
    if (e1) console.error('O insert failed:', e1.message, oName);
    else oCount++;

    for (const kr of obj.krs) {
      sort++;
      const { error: e2 } = await supabase.from('category_items').insert({
        category_id: catKrId,
        code: '',
        name: kr,
        description: `${oName} · ${grp.groupLabel}`,
        sort_order: sort,
        active: true,
        extra: { role: roleName, group: grp.group, groupLabel: grp.groupLabel, roleGroup: grp.roleGroup, objective: oName },
      });
      if (e2) console.error('KR insert failed:', e2.message, kr);
      else krCount++;
    }
  }
}

console.log(`Done: O=${oCount}, KR=${krCount}, total=${oCount + krCount}`);
console.log(`Categories: okr_o_template=${catOId}, okr_kr_template=${catKrId}`);
