// src/lib/co-van/prompt.ts — prompt chấm theo MỤC TIÊU + PHẠM VI + ĐẦU RA

import { DEFAULT_COMPANY_BRIEF } from '@/lib/chatbot/ai';

const TIEU_CHI_CHUNG = 'GIAO VIỆC = MỤC TIÊU + PHẠM VI + ĐẦU RA → Thời hạn → Người chịu trách nhiệm → Kết quả.';

const TIEU_CHI_KE_HOACH = [
  'Kế hoạch gồm 2 phần — chấm riêng từng phần:',
  '1) MỤC TIÊU TUẦN: Đạt khi có Mục tiêu (muốn đạt gì) + Phạm vi (cho nhóm/khách/mã nào) + Đầu ra đo được (con số) + Thời hạn.',
  '2) KẾ HOẠCH TUẦN (các dòng việc): Đạt khi mỗi việc có Phạm vi rõ + Đầu ra đo được + Ngày làm + Người làm. Thiếu 1 ý là chưa đạt.',
  'Kết luận chung: cả 2 phần đều Đạt thì Đạt; 1 phần chưa đạt thì Cần sửa/Không đạt.',
].join('\n');

const TIEU_CHI_BAO_CAO = [
  'Báo cáo gồm: Kết quả từng việc + Thông tin giá trị + Đề xuất. Chấm riêng từng phần:',
  '1) Kết quả: Đạt khi đối chiếu từng việc kế hoạch (xong/một phần/chưa, có số) + Nguyên nhân thật + Bước tiếp theo. 100% nhưng nhiều dòng Chưa xong là sai.',
  '2) Thông tin: Đạt khi có giá trị — cụ thể, có số, có nguyên nhân sâu. Ghi chung chung "khách chê/không mua/bận/không có nhu cầu" là chưa đạt.',
  '3) Đề xuất: Đạt khi có bước tiếp theo cụ thể (làm gì + với ai + khi nào + đầu ra gì). Ghi "cố gắng", "tiếp tục chăm sóc" là chưa đạt.',
].join('\n');

const TIEU_CHI_CHIEN_DICH = 'Chiến dịch Đạt khi: Mục tiêu có số + Phạm vi rõ (dự án/sản phẩm/nhóm khách nào) + Đầu ra đo được (doanh số, số đại lý, độ phủ) + Thời hạn + Người chịu trách nhiệm. Thiếu 1 ý là chưa đạt.';

const TIEU_CHI_TIN = 'Tin thị trường Đạt khi: Mục tiêu rõ (thu thập gì) + Phạm vi rõ (khu vực/nhóm khách/sản phẩm nào) + Đầu ra cụ thể (thông tin gì, để làm gì) + Thời hạn + Người chịu trách nhiệm. Tin chung chung, không có đầu ra hành động là chưa đạt.';

const DOI_PHO = 'Dấu hiệu đối phó: chép lại tuần trước, 100% nhưng việc rỗng, việc hứa biến mất, nộp sát hạn ngắn bất thường.';

function tieuChiTheoLoai(loai: string): string {
  if (loai === 'chien_dich') return `${TIEU_CHI_CHUNG}\n${TIEU_CHI_CHIEN_DICH}\n${DOI_PHO}`;
  if (loai === 'tin_thi_truong') return `${TIEU_CHI_CHUNG}\n${TIEU_CHI_TIN}\n${DOI_PHO}`;
  if (loai === 'bao_cao') return `${TIEU_CHI_CHUNG}\n${TIEU_CHI_BAO_CAO}\n${DOI_PHO}`;
  return `${TIEU_CHI_CHUNG}\n${TIEU_CHI_KE_HOACH}\n${DOI_PHO}`;
}

export function buildCoVanSystem(brief: string, extraInstructions: string, loai?: string): string {
  const company = (brief || '').trim() || DEFAULT_COMPANY_BRIEF;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const parts = [
    'Bạn là Cố vấn Giám đốc. Chấm bài của nhân viên.',
    `BỐI CẢNH:\n${company}`,
    tieuChiTheoLoai(loai ?? ''),
    `Hôm nay: ${dd}/${mm}/${now.getFullYear()}.`,
  ];
  if (extraInstructions.trim()) parts.push(`GHI CHÚ GIÁM ĐỐC:\n${extraInstructions.trim()}`);
  parts.push(
    'ĐẦU RA: chỉ 1 JSON duy nhất, không thêm chữ:',
    '{"ket_qua":"Dat|Can sua|Khong dat","ly_do":"...","dau_hieu_doi_pho":"...","gop_y_soan_san":"..."}',
    '- ly_do: nêu rõ 2 phần — "Mục tiêu: ... | Kế hoạch: ...", mỗi phần thiếu ý nào, < 100 từ.',
    '- gop_y: cô đọng, ngắn gọn, đủ ý — chỉ thiếu gì + gợi ý sửa 1-2 dòng mẫu, < 100 từ. VD: "Chiến à, Mục tiêu còn chung chung (thiếu Đầu ra). Kế hoạch thiếu Phạm vi. Sửa: T2-T3: Gọi 15 đại lý B tuyến HN-HP chốt 5 đơn F3 Ultra."',
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
