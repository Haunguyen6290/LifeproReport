'use client';
import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { categoryItems } from '@/lib/categories';
import { fmtCommentTimeVN } from '@/lib/time';
import { CustomerForm, tierColor, type CustomerValues } from '@/components/CustomerForm';
import { CustomerSalesTab } from '@/components/CustomerSalesTab';
import { CustomerInteractionTab, lastInteractionDate, isStaleInteraction } from '@/components/CustomerInteractionTab';
type Hist = { id: string; action: string; nguoi: string; thoi_gian: string; details: any };
type Tab = 'chung' | 'vanhanh' | 'khaithac' | 'banhang' | 'tuongtac' | 'lichsu';
function Screen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { userId, can } = useAuth();
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState<CustomerValues>({});
  const [cats, setCats] = useState<any>({ moHinhKD: [], tiers: [], statuses: [], quyMo: [], segments: [] });
  const [users, setUsers] = useState<{ id: string; username: string; full_name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<{ id: string; name: string }[]>([]);
  const [codes, setCodes] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Hist[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [statusName, setStatusName] = useState('');
  const [tab, setTab] = useState<Tab>('chung');
  const [staleCare, setStaleCare] = useState(false);
  useEffect(() => {
    (async () => {
      const [khRes, mh, tier, st, qm, seg, u, c, p, prov] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        categoryItems('mo_hinh_kd'), categoryItems('phan_hang_kh'), categoryItems('trang_thai_kh'),
        categoryItems('quy_mo'), categoryItems('phan_khuc_xe'),
        supabase.from('profiles').select('id, username, full_name').eq('status', 'ACTIVE'),
        supabase.from('customers').select('ma_kh'),
        categoryItems('san_pham'), categoryItems('tinh_thanh'),
      ]);
      const kh = khRes.data as Record<string, any> | null;
      if (!kh) { setReady(true); return; }
      const init: CustomerValues = {};
      for (const k of Object.keys(kh)) if (kh[k] != null) init[k] = String(kh[k]);
      setInitial(init);
      setCats({ moHinhKD: mh, tiers: tier, statuses: st, quyMo: qm, segments: seg });
      setUsers((u.data ?? []) as { id: string; username: string; full_name: string }[]);
      setProducts(p.map((x) => ({ id: x.id, name: x.name })));
      setProvinces((prov as any[]).map((x: any) => ({ id: x.id, name: x.name, code: '' })));
      setCodes(new Set(((c.data ?? []) as { ma_kh: string }[]).map((x) => x.ma_kh)));
      setCanEdit(can('sua_khach_bat_ky') || String(kh.assigned_to) === userId);
      if (kh.status_id) {
        const { data: stItem } = await supabase.from('category_items').select('name').eq('id', kh.status_id).single();
        setStatusName(stItem?.name ?? '');
      }
      const { data: logs } = await supabase.from('audit_logs')
        .select('id, action, details, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)')
        .eq('entity_type', 'customer').eq('entity_id', id).order('created_at', { ascending: false }).limit(50);
      setHistory(((logs ?? []) as any[]).map((l) => ({ id: l.id, action: l.action, nguoi: l.actor?.full_name ?? '', thoi_gian: l.created_at, details: l.details })));
      try { setStaleCare(isStaleInteraction(await lastInteractionDate(id))); } catch { setStaleCare(false); }
      setReady(true);
    })();
  }, [id, userId, can, reloadKey]);
  async function onSubmit(v: CustomerValues): Promise<string | null> {
    const prev = initial;
    const fields = ['ten_kh', 'sdt', 'facebook', 'google_maps', 'dia_chi', 'quan_huyen', 'tinh_thanh', 'nguoi_quyet_dinh', 'chuc_vu', 'business_model', 'tier_id', 'status_id', 'scale_id', 'so_co_so', 'xe_ngay', 'segment', 'sp_dang_ban', 'nguon_nhap', 'sp_ban_manh', 'sp_ban_yeu', 'van_de', 'sp_cty_phu_hop', 'ly_do_chon', 'tro_ngai', 'ghi_chu', 'assigned_to'];
    const changes: { field: string; old: string; new: string }[] = [];
    const patch: Record<string, any> = { updated_by: userId };
    for (const f of fields) {
      let nv: any = v[f] ?? '';
      if (f === 'so_co_so') nv = nv === '' ? null : Number(nv);
      else if (f === 'xe_ngay') nv = nv === '' ? null : Number(nv);
      else if (['_id'].some((s) => f.endsWith(s))) nv = nv === '' ? null : nv;
      const ov = prev[f] ?? '';
      if (String(ov) !== String(nv ?? '')) { changes.push({ field: f, old: String(ov), new: String(nv ?? '') }); patch[f] = nv; }
    }
    if (Object.keys(patch).length === 1) return 'Không có thay đổi.';
    const { error } = await supabase.from('customers').update(patch).eq('id', id);
    if (error) return error.message;
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Sửa hồ sơ', entity_type: 'customer', entity_id: id, details: { changes, full_name: (me2 as any)?.full_name ?? '' } }); } catch {}
    setReloadKey((k) => k + 1);
    return null;
  }
  async function deleteForever() {
    if (!can('xoa_khach')) return;
    const ten = initial.ten_kh ?? '';
    if (!confirm(`XÓA VĨNH VIỄN khách "${ten}"? Không thể hoàn tác.`)) return;
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'XÓA VĨNH VIỄN khách hàng', entity_type: 'customer', entity_id: id, details: { ten_kh: ten, ma_kh: initial.ma_kh, full_name: (me2 as any)?.full_name ?? '' } }); } catch {}
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    router.push('/khach-hang');
  }
  if (ready && !initial.ten_kh) return <AppSidebar><main className="w-full px-6 py-10 text-slate-600">Không tìm thấy khách hàng.</main></AppSidebar>;
  const tier = cats.tiers.find((t: any) => t.id === initial.tier_id);
  const assignedName = users.find((u) => u.id === initial.assigned_to)?.full_name ?? '';
  const moHinhNames = (initial.business_model ?? '').split(',').filter(Boolean).join(', ');
  const tabBtn = (k: Tab, label: string, dot?: boolean) => (
    <button onClick={() => setTab(k)} className={`relative rounded-full px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-[#1e3a8a] text-white shadow' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}>{label}{dot ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" title="Hơn 21 ngày chưa chăm sóc" /> : null}</button>
  );
  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <a href="/khach-hang" className="mb-3 inline-flex text-sm font-medium text-[#1e3a8a] hover:underline">← Danh sách khách hàng</a>
        {/* Card tóm tắt */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eff6ff] text-[#1e3a8a]">🚗</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold leading-tight text-slate-900">{initial.ten_kh}</h1>
                <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold text-white ${tierColor(tier?.code)}`}>● {tier?.code ?? '—'}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{statusName || '—'}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span>Kinh doanh: <b className="text-slate-900">{assignedName || '—'}</b></span>
                <span>Tỉnh/TP: <b className="text-slate-900">{initial.tinh_thanh || '—'}</b></span>
              </div>
              {moHinhNames && <div className="mt-1 text-sm text-slate-600">Mô hình KD: <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium">{moHinhNames}</span></div>}
            </div>
            <div className="hidden shrink-0 gap-2 sm:flex">
              {!canEdit && ready && <span className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">Chỉ xem</span>}
              {can('xoa_khach') && ready && statusName === 'Ngừng theo dõi' && <button onClick={deleteForever} className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Xóa vĩnh viễn</button>}
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tabBtn('chung', 'Thông tin chung')}
          {tabBtn('vanhanh', 'Vận hành')}
          {tabBtn('khaithac', 'Khai thác')}
          {tabBtn('banhang', 'Bán hàng & Công nợ')}
          {tabBtn('tuongtac', 'Tương tác', staleCare)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {tabBtn('lichsu', 'Lịch sử thay đổi')}
        </div>
        <div className="mt-4">
          {tab === 'banhang' ? (
            <CustomerSalesTab maKh={String(initial.ma_kh ?? '')} tenKh={String(initial.ten_kh ?? '')} />
          ) : tab === 'tuongtac' ? (
            <CustomerInteractionTab customerId={id} onChanged={async () => { try { setStaleCare(isStaleInteraction(await lastInteractionDate(id))); } catch {} }} />
          ) : tab !== 'lichsu' ? (
            ready ? <CustomerForm key={reloadKey} mode="edit" initial={initial} cats={cats} provinces={provinces} products={products} users={users} canPickAssignee={can('sua_khach_bat_ky')} existingCodes={codes} onSubmit={onSubmit} submitLabel="Lưu thay đổi" disabled={!canEdit} activeTab={tab} /> : <div className="text-slate-600">Đang tải…</div>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-3 text-sm font-bold text-[#1e3a8a]">Lịch sử thay đổi</h2>
              {history.length === 0 ? <p className="text-sm text-slate-600">Chưa có thay đổi nào.</p> : (
                <ul className="divide-y divide-slate-200 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="py-2">
                      <div className="flex items-center justify-between"><span className="font-medium text-slate-900">{h.action}</span><span className="text-xs text-slate-700">{fmtCommentTimeVN(h.thoi_gian)} · {h.nguoi}</span></div>
                      {Array.isArray(h.details?.changes) && h.details.changes.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-xs text-slate-700">
                          {h.details.changes.map((c: any, i: number) => <div key={i}><span className="font-mono">{c.field}</span>: “{c.old || '—'}” → “{c.new || '—'}”</div>)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </main>
    </AppSidebar>
  );
}
export default function Page({ params }: { params: Promise<{ id: string }> }) { return <RequireAuth><Screen params={params} /></RequireAuth>; }
