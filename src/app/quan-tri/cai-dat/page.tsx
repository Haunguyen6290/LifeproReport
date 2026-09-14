'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { AdminTabs } from '@/components/AdminTabs';
import { FinanceSettingsPanel } from '@/components/FinanceSettingsPanel';

const KEYS = [
  { key: 'APP_NAME', label: 'Tên ứng dụng (hiện ở sidebar)' },
  { key: 'LOGIN_TITLE', label: 'Dòng chào mừng (trang đăng nhập)' },
  { key: 'LOGIN_SUBTITLE', label: 'Dòng phụ đề (trang đăng nhập)' },
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
// Bot 8h30 thứ 2 — việc nào tích thì bot sẽ kiểm tra + đăng cảnh báo lên Bảng tin
const BOT_CHECKS = [
  { key: 'BOT_CHECK_OKR', label: 'Chưa tạo OKR cá nhân kỳ hiện tại' },
  { key: 'BOT_CHECK_KE_HOACH_TUAN', label: 'Chưa nộp Kế hoạch tuần' },
  { key: 'BOT_CHECK_BAO_CAO_TUAN', label: 'Chưa nộp Báo cáo tuần (tuần trước)' },
  { key: 'BOT_CHECK_BAO_CAO_KHO', label: 'Chưa có Báo cáo kho trong 7 ngày' },
  { key: 'BOT_CHECK_DANG_NHAP', label: 'Không đăng nhập quá 7 ngày' },
  { key: 'BOT_CHECK_TIN_THI_TRUONG', label: 'Tuần rồi không có Tin thị trường mới' },
  { key: 'BOT_CHECK_CHIEN_DICH', label: 'Tuần rồi không có Cập nhật Chiến dịch' },
];
// Mặc định mỗi việc -> vai trò nào bị bot soi (tag)
const DEFAULT_BOT_ROLE_MAP: Record<string, string[]> = {
  BOT_CHECK_OKR: ['KINH_DOANH', 'MARKETING', 'KHO', 'TỔNG_HỢP_KHO', 'BẢO_HÀNH', 'KẾ_TOÁN', 'LÁI_XE'],
  BOT_CHECK_KE_HOACH_TUAN: ['KINH_DOANH', 'MARKETING'],
  BOT_CHECK_BAO_CAO_TUAN: ['KINH_DOANH', 'MARKETING'],
  BOT_CHECK_BAO_CAO_KHO: ['KHO', 'TỔNG_HỢP_KHO', 'BẢO_HÀNH', 'LÁI_XE'],
  BOT_CHECK_DANG_NHAP: ['KINH_DOANH', 'MARKETING', 'KHO', 'TỔNG_HỢP_KHO', 'BẢO_HÀNH', 'KẾ_TOÁN', 'LÁI_XE'],
  BOT_CHECK_TIN_THI_TRUONG: ['KINH_DOANH', 'MARKETING'],
  BOT_CHECK_CHIEN_DICH: ['KINH_DOANH', 'MARKETING'],
};

function Screen() {
  const { userId, can } = useAuth();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [allowedNames, setAllowedNames] = useState<string[]>([]);
  const [nameMap, setNameMap] = useState<{ from: string; to: string }[]>([]);
  const [newAllowed, setNewAllowed] = useState('');
  const [newMapFrom, setNewMapFrom] = useState('');
  const [newMapTo, setNewMapTo] = useState('');
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [botRoleMap, setBotRoleMap] = useState<Record<string, string[]>>({});

  async function load() {
    const { data } = await supabase.from('settings').select('key, value');
    const v: Record<string, string> = {};
    for (const r of (data ?? []) as { key: string; value: string }[]) v[r.key] = r.value;
    setVals(v);
    try { const a = JSON.parse(v.SALES_ALLOWED_NAMES ?? '[]'); if (Array.isArray(a)) setAllowedNames(a); } catch {}
    try {
      const m = JSON.parse(v.SALES_NAME_MAP ?? '{}');
      if (m && typeof m === 'object' && !Array.isArray(m)) setNameMap(Object.entries(m).map(([from, to]) => ({ from, to: String(to) })));
    } catch {}
    // Bot role map
    try {
      const b = JSON.parse(v.BOT_ROLE_MAP ?? '{}');
      if (b && typeof b === 'object' && !Array.isArray(b)) setBotRoleMap(b);
      else setBotRoleMap(DEFAULT_BOT_ROLE_MAP);
    } catch { setBotRoleMap(DEFAULT_BOT_ROLE_MAP); }
    if (!v.BOT_ROLE_MAP) setBotRoleMap((prev) => Object.keys(prev).length ? prev : DEFAULT_BOT_ROLE_MAP);
    const { data: rs } = await supabase.from('roles').select('id, name').order('name');
    setRoles(((rs ?? []) as { id: string; name: string }[]));
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true); setMsg('');
    const valsToSave = { ...vals };
    valsToSave.SALES_ALLOWED_NAMES = JSON.stringify(allowedNames);
    const mapObj: Record<string, string> = {};
    for (const r of nameMap) if (r.from.trim() && r.to.trim()) mapObj[r.from.trim()] = r.to.trim();
    valsToSave.SALES_NAME_MAP = JSON.stringify(mapObj);
    valsToSave.BOT_ROLE_MAP = JSON.stringify(botRoleMap);
    for (const k of Object.keys(valsToSave)) {
      await supabase.from('settings').upsert({ key: k, value: valsToSave[k], updated_by: userId }, { onConflict: 'key' });
    }
    setVals(valsToSave);
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Lưu cài đặt', entity_type: 'settings', entity_id: null, details: { keys: Object.keys(valsToSave), full_name: me2?.full_name ?? '' } }); } catch {}
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

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setMsg('Chỉ chọn file ảnh PNG/JPG.'); return; }
    if (f.size > 2 * 1024 * 1024) { setMsg('Ảnh tối đa 2MB.'); return; }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(f));
    setMsg('');
  }

  async function uploadLogo() {
    const f = logoRef.current?.files?.[0];
    if (!f) { setMsg('Chưa chọn logo — bấm Chọn ảnh trước.'); return; }
    setLogoBusy(true); setMsg('Đang upload logo…');
    try {
      // Nén ảnh xuống tối đa 600px
      const bmp = await createImageBitmap(f);
      const scale = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png', 0.92));
      const fd = new FormData();
      fd.append('file', blob, 'logo.png');
      const resp = await fetch('/api/branding/logo', { method: 'POST', body: fd });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body?.error ?? 'Upload thất bại');
      const url = body.url as string;
      await supabase.from('settings').upsert({ key: 'LOGO_URL', value: url, updated_by: userId }, { onConflict: 'key' });
      setVals((prev) => ({ ...prev, LOGO_URL: url }));
      setLogoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      if (logoRef.current) logoRef.current.value = '';
      setMsg('Đã upload logo — mở trang đăng nhập để xem.');
    } catch (e: any) {
      setMsg('Upload thất bại: ' + (e?.message ?? ''));
    } finally { setLogoBusy(false); }
  }

  async function removeLogo() {
    setLogoBusy(true);
    try {
      await supabase.from('settings').upsert({ key: 'LOGO_URL', value: '', updated_by: userId }, { onConflict: 'key' });
      setVals((prev) => ({ ...prev, LOGO_URL: '' }));
      setLogoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      if (logoRef.current) logoRef.current.value = '';
      setMsg('Đã gỡ logo — trang đăng nhập sẽ dùng biểu tượng mặc định.');
    } catch (e: any) { setMsg('Lỗi: ' + (e as any).message); }
    finally { setLogoBusy(false); }
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
          <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Logo trang đăng nhập</h2>
          <p className="mb-2 text-xs text-slate-600">Upload ảnh PNG/JPG (tối đa 2MB, tự nén). Chưa có logo sẽ dùng biểu tượng mặc định.</p>
          {vals.LOGO_URL ? (
            <div className="mb-2">
              <img src={vals.LOGO_URL} alt="Logo hiện tại" className="max-h-[80px] max-w-[220px] object-contain rounded-lg bg-white border border-slate-200 p-2" />
              <p className="mt-1 text-xs text-slate-500 break-all">{vals.LOGO_URL}</p>
            </div>
          ) : (
            <p className="mb-2 text-xs italic text-slate-500">Chưa có logo.</p>
          )}
          {logoPreview && (
            <div className="mb-2">
              <img src={logoPreview} alt="Xem trước" className="max-h-[80px] max-w-[220px] object-contain rounded-lg bg-white border border-slate-200 p-2" />
              <p className="mt-1 text-xs text-slate-600">Xem trước — bấm Upload để lưu.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => logoRef.current?.click()} className="rounded-md border border-[var(--color-muted)] px-3 py-2 text-sm hover:border-[var(--color-primary)]">Chọn ảnh</button>
            <input ref={logoRef} id="logo-file" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickLogo} />
            <button onClick={uploadLogo} disabled={logoBusy} className="rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{logoBusy ? 'Đang upload…' : 'Upload'}</button>
            {vals.LOGO_URL && <button onClick={removeLogo} disabled={logoBusy} className="rounded-md border border-[var(--color-muted)] px-3 py-2 text-sm hover:border-red-300 hover:text-red-600">Gỡ logo</button>}
          </div>
        </div>

        <div className={`${card} mt-4`}>
          <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Nhân viên được tính vào báo cáo bán hàng</h2>
          <p className="mb-2 text-xs text-slate-600">Chỉ những dòng có <em>Kinh doanh QL</em> khớp tên trong danh sách này mới được tính. Ô trống / tên khác sẽ bị bỏ qua.</p>
          <ul className="mb-2 space-y-1">
            {allowedNames.map((n, i) => (
              <li key={i} className="flex items-center gap-2 text-sm"><span className="flex-1 rounded bg-slate-50 px-2 py-1">{n}</span><button onClick={() => setAllowedNames((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">Xóa</button></li>
            ))}
            {allowedNames.length === 0 && <li className="text-xs italic text-slate-500">Chưa có ai — hãy thêm 5 người ban đầu.</li>}
          </ul>
          <div className="flex gap-2">
            <input value={newAllowed} onChange={(e) => setNewAllowed(e.target.value)} placeholder="Tên nhân viên (vd Nguyễn Trung Chính SG)" className={`${sel} flex-1`} onKeyDown={(e) => { if (e.key === 'Enter' && newAllowed.trim()) { setAllowedNames((prev) => [...prev, newAllowed.trim()]); setNewAllowed(''); } }} />
            <button onClick={() => { if (newAllowed.trim()) { setAllowedNames((prev) => [...prev, newAllowed.trim()]); setNewAllowed(''); } }} className="rounded-md border border-[var(--color-muted)] px-3 py-2 text-sm hover:border-[var(--color-primary)]">Thêm</button>
          </div>
        </div>

        <div className={`${card} mt-4`}>
          <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Ánh xạ tên nhân viên</h2>
          <p className="mb-2 text-xs text-slate-600">Gộp các tên khác nhau về một người, ví dụ <code>Nguyễn Trung Chính SG → Nguyễn Trung Chính</code>. Doanh số sẽ được cộng dồn theo tên đích.</p>
          {nameMap.length > 0 && (
            <table className="mb-2 w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="pb-1">Tên gốc</th><th className="pb-1">Tên gộp</th><th></th></tr></thead>
              <tbody>
                {nameMap.map((r, i) => (
                  <tr key={i}><td className="py-1 pr-2"><input value={r.from} onChange={(e) => setNameMap((prev) => prev.map((x, j) => j === i ? { ...x, from: e.target.value } : x))} className={`${sel} w-full py-1`} /></td><td className="py-1 pr-2"><input value={r.to} onChange={(e) => setNameMap((prev) => prev.map((x, j) => j === i ? { ...x, to: e.target.value } : x))} className={`${sel} w-full py-1`} /></td><td className="py-1"><button onClick={() => setNameMap((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">Xóa</button></td></tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex flex-wrap gap-2">
            <input value={newMapFrom} onChange={(e) => setNewMapFrom(e.target.value)} placeholder="Tên gốc (vd Đỗ Thành Công)" className={`${sel} flex-1 min-w-[140px]`} />
            <span className="self-center text-slate-500">→</span>
            <input value={newMapTo} onChange={(e) => setNewMapTo(e.target.value)} placeholder="Tên gộp (vd Nguyễn Trung Chính)" className={`${sel} flex-1 min-w-[140px]`} />
            <button onClick={() => { if (newMapFrom.trim() && newMapTo.trim()) { setNameMap((prev) => [...prev, { from: newMapFrom.trim(), to: newMapTo.trim() }]); setNewMapFrom(''); setNewMapTo(''); } }} className="rounded-md border border-[var(--color-muted)] px-3 py-2 text-sm hover:border-[var(--color-primary)]">Thêm ánh xạ</button>
          </div>
        </div>

        <div className={`${card} mt-4`}>
          <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Bot nhắc việc — 8h30 thứ 2 hàng tuần</h2>
          <p className="mb-3 text-xs text-slate-600">Tích việc nào bot sẽ kiểm tra cho vai trò nào rồi đăng cảnh báo lên Bảng tin. Thêm vai trò mới tự có cột. Bỏ trống cả hàng = tắt việc đó.</p>
          {roles.length === 0 ? (
            <p className="text-xs text-slate-500">Đang tải vai trò…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs font-semibold text-[#0f2a4a]"><th className="py-2 pr-2 bg-[#eff6ff]">Việc bot soi</th>{roles.map((r) => <th key={r.id} className="px-2 py-2 text-center bg-[#eff6ff] border-l border-white" title={r.name}><span className="inline-block max-w-[80px] truncate">{r.name}</span></th>)}</tr></thead>
                <tbody>{BOT_CHECKS.map((t) => (
                  <tr key={t.key} className="border-t border-slate-200">
                    <td className="py-1 pr-2 text-xs font-medium">{t.label}</td>
                    {roles.map((r) => {
                      const checked = (botRoleMap[t.key] ?? []).includes(r.name);
                      return (
                        <td key={r.id} className="px-1 py-1 text-center">
                          <input type="checkbox" checked={checked} onChange={() => {
                            setBotRoleMap((prev) => {
                              const cur = prev[t.key] ?? [];
                              const next = checked ? cur.filter((x) => x !== r.name) : [...cur, r.name];
                              return { ...prev, [t.key]: next };
                            });
                          }} className="h-4 w-4 accent-[var(--color-primary)]" aria-label={`${t.label} — ${r.name}`} />
                        </td>
                      );
                    })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">Mẹo: Báo cáo kho → tích KHO / TỔNG_HỢP_KHO / BẢO_HÀNH; Tin thị trường / Kế hoạch tuần / Báo cáo tuần → tích KINH_DOANH / MARKETING; Không đăng nhập → tích cả công ty. Bấm Lưu cài đặt để lưu.</p>
          <div className="mt-3">
            <button onClick={async () => { setMsg('Bot đang kiểm tra…'); try { const { data: sess } = await supabase.auth.getSession(); const tok = sess?.session?.access_token ?? ''; const r = await fetch('/api/bot/weekly-check', { method: 'POST', headers: { Authorization: `Bearer ${tok}` } }); const j = await r.json(); if (!r.ok) setMsg('Lỗi: ' + (j?.error ?? r.statusText)); else setMsg(j.message ?? 'Bot đã chạy — vào Bảng tin để xem.'); } catch (e: any) { setMsg('Lỗi: ' + (e?.message ?? String(e))); } }} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">Chạy bot ngay (test)</button>
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

        <div className={`${card} mt-4`}>
          <h2 className="mb-2 text-sm font-bold text-[#1e3a8a]">Trợ lý AI (đánh giá công việc)</h2>
          <p className="mb-3 text-xs text-slate-600">
            Dùng AI để trả lời các câu hỏi nâng cao / góp ý vào mục tiêu, kế hoạch, báo cáo nhân viên dán vào.
            <strong> Tắt</strong> → chatbot chạy 100% theo câu chuẩn (rankQA), không tốn phí.
            API key không hiển thị ra ngoài và chỉ admin mới đọc được.
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={String(vals.AI_ENABLED ?? '').toUpperCase() === 'TRUE'}
                onChange={(e) => setVals({ ...vals, AI_ENABLED: e.target.checked ? 'TRUE' : 'FALSE' })} />
              Bật Trợ lý AI
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={String(vals.TRO_LY_SHOW ?? '').toUpperCase() === 'TRUE'}
                onChange={(e) => setVals({ ...vals, TRO_LY_SHOW: e.target.checked ? 'TRUE' : 'FALSE' })} />
              Hiển thị Trợ lý cho toàn công ty (mục menu + ô chat nổi)
            </label>
            <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
              <label className="text-sm font-semibold">API Key</label>
              <input value={vals.AI_KEY ?? ''} onChange={(e) => setVals({ ...vals, AI_KEY: e.target.value })} type="password" placeholder="sk-<token>:<key-nha-cung-cap> (dinh dang BYOK)" className={sel} />
            </div>
            <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
              <label className="text-sm font-semibold">Endpoint (tuỳ chọn)</label>
              <input value={vals.AI_ENDPOINT ?? ''} onChange={(e) => setVals({ ...vals, AI_ENDPOINT: e.target.value })} placeholder="https://api.anthropic.com" className={sel} />
            </div>
            <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
              <label className="text-sm font-semibold">Model</label>
              <input value={vals.AI_MODEL ?? ''} onChange={(e) => setVals({ ...vals, AI_MODEL: e.target.value })} placeholder="claude-sonnet-4-5" className={sel} />
            </div>
            <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
              <label className="text-sm font-semibold">Giới hạn tin AI tự do / phiên</label>
              <select value={vals.AI_FREE_MSG_LIMIT ?? '10'} onChange={(e) => setVals({ ...vals, AI_FREE_MSG_LIMIT: e.target.value })} className={sel}>
                <option value="5">5 tin</option>
                <option value="10">10 tin</option>
                <option value="20">20 tin</option>
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-start">
              <label className="text-sm font-semibold">Bản giới thiệu công ty cho AI <span className="font-normal text-slate-500">(để trống = dùng bản mặc định)</span></label>
              <textarea value={vals.AI_COMPANY_BRIEF ?? ''} onChange={(e) => setVals({ ...vals, AI_COMPANY_BRIEF: e.target.value })} rows={8} placeholder="Mô tả công ty bán gì, phần mềm quản lý gì, từng vai trò làm gì, chuẩn đạt là gì…" className={`${sel} resize-y`} />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Mẹo: dán API key rồi bấm Lưu cài đặt. Tắt công tắc để chatbot chỉ dùng câu chuẩn (miễn phí). Khi AI không khả dụng (lỗi/mạng/key), tự rơi về chế độ câu chuẩn.</p>
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-base font-bold text-[#0f2a4a]">Công nợ &amp; Tài chính</h2>
          <FinanceSettingsPanel />
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
