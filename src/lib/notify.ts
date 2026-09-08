import { supabase } from '@/lib/supabase/client';

/**
 * Gửi thông báo Telegram ở chế độ NỀN (fire-and-forget) — không bắt người dùng đợi.
 * An toàn: chỉ dùng cho thông báo phụ; dữ liệu chính + audit đã được lưu (await) trước khi gọi hàm này.
 * - keepalive: true để request vẫn chạy xong kể cả khi trang chuyển/đóng.
 * - text nhận hàm (nm) => string để chèn tên người gửi sau khi fetch nền.
 */
export function notifyTelegram(
  eventKey: string,
  text: string | ((nm: string) => string),
  userId?: string,
): void {
  void (async () => {
    try {
      let nm = '';
      if (userId) {
        const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
        nm = (data as any)?.full_name ?? '';
      }
      const body = typeof text === 'function' ? text(nm) : text;
      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventKey, text: body }),
        keepalive: true,
      });
    } catch {
      /* thông báo phụ — bỏ qua lỗi, không ảnh hưởng dữ liệu */
    }
  })();
}
