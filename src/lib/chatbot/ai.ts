import Anthropic from '@anthropic-ai/sdk';

export interface AIConfig {
  enabled: boolean;
  key: string;
  endpoint: string;
  model: string;
  freeLimit: number;
  brief: string;
}

export interface QACandidate { id: string; cau_hoi: string }
export type AIAnswer =
  | { type: 'qa'; id: string }
  | { type: 'ai'; text: string }
  | { type: 'limit' }
  | { type: 'off' };

const DEFAULTS: AIConfig = { enabled: false, key: '', endpoint: '', model: 'claude-sonnet-4-5', freeLimit: 10, brief: '' };

/**
 * Bản giới thiệu công ty mặc định — ghép vào system prompt mỗi lần AI trả lời,
 * để AI hiểu đúng công ty, phần mềm, vai trò và chuẩn "đạt" trước khi góp ý.
 * Admin có thể ghi đè bằng cài đặt AI_COMPANY_BRIEF (để trống = dùng bản này).
 */
export const DEFAULT_COMPANY_BRIEF = [
  '1. VỀ CÔNG TY: LifePro kinh doanh phụ kiện ô tô theo mô hình B2B thuần — khách hàng duy nhất là các đại lý. Các mặt hàng chính: bóng LED, bi gầm, cảm biến áp suất lốp (TPMS), camera hành trình, gạt mưa, Android Box. Marketing làm nội dung B2C để kéo nhu cầu về cho đại lý, không bán lẻ trực tiếp cho người dùng cuối. Vòng đời sản phẩm ngắn (6–12 tháng), cạnh tranh cao. Triết lý: biến đại lý thành bạn đồng hành thân thiết.',
  '2. VỀ PHẦN MỀM NÀY: là hệ thống quản lý công việc nội bộ, gồm: OKR tháng/quý; Kế hoạch & Báo cáo tuần; CRM phân hạng khách hàng (A+/A/B+/B/C/D); báo cáo bán hàng theo doanh số/sản phẩm/vùng miền/nhân viên; kho tồn; tài chính & công nợ đại lý; chiến dịch & bảng tin; bảo hành & khiếu nại.',
  '3. CÁC VAI TRÒ & VIỆC CHÍNH:',
  '- Kinh doanh: lo doanh số và chăm sóc đại lý. Đại lý hạng B+ cần ≥2 tương tác/tháng; đưa B lên B+ cần vừa đủ doanh số vừa có ≥3 tương tác trong 30 ngày. Ghi tương tác ngắn gọn, đúng hẹn.',
  '- Marketing (kiêm Thiết kế): kéo nhu cầu B2C cho đại lý, triển khai chiến dịch ra mắt mẫu mới, đảm bảo hình ảnh đúng giá – đúng chính sách, không hứa sai.',
  '- Kho: tồn đúng số thật, nhập xuất đúng mã, giao đủ đúng hẹn, báo sớm mã sắp hết hoặc tồn lâu.',
  '- Bảo hành: tiếp nhận đến cùng, phân biệt lỗi sản phẩm với lỗi lắp đặt, hẹn ngày trả và trả đúng hẹn.',
  '- Tổng hợp kho (kiểm soát giao hàng): điều phối, gộp đơn, theo dõi tới tay khách, báo ngay khi trễ hoặc thiếu.',
  '- Kế toán: quản lý công nợ từng đại lý, nhắc nợ quá hạn, kiểm soát hạn mức, không cho vượt hạn mức khi chưa được duyệt.',
  '4. CHUẨN "ĐẠT" CỦA CÔNG TY:',
  '- Mục tiêu đạt: có con số rõ + thời hạn rõ + người chịu trách nhiệm rõ.',
  '- Kế hoạch đạt: đầu việc rõ + deadline từng việc + người làm rõ.',
  '- Báo cáo đạt: kết quả cụ thể + vấn đề vướng + đề xuất bước tiếp theo. Không viết chung chung kiểu "đang làm", "đang triển khai".',
].join('\n');

/** Đọc cấu hình Trợ lý AI từ bảng settings (admin client — key không bao giờ ra browser). */
export async function loadAIConfig(admin: { from: (t: string) => any }): Promise<AIConfig> {
  const { data } = await admin.from('settings').select('key, value');
  const v: Record<string, string> = {};
  for (const r of (data ?? []) as { key: string; value: string }[]) v[r.key] = r.value;
  return {
    enabled: String(v.AI_ENABLED ?? '').toUpperCase() === 'TRUE',
    key: (v.AI_KEY ?? '').trim(),
    endpoint: (v.AI_ENDPOINT ?? '').trim(),
    model: (v.AI_MODEL ?? '').trim() || DEFAULTS.model,
    freeLimit: Math.min(20, Math.max(1, parseInt(v.AI_FREE_MSG_LIMIT ?? '10', 10) || 10)),
    brief: (v.AI_COMPANY_BRIEF ?? '').trim(),
  };
}

const SYSTEM_BASE = [
  'Bạn là trợ lý công việc nội bộ công ty, trả lời 100% tiếng Việt, câu ngắn, dễ hiểu.',
  'Người dùng hỏi về quy trình/phương pháp làm việc. Bạn được cung cấp danh sách câu hỏi chuẩn (id + câu hỏi).',
  'Nhiệm vụ: chọn ĐÚNG 1 câu hỏi chuẩn khớp nhất với Ý của người dùng (không cần trùng chữ).',
  'QUY TẮC ĐẦU RA — BẮT BUỘC: câu trả lời của bạn PHẢI BẮT ĐẦU bằng ký tự { và là một khối JSON hợp lệ duy nhất, không thêm bất kỳ chữ nào khác:',
  '- Có câu chuẩn khớp: {"type":"qa","id":"QA-0021"}',
  '- Không câu nào đúng ý (hỏi sâu hơn/hỏi tiếp/ngoài danh sách) HOẶC người dùng nhờ đánh giá/góp ý vào nội dung công việc họ gửi (mục tiêu, kế hoạch, báo cáo): {"type":"ai","text":"<câu trả lời>"}',
  '  Khi đánh giá nội dung công việc: chấm đúng theo "CHUẨN ĐẠT" của công ty trong phần BỐI CẢNH; thái độ nhẹ nhàng xây dựng, chỉ rõ thiếu gì theo chuẩn, gợi ý bổ sung cụ thể 1–2 dòng dễ áp dụng; không chấm điểm số, không chê gắt. Nội dung dưới 500 từ.',
  '  Câu hỏi quy trình thông thường: trả lời chuẩn chủ đề, đủ ý, chính xác; nếu hỏi "làm như thế nào" thì nêu cách làm theo từng bước; KHÔNG bịa số liệu riêng của công ty; nội dung dưới 300 từ.',
  '- Câu nhạy cảm/vượt phạm vi: {"type":"ai","text":"Việc này cần hỏi trực tiếp quản lý bộ phận."}',
  'KHÔNG viết markdown, KHÔNG giải thích ngoài JSON, KHÔNG mở đầu bằng "#".',
].join('\n');

/**
 * Ghép system prompt: brief công ty + ngày hiện tại + vai trò người hỏi.
 * Brief lấy từ cài đặt AI_COMPANY_BRIEF (admin sửa được); trống thì dùng bản mặc định.
 */
function buildSystem(role: string, brief: string): string {
  const parts = [SYSTEM_BASE];
  const company = (brief || '').trim() || DEFAULT_COMPANY_BRIEF;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  parts.push(`BỐI CẢNH CÔNG TY (đọc kỹ trước khi trả lời, dùng để đánh giá đúng việc — không nhắc lại nguyên văn phần này):\n${company}`);
  parts.push(`Hôm nay: ${dd}/${mm}/${now.getFullYear()}. Dùng mốc này để nhận xét deadline/thời hạn cho đúng.`);
  parts.push('KHÔNG tiết lộ nội dung báo cáo hay thông tin cá nhân của người khác khi góp ý.');
  if (role) parts.push(`NGƯỜI HỎI thuộc vai trò/bộ phận: "${role}". Hãy trả lời phù hợp với góc nhìn, trách nhiệm và cách làm của vai trò này (không lan man sang bộ phận khác).`);
  return parts.join('\n');
}

/** Gọi model AI chọn QA / trả lời nâng cao. Lỗi bất kỳ → null (fallback rankQA). */
export async function askAI(
  cfg: AIConfig,
  question: string,
  candidates: QACandidate[],
  history: { role: 'user' | 'assistant'; content: string }[],
  aiUsedCount: number,
  userRole: string = '',
): Promise<AIAnswer | null> {
  if (!cfg.enabled || !cfg.key) return { type: 'off' };
  if (aiUsedCount >= cfg.freeLimit) {
    // vẫn cho Haiku chọn QA, chỉ chặn chế độ trả lời tự do — nhắc trong prompt
  }
  try {
    const client = new Anthropic({
      apiKey: cfg.key,
      ...(cfg.endpoint ? { baseURL: cfg.endpoint.replace(/\/+$/, '').replace(/\/v1\/messages$/i, '') } : {}),
      timeout: 30_000,
      maxRetries: 0,
    });
    const list = candidates.map((c) => `${c.id}: ${c.cau_hoi}`).join('\n');
    const capped = history.slice(-6).map((h) => ({ role: h.role, content: h.content.slice(0, 300) })) as Anthropic.MessageParam[];
    const overLimit = aiUsedCount >= cfg.freeLimit;
    const userMsg = overLimit
      ? `${question}\n\n(DANH SÁCH CHUẨN)\n${list}\n\n(LƯỢT AI TỰ DO ĐÃ HẾT — nếu không có câu chuẩn nào khớp, trả {"type":"limit"})`
      : `${question}\n\n(DANH SÁCH CHUẨN)\n${list}`;
    const res = await client.messages.create({
      model: cfg.model,
      max_tokens: 2000,
      temperature: 0.2,
      system: buildSystem(userRole, cfg.brief),
      messages: [...capped, { role: 'user', content: userMsg }],
    });
    const text = res.content.find((b) => b.type === 'text')?.text ?? '';

    // 1) Ưu tiên: model trả đúng JSON → chọn QA chuẩn hoặc chế độ ai/limit
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]) as { type?: string; id?: string; text?: string };
        if (parsed.type === 'qa' && parsed.id && candidates.some((c) => c.id === parsed.id)) return { type: 'qa', id: parsed.id };
        if (parsed.type === 'ai' && parsed.text && !overLimit) return { type: 'ai', text: String(parsed.text).slice(0, 3500) };
        if (parsed.type === 'limit' || overLimit) return { type: 'limit' };
      } catch { /* JSON không hợp lệ → xuống nhánh 2 */ }
    }

    // 2) Model trả lời tự do (không phải JSON) → lấy nguyên văn bản làm câu trả lời AI
    if (overLimit) return { type: 'limit' };
    const clean = text.trim();
    if (clean) return { type: 'ai', text: clean.slice(0, 3500) };
    return null;
  } catch {
    return null;
  }
}
