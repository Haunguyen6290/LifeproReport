'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/RequireAuth';
import { Dialog } from '@/components/Dialog';
import { GrowArea } from '@/components/GrowArea';
import { fmtDateVN, fmtCommentTimeVN } from '@/lib/time';
import { periodLabel } from '@/lib/okr';
import type { OkrRow } from '@/components/OkrTree';

function cleanKrList(krs: string[]): string[] {
  return (krs ?? []).map((s) => String(s ?? '').trim()).filter(Boolean);
}
function validateKRs(list: string[], oCount: number): { ok: boolean; msg: string } {
  if (list.length < 2 || list.length > 5) return { ok: false, msg: 'Mỗi O cần 2-5 KR' };
  for (const k of list) if (!/\d/.test(k) && !k.includes('%') && !/đ\b/i.test(k)) return { ok: false, msg: 'KR "' + k + '" phải có số' };
  return { ok: true, msg: '' };
}

type CheckIn = { id: string; tuan_tu: string; tien_do: number; tu_tin: string; ket_qua: string; vuong_mac: string; can_ho_tro: string; y_kien_quan_ly: string; created_at: string };

export function OkrDetailDialog({ okr, onClose, onDone, onRefresh, canManage, readOnly }: { okr: OkrRow; onClose: () => void; onDone: () => void; onRefresh?: () => void; canManage: boolean; readOnly?: boolean }) {
  const { userId } = useAuth();
  const canEdit = !readOnly && (canManage || okr.user_id === userId);
  const [krs, setKrs] = useState<{ id: string; noi_dung: string }[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [openCheckin, setOpenCheckin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editObjective, setEditObjective] = useState('');
  const [editKrs, setEditKrs] = useState<string[]>([]);
  const [editTu, setEditTu] = useState('');
  const [editDen, setEditDen] = useState('');
  const [editMsg, setEditMsg] = useState('');
  const [tkDanhGia, setTkDanhGia] = useState('');
  const [tkPhanHoi, setTkPhanHoi] = useState('');
  const [savedTk, setSavedTk] = useState({ dg: '', ph: '' });
  const [tab, setTab] = useState<'checkin' | 'tongket'>('checkin');
  const [showAllCi, setShowAllCi] = useState(false);
  const [tienDoHienTai, setTienDoHienTai] = useState(okr.tien_do);
  const [tkEditing, setTkEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const [a, b, okrFull] = await Promise.all([
      supabase.from('okr_key_results').select('id, noi_dung').eq('okr_id', okr.id).order('sort_order', { ascending: true }),
      supabase.from('okr_check_ins').select('id, tuan_tu, tien_do, tu_tin, ket_qua, vuong_mac, can_ho_tro, y_kien_quan_ly, created_at').eq('okr_id', okr.id).order('created_at', { ascending: false }),
      supabase.from('okrs').select('tien_do, tongket_tudanhgia, tongket_phanhoi').eq('id', okr.id).single(),
    ]);
    setKrs((a.data ?? []) as any);
    setCheckins((b.data ?? []) as any);
    setTienDoHienTai((okrFull.data as any)?.tien_do ?? okr.tien_do);
    const dg = (okrFull.data as any)?.tongket_tudanhgia ?? '';
    const ph = (okrFull.data as any)?.tongket_phanhoi ?? '';
    setSavedTk({ dg, ph });
    setTkDanhGia(dg);
    setTkPhanHoi(ph);
    setTkEditing(!(dg || ph));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [okr.id]);

  function startEditOkr() {
    setEditObjective(okr.objective);
    setEditKrs(krs.map((k) => k.noi_dung));
    setEditTu(okr.tu_ngay ?? '');
    setEditDen(okr.den_ngay ?? '');
    setEditMsg('');
    setEditing(true);
  }
  async function saveEditOkr() {
    const t = editObjective.trim();
    if (!t) { setEditMsg('Objective không được trống'); return; }
    if (!editTu || !editDen) { setEditMsg('Phải có Từ ngày và Đến ngày'); return; }
    if (editTu > editDen) { setEditMsg('Từ ngày phải ≤ Đến ngày'); return; }
    const list = cleanKrList(editKrs);
    const vr = validateKRs(list, 1);
    if (!vr.ok) { setEditMsg(vr.msg); return; }
    setBusy(true); setEditMsg('');
    try {
      const { error: e1 } = await supabase.from('okrs').update({ objective: t, tu_ngay: editTu, den_ngay: editDen }).eq('id', okr.id);
      if (e1) throw new Error(e1.message);
      const { data: existing } = await supabase.from('okr_key_results').select('id').eq('okr_id', okr.id).order('sort_order');
      const exIds = (existing ?? []).map((x: any) => x.id);
      // simple: delete all then insert
      if (exIds.length) await supabase.from('okr_key_results').delete().eq('okr_id', okr.id);
      const rows = list.map((noi_dung, sort_order) => ({ okr_id: okr.id, noi_dung, sort_order }));
      if (rows.length) {
        const { error: e2 } = await supabase.from('okr_key_results').insert(rows);
        if (e2) throw new Error(e2.message);
      }
      setEditing(false);
      await load();
      onDone();
    } catch (e: any) { setEditMsg(e?.message ?? 'Lỗi lưu OKR'); }
    finally { setBusy(false); }
  }

  async function saveTongKet() {
    setBusy(true); setMsg('');
    const { error } = await supabase.from('okrs').update({ tongket_tudanhgia: tkDanhGia.trim(), tongket_phanhoi: tkPhanHoi.trim() }).eq('id', okr.id);
    if (error) setMsg(error.message);
    else {
      const dg = tkDanhGia.trim();
      const ph = tkPhanHoi.trim();
      setSavedTk({ dg, ph });
      setMsg('Đã lưu tổng kết.');
      setTkEditing(false);
    }
    setBusy(false);
  }
  async function doArchive() {
    if (!confirm('Đóng & Lưu trữ OKR này? OK sẽ ẩn khỏi danh sách.')) return;
    setBusy(true);
    await supabase.from('okrs').update({ is_archived: true }).eq('id', okr.id);
    setBusy(false); onDone(); onClose();
  }
  async function saveGopY(id: string, text: string) {
    if (!text.trim()) return;
    await supabase.from('okr_check_ins').update({ y_kien_quan_ly: text.trim() }).eq('id', id);
    load();
  }
  async function deleteCheckIn(c: CheckIn) {
    const tuan = c.tuan_tu ? fmtDateVN(c.tuan_tu) : '';
    if (!confirm(`Xóa check-in tuần ${tuan} (${c.tien_do}%)? Hành động này không hoàn tác được.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('okr_check_ins').delete().eq('id', c.id);
      if (error) throw new Error(error.message);
      try {
        await supabase.from('audit_logs').insert({
          actor_id: userId, action: 'Xóa check-in OKR', entity_type: 'okr_check_in', entity_id: c.id,
          details: { okr_id: okr.id, tuan_tu: c.tuan_tu, tien_do: c.tien_do },
        });
      } catch {}
      await load();
      onRefresh?.();
    } catch (e: any) { setMsg(e?.message ?? 'Xóa thất bại'); }
    finally { setBusy(false); }
  }

  const sel = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]';
  return (
    <Dialog open onClose={onClose} title={okr.is_company ? 'OKR công ty' : 'OKR cá nhân'} size="wide">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {editing ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Mục tiêu</label>
              <GrowArea value={editObjective} onChange={(e) => setEditObjective(e.target.value)} placeholder="Mục tiêu…" className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]" rows={2} />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Từ ngày *</label>
                  <input type="date" value={editTu} onChange={(e) => setEditTu(e.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Đến ngày *</label>
                  <input type="date" value={editDen} onChange={(e) => setEditDen(e.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]" />
                </div>
              </div>
              {editMsg && <p className="mt-1 text-xs text-red-600">{editMsg}</p>}
              <div className="mt-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">Kết quả then chốt (2-5 KR, mỗi KR phải có số)</label>
                <div className="grid gap-2">
                  {editKrs.map((kr, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-xs font-semibold text-slate-600">KR{i + 1}</span>
                      <input value={kr} onChange={(e) => setEditKrs((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })} placeholder="VD: Chốt 5 khách / Tăng 20%" className="w-full flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
                      <button type="button" onClick={() => setEditKrs((prev) => prev.filter((_, j) => j !== i))} disabled={editKrs.length <= 2} className="shrink-0 rounded-md border border-slate-200 px-2 text-sm disabled:opacity-40">×</button>
                    </div>
                  ))}
                </div>
                {editKrs.length < 5 && <button type="button" onClick={() => setEditKrs((p) => [...p, ''])} className="mt-2 text-xs font-semibold text-[#1e3a8a]">+ Thêm KR</button>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setEditing(false)} disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button>
                  <button onClick={saveEditOkr} disabled={busy} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu OKR'}</button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-bold text-[#0f2a4a]">🎯 {okr.objective}</span>
                {canEdit && <button onClick={startEditOkr} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:border-[#1e3a8a] hover:text-[#1e3a8a]">Sửa OKR</button>}
              </div>
              <div className="mt-1 text-xs text-slate-500">{periodLabel(okr.tu_ngay, okr.den_ngay)} · {checkins.length} check-in</div>
              {krs.length > 0 && <ul className="mt-2 space-y-1 text-sm text-slate-800">{krs.map((k, i) => <li key={k.id}>KR{i + 1}: {k.noi_dung}</li>)}</ul>}
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2.5 w-full max-w-[200px] overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${tienDoHienTai}%` }} /></div>
                <span className="text-xs font-semibold text-slate-700">{tienDoHienTai}%</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!readOnly && <button onClick={() => setOpenCheckin(true)} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">+ Check-in</button>}
                {canManage && <button onClick={doArchive} disabled={busy} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Đóng & Lưu trữ</button>}
              </div>
            </div>
          )}
        </div>

        {/* 2 tab ngang — mặc định Lịch sử check-in */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex gap-1 border-b border-slate-200 px-2 pt-2">
            <button type="button" onClick={() => setTab('checkin')} className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${tab === 'checkin' ? 'border border-b-0 border-slate-200 bg-white text-[#1e3a8a]' : 'text-slate-600 hover:text-slate-900'}`}>Lịch sử check-in</button>
            <button type="button" onClick={() => setTab('tongket')} className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${tab === 'tongket' ? 'border border-b-0 border-slate-200 bg-white text-[#1e3a8a]' : 'text-slate-600 hover:text-slate-900'}`}>Tổng kết OKR</button>
          </div>
          <div className="p-4">
            {tab === 'checkin' ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#1e3a8a]">Lịch sử check-in <span className="font-normal text-slate-500">({checkins.length})</span></h3>
                  {checkins.length > 3 && (
                    <button type="button" onClick={() => setShowAllCi((v) => !v)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-[#1e3a8a] hover:text-[#1e3a8a]">
                      {showAllCi ? 'Thu gọn' : `Xem tất cả (${checkins.length})`}
                    </button>
                  )}
                </div>
                {checkins.length === 0 ? <p className="text-sm text-slate-600">Chưa có check-in.</p> : (
                  <ul className={showAllCi ? 'max-h-[420px] space-y-3 overflow-y-auto pr-1' : 'space-y-3'}>
                    {(showAllCi ? checkins : checkins.slice(0, 3)).map((c) => (
                    <li key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-900">Tuần {fmtDateVN(c.tuan_tu)}</span>
                        <span className="font-semibold text-slate-900">{c.tien_do}%</span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{c.tu_tin}</span>
                        <span className="text-slate-500">lúc {fmtCommentTimeVN(c.created_at)}</span>
                      </div>
                      {c.ket_qua && <p className="mt-1 text-sm text-slate-800">Kết quả: {c.ket_qua}</p>}
                      {c.vuong_mac && <p className="mt-1 text-sm text-slate-800">Trở ngại: {c.vuong_mac}</p>}
                      {c.can_ho_tro && <p className="mt-1 text-sm text-slate-800">Cần xử: {c.can_ho_tro}</p>}
                      {canManage ? (
                        <FeedbackBox initial value={c.y_kien_quan_ly} onSave={(t) => saveGopY(c.id, t)} />
                      ) : c.y_kien_quan_ly ? (
                        <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-800">Cấp trên: {c.y_kien_quan_ly}</p>
                      ) : null}
                      {canManage && (
                        <div className="mt-2 flex justify-end">
                          <button type="button" onClick={() => deleteCheckIn(c)} disabled={busy} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">Xóa check-in này</button>
                        </div>
                      )}
                    </li>
                  ))}</ul>
                )}
                {!showAllCi && checkins.length > 3 && <p className="mt-2 text-xs text-slate-500">Đang hiển thị 3 lần check-in gần nhất.</p>}
              </div>
            ) : (
              <div>
                <h3 className="mb-2 text-sm font-bold text-[#1e3a8a]">Tổng kết OKR</h3>
                {tkEditing ? (
                  <>
                    <div className="grid gap-2">
                      <div><label className="mb-1 block text-xs font-semibold">Tự đánh giá</label><GrowArea value={tkDanhGia} onChange={(e) => setTkDanhGia(e.target.value)} className={sel} rows={2} /></div>
                      <div><label className="mb-1 block text-xs font-semibold">Phản hồi của các cấp, các bộ phận</label><GrowArea value={tkPhanHoi} onChange={(e) => setTkPhanHoi(e.target.value)} className={sel} rows={2} /></div>
                    </div>
                    {msg && <p className="mt-2 text-xs text-slate-600">{msg}</p>}
                    <div className="mt-2 flex justify-end gap-2"><button onClick={() => setTkEditing(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button><button onClick={saveTongKet} disabled={busy} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu tổng kết'}</button></div>
                  </>
                ) : (
                  <>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800"><span className="font-semibold">Tự đánh giá:</span> {savedTk.dg || '—'}</p>
                    <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-slate-800"><span className="font-semibold">Phản hồi các cấp:</span> {savedTk.ph || '—'}</p>
                    <div className="mt-2 flex justify-end"><button onClick={() => { setTkDanhGia(savedTk.dg); setTkPhanHoi(savedTk.ph); setTkEditing(true); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-[#1e3a8a] hover:text-[#1e3a8a]">Sửa tổng kết</button></div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {openCheckin && <CheckInDialog okr={okr} onClose={() => setOpenCheckin(false)} onDone={() => { setOpenCheckin(false); load(); setShowAllCi(false); setTab('checkin'); onRefresh?.(); }} />}
    </Dialog>
  );
}

function FeedbackBox({ initial, value, onSave }: { initial: any; value: string; onSave: (t: string) => void }) {
  const [t, setT] = useState(value ?? '');
  return (
    <div className="mt-2 flex gap-2">
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Phản hồi của cấp trên…" className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm" />
      <button onClick={() => onSave(t)} className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white">Góp ý</button>
    </div>
  );
}

function CheckInDialog({ okr, onClose, onDone }: { okr: OkrRow; onClose: () => void; onDone: () => void }) {
  const { userId } = useAuth();
  const week = (() => { const d = new Date(); const day = d.getDay() || 7; const m = new Date(d); m.setDate(d.getDate() - (day - 1)); return m.toISOString().slice(0, 10); })();
  const [tienDo, setTienDo] = useState(okr.tien_do);
  const [tuTin, setTuTinT] = useState('Ổn');
  const [ketQua, setKetQua] = useState('');
  const [vuongMac, setVuongMac] = useState('');
  const [canHoTro, setCanHoTro] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const sel = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]';

  async function save() {
    setBusy(true); setMsg('');
    const { error } = await supabase.from('okr_check_ins').insert({ okr_id: okr.id, user_id: userId, tuan_tu: week, tien_do: tienDo, tu_tin: tuTin, ket_qua: ketQua.trim(), vuong_mac: vuongMac, can_ho_tro: canHoTro });
    if (error) { setMsg(error.message); setBusy(false); return; }
    await supabase.from('okrs').update({ tien_do: tienDo }).eq('id', okr.id);
    setBusy(false); onDone();
  }

  return (
    <Dialog open onClose={onClose} title="Check-in tuần">
      <div className="grid gap-2">
        <div><label className="mb-1 block text-xs font-semibold">Mức độ tự tin hoàn thành</label>
          <select value={tuTin} onChange={(e) => setTuTinT(e.target.value)} className={sel}><option value="Tốt">Tốt</option><option value="Ổn">Ổn</option><option value="Không ổn">Không ổn</option></select>
        </div>
        <div><label className="mb-1 block text-xs font-semibold">Tiến độ, kết quả công việc (%)</label>
          <div className="flex items-center gap-2"><input type="range" min={0} max={100} value={tienDo} onChange={(e) => setTienDo(Number(Number(e.target.value)))} className="flex-1" /><span className="w-10 text-right text-sm font-semibold">{tienDo}%</span></div>
        </div>
        <div><label className="mb-1 block text-xs font-semibold">Kết quả công việc</label><GrowArea value={ketQua} onChange={(e) => setKetQua(e.target.value)} className={sel} rows={2} /></div>
        <div><label className="mb-1 block text-xs font-semibold">Trở ngại khó khăn là gì</label><GrowArea value={vuongMac} onChange={(e) => setVuongMac(e.target.value)} className={sel} rows={2} /></div>
        <div><label className="mb-1 block text-xs font-semibold">Cần làm gì để xử lý khó khăn</label><GrowArea value={canHoTro} onChange={(e) => setCanHoTro(e.target.value)} className={sel} rows={2} /></div>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button><button onClick={save} disabled={busy} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu check-in'}</button></div>
      </div>
    </Dialog>
  );
}
