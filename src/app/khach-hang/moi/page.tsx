'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { categoryItems } from '@/lib/categories';
import { notifyTelegram } from '@/lib/notify';
import { CustomerForm, type CustomerValues } from '@/components/CustomerForm';
function Screen() {
  const { userId, username, can } = useAuth();
  const sp = useSearchParams();
  const prefill: CustomerValues = {};
  if (sp.get('ma')) prefill.ma_kh = sp.get('ma')!;
  if (sp.get('ten')) prefill.ten_kh = sp.get('ten')!;
  const [ready, setReady] = useState(false);
  const [cats, setCats] = useState<{ moHinhKD: any[]; tiers: any[]; statuses: any[]; quyMo: any[]; segments: any[] }>({ moHinhKD: [], tiers: [], statuses: [], quyMo: [], segments: [] });
  const [users, setUsers] = useState<{ id: string; username: string; full_name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<{ id: string; name: string }[]>([]);
  const [codes, setCodes] = useState<Set<string>>(new Set());
  useEffect(() => {
    (async () => {
      const [mh, tier, st, qm, seg, u, c, p, prov] = await Promise.all([
        categoryItems('mo_hinh_kd'), categoryItems('phan_hang_kh'), categoryItems('trang_thai_kh'),
        categoryItems('quy_mo'), categoryItems('phan_khuc_xe'),
        supabase.from('profiles').select('id, username, full_name').eq('status', 'ACTIVE'),
        supabase.from('customers').select('ma_kh'),
        categoryItems('san_pham'), categoryItems('tinh_thanh'),
      ]);
      setCats({ moHinhKD: mh, tiers: tier, statuses: st, quyMo: qm, segments: seg });
      setUsers((u.data ?? []) as { id: string; username: string; full_name: string }[]);
      setCodes(new Set(((c.data ?? []) as { ma_kh: string }[]).map((x) => x.ma_kh)));
      setProducts(p.map((x) => ({ id: x.id, name: x.name })));
      setProvinces((prov as any[]).map((x: any) => ({ id: x.id, name: x.name, code: '' })));
      setReady(true);
    })();
  }, []);
  async function onSubmit(v: CustomerValues): Promise<string | null> {
    const isAdmin = can('sua_khach_bat_ky');
    const assignedTo = isAdmin && v.assigned_to ? v.assigned_to : userId;
    if (!assignedTo) return 'Chưa chọn người phụ trách.';
    const payload = {
      ma_kh: v.ma_kh.trim().toUpperCase().replace(/\s+/g, '_'),
      ten_kh: v.ten_kh.trim(),
      assigned_to: assignedTo,
      sdt: v.sdt, facebook: v.facebook, google_maps: v.google_maps,
      dia_chi: v.dia_chi, quan_huyen: v.quan_huyen, tinh_thanh: v.tinh_thanh,
      nguoi_quyet_dinh: v.nguoi_quyet_dinh, chuc_vu: v.chuc_vu,
      business_model: v.business_model || '', tier_id: v.tier_id || null,
      status_id: v.status_id || null, scale_id: v.scale_id || null,
      so_co_so: v.so_co_so ? Number(v.so_co_so) : null,
      xe_ngay: v.xe_ngay ? Number(v.xe_ngay) : null,
      segment: v.segment || '',
      sp_dang_ban: v.sp_dang_ban, nguon_nhap: v.nguon_nhap, sp_ban_manh: v.sp_ban_manh, sp_ban_yeu: v.sp_ban_yeu,
      van_de: v.van_de, sp_cty_phu_hop: v.sp_cty_phu_hop, ly_do_chon: v.ly_do_chon, tro_ngai: v.tro_ngai, ghi_chu: v.ghi_chu,
      created_by: userId, updated_by: userId,
    };
    const { data, error } = await supabase.from('customers').insert(payload).select('id').single();
    if (error) return error.message.includes('duplicate') ? 'Mã khách hàng này đã tồn tại.' : error.message;
    let _nm = '';
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); _nm = (me2 as any)?.full_name ?? ''; await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Thêm khách hàng', entity_type: 'customer', entity_id: data.id, details: { ten_kh: payload.ten_kh, full_name: _nm } }); } catch {}
    notifyTelegram('TB_KHACH_HANG_MOI', `[Khách mới] ${payload.ten_kh} (${payload.ma_kh})\nNgười tạo: ${_nm}`);
    window.location.href = `/khach-hang/${data.id}`;
    return null;
  }
  return (
    <AppSidebar>
      
      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="mb-5 text-2xl font-bold tracking-tight">Thêm khách hàng mới</h1>
        {ready ? (
          <CustomerForm mode="new" initial={prefill} cats={cats} provinces={provinces} products={products} users={users} canPickAssignee={can('sua_khach_bat_ky')} existingCodes={codes} onSubmit={onSubmit} submitLabel="Lưu khách hàng" />
        ) : <div className="text-slate-600">Đang tải…</div>}
      </main>
    </AppSidebar>
  );
}
export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
