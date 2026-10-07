// src/lib/co-van/prompt.ts — prompt chấm theo MỤC TIÊU + PHẠM VI + ĐẦU RA

import { DEFAULT_COMPANY_BRIEF } from '@/lib/chatbot/ai';

const TIEU_CHI_CHUNG = 'GIAO VIỆC = MỤC TIÊU + PHẠM VI + ĐẦU RA → Thời hạn → Người chịu trách nhiệm → Kết quả.';

const TIEU_CHI_KE_HOACH = [
  'Kế hoạch gồm 2 phần — chấm riêng:',
  '1) MỤC TIÊU: Đạt khi có Mục tiêu + Phạm vi + Đầu ra (con số) + Thời hạn.',
  '2) KẾ HOẠCH (từng dòng việc): Đạt khi mỗi việc có Phạm vi + Đầu ra + Ngày + Người làm.',
].join('\n');

const TIEU_CHI_BAO_CAO = [
  'Báo cáo gồm 3 phần — chấm riêng:',
  '1) Kết quả: đối chiếu từng việc kế hoạch (xong/một phần/chưa, có số) + Nguyên nhân + Bước tiếp theo.',
  '2) Thông tin: phải có giá trị — cụ thể, có số, nguyên nhân sâu. Chung chung "khách chê/bận/không mua" là chưa đạt.',
  '3) Đề xuất: phải có bước tiếp theo cụ thể (làm gì + với ai + khi nào). Chung chung là chưa đạt.',
].join('\n');

const TIEU_CHI_CHIEN_DICH = 'Chiến dịch Đạt khi: Mục tiêu có số + Phạm vi + Đầu ra (doanh số/đại lý/độ phủ) + Thời hạn + Người chịu trách nhiệm.';
const TIEU_CHI_TIN = 'Tin TT Đạt khi: Mục tiêu + Phạm vi + Đầu ra hành động (thông tin để làm gì) + Thời hạn + Người chịu trách nhiệm.';

function tieuChiTheoLoai(loai: string): string {
  if (loai === 'chien_dich') return `${TIEU_CHI_CHUNG}\n${TIEU_CHI_CHIEN_DICH}`;
  if (loai === 'tin_thi_truong') return `${TIEU_CHI_CHUNG}\n${TIEU_CHI_TIN}`;
  if (loai === 'bao_cao') return `${TIEU_CHI_CHUNG}\n${TIEU_CHI_BAO_CAO}`;
  return `${TIEU_CHI_CHUNG}\n${TIEU_CHI_KE_HOACH}`;
}

export function buildCoVanSystem(brief: string, extraInstructions: string, loai?: string): string {
  const company = (brief || '').trim() || DEFAULT_COMPANY_BRIEF;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const parts = [
    'Bạn là Cố vấn Giám đốc. Chấm bài nhân viên — chỉ bắt lỗi cho Giám đốc đọc, không soạn tin nhắn gửi.',
    `BỐI CẢNH:\n${company}`,
    tieuChiTheoLoai(loai ?? ''),
    `Hôm nay: ${dd}/${mm}/${now.getFullYear()}.`,
  ];
  if (extraInstructions.trim()) parts.push(`GHI CHÚ GIÁM ĐỐC:\n${extraInstructions.trim()}`);
  parts.push(
    'ĐẦU RA: chỉ 1 JSON duy nhất:',
    '{"ket_qua":"Dat|Can sua|Khong dat","ly_do":"...","dau_hieu_doi_pho":"...","gop_y_soan_san":"..."}',
    '- ket_qua: Dat (đủ ý), Can sua (thiếu 1-2 ý), Khong dat (thiếu nhiều/dấu hiệu đối phó).',
    '- ly_do: mỗi ý 1 gạch • , cô đọng, nêu thiếu gì. VD: "• Mục tiêu: thiếu Đầu ra\\n• Kế hoạch: 3/5 việc thiếu Phạm vi". < 80 từ.',
    '- dau_hieu_doi_pho: nếu có, mỗi ý 1 gạch • , rỗng nếu không.',
    '- gop_y_soan_san: tóm tắt ngắn cho Giám đốc đọc — mỗi ý 1 gạch • , nêu Thiếu gì → Cần sửa gì (gợi ý 1 dòng mẫu nếu cần). < 80 từ. KHÔNG xưng tên nhân viên, KHÔNG viết đoạn dài.',
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
