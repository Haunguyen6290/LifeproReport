'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { AdminTabs } from '@/components/AdminTabs';

const KEYS = [
  { key: 'APP_NAME', label: 'Tên ứng dụng (hiện ở sidebar)' },
  { key: 'TEN_DOANH_NGHIEP', label: 'Tên doanh nghiệp' },
  { key: 'TEN_RUT_GON', label: 'Tên rút gọn' },
  { key: 'TIMEZONE', label: 'Múi giờ (vd Asia/Ho_Chi_Minh)' },
  { key: 'DATE_FORMAT', label: 'Định dạng ngày (vd yyyy-MM-dd)' },
  { key: 'TELEGRAM_BOT_TOKEN', label: 'Telegram Bot Token' },
  { key: 'TELEGRAM_CHAT_ID', label: 'Telegram Chat ID' },
];
const TOGGLES = [
  { key: 'TB_KHACH_HANG_MOI', label: 'Khách hàng mới' },
  { key: 'TB_TIN_THI_TRUONG_MOI', label: 'Tin thị trường mới' },
  { key: 'TB_COMMENT_MOI', label: 'Comment mới' },
  { key: 'TB_CAP_NHAT_CHIEN_DICH', label: 'Cập nhật chiến dịch' },
  { key: 'TB_CHIEN_DICH_MOI', label: 'Chiến dịch mới' },
  { key: 'TB_KET_LUAN', label: 'Kết luận' },
  { key: 'TB_IMPORT', label: 'Import Excel' },
  { key: 'TB_OKR', label: 'OKR' },
  { key: 'TB_KE_HOACH_TUAN', label: 'Kế hoạch tuần' },
  { key: 'TB_BAO_CAO_TUAN', label: 'Báo cáo tuần' },
  { key: 'TB_BAO_CAO_KHO', label: 'Báo cáo kho' },
];

function Screen() {
  const { userId, can } = useAuth();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('settings').select('key, value');
    const v: Record<string, string> = {};
    for (const r of (data ?? []) as { key: string; value: string }[]) v[r.key] = r.value;
    setVals(v);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true); setMsg('');
    for (const k of Object.keys(vals)) {
      await supabase.from('settings').upsert({ key: k, value: vals[k], updated_by: userId }, { onConflict: 'key' });
    }
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Lưu cài đặt', entity_type: 'settings', entity_id: null, details: { keys: Object.keys(vals), full_name: me2?.full_name ?? '' } }); } catch {}
    setBusy(false); setMsg('Đã lưu.');
  }

  async function testTelegram() {
    setMsg('Đang gửi…');
    try {
      const text = `✅ Kết nối thành công — ${vals.TEN_DOANH_NGHIEP || 'Hệ thống'}\nThời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;
      const res = await fetch('/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, test: true }) });
      const body = await res.json();
      setMsg(body.ok ? 'Đã gửi tin thử vào Telegram.' : ('Thất bại: ' + (body.description ?? body.reason ?? '')));
    } catch (e: any) { setMsg('Lỗi: ' + (e as any).message); }
  }

  async function layGroupId() {
    setMsg('Đang dò group…');
    try {
      const res = await fetch('/api/telegram');
      const j = await res.json();
      if (!j.chats || j.chats.length === 0) { setMsg('Chưa thấy group nào. Hãy add @TonKHoNovaX_bot vào group, gửi "hello" rồi bấm lại.'); return; }
      const groups = j.chats.filter((c: any) => c.type === 'supergroup' || c.type === 'group');
      if (groups.length === 0) { setMsg('Chỉ thấy chat cá nhân. Hãy add bot vào group và gửi 1 tin trong group.'); return; }
      const g = groups[0];
      setVals({ ...vals, TELEGRAM_CHAT_ID: String(g.id) });
      setMsg(`Đã tìm thấy group: ${g.title || g.id} (${g.id}) — bấm Lưu cài đặt để lưu.`);
    } catch (e: any) { setMsg('Lỗi: ' + (e as any).message); }
  }

  if (!can('quan_ly_cai_dat')) return <AppSidebar><main className="px-6 py-10 text-slate-700">Bạn không có quyền.</main></AppSidebar>;
  const sel = 'rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]';
  const card = 'rounded-xl border border-slate-200 bg-white p-4 backdrop-blur sm:p-5';

  return (
    <AppSidebar>

      <main className="w-full px-4 py-6 sm:px-6 text-slate-900">
        <AdminTabs />
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Cài đặt hệ thống</h1>
        <div className={card}>
          <div className="space-y-3">
            {KEYS.map((k) => (
              <div key={k.key} className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
                <label className="text-sm font-semibold">{k.label}</label>
                <input value={vals[k.key] ?? ''} onChange={(e) => setVals({ ...vals, [k.key]: e.target.value })} className={sel} type={k.key.includes('TOKEN') ? 'password' : 'text'} />
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} mt-4`}>
          <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Thông báo Telegram</h2>
          <p className="mb-3 text-xs text-slate-600">Bật/tắt từng loại sự kiện được đẩy về group chung.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {TOGGLES.map((t) => (
              <label key={t.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={String(vals[t.key] ?? '').toUpperCase() === 'TRUE'} onChange={(e) => setVals({ ...vals, [t.key]: e.target.checked ? 'TRUE' : 'FALSE' })} /> {t.label}</label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2"><button onClick={layGroupId} className="rounded-md border border-[var(--color-muted)] px-3 py-2 text-sm hover:border-[var(--color-primary)]">Lấy Group ID</button><button onClick={testTelegram} className="rounded-md border border-[var(--color-muted)] px-3 py-2 text-sm hover:border-[var(--color-primary)]">Gửi tin thử Telegram</button></div>
          <p className="mt-2 text-xs text-slate-500">Mẹo: Add @TonKHoNovaX_bot vào group, gửi "hello" trong group, bấm Lấy Group ID, rồi Lưu cài đặt. Nếu không thấy, tắt Group Privacy cho bot qua @BotFather.</p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {msg && <span className="self-center text-sm text-[#1e3a8a]">{msg}</span>}
          <button onClick={save} disabled={busy} className="rounded-md bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu cài đặt'}</button>
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
