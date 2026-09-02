import Anthropic from '@anthropic-ai/sdk';

export interface AIConfig {
  enabled: boolean;
  key: string;
  endpoint: string;
  model: string;
  freeLimit: number;
}

export interface QACandidate { id: string; cau_hoi: string }
export type AIAnswer =
  | { type: 'qa'; id: string }
  | { type: 'ai'; text: string }
  | { type: 'limit' }
  | { type: 'off' };

const DEFAULTS: AIConfig = { enabled: false, key: '', endpoint: '', model: 'claude-haiku-4-5', freeLimit: 5 };

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
    freeLimit: Math.min(10, Math.max(1, parseInt(v.AI_FREE_MSG_LIMIT ?? '5', 10) || 5)),
  };
}

const SYSTEM_BASE = [
  'Bạn là trợ lý công việc nội bộ công ty, trả lời 100% tiếng Việt, câu ngắn, dễ hiểu.',
  'Người dùng hỏi về quy trình/phương pháp làm việc. Bạn được cung cấp danh sách câu hỏi chuẩn (id + câu hỏi).',
  'Nhiệm vụ: chọn ĐÚNG 1 câu hỏi chuẩn khớp nhất với Ý của người dùng (không cần trùng chữ).',
  'QUY TẮC ĐẦU RA — BẮT BUỘC: câu trả lời của bạn PHẢI BẮT ĐẦU bằng ký tự { và là một khối JSON hợp lệ duy nhất, không thêm bất kỳ chữ nào khác:',
  '- Có câu chuẩn khớp: {"type":"qa","id":"QA-0021"}',
  '- Không câu nào đúng ý (hỏi sâu hơn/hỏi tiếp/ngoài danh sách): {"type":"ai","text":"<trả lời chuẩn chủ đề, ngắn gọn ≤ 4 câu, đủ ý, chính xác; nếu hỏi \\"làm như thế nào\\" thì nêu cách làm theo từng bước; KHÔNG bịa số liệu riêng của công ty>"}',
  '- Câu nhạy cảm/vượt phạm vi: {"type":"ai","text":"Việc này cần hỏi trực tiếp quản lý bộ phận."}',
  'KHÔNG viết markdown, KHÔNG giải thích ngoài JSON, KHÔNG mở đầu bằng "#".',
].join('\n');

/** Ghép system prompt: thêm ngữ cảnh vai trò người hỏi để AI trả lời đúng góc nhìn của họ. */
function buildSystem(role: string): string {
  if (!role) return SYSTEM_BASE;
  return `${SYSTEM_BASE}\nNGƯỜI HỎI thuộc vai trò/bộ phận: "${role}". Hãy trả lời phù hợp với góc nhìn, trách nhiệm và cách làm của vai trò này (không lan man sang bộ phận khác).`;
}

/** Gọi Haiku chọn QA / trả lời nâng cao. Lỗi bất kỳ → null (fallback rankQA). */
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
      max_tokens: 1000,
      temperature: 0.2,
      system: buildSystem(userRole),
      messages: [...capped, { role: 'user', content: userMsg }],
    });
    const text = res.content.find((b) => b.type === 'text')?.text ?? '';

    // 1) Ưu tiên: model trả đúng JSON → chọn QA chuẩn hoặc chế độ ai/limit
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]) as { type?: string; id?: string; text?: string };
        if (parsed.type === 'qa' && parsed.id && candidates.some((c) => c.id === parsed.id)) return { type: 'qa', id: parsed.id };
        if (parsed.type === 'ai' && parsed.text && !overLimit) return { type: 'ai', text: String(parsed.text).slice(0, 900) };
        if (parsed.type === 'limit' || overLimit) return { type: 'limit' };
      } catch { /* JSON không hợp lệ → xuống nhánh 2 */ }
    }

    // 2) Model trả lời tự do (không phải JSON) → lấy nguyên văn bản làm câu trả lời AI
    if (overLimit) return { type: 'limit' };
    const clean = text.trim();
    if (clean) return { type: 'ai', text: clean.slice(0, 900) };
    return null;
  } catch {
    return null;
  }
}
