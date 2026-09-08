'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { weekBounds } from '@/lib/week';
import { fmtCommentTimeVN, fmtDateVN } from '@/lib/time';

type OkrRow = { id: string; user_id: string; objective: string };
type CheckIn = {
  id: string;
  okr_id: string;
  user_id: string;
  tuan_tu: string;
  tien_do: number;
  tu_tin: string;
  vuong_mac: string;
  can_ho_tro: string;
  created_at: string;
  updated_at: string;
};

export function OkrCheckInPanel({ okr, tu, den }: { okr: OkrRow; tu: string; den: string }) {
  const { userId, can } = useAuth();
  const canComment = can('quan_ly_okr');
  const week = weekBounds(new Date());
  const [items, setItems] = useState<CheckIn[]>([]);
  const [tienDo, setTienDo] = useState(0);
  const [tuTin, setTuTin] = useState('Ổn');
  const [vuongMac, setVuongMac] = useState('');
  const [canHoTro, setCanHoTro] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data } = await supabase
      .from('okr_check_ins')
      .select('id, okr_id, user_id, tuan_tu, tien_do, tu_tin, vuong_mac, can_ho_tro, created_at, updated_at')
      .eq('okr_id', okr.id)
      .order('tuan_tu', { ascending: false });
    setItems((data ?? []) as CheckIn[]);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [okr.id]);

  const hasThisWeek = items.some((c) => c.tuan_tu === week.tu);

  async function save() {
    if (okr.user_id !== userId && !can('quan_ly_okr')) {
      setMsg('Chỉ chủ sở hữu hoặc quản lý OKR được check-in.');
      return;
    }
    if (tienDo < 0 || tienDo > 100) {
      setMsg('Tiến độ phải 0–100');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const payload: any = {
        okr_id: okr.id,
        user_id: userId,
        tuan_tu: week.tu,
        tien_do: tienDo,
        tu_tin: tuTin,
        vuong_mac: vuongMac.trim(),
        can_ho_tro: canHoTro.trim(),
      };
      const { error } = await supabase.from('okr_check_ins').upsert(payload, { onConflict: 'okr_id,tuan_tu' });
      if (error) throw new Error(error.message);
      await supabase.from('okrs').update({ tien_do: tienDo }).eq('id', okr.id);
      try {
        const me2 = (await supabase.from('profiles').select('full_name').eq('id', userId).single()).data;
        await supabase.from('audit_logs').insert({
          actor_id: userId,
          action: 'Check-in OKR',
          entity_type: 'okr',
          entity_id: okr.id,
          details: { tuan_tu: week.tu, tien_do: tienDo, tu_tin: tuTin, full_name: (me2 as any)?.full_name ?? '' },
        });
      } catch {}
      try {
        const nm = (await supabase.from('profiles').select('full_name').eq('id', userId).single()).data?.full_name ?? '';
        await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventKey: 'TB_OKR', text: `[Check-in OKR] ${ocrClean(okr.objective)}\nNgười: ${nm}\nTuần ${fmtDateVN(week.tu)} -> ${fmtDateVN(week.den)} · ${tienDo}% · ${tuTin}` }),
        });
      } catch {}
      setVuongMac('');
      setCanHoTro('');
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? 'Lỗi lưu check-in');
    } finally {
      setBusy(false);
    }
  }

  async function postGopY(checkInId: string, text: string) {
    if (!text.trim()) return;
    const { error } = await supabase
      .from('okr_check_ins')
      .update({ y_kien_quan_ly: text.trim() })
      .eq('id', checkInId);
    if (!error) load();
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">Check-in hàng tuần</span>
        {!hasThisWeek && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Chưa check-in tuần {fmtDateVN(week.tu)}</span>}
      </div>

      {/* Nhập */}
      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold text-slate-600">Tuần {fmtDateVN(week.tu)} → {fmtDateVN(week.den)} · Cập nhật cho: {okr.objective}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tiến độ</label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} value={tienDo} onChange={(e) => setTienDo(Number(e.target.value))} className="flex-1" />
              <span className="w-10 text-right text-sm font-semibold text-slate-900">{tienDo}%</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Mức tự tin</label>
            <select value={tuTin} onChange={(e) => setTuTin(e.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
              <option>Tốt</option>
              <option>Ổn</option>
              <option>Không ổn</option>
            </select>
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Vướng mắc</label>
            <textarea value={vuongMac} onChange={(e) => setVuongMac(e.target.value)} placeholder="Đang tắc ở đâu…" rows={2} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Cần hỗ trợ</label>
            <textarea value={canHoTro} onChange={(e) => setCanHoTro(e.target.value)} placeholder="Cần ai giúp gì…" rows={2} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" />
          </div>
        </div>
        {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
        <button onClick={save} disabled={busy} className="mt-2 rounded-md bg-[#1e3a8a] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">
          {busy ? 'Đang lưu…' : hasThisWeek ? 'Cập nhật check-in' : 'Gửi check-in'}
        </button>
      </div>

      {/* Lịch sử */}
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có check-in.</p>
        ) : (
          items.map((c) => (
            <CheckInCard key={c.id} c={c} canComment={!!canComment} onGopY={postGopY} />
          ))
        )}
      </div>
    </div>
  );
}

function CheckInCard({ c, canComment, onGopY }: { c: any; canComment: boolean; onGopY: (id: string, text: string) => void }) {
  const [text, setText] = useState(c.y_kien_quan_ly ?? '');
  const badge =
    c.tu_tin === 'Tốt' ? 'bg-emerald-50 text-emerald-700' : c.tu_tin === 'Không ổn' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">Tuần {fmtDateVN(c.tuan_tu)}</span>
        <span>·</span>
        <span className="font-semibold text-slate-900">{c.tien_do}%</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${badge}`}>{c.tu_tin}</span>
        <span>·</span>
        <span>{fmtCommentTimeVN(c.created_at)}</span>
      </div>
      {c.vuong_mac && <p className="mt-1 text-sm text-slate-800">Vướng mắc: {c.vuong_mac}</p>}
      {c.can_ho_tro && <p className="mt-1 text-sm text-slate-800">Cần hỗ trợ: {c.can_ho_tro}</p>}
      {c.y_kien_quan_ly ? <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-800">Quản lý: {c.y_kien_quan_ly}</p> : null}
      {canComment && (
        <div className="mt-2 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Góp ý của quản lý…" className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
          <button onClick={() => onGopY(c.id, text)} className="rounded-md bg-[#1e3a8a] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1e40af]">
            Góp ý
          </button>
        </div>
      )}
    </div>
  );
}

function ocrClean(s: string): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
}
