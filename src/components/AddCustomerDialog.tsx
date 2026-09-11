'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { categoryItems } from '@/lib/categories';
import { CustomerForm, type CustomerValues } from '@/components/CustomerForm';
import { Dialog } from '@/components/Dialog';
export function AddCustomerDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { userId, can } = useAuth();
  const [ready, setReady] = useState(false);
  const [cats, setCats] = useState<any>({ moHinhKD: [], tiers: [], statuses: [], quyMo: [], segments: [] });
  const [users, setUsers] = useState<{ id: string; username: string; full_name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<{ id: string; name: string }[]>([]);
  const [codes, setCodes] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'chung' | 'vanhanh' | 'khaithac'>('chung');
  const [saved, setSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setFormKey((k) => k + 1);
    (async () => {
      const [mh, tier, st, qm, seg, u, c, p, prov] = await Promise.all([
        categoryItems('mo_hinh_kd'), categoryItems('phan_hang_kh'), categoryItems('trang_thai_kh'),
        categoryItems('quy_mo'), categoryItems('phan_khuc_xe'),
        supabase.from('profiles').select('id, username, full_name, roles(name)').eq('status', 'ACTIVE'),
        supabase.from('customers').select('ma_kh'),
        categoryItems('san_pham'), categoryItems('tinh_thanh'),
      ]);
      setCats({ moHinhKD: mh, tiers: tier, statuses: st, quyMo: qm, segments: seg });
      setUsers(((u.data ?? []) as any).filter((x: any) => x.roles?.name === 'KINH_DOANH'));
      setCodes(new Set(((c.data ?? []) as any[]).map((x: any) => x.ma_kh)));
      setProducts(p.map((x: any) => ({ id: x.id, name: x.name })));
      setProvinces(prov.map((x: any) => ({ id: x.id, name: x.name, code: '' })));
      setReady(true);
    })();
  }, [open]);
  async function onSubmit(v: CustomerValues): Promise<string | null> {
    const assignedTo = can('sua_khach_bat_ky') && v.assigned_to ? v.assigned_to : userId;
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
    const { error } = await supabase.from('customers').insert(payload).select('id').single();
    if (error) return error.message.includes('duplicate') ? 'Mã khách hàng này đã tồn tại.' : error.message;
    onDone();
    setSaved(true);
    setCodes((prev) => new Set(prev).add(payload.ma_kh));
    setFormKey((k) => k + 1);
    setTab('chung');
    return null;
  }
  return (
    <Dialog open={open} onClose={onClose} title="Thêm khách hàng mới">
      {ready ? (
        <>
          <div className="mb-4 flex gap-2">
            {(['chung','vanhanh','khaithac'] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab===k ? 'bg-[#1e3a8a] text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                {k==='chung'?'Thông tin chung':k==='vanhanh'?'Vận hành':'Khai thác'}
              </button>
            ))}
          </div>
          {saved && <div role="status" className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">Đã lưu khách hàng. Form đã sẵn sàng để nhập khách tiếp theo — bấm X để đóng hộp.</div>}
          <CustomerForm key={formKey} mode="new" cats={cats} provinces={provinces} products={products} users={users} canPickAssignee={can('sua_khach_bat_ky')} existingCodes={codes} onSubmit={onSubmit} submitLabel="Lưu khách hàng" activeTab={tab} />
        </>
      ) : (
        <div className="py-10 text-center text-slate-600">Đang tải…</div>
      )}
    </Dialog>
  );
}
