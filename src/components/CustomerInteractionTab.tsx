'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { fmtCommentTimeVN } from '@/lib/time';

type Loai = 'goi' | 'gap' | 'zalo' | 'khieu_nai';
type Row = { id: string; loai: Loai; noi_dung: string; ngay: string; hen_nhac: string | null; nguoi: string; created_at: string };

const LOAI_LABEL: Record<Loai, string> = { goi: '📞 Gọi', gap: '🤝 Gặp', zalo: '💬 Zalo', khieu_nai: '⚠️ Khiếu nại' };
const LOAIS: Loai[] = ['goi', 'gap', 'zalo', 'khieu_nai'];

function todayVN() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export function CustomerInteractionTab({ customerId, onChanged, readOnly }: { customerId: string; onChanged?: () => void; readOnly?: boolean }) {
  const { userId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Loai>('all');
  const [text, setText] = useState('');
  const [loai, setLoai] = useState<Loai>('goi');
  const [ngay, setNgay] = useState(todayVN());
  const [hen, setHen] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('customer_interactions')
      .select('id, loai, noi_dung, ngay, hen_nhac, created_at, nguoi:profiles!customer_interactions_nguoi_tao_fkey(full_name)')
      .eq('customer_id', customerId).order('ngay', { ascending: false }).order('created_at', { ascending: false }).limit(200);
    setRows(((data ?? []) as any[]).map((r) => ({
      id: r.id, loai: r.loai as Loai, noi_dung: r.noi_dung ?? '', ngay: r.ngay,
      hen_nhac: r.hen_nhac ?? null, nguoi: r.nguoi?.full_name ?? '', created_at: r.created_at,
    })));
    setLoading(false);
  }

  useEffect(() => { if (customerId) load(); }, [customerId]);

  const counts = (l: Loai) => rows.filter((r) => r.loai === l).length;
  const shown = filter === 'all' ? rows : rows.filter((r) => r.loai === filter);

  async function save() {
    const nd = text.trim();
    if (!nd || saving) return;
    setSaving(true);
    const { error } = await supabase.from('customer_interactions').insert({
      customer_id: customerId, loai, noi_dung: nd, ngay: ngay || todayVN(),
      hen_nhac: hen || null, nguoi_tao: userId,
    });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setText('');
    setHen('');
    await load();
    onChanged?.();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-[#1e3a8a]">Tương tác & Chăm sóc</h3>
      </div>

      {/* Chips lọc */}
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === 'all' ? 'bg-[#1e3a8a] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
          Tất cả {rows.length}
        </button>
        {LOAIS.map((l) => (
          <button key={l} onClick={() => setFilter(l)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === l ? 'bg-[#1e3a8a] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {LOAI_LABEL[l]} {counts(l)}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Chưa có tương tác nào. Ghi dòng đầu tiên bên dưới nhé.</p>
      ) : (
        <ul className="relative mb-4 space-y-0 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-0.5 before:rounded before:bg-slate-200">
          {shown.map((r) => (
            <li key={r.id} className="relative pb-3">
              <span className={`absolute -left-5 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${r.loai === 'khieu_nai' ? 'bg-red-500' : 'bg-[#1e3a8a]'}`} />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">{LOAI_LABEL[r.loai]}</span>
                <span>{r.ngay ? fmtCommentTimeVN(r.ngay) : ''}</span>
                {r.nguoi && <span>· {r.nguoi}</span>}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{r.noi_dung}</p>
              {r.hen_nhac && <p className="mt-0.5 text-xs font-medium text-amber-700">⏰ Hẹn: {fmtCommentTimeVN(r.hen_nhac)}</p>}
            </li>
          ))}
        </ul>
      )}

      {/* Ghi nhanh */}
      {readOnly ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">Ông không phụ trách khách này nên chỉ xem, không ghi tương tác.</p>
      ) : (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ghi nhanh (Enter = lưu, Shift+Enter = xuống dòng)</label>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }}
          placeholder="VD: Gọi anh Tú — kêu chưa nhận đủ bi gầm X200, hẹn giao bổ sung mai..."
          className="mt-1.5 min-h-[64px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a]"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <select value={loai} onChange={(e) => setLoai(e.target.value as Loai)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
            <option value="goi">📞 Gọi</option>
            <option value="gap">🤝 Gặp trực tiếp</option>
            <option value="zalo">💬 Zalo</option>
            <option value="khieu_nai">⚠️ Khiếu nại</option>
          </select>
          <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
          <input type="date" value={hen} onChange={(e) => setHen(e.target.value)} title="Hẹn nhắc lại" className="flex-1 min-w-[140px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
          <button onClick={save} disabled={saving || !text.trim()} className="rounded-md bg-[#1e3a8a] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Lưu</button>
        </div>
      </div>
      )}
    </section>
  );
}

// Ngày tương tác gần nhất — dùng để chấm đỏ tab khi bỏ bê quá 21 ngày.
export async function lastInteractionDate(customerId: string): Promise<string | null> {
  const { data } = await supabase.from('customer_interactions')
    .select('ngay').eq('customer_id', customerId).order('ngay', { ascending: false }).limit(1);
  return (data as any[])?.[0]?.ngay ?? null;
}

export function isStaleInteraction(lastNgay: string | null): boolean {
  if (!lastNgay) return true;
  const d = new Date(lastNgay.length <= 10 ? lastNgay + 'T00:00:00' : lastNgay).getTime();
  if (Number.isNaN(d)) return false;
  return Date.now() - d > 21 * 24 * 3600 * 1000;
}
