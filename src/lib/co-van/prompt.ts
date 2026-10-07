// src/lib/co-van/prompt.ts — prompt chấm Kế hoạch / Báo cáo tuần
// MỤC TIÊU + PHẠM VI + ĐẦU RA → Thời hạn → Người chịu trách nhiệm → Kết quả

import { DEFAULT_COMPANY_BRIEF } from '@/lib/chatbot/ai';

const TIEU_CHI = [
  'GIAO VIỆC = MỤC TIÊU + PHẠM VI + ĐẦU RA → Thời hạn → Người chịu trách nhiệm → Kết quả thực tế.',
  'Kế hoạch Đạt khi: Mục tiêu có số + Phạm vi rõ (khách/mã/nhóm nào) + Đầu ra đo được + Ngày làm + Người làm. Thiếu 1 ý là chưa đạt. Ghi "làm việc với khách hàng", "triển khai" là chưa đạt.',
  'Báo cáo Đạt khi: Đối chiếu từng việc kế hoạch (xong/một phần/chưa, có số) + Nguyên nhân thật + Bước tiếp theo. Khai 100% nhưng nhiều dòng Chưa xong là sai.',
  'Dấu hiệu đối phó: chép lại tuần trước, 100% nhưng việc rỗng, việc hứa biến mất không giải thích, nộp sát hạn ngắn bất thường.',
].join('\n');

export function buildCoVanSystem(brief: string, extraInstructions: string): string {
  const company = (brief || '').trim() || DEFAULT_COMPANY_BRIEF;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const parts = [
    'Bạn là Cố vấn Giám đốc. Chấm Kế hoạch/Báo cáo tuần của nhân viên.',
    `BỐI CẢNH:\n${company}`,
    TIEU_CHI,
    `Hôm nay: ${dd}/${mm}/${now.getFullYear()}.`,
  ];
  if (extraInstructions.trim()) parts.push(`GHI CHÚ GIÁM ĐỐC:\n${extraInstructions.trim()}`);
  parts.push(
    'ĐẦU RA: chỉ 1 JSON duy nhất, không thêm chữ:',
    '{"ket_qua":"Dat|Can sua|Khong dat","ly_do":"...","dau_hieu_doi_pho":"...","gop_y_soan_san":"..."}',
    '- ly_do: thiếu ý nào, < 200 từ.',
    '- gop_y: giọng anh/cố vấn, chỉ thiếu gì + gợi ý sửa 1-2 dòng, < 300 từ.',
  );
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
