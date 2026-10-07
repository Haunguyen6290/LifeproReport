// src/lib/co-van/config.ts — đọc cấu hình Cố vấn từ bảng settings
// Tái dùng key/endpoint/model/brief của chatbot, nhưng không phụ thuộc AI_ENABLED
import type { AIConfig } from '@/lib/chatbot/ai';
import { DEFAULT_COMPANY_BRIEF } from '@/lib/chatbot/ai';

export type CoVanConfig = {
  ai: AIConfig;
  autoSend: boolean;
  extraInstructions: string;
  privateChatId: string;
  webhookSecret: string;
};

const DEFAULT_MODEL = 'claude-sonnet-4-5';

export async function loadCoVanConfig(admin: { from: (t: string) => any }): Promise<CoVanConfig> {
  const { data } = await admin.from('settings').select('key, value');
  const v: Record<string, string> = {};
  for (const r of (data ?? []) as { key: string; value: string }[]) v[r.key] = r.value;
  return {
    ai: {
      enabled: true, // Cố vấn không phụ thuộc AI_ENABLED của chatbot nhân viên
      key: (v.AI_KEY ?? '').trim(),
      endpoint: (v.AI_ENDPOINT ?? '').trim(),
      model: (v.AI_MODEL ?? '').trim() || DEFAULT_MODEL,
      freeLimit: 999,
      brief: (v.AI_COMPANY_BRIEF ?? '').trim() || DEFAULT_COMPANY_BRIEF,
    },
    autoSend: String(v.CO_VAN_AUTO_SEND ?? '').toUpperCase() === 'TRUE',
    extraInstructions: (v.CO_VAN_EXTRA_INSTRUCTIONS ?? '').trim(),
    privateChatId: (v.CO_VAN_TELEGRAM_PRIVATE_CHAT_ID ?? '').trim(),
    webhookSecret: (v.CO_VAN_TELEGRAM_WEBHOOK_SECRET ?? '').trim(),
  };
}
