'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { AdminTabs } from '@/components/AdminTabs';

function Screen() {
  const { userId, can } = useAuth();
  const [v, setV] = useState({ ten_day_du: '', ten_rut_gon: '', dia_chi: '', ma_so_thue: '', dien_thoai: '', email: '', logo_url: '', footer_in: '', kho_giay: 'A4' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase.from('company_profile').select('*').eq('id', 1).single();
    if (data) setV((prev) => ({ ...prev, ...(data as any) }));
  }
  useEffect(() => { load(); }, []);

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const path = `logo/${Date.now()}_${f.name}`;
    const blob = f;
    const { error } = await supabase.storage.from('company').upload(path, blob, { upsert: true });
    if (error) { setMsg(error.message); return; }
    const url = supabase.storage.from('company').getPublicUrl(path).data.publicUrl;
    setV({ ...v, logo_url: url });
  }

  async function save() {
    setBusy(true); setMsg('');
    const { error } = await supabase.from('company_profile').upsert({ id: 1, ...v }, { onConflict: 'id' });
    if (error) { setMsg(error.message); setBusy(false); return; }
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Lưu hồ sơ công ty', entity_type: 'company_profile', entity_id: null, details: { ten_day_du: v.ten_day_du, full_name: me2?.full_name ?? '' } }); } catch {}
    setMsg('Đã lưu.'); setBusy(false);
  }

  if (!can('quan_ly_cai_dat')) return <AppSidebar><main className="px-6 py-10 text-slate-700">Bạn không có quyền.</main></AppSidebar>;
  const sel = 'rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]';
  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]';
  const LABEL = 'mb-1 block text-sm font-semibold';

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6 text-slate-900">
        <AdminTabs />
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Hồ sơ công ty</h1>
        <div className={card}>
          <div className="space-y-3">
            <div><label className={LABEL}>Tên đầy đủ</label><input value={v.ten_day_du} onChange={(e) => setV({ ...v, ten_day_du: e.target.value })} className={sel + ' w-full'} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={LABEL}>Tên rút gọn</label><input value={v.ten_rut_gon} onChange={(e) => setV({ ...v, ten_rut_gon: e.target.value })} className={sel + ' w-full'} /></div>
              <div><label className={LABEL}>Mã số thuế</label><input value={v.ma_so_thue} onChange={(e) => setV({ ...v, ma_so_thue: e.target.value })} className={sel + ' w-full'} /></div>
            </div>
            <div><label className={LABEL}>Địa chỉ</label><input value={v.dia_chi} onChange={(e) => setV({ ...v, dia_chi: e.target.value })} className={sel + ' w-full'} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={LABEL}>Điện thoại</label><input value={v.dien_thoai} onChange={(e) => setV({ ...v, dien_thoai: e.target.value })} className={sel + ' w-full'} /></div>
              <div><label className={LABEL}>Email</label><input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} className={sel + ' w-full'} /></div>
            </div>
            <div><label className={LABEL}>Khổ giấy in</label><select value={v.kho_giay} onChange={(e) => setV({ ...v, kho_giay: e.target.value })} className={sel}><option value="A4">A4</option><option value="A5">A5</option></select></div>
            <div><label className={LABEL}>Footer mẫu in</label><textarea value={v.footer_in} onChange={(e) => setV({ ...v, footer_in: e.target.value })} placeholder="Dòng cuối trang khi in (vd: Hotline, chính sách bảo hành…)" className={sel + ' w-full'} rows={2} /></div>
            <div><label className={LABEL}>Logo</label>
              <div className="flex items-center gap-3">
                {v.logo_url && <img src={v.logo_url} alt="logo" className="h-16 w-16 rounded border object-contain" />}
                <label className="rounded-md border border-[var(--color-muted)] px-3 py-2 text-sm hover:border-[var(--color-primary)] cursor-pointer">Chọn ảnh
                  <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {msg && <span className="self-center text-sm text-[#1e3a8a]">{msg}</span>}
          <button onClick={save} disabled={busy} className="rounded-md bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
