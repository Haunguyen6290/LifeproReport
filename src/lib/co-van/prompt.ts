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

// Prompt chấm rút gọn (10/2026): proxy AI trả rỗng khi system quá dài (~3300 ký tự).
// Chỉ chat mới dùng full brief công ty; chấm chỉ cần tiêu chí + cấu trúc JSON (<1500 ký tự).
const BRIEF_NGAN = 'LifePro bán buôn phụ kiện ô tô (B2B): khách là gara/đại lý/nội thất xe.';

function buildHuongDanBaoCao(): string {
  return [
    'Trả đúng 1 JSON, tiếng Việt CÓ DẤU, không thêm chữ:',
    '{"ket_qua":"Dat|Can sua|Khong dat","ly_do":"...","dau_hieu_doi_pho":"","gop_y_soan_san":"..."}',
    '- ket_qua: Đạt/Cần sửa/Không đạt. Có NỘP MUỘN thì tối thiểu Cần sửa.',
    '- ly_do: tối đa 3 lỗi, mỗi ý 1 dòng "• ". Có NỘP MUỘN thì dòng đầu là "• Nộp muộn ..." (hạn + lúc nộp).',
    '- dau_hieu_doi_pho: "".',
    '- gop_y_soan_san (6–8 dòng, mỗi ý 1 câu, CẤM lặp chữ "thiếu" ở ly_do):',
    '  CẦN SỬA: • Viết lại ... thành ... (hành động khắc phục)',
    '  HƯỚNG DẪN: • Đã làm gì + Kết quả (số) + Vấn đề→Nguyên nhân + Đề xuất→Kết quả + Tiếp theo (làm gì/cho ai/khi nào).',
    '  VD: "• Đã tiếp cận 20/20 khách, 5/7 đơn — chưa đạt do giá cao 15%, T3 gọi lại 3 khách mục tiêu 2 đơn."',
  ].join('\n');
}

function buildHuongDanKeHoach(): string {
  return [
    'Trả đúng 1 JSON, tiếng Việt CÓ DẤU, không thêm chữ:',
    '{"ket_qua":"Dat|Can sua|Khong dat","ly_do":"...","dau_hieu_doi_pho":"","gop_y_soan_san":"..."}',
    '- ket_qua: Đạt/Cần sửa/Không đạt. Có NỘP MUỘN thì tối thiểu Cần sửa.',
    '- ly_do: tối đa 3 dòng "• ". Có NỘP MUỘN thì dòng đầu là "• Nộp muộn ..." (hạn + lúc nộp).',
    '- dau_hieu_doi_pho: "".',
    '- gop_y_soan_san (5 dòng, mỗi ý 1 câu, CẤM lặp chữ "thiếu" ở ly_do):',
    '  CẦN SỬA: • Viết lại mục tiêu/dòng việc ... thành ... (hành động khắc phục)',
    '  HƯỚNG DẪN: • Làm gì + Cho ai + Khi nào + Kết quả gì. VD: "• T3–T4 chào F9 cho 5 khách, mục tiêu 3 đơn."',
  ].join('\n');
}

// Tiêu chí rút gọn
const TIEU_CHI_KH = 'MỤC TIÊU Đạt khi có Mục tiêu+Phạm vi+Đầu ra (số)+Thời hạn. Từng dòng việc Đạt khi có Việc gì+Cho ai+Khi nào+Kết quả gì. Chưa gắn KR nào thì ghi rõ.';
const TIEU_CHI_BC = 'Báo cáo: Đã làm gì→Kết quả (số, %HT)→Thông tin thực tế→Vấn đề→Nguyên nhân→Đề xuất→Tiếp theo. Sales ưu tiên số khách→đơn→doanh số→cơ hội. Ngắn mà đủ thì Đạt.';

export function buildCoVanSystem(_brief: string, extraInstructions: string, loai?: string): string {
  // Cố ý bỏ full brief công ty (~1800 ký tự) — proxy AI trả rỗng khi system quá dài.
  const parts = [
    'Bạn là BOT KIỂM TRA CHẤT LƯỢNG. Chấm chất lượng, không chấm văn.',
    `BỐI CẢNH: ${BRIEF_NGAN}`,
    loai === 'bao_cao' ? TIEU_CHI_BC : loai === 'ke_hoach' ? TIEU_CHI_KH : tieuChiTheoLoai(loai ?? 'ke_hoach'),
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
