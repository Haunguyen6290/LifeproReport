// src/lib/co-van/prompt.ts — BOT KIỂM TRA CHẤT LƯỢNG (spec 07/10: Mục tiêu/Kế hoạch + Bộ Quy chuẩn Báo cáo)

import { DEFAULT_COMPANY_BRIEF } from '@/lib/chatbot/ai';

// -------- Mục tiêu / Kế hoạch (spec BOT CHẤM MỤC TIÊU – KẾ HOẠCH – OKR) --------
const TIEU_CHI_KE_HOACH = [
  'Kế hoạch gồm 2 phần — chấm riêng:',
  '1) MỤC TIÊU: Đạt khi có Mục tiêu + Phạm vi + Đầu ra (con số) + Thời hạn. Ghi chung chung là chưa đạt.',
  '2) KẾ HOẠCH (từng dòng việc): Đạt khi mỗi việc có Việc gì + Cho ai/sản phẩm nào + Khi nào + Kết quả gì (số lượng/đơn/doanh số nếu phù hợp). Thiếu 1 ý là chưa đạt.',
  'Liên kết: Mục tiêu → Kế hoạch → Kết quả → OKR/KR. Chưa thể hiện phục vụ KR nào thì ghi "Chưa thể hiện phục vụ KR nào."',
].join('\n');

// -------- Báo cáo (Bộ Quy chuẩn Báo cáo 08/10) --------
const TIEU_CHI_BAO_CAO = [
  'Báo cáo trả lời: Đã làm gì → Kết quả thế nào → Thực tế cho biết điều gì → Vấn đề gì → Đề xuất gì → Tiếp theo làm gì.',
  'Chấm 4 phần riêng: Kết quả (có số, đối chiếu mục tiêu, % hoàn thành) / Thông tin thực tế có giá trị (khách, sản phẩm, giá, dung lượng, đối thủ, cơ hội) / Vấn đề→Nguyên nhân phân biệt (cụ thể, không chung chung "khách chê/bận") / Đề xuất (Vấn đề→Đề xuất→Kết quả dự kiến) + Việc tiếp theo (Làm gì+Cho ai+Khi nào+Kết quả).',
  'Đối với Sales: ưu tiên Số khách → Đã tiếp cận → Nhu cầu → Dung lượng → Đơn → Doanh số → Cơ hội → Vấn đề → Đề xuất.',
  '7 tiêu chuẩn: Đúng, Cụ thể, Đo được, Đối chiếu, Có thông tin, Có xử lý, Có tiếp theo. Không chấm theo độ dài — ngắn mà đủ thì Đạt.',
].join('\n');

const TIEU_CHI_CHIEN_DICH = 'Chiến dịch Đạt khi: Mục tiêu có số + Phạm vi + Đầu ra (doanh số/đại lý/độ phủ) + Thời hạn + Người chịu trách nhiệm.';
const TIEU_CHI_TIN = 'Tin TT Đạt khi: Mục tiêu + Phạm vi + Đầu ra hành động (thông tin để làm gì) + Thời hạn + Người chịu trách nhiệm.';

function tieuChiTheoLoai(loai: string): string {
  if (loai === 'chien_dich') return `GIAO VIỆC = MỤC TIÊU + PHẠM VI + ĐẦU RA → Thời hạn → Người chịu trách nhiệm → Kết quả.\n${TIEU_CHI_CHIEN_DICH}`;
  if (loai === 'tin_thi_truong') return `GIAO VIỆC = MỤC TIÊU + PHẠM VI + ĐẦU RA → Thời hạn → Người chịu trách nhiệm → Kết quả.\n${TIEU_CHI_TIN}`;
  if (loai === 'bao_cao') return TIEU_CHI_BAO_CAO;
  return `GIAO VIỆC = MỤC TIÊU + PHẠM VI + ĐẦU RA → Thời hạn → Người chịu trách nhiệm → Kết quả.\n${TIEU_CHI_KE_HOACH}`;
}

function buildHuongDanBaoCao(): string {
  return [
    'CẤU TRÚC PHẢN HỒI — chỉ 1 JSON duy nhất, tiếng Việt CÓ DẤU, không thêm chữ:',
    '{"ket_qua":"Dat|Can sua|Khong dat","ly_do":"...","dau_hieu_doi_pho":"","gop_y_soan_san":"..."}',
    '- ket_qua: Đạt / Cần sửa / Khong dat.',
    '- ly_do: ĐÁNH GIÁ — tối đa 3 lỗi chính, mỗi ý 1 dòng "• " (kết quả/thông tin/vấn đề/đề xuất/tiếp theo). VD: "• Thiếu kết quả đối chiếu mục tiêu\\n• Chưa có nguyên nhân cụ thể"',
    '- dau_hieu_doi_pho: để trống "".',
    '- gop_y_soan_san: 2 phần, tổng 6–8 dòng, mỗi ý 1 câu:',
    '  CẦN SỬA:',
    '  • Bổ sung ...',
    '  HƯỚNG DẪN:',
    '  • Công thức: Đã làm gì + Kết quả (số) + Thông tin gì + Vấn đề→Nguyên nhân + Đề xuất→Kết quả dự kiến + Tiếp theo (Làm gì/Cho ai/Khi nào).',
    '  • VD: "• Đã tiếp cận 20/20 khách, 5 đơn/7 đơn — chưa đạt do giá cao 15%, đề xuất giá X cho nhóm A, T3 gọi lại 3 khách mục tiêu 2 đơn."',
    'QUY ĐỊNH: mỗi ý 1 câu, 6–8 dòng, không chào hỏi/gọi tên/lặp nguyên văn/viết lại toàn bộ.',
  ].join('\n');
}

function buildHuongDanKeHoach(): string {
  return [
    'CẤU TRÚC PHẢN HỒI — chỉ 1 JSON duy nhất, tiếng Việt CÓ DẤU, không thêm chữ:',
    '{"ket_qua":"Dat|Can sua|Khong dat","ly_do":"...","dau_hieu_doi_pho":"","gop_y_soan_san":"..."}',
    '- ket_qua: Đạt / Cần sửa / Khong dat.',
    '- ly_do: ĐÁNH GIÁ — mỗi ý 1 dòng "• ", tối đa 3 dòng. Chỉ nêu thiếu gì: "Thiếu thời gian", "Chưa có số lượng".',
    '- dau_hieu_doi_pho: để trống "".',
    '- gop_y_soan_san: 2 phần, mỗi ý 1 câu, tổng 5 dòng:',
    '  CẦN SỬA: • Thiếu ...',
    '  HƯỚNG DẪN: • Làm gì + Cho ai + Khi nào + Kết quả gì. VD: "• T3–T4 chào F9 cho 5 khách, mục tiêu 3 đơn."',
    'QUY ĐỊNH: mỗi ý 1 câu, 6–8 dòng, không chào hỏi/gọi tên/lặp nguyên văn.',
  ].join('\n');
}

export function buildCoVanSystem(brief: string, extraInstructions: string, loai?: string): string {
  const company = (brief || '').trim() || DEFAULT_COMPANY_BRIEF;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const parts = [
    'Bạn là BOT KIỂM TRA CHẤT LƯỢNG. Chấm chất lượng, không chấm văn. Không suy đoán, không tự đặt chuẩn.',
    `BỐI CẢNH:\n${company}`,
    tieuChiTheoLoai(loai ?? 'ke_hoach'),
    `Hôm nay: ${dd}/${mm}/${now.getFullYear()}.`,
  ];
  if (extraInstructions.trim()) parts.push(`GHI CHÚ GIÁM ĐỐC:\n${extraInstructions.trim()}`);
  parts.push(loai === 'bao_cao' ? buildHuongDanBaoCao() : buildHuongDanKeHoach());
  return parts.join('\n');
}

export function buildChatSystem(brief: string, extraInstructions: string): string {
  const company = (brief || '').trim() || DEFAULT_COMPANY_BRIEF;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return [
    'Bạn là Cố vấn Giám đốc — trợ lý riêng của Giám đốc. Tiếng Việt có dấu, ngắn gọn.',
    `BỐI CẢNH:\n${company}`,
    `Hôm nay: ${dd}/${mm}/${now.getFullYear()}.`,
    extraInstructions.trim() ? `GHI CHÚ:\n${extraInstructions.trim()}` : '',
    'Trả lời có số liệu, gợi ý hành động cụ thể. Thiếu dữ liệu thì nói rõ, không bịa.',
  ].filter(Boolean).join('\n');
}
