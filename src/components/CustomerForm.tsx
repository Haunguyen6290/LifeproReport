'use client';
import { useEffect, useMemo, useState } from 'react';
import { buildMaKH } from '@/lib/makh';
import { fmtPhones } from '@/lib/format';
import { Combobox } from '@/components/Combobox';
import { GrowArea } from '@/components/GrowArea';
import { MultiPicker } from '@/components/MultiPicker';

export type CatOpt = { id: string; code?: string; name: string; description?: string };
export type CustomerValues = Record<string, string>;

type Props = {
  initial?: CustomerValues;
  mode: 'new' | 'edit';
  cats: { moHinhKD: CatOpt[]; tiers: CatOpt[]; statuses: CatOpt[]; quyMo: CatOpt[]; segments: CatOpt[] };
  provinces: CatOpt[];
  products: { id: string; name: string }[];
  users: { id: string; username: string; full_name: string }[];
  canPickAssignee: boolean;
  existingCodes: Set<string>;
  onSubmit: (v: CustomerValues) => Promise<string | null>;
  submitLabel: string;
  disabled?: boolean;
  activeTab?: 'chung' | 'vanhanh' | 'khaithac';
};

const FIELD = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[14px] leading-[1.6] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/15 disabled:bg-slate-50 disabled:text-slate-700';
const LABEL = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-700';

export function tierColor(code?: string): string {
  switch ((code ?? '').toUpperCase()) {
    case 'A+': return 'bg-emerald-600';
    case 'A': return 'bg-green-600';
    case 'B+': return 'bg-blue-600';
    case 'B': return 'bg-amber-500';
    case 'C': return 'bg-orange-500';
    case 'D': return 'bg-red-600';
    default: return 'bg-slate-400';
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5">
      <legend className="px-2 text-[15px] font-bold text-[#1e3a8a]">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function CustomerForm({ initial = {}, mode, cats, provinces, products, users, canPickAssignee, existingCodes, onSubmit, submitLabel, disabled, activeTab = 'chung' }: Props) {
  const [v, setV] = useState<CustomerValues>({ ...initial });
  useEffect(() => { setV({ ...initial }); }, [JSON.stringify(initial)]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const prodOpts = useMemo(() => products.map((p) => ({ id: p.name, label: p.name })), [products]);
  const toArr = (s?: string) => (s ? s.split(/,\s*/).filter(Boolean) : []);
  const tier = cats.tiers.find((t) => t.id === v.tier_id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!v.ma_kh?.trim()) return setError('Phải có Mã khách hàng.');
    if (!v.ten_kh?.trim()) return setError('Phải có Tên khách hàng.');
    setSaving(true);
    const err = await onSubmit(v);
    setSaving(false);
    if (err) setError(err);
  }

  function suggestCode() {
    const code = buildMaKH(v.ten_kh || '', v.tinh_thanh || '', existingCodes);
    if (code) setV((p) => ({ ...p, ma_kh: code }));
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {activeTab === 'chung' && (
        <Section title="Thông tin chung">
          <div>
            <label htmlFor="ma_kh" className={LABEL}>Mã khách hàng *</label>
            <div className="flex gap-2">
              <input id="ma_kh" value={v.ma_kh ?? ''} onChange={set('ma_kh')} disabled={disabled || mode === 'edit'} placeholder="VD: HN_MINHANH" className={`${FIELD} font-mono`} />
              {mode === 'new' && <button type="button" onClick={suggestCode} disabled={disabled} className="shrink-0 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold hover:border-[#1e3a8a] hover:text-[#1e3a8a] disabled:opacity-60">Gợi ý mã</button>}
            </div>
          </div>
          <div><label htmlFor="ten_kh" className={LABEL}>Tên khách hàng *</label><GrowArea id="ten_kh" value={v.ten_kh ?? ''} onChange={set('ten_kh')} disabled={disabled} className={FIELD} /></div>
          <div>
            <label htmlFor="assigned_to" className={LABEL}>Kinh doanh quản lý</label>
            {canPickAssignee ? (
              <select id="assigned_to" value={v.assigned_to ?? ''} onChange={set('assigned_to')} disabled={disabled} className={FIELD}>
                <option value="">— chọn —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            ) : (
              <input value={users.find((u) => u.id === v.assigned_to)?.full_name ?? ''} disabled className={FIELD} />
            )}
          </div>
          <div>
            <label htmlFor="tier_id" className={LABEL}>Phân hạng khách hàng</label>
            <div className="flex items-center gap-2">
              <span className={`grid h-8 w-10 shrink-0 place-items-center rounded-md text-sm font-bold text-white ${tierColor(tier?.code)}`} aria-hidden>{tier?.code || '—'}</span>
              <select id="tier_id" value={v.tier_id ?? ''} onChange={set('tier_id')} disabled={disabled} className={FIELD}>
                <option value="">— chưa phân hạng —</option>
                {cats.tiers.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ''}{c.name}</option>)}
              </select>
            </div>
            {tier?.description && <p className="mt-1 text-xs text-slate-700">{tier.description}</p>}
          </div>
          <div><label htmlFor="sdt" className={LABEL}>Số điện thoại</label><input id="sdt" value={v.sdt ?? ''} onChange={set('sdt')} onBlur={(e) => setV((p) => ({ ...p, sdt: fmtPhones(e.target.value) }))} disabled={disabled} placeholder="0905123456, 0905..." className={FIELD} /></div>
          <div><label htmlFor="facebook" className={LABEL}>Facebook</label><GrowArea id="facebook" value={v.facebook ?? ''} onChange={set('facebook')} disabled={disabled} className={FIELD} /></div>
          <div className="sm:col-span-2"><label htmlFor="dia_chi" className={LABEL}>Địa chỉ</label><GrowArea id="dia_chi" value={v.dia_chi ?? ''} onChange={set('dia_chi')} disabled={disabled} className={FIELD} /></div>
          <div><label htmlFor="quan_huyen" className={LABEL}>Quận/Huyện</label><input id="quan_huyen" value={v.quan_huyen ?? ''} onChange={set('quan_huyen')} disabled={disabled} className={FIELD} /></div>
          <div><label htmlFor="tinh_thanh" className={LABEL}>Tỉnh/TP</label>
            <input id="tinh_thanh" list="tinh-thanh-list" value={v.tinh_thanh ?? ''} onChange={set('tinh_thanh')} disabled={disabled} placeholder="Chọn hoặc nhập tỉnh/thành…" className={FIELD} />
            <datalist id="tinh-thanh-list">{provinces.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          </div>
          <div className="sm:col-span-2 grid grid-cols-2 gap-2">
            <div><label htmlFor="nguoi_quyet_dinh" className={LABEL}>Người quyết định</label><input id="nguoi_quyet_dinh" value={v.nguoi_quyet_dinh ?? ''} onChange={set('nguoi_quyet_dinh')} disabled={disabled} className={FIELD} /></div>
            <div><label htmlFor="chuc_vu" className={LABEL}>Chức vụ</label><input id="chuc_vu" value={v.chuc_vu ?? ''} onChange={set('chuc_vu')} disabled={disabled} className={FIELD} /></div>
          </div>
          <div className="sm:col-span-2"><label htmlFor="google_maps" className={LABEL}>Google Maps</label><GrowArea id="google_maps" value={v.google_maps ?? ''} onChange={set('google_maps')} disabled={disabled} className={FIELD} /></div>
        </Section>
      )}

      {activeTab === 'vanhanh' && (
        <Section title="Vận hành">
          <div><label className={LABEL}>Mô hình kinh doanh</label><MultiPicker options={cats.moHinhKD.map((c) => ({ id: c.name, label: c.name }))} value={toArr(v.business_model)} onChange={(arr) => setV((p) => ({ ...p, business_model: arr.join(', ') }))} placeholder="Chọn mô hình…" disabled={disabled} /></div>
          <div><label className={LABEL}>Phân khúc xe</label><MultiPicker options={cats.segments.map((c) => ({ id: c.name, label: c.name }))} value={toArr(v.segment)} onChange={(arr) => setV((p) => ({ ...p, segment: arr.join(', ') }))} placeholder="Chọn phân khúc…" disabled={disabled} /></div>
          <div><label htmlFor="scale_id" className={LABEL}>Quy mô</label><MultiPicker options={cats.quyMo.map((c) => ({ id: c.id, label: c.name }))} value={v.scale_id ? [v.scale_id] : []} onChange={(arr) => setV((p) => ({ ...p, scale_id: arr[0] ?? '' }))} placeholder="Chọn quy mô…" disabled={disabled} /></div>
          <div><label htmlFor="so_co_so" className={LABEL}>Số cơ sở</label><input id="so_co_so" type="number" min={0} value={v.so_co_so ?? ''} onChange={set('so_co_so')} disabled={disabled} className={FIELD} /></div>
          <div><label htmlFor="xe_ngay" className={LABEL}>Xe/ngày</label><input id="xe_ngay" type="number" min={0} step="0.1" value={v.xe_ngay ?? ''} onChange={set('xe_ngay')} disabled={disabled} className={FIELD} /></div>
          <div><label htmlFor="nguon_nhap" className={LABEL}>Nguồn nhập</label><GrowArea id="nguon_nhap" value={v.nguon_nhap ?? ''} onChange={set('nguon_nhap')} disabled={disabled} className={FIELD} /></div>
          <div className="sm:col-span-2"><label htmlFor="sp_dang_ban" className={LABEL}>SP khách đang bán (nhập nhiều dòng)</label><GrowArea id="sp_dang_ban" rows={3} value={v.sp_dang_ban ?? ''} onChange={set('sp_dang_ban')} disabled={disabled} placeholder="VD: Thảm lót sàn, camera hành trình…" className={FIELD} /></div>
          <div>
            <label htmlFor="status_id" className={LABEL}>Trạng thái</label>
            <select id="status_id" value={v.status_id ?? ''} onChange={set('status_id')} disabled={disabled} className={FIELD}>
              <option value="">—</option>{cats.statuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </Section>
      )}

      {activeTab === 'khaithac' && (
        <Section title="Khai thác">
          <div><label htmlFor="sp_ban_manh" className={LABEL}>SP khách bán mạnh</label><GrowArea id="sp_ban_manh" value={v.sp_ban_manh ?? ''} onChange={set('sp_ban_manh')} disabled={disabled} className={FIELD} /></div>
          <div><label htmlFor="sp_ban_yeu" className={LABEL}>SP khách bán yếu</label><GrowArea id="sp_ban_yeu" value={v.sp_ban_yeu ?? ''} onChange={set('sp_ban_yeu')} disabled={disabled} className={FIELD} /></div>
          <div className="sm:col-span-2"><label htmlFor="van_de" className={LABEL}>Vấn đề của khách</label><GrowArea id="van_de" rows={3} value={v.van_de ?? ''} onChange={set('van_de')} disabled={disabled} className={FIELD} /></div>
          <div><label className={LABEL}>SP công ty phù hợp (chọn nhiều)</label><Combobox options={prodOpts} value={toArr(v.sp_cty_phu_hop)} onChange={(arr) => setV((p) => ({ ...p, sp_cty_phu_hop: arr.join(', ') }))} placeholder="Chọn sản phẩm công ty…" disabled={disabled} /></div>
          <div><label htmlFor="ly_do_chon" className={LABEL}>Lý do chọn</label><GrowArea id="ly_do_chon" value={v.ly_do_chon ?? ''} onChange={set('ly_do_chon')} disabled={disabled} className={FIELD} /></div>
          <div className="sm:col-span-2"><label htmlFor="tro_ngai" className={LABEL}>Trở ngại</label><GrowArea id="tro_ngai" rows={3} value={v.tro_ngai ?? ''} onChange={set('tro_ngai')} disabled={disabled} className={FIELD} /></div>
          <div className="sm:col-span-2"><label htmlFor="ghi_chu" className={LABEL}>Ghi chú</label><GrowArea id="ghi_chu" rows={3} value={v.ghi_chu ?? ''} onChange={set('ghi_chu')} disabled={disabled} className={FIELD} /></div>
        </Section>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 mt-1 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex justify-end">
          <button type="submit" disabled={disabled || saving} className="rounded-lg bg-[#1e3a8a] px-6 py-3 text-sm font-semibold text-white shadow hover:bg-[#1e40af] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e3a8a] disabled:opacity-60">
            {saving ? 'Đang lưu…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
