'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');
const fmtD = (d: string) => d.split('-').reverse().join('/');

type Item = { ngay: string; so_ct: string; dien_giai: string; tien: number };
type ChiTiet = { ma_vt: string; ten_vt: string; so_luong: number; don_gia: number; thanh_tien: number };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function rangeOf(kieu: string): [string, string] {
  const n = new Date();
  if (kieu === 'thang') return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(new Date(n.getFullYear(), n.getMonth() + 1, 0))];
  if (kieu === 'quy') { const q = Math.floor(n.getMonth() / 3) * 3; return [iso(new Date(n.getFullYear(), q, 1)), iso(new Date(n.getFullYear(), q + 3, 0))]; }
  if (kieu === 'nam') return [`${n.getFullYear()}-01-01`, `${n.getFullYear()}-12-31`];
  return [iso(n), iso(n)];
}

type Props = { open: boolean; maKh: string; tenKh: string; onClose: () => void };

export function DoiChieuDialog({ open, maKh, tenKh, onClose }: Props) {
  const [kieu, setKieu] = useState('thang');
  const [[tu, den], setRange] = useState<[string, string]>(rangeOf('thang'));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [expand, setExpand] = useState<Set<string>>(new Set());
  const [chiTiet, setChiTiet] = useState<Map<string, ChiTiet[]>>(new Map());

  async function load() {
    setLoading(true); setErr(''); setData(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token ?? '';
      const r = await fetch(`/api/finance/doi-chieu?ma_kh=${encodeURIComponent(maKh)}&tu=${tu}&den=${den}`, { headers: { Authorization: `Bearer ${tok}` } });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? 'Lỗi'); return; }
      setData(j);
    } catch (e: any) { setErr(e?.message ?? 'Lỗi kết nối'); }
    finally { setLoading(false); }
  }

  async function toggleExpand(soCt: string) {
    const next = new Set(expand);
    if (next.has(soCt)) { next.delete(soCt); setExpand(next); return; }
    next.add(soCt); setExpand(next);
    if (chiTiet.has(soCt)) return;
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token ?? '';
      const r = await fetch(`/api/finance/doi-chieu/chi-tiet?so_ct=${encodeURIComponent(soCt)}`, { headers: { Authorization: `Bearer ${tok}` } });
      const j = await r.json();
      if (r.ok) setChiTiet(new Map(chiTiet).set(soCt, j.items ?? []));
    } catch {}
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-bold text-[#0f2a4a]">Đối chiếu công nợ</h2>
          <button onClick={onClose} aria-label="Đóng" className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">×</button>
        </div>

        <div className="border-b border-slate-200 px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">{maKh} - {tenKh}</p>
          <div className="flex flex-wrap items-center gap-2">
            {[['thang', 'Tháng'], ['quy', 'Quý'], ['nam', 'Năm'], ['tuy', 'Tùy chọn']].map(([k, l]) => (
              <button key={k} onClick={() => { setKieu(k); if (k !== 'tuy') setRange(rangeOf(k)); }} className={`rounded-full px-3 py-1 text-xs font-semibold ${kieu === k ? 'bg-[#1e3a8a] text-white' : 'bg-white ring-1 ring-slate-200'}`}>{l}</button>
            ))}
            <input type="date" value={tu} onChange={(e) => { setKieu('tuy'); setRange([e.target.value, den]); }} className="rounded-md border border-slate-200 px-2 py-1 text-xs" />
            <span className="text-xs text-slate-500">→</span>
            <input type="date" value={den} onChange={(e) => { setKieu('tuy'); setRange([tu, e.target.value]); }} className="rounded-md border border-slate-200 px-2 py-1 text-xs" />
            <button onClick={load} disabled={loading} className="rounded-lg bg-[#1e3a8a] px-4 py-1 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Đang tải…' : 'Xem báo cáo'}</button>
          </div>
          {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {!data && !loading && <p className="py-6 text-center text-sm text-slate-500">Chọn kỳ và bấm "Xem báo cáo"</p>}
          {loading && <p className="py-6 text-center text-sm text-slate-500">Đang tải…</p>}
          {data && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="font-semibold">Nợ đầu kỳ ({fmtD(tu)}):</span><span className="font-bold">{fmt(data.dau_ky)}đ</span></div>

              {data.mua_hang?.length > 0 && (
                <div className="rounded-lg border border-slate-200">
                  <div className="flex justify-between bg-blue-50 px-3 py-2"><span className="font-semibold">📦 MUA HÀNG ({data.mua_hang.length} đơn)</span><span className="font-bold">{fmt(data.mua_hang.reduce((s: number, x: Item) => s + x.tien, 0))}đ</span></div>
                  {data.mua_hang.map((x: Item, i: number) => {
                    const isExp = expand.has(x.so_ct);
                    const ct = chiTiet.get(x.so_ct) ?? [];
                    return (
                      <div key={i} className="border-t border-slate-100">
                        <button onClick={() => toggleExpand(x.so_ct)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50">
                          <span className="flex items-center gap-2"><span className="text-slate-400">{isExp ? '▼' : '›'}</span><span>{fmtD(x.ngay)}</span><span className="text-slate-600">{x.dien_giai}</span></span>
                          <span className="font-semibold tabular-nums">{fmt(x.tien)}đ</span>
                        </button>
                        {isExp && ct.length > 0 && (
                          <div className="bg-slate-50 px-6 pb-2">
                            <table className="w-full text-xs"><thead><tr className="text-left text-slate-600"><th className="py-1">Mã SP</th><th className="py-1">Tên sản phẩm</th><th className="py-1 text-right">SL</th><th className="py-1 text-right">Đơn giá</th><th className="py-1 text-right">Thành tiền</th></tr></thead>
                              <tbody>{ct.map((c, j) => <tr key={j} className="border-t border-slate-200"><td className="py-1 font-mono text-[10px]">{c.ma_vt}</td><td className="py-1">{c.ten_vt}</td><td className="py-1 text-right tabular-nums">{c.so_luong}</td><td className="py-1 text-right tabular-nums">{fmt(c.don_gia)}</td><td className="py-1 text-right font-semibold tabular-nums">{fmt(c.thanh_tien)}</td></tr>)}</tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {data.tra_tien?.length > 0 && (
                <div className="rounded-lg border border-slate-200">
                  <div className="flex justify-between bg-green-50 px-3 py-2"><span className="font-semibold">💰 TRẢ TIỀN ({data.tra_tien.length} lần)</span><span className="font-bold">{fmt(data.tra_tien.reduce((s: number, x: Item) => s + x.tien, 0))}đ</span></div>
                  {data.tra_tien.map((x: Item, i: number) => <div key={i} className="flex justify-between border-t border-slate-100 px-3 py-2"><span className="flex items-center gap-2"><span className="text-slate-400">•</span><span>{fmtD(x.ngay)}</span><span className="text-slate-600">{x.dien_giai}</span></span><span className="font-semibold tabular-nums">{fmt(x.tien)}đ</span></div>)}
                </div>
              )}

              {data.khau_tru?.length > 0 && (
                <div className="rounded-lg border border-slate-200">
                  <div className="flex justify-between bg-orange-50 px-3 py-2"><span className="font-semibold">🎨 KHẤU TRỪ CHI PHÍ ({data.khau_tru.length} lần)</span><span className="font-bold">{fmt(data.khau_tru.reduce((s: number, x: Item) => s + x.tien, 0))}đ</span></div>
                  {data.khau_tru.map((x: Item, i: number) => <div key={i} className="flex justify-between border-t border-slate-100 px-3 py-2"><span className="flex items-center gap-2"><span className="text-slate-400">•</span><span>{fmtD(x.ngay)}</span><span className="text-slate-600">{x.dien_giai}</span></span><span className="font-semibold tabular-nums">{fmt(x.tien)}đ</span></div>)}
                </div>
              )}

              {data.dieu_chinh?.length > 0 && (
                <div className="rounded-lg border border-slate-200 opacity-60">
                  <div className="flex justify-between bg-slate-50 px-3 py-2"><span className="font-semibold text-slate-600">🔄 ĐIỀU CHỈNH SỔ ({data.dieu_chinh.length} lần)</span><span className="font-semibold text-slate-600">±0đ</span></div>
                  {data.dieu_chinh.map((x: Item, i: number) => <div key={i} className="flex justify-between border-t border-slate-100 px-3 py-2 text-slate-500"><span className="flex items-center gap-2"><span>•</span><span>{fmtD(x.ngay)}</span><span>{x.dien_giai}</span></span><span className="font-semibold">±0đ</span></div>)}
                </div>
              )}

              {data.tra_hang?.length > 0 && (
                <div className="rounded-lg border border-slate-200">
                  <div className="flex justify-between bg-amber-50 px-3 py-2"><span className="font-semibold">↩️ TRẢ HÀNG ({data.tra_hang.length} lần)</span><span className="font-bold">{fmt(data.tra_hang.reduce((s: number, x: Item) => s + x.tien, 0))}đ</span></div>
                  {data.tra_hang.map((x: Item, i: number) => {
                    const isExp = expand.has(x.so_ct);
                    const ct = chiTiet.get(x.so_ct) ?? [];
                    return (
                      <div key={i} className="border-t border-slate-100">
                        <button onClick={() => toggleExpand(x.so_ct)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50">
                          <span className="flex items-center gap-2"><span className="text-slate-400">{isExp ? '▼' : '›'}</span><span>{fmtD(x.ngay)}</span><span className="text-slate-600">{x.dien_giai}</span></span>
                          <span className="font-semibold tabular-nums">{fmt(x.tien)}đ</span>
                        </button>
                        {isExp && ct.length > 0 && (
                          <div className="bg-slate-50 px-6 pb-2">
                            <table className="w-full text-xs"><thead><tr className="text-left text-slate-600"><th className="py-1">Mã SP</th><th className="py-1">Tên sản phẩm</th><th className="py-1 text-right">SL</th><th className="py-1 text-right">Đơn giá</th><th className="py-1 text-right">Thành tiền</th></tr></thead>
                              <tbody>{ct.map((c, j) => <tr key={j} className="border-t border-slate-200"><td className="py-1 font-mono text-[10px]">{c.ma_vt}</td><td className="py-1">{c.ten_vt}</td><td className="py-1 text-right tabular-nums">{c.so_luong}</td><td className="py-1 text-right tabular-nums">{fmt(c.don_gia)}</td><td className="py-1 text-right font-semibold tabular-nums">{fmt(c.thanh_tien)}</td></tr>)}</tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between rounded-lg border-2 border-slate-300 bg-slate-100 px-3 py-2"><span className="font-bold">Còn nợ cuối kỳ ({fmtD(den)}):</span><span className={`text-lg font-bold ${data.cuoi_ky > 0 ? 'text-red-600' : data.cuoi_ky < 0 ? 'text-green-600' : 'text-slate-600'}`}>{fmt(data.cuoi_ky)}đ</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
