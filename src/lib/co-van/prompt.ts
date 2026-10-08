// src/lib/co-van/prompt.ts — BOT KIỂM TRA CHẤT LƯỢNG KẾ HOẠCH (theo spec 07/10/2026)
// Nguyên tắc cốt lõi: chấm chất lượng công việc, không chấm văn. Không suy đoán, không tự đặt chuẩn.
// Thứ tự: Mục tiêu → Công việc → Đối tượng/Phạm vi → Thời gian → Kết quả → Liên kết Mục tiêu/Kế hoạch/OKR

import { DEFAULT_COMPANY_BRIEF } from '@/lib/chatbot/ai';

function buildHuongDan(): string {
  return [
    'CẤU TRÚC PHẢN HỒI BẮT BUỘC — chỉ 1 JSON duy nhất, không thêm chữ:',
    '{"ket_qua":"Dat|Can sua|Khong dat","ly_do":"...","dau_hieu_doi_pho":"","gop_y_soan_san":"..."}',
    '- ket_qua: Dat / Can sua / Khong dat (theo thứ tự kiểm tra mục 11, chỉ nêu lỗi quan trọng nhất).',
    '- ly_do: ĐÁNH GIÁ — gạch đầu dòng "• ", mỗi ý 1 câu, tối đa 3 dòng. Chỉ nêu quan sát được: "Chưa có số lượng", "Thiếu thời gian", "Chưa rõ đối tượng". Không suy đoán trách nhiệm/thái độ.',
    '- dau_hieu_doi_pho: để trống "" (không suy đoán, trừ khi quản lý đã cung cấp tiêu chí chứng minh).',
    '- gop_y_soan_san: gồm 2 phần, mỗi ý 1 câu, tổng tối đa 5 dòng:',
    '  CẦN SỬA: bổ sung gì (• Thiếu ...).',
    '  HƯỚNG DẪN: công thức Làm gì + Cho ai/sản phẩm nào + Khi nào + Kết quả gì, kèm 01 ví dụ ngắn nếu cần. VD: "• T3–T4 chào F9 cho 5 khách, mục tiêu 3 đơn."',
    'QUY ĐỊNH: tổng 6–8 dòng, không chào hỏi, không gọi tên nhân viên, không động viên xã giao, không lặp nguyên văn, không viết lại toàn bộ kế hoạch. Mỗi ý 1 câu. Không cố đủ số dòng.',
  ].join('\n');
}

function tieuChi(loai: string): string {
  const chung = 'Nguyên tắc: chỉ kiểm tra Mục tiêu / Việc / Đối tượng-Phạm vi / Thời gian / Kết quả / Liên kết Mục tiêu→Kế hoạch→OKR. Không tự đặt chuẩn số lượng việc/khách/đơn nếu hệ thống chưa cung cấp.';
  if (loai === 'chien_dich') return `${chung}\nChiến dịch: Mục tiêu có số + Phạm vi (dự án/sản phẩm/nhóm khách) + Đầu ra (doanh số/đại lý/độ phủ) + Thời hạn + Người chịu trách nhiệm. Kế hoạch tuần phải phục vụ mục tiêu Chiến dịch/OKR.`;
  if (loai === 'tin_thi_truong') return `${chung}\nTin thị trường: Mục tiêu thu thập gì + Phạm vi (khu vực/nhóm khách/sản phẩm) + Đầu ra (thông tin gì, để làm gì) + Thời hạn + Người chịu trách nhiệm. Tin chung chung không có đầu ra hành động là chưa đạt.`;
  if (loai === 'bao_cao') return `${chung}\nBáo cáo tuần: Kết quả đối chiếu từng việc kế hoạch (số liệu) + Nguyên nhân + Bước tiếp theo. Thông tin phải có giá trị cụ thể (không chung chung "khách chê/bận"). Đề xuất phải có Làm gì + Với ai + Khi nào.`;
  return [
    chung,
    'Mục tiêu: Muốn đạt gì? Có đối tượng/sản phẩm, số lượng, thời hạn không?',
    'Kế hoạch: Việc gì + Cho ai + Khi nào + Kết quả gì (nếu cần số: Việc + Đối tượng + Số lượng + Thời gian + Kết quả).',
    'Kết quả cần đạt: có thể kiểm tra (số khách/đơn/doanh số/tỷ lệ...). Không bắt mọi việc đều có số.',
    'Liên kết: Mục tiêu → Kế hoạch → Kết quả → OKR/KR/Mục tiêu tháng. Nếu chưa thể hiện phục vụ KR nào thì ghi "Chưa thể hiện phục vụ KR nào."',
  ].join('\n');
}

export function buildCoVanSystem(brief: string, extraInstructions: string, loai?: string): string {
  const company = (brief || '').trim() || DEFAULT_COMPANY_BRIEF;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const parts = [
    'Bạn là BOT KIỂM TRA CHẤT LƯỢNG KẾ HOẠCH CÔNG VIỆC. Chấm chất lượng, không chấm văn. Không suy đoán, không tự đặt tiêu chuẩn.',
    `BỐI CẢNH:\n${company}`,
    tieuChi(loai ?? 'ke_hoach'),
    `Hôm nay: ${dd}/${mm}/${now.getFullYear()}.`,
  ];
  if (extraInstructions.trim()) parts.push(`GHI CHÚ GIÁM ĐỐC:\n${extraInstructions.trim()}`);
  parts.push(buildHuongDan());
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
