'use client';
import { useEffect, useState, useRef } from 'react';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { supabase } from '@/lib/supabase/client';

type DanhGia = {
  id: string; loai: string; target_id: string; user_id: string; ten_nhan_vien: string;
  tuan_tu: string; tuan_den: string; ket_qua: string; ly_do: string; dau_hieu_doi_pho: string;
  gop_y_soan_san: string; trang_thai: string; created_at: string;
};
type Msg = { id: string; vai_tro: string; noi_dung: string; created_at: string };

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const tok = data.session?.access_token ?? '';
  return tok ? { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function bulleted(s: string) {
  const lines = s.split(/\n|•/).map((x) => x.trim()).filter(Boolean);
  if (lines.length <= 1) return <span>{s}</span>;
  return <ul className="list-disc pl-5 space-y-0.5">{lines.map((l, i) => <li key={i} className="italic font-semibold">{l}</li>)}</ul>;
}

function badge(ket_qua: string) {
  if (ket_qua === 'Dat') return 'bg-emerald-100 text-emerald-700';
  if (ket_qua === 'Can sua') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function ChatPanel({ full }: { full?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const h = await authHeaders();
    const r = await fetch('/api/co-van/chat', { headers: h });
    const j = await r.json();
    if (r.ok) setMsgs(j.rows ?? []);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send() {
    const text = q.trim();
    if (!text || busy) return;
    setQ(''); setBusy(true);
    const optimistic: Msg = { id: 'tmp-' + Date.now(), vai_tro: 'user', noi_dung: text, created_at: new Date().toISOString() };
    setMsgs((m) => [...m, optimistic]);
    try {
      const h = await authHeaders();
      const r = await fetch('/api/co-van/chat', { method: 'POST', headers: h, body: JSON.stringify({ q: text }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Lỗi');
      setMsgs((m) => [...m.filter((x) => x.id !== optimistic.id), { id: 'u-' + Date.now(), vai_tro: 'user', noi_dung: text, created_at: new Date().toISOString() }, { id: 'a-' + Date.now(), vai_tro: 'assistant', noi_dung: j.text, created_at: new Date().toISOString() }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { id: 'e-' + Date.now(), vai_tro: 'assistant', noi_dung: 'Lỗi: ' + (e?.message ?? 'không rõ'), created_at: new Date().toISOString() }]);
    } finally { setBusy(false); }
  }

  return (
    <div className={`flex flex-col rounded-xl border border-slate-200 bg-white ${full ? 'h-full' : 'h-[420px]'}`}>
      <div className="border-b border-slate-200 px-4 py-2 text-sm font-bold text-[#0f2a4a]">Chat với Cố vấn</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 && <p className="text-xs text-slate-500">Hỏi như: "Tuần này ai làm dở nhất?" · "Tóm tắt team Kinh doanh tuần trước"</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.vai_tro === 'user' ? 'ml-auto bg-[#0f2a4a] text-white' : 'bg-slate-100 text-slate-800'}`}>
            <p className="whitespace-pre-wrap break-words">{m.noi_dung}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 border-t border-slate-200 p-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Nhắn cho Cố vấn..." className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1e3a8a]" />
        <button onClick={send} disabled={busy || !q.trim()} className="rounded-md bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? '...' : 'Gửi'}</button>
      </div>
    </div>
  );
}

function DanhGiaList({ loai }: { loai: 'ke_hoach' | 'bao_cao' | 'chien_dich' | 'tin_thi_truong' }) {
  const [rows, setRows] = useState<DanhGia[]>([]);
  const [filter, setFilter] = useState('Cho duyet');
  const [tuanTu, setTuanTu] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);

  async function doSweep() {
    setSweeping(true);
    try {
      const h = await authHeaders();
      const r = await fetch('/api/cron/co-van-sweep', { headers: h });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Lỗi');
      alert(`Đã quét: ${j.pending ?? 0} bài chờ, đã chấm ${j.processed ?? 0} bài`);
      load();
    } catch (e: any) {
      alert(e?.message ?? 'Lỗi quét');
    } finally { setSweeping(false); }
  }

  async function load() {
    setLoading(true);
    const h = await authHeaders();
    const params = new URLSearchParams({ loai, trang_thai: filter });
    if (tuanTu) params.set('tuan_tu', tuanTu);
    const r = await fetch(`/api/co-van/danh-gia?${params.toString()}`, { headers: h });
    const j = await r.json();
    if (r.ok) {
      setRows(j.rows ?? []);
      const m: Record<string, string> = {};
      for (const x of (j.rows ?? []) as DanhGia[]) m[x.id] = x.gop_y_soan_san;
      setEditing(m);
      // reset mở rộng khi đổi filter
      setExpanded(null); setBaiCache({});
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [filter, tuanTu, loai]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [baiCache, setBaiCache] = useState<Record<string, any>>({});
  const [baiLoading, setBaiLoading] = useState<string | null>(null);

  async function toggleBai(r: DanhGia) {
    if (expanded === r.id) { setExpanded(null); return; }
    setExpanded(r.id);
    if (baiCache[r.id]) return;
    setBaiLoading(r.id);
    try {
      const h = await authHeaders();
      const qr = await fetch(`/api/co-van/bai?loai=${r.loai}&id=${r.target_id}`, { headers: h });
      const j = await qr.json();
      if (qr.ok) setBaiCache((m) => ({ ...m, [r.id]: j }));
    } catch {}
    setBaiLoading(null);
  }

  async function doChamLai(r: DanhGia) {
    setBusyId(r.id);
    try {
      const h = await authHeaders();
      const rr = await fetch('/api/co-van/evaluate', { method: 'POST', headers: h, body: JSON.stringify({ loai: r.loai, targetId: r.target_id, force: true }) });
      const j = await rr.json();
      if (!rr.ok) alert(j.reason ?? j.error ?? 'Lỗi');
      else { alert(`Đã chấm lại: ${j.ket_qua ?? ''} ${j.reason ?? ''}`.trim()); load(); }
    } catch (e: any) { alert(e?.message ?? 'Lỗi'); }
    setBusyId(null);
  }

  async function doGui(id: string) {
    setBusyId(id);
    const h = await authHeaders();
    const r = await fetch('/api/co-van/gui', { method: 'POST', headers: h, body: JSON.stringify({ id, action: 'gui', gop_y: editing[id] }) });
    const j = await r.json();
    if (!r.ok) alert(j.error ?? 'Lỗi');
    else load();
    setBusyId(null);
  }
  async function doBoQua(id: string) {
    setBusyId(id);
    const h = await authHeaders();
    const r = await fetch('/api/co-van/gui', { method: 'POST', headers: h, body: JSON.stringify({ id, action: 'bo_qua' }) });
    const j = await r.json();
    if (!r.ok) alert(j.error ?? 'Lỗi');
    else load();
    setBusyId(null);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
        <input type="date" value={tuanTu} onChange={(e) => setTuanTu(e.target.value)} className="rounded-md border border-slate-200 px-3 py-1 text-sm" title="Lọc theo tuần (tuan_tu)" />
        {tuanTu && <button onClick={() => setTuanTu('')} className="rounded-md border border-slate-200 px-2 py-1 text-xs">Xóa lọc tuần</button>}
        <button onClick={doSweep} disabled={sweeping} className="rounded-md bg-[#1e3a8a] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">{sweeping ? 'Đang chấm...' : 'Chấm tất cả chưa chấm'}</button>
        <div className="ml-auto flex gap-1">
          {(['Cho duyet', 'Da gui', 'Bo qua', ''] as const).map((v) => (
            <button key={v || 'all'} onClick={() => setFilter(v)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === v ? 'bg-[#0f2a4a] text-white' : 'bg-slate-100 text-slate-600'}`}>
              {v === '' ? 'Tất cả' : v === 'Cho duyet' ? 'Chờ duyệt' : v === 'Da gui' ? 'Đã gửi' : 'Bỏ qua'}
            </button>
          ))}
        </div>
        <button onClick={load} className="rounded-md border border-slate-200 px-3 py-1 text-xs">Tải lại</button>
      </div>
      {loading ? <p className="p-6 text-center text-sm text-slate-500">Đang tải...</p>
        : rows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Chưa có đánh giá nào.</p>
        : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#0f2a4a]">{r.ten_nhan_vien}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badge(r.ket_qua)}`}>{r.ket_qua}</span>
                  <span className="ml-auto text-xs text-slate-400">tuần {r.tuan_tu}→{r.tuan_den}</span>
                </div>
                {r.ly_do && <div className="text-sm text-slate-700">{bulleted(r.ly_do)}</div>}
                {r.dau_hieu_doi_pho && <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{bulleted(r.dau_hieu_doi_pho)}</div>}
                {editing[r.id] && <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{bulleted(editing[r.id])}</div>}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => toggleBai(r)} className="rounded-md border border-slate-200 px-3 py-1 text-xs">{expanded === r.id ? 'Ẩn' : 'Xem bài'}</button>
                  <button onClick={() => doChamLai(r)} disabled={!!busyId} className="rounded-md border border-slate-200 px-3 py-1 text-xs disabled:opacity-50">Chấm lại</button>
                  <button onClick={() => doGui(r.id)} disabled={!!busyId} className="ml-auto rounded-md bg-[#1e3a8a] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">{busyId === r.id ? '...' : 'Gửi'}</button>
                  <button onClick={() => doBoQua(r.id)} disabled={!!busyId} className="rounded-md border border-slate-200 px-3 py-1 text-xs disabled:opacity-50">Bỏ qua</button>
                </div>
                {expanded === r.id && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                    {baiLoading === r.id ? <p className="text-xs text-slate-500">Đang tải...</p>
                      : (() => {
                        const b = baiCache[r.id];
                        if (!b) return <p className="text-xs text-slate-500">Không tải được</p>;
                        if (r.loai === 'ke_hoach') {
                          return <>
                            <p><span className="font-semibold">Mục tiêu:</span> {b.plan?.muc_tieu_tuan || '—'}</p>
                            <div className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white">
                              <table className="w-full text-xs">
                                <thead><tr className="bg-slate-100 text-left"><th className="px-2 py-1">#</th><th className="px-2 py-1">Công việc</th><th className="px-2 py-1">Đầu ra</th><th className="px-2 py-1">Ngày</th></tr></thead>
                                <tbody>{(b.items ?? []).map((it: any, i: number) => <tr key={i} className="border-t border-slate-100"><td className="px-2 py-1">{i+1}</td><td className="px-2 py-1">{it.cong_viec || '—'}</td><td className="px-2 py-1">{it.kq_can_dat || '—'}</td><td className="px-2 py-1">{it.ngay_list || '—'}</td></tr>)}</tbody>
                              </table>
                            </div>
                            {b.baoCao && <>
                              <p className="mt-3 font-semibold text-xs text-slate-600">Báo cáo cùng tuần:</p>
                              <p className="text-xs">Tự đánh giá: {(b.baoCao as any).tu_danh_gia ?? '—'} {(b.baoCao as any).ty_le_ht != null ? `(${(b.baoCao as any).ty_le_ht}%)` : ''}</p>
                              {(b.bcItems ?? []).length > 0 && <div className="mt-1 overflow-x-auto rounded border border-slate-200 bg-white"><table className="w-full text-xs"><thead><tr className="bg-slate-100 text-left"><th className="px-2 py-1">#</th><th className="px-2 py-1">Việc đã làm</th><th className="px-2 py-1">%HT</th></tr></thead><tbody>{(b.bcItems ?? []).map((it: any, i: number) => <tr key={i} className="border-t border-slate-100"><td className="px-2 py-1">{i+1}</td><td className="px-2 py-1">{it.viec_da_lam || '—'}</td><td className="px-2 py-1">{it.phan_tram != null ? `${it.phan_tram}%` : '—'}</td></tr>)}</tbody></table></div>}
                            </>}
                          </>;
                        } else if (r.loai === 'bao_cao') {
                          return <>
                            <p>Tự đánh giá: {b.report?.tu_danh_gia ?? '—'} {b.report?.ty_le_ht != null ? `(${b.report.ty_le_ht}%)` : ''}</p>
                            {b.report?.diem_noi_bat && <p>Nổi bật: {b.report.diem_noi_bat}</p>}{b.report?.kho_khan && <p>Khó khăn: {b.report.kho_khan}</p>}{b.report?.de_xuat && <p>Đề xuất: {b.report.de_xuat}</p>}
                            <div className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white">
                              <table className="w-full text-xs">
                                <thead><tr className="bg-slate-100 text-left"><th className="px-2 py-1">#</th><th className="px-2 py-1">Việc đã làm</th><th className="px-2 py-1">%HT</th><th className="px-2 py-1">Tự đánh giá</th><th className="px-2 py-1">Nguyên nhân</th></tr></thead>
                                <tbody>{(b.items ?? []).map((it: any, i: number) => <tr key={i} className="border-t border-slate-100"><td className="px-2 py-1">{i+1}</td><td className="px-2 py-1">{it.viec_da_lam || '—'}</td><td className="px-2 py-1">{it.phan_tram != null ? `${it.phan_tram}%` : '—'}</td><td className="px-2 py-1">{it.tu_danh_gia ?? '—'}</td><td className="px-2 py-1">{it.nguyen_nhan || '—'}</td></tr>)}</tbody>
                              </table>
                            </div>
                            {b.keHoach && <>
                              <p className="mt-3 font-semibold text-xs text-slate-600">Kế hoạch cùng tuần:</p>
                              <p className="text-xs">Mục tiêu: {(b.keHoach as any).muc_tieu_tuan || (b.keHoach as any).noi_dung || '—'}</p>
                              {(b.khItems ?? []).length > 0 && <div className="mt-1 overflow-x-auto rounded border border-slate-200 bg-white"><table className="w-full text-xs"><thead><tr className="bg-slate-100 text-left"><th className="px-2 py-1">#</th><th className="px-2 py-1">Công việc</th><th className="px-2 py-1">Đầu ra</th></tr></thead><tbody>{(b.khItems ?? []).map((it: any, i: number) => <tr key={i} className="border-t border-slate-100"><td className="px-2 py-1">{i+1}</td><td className="px-2 py-1">{it.cong_viec || '—'}</td><td className="px-2 py-1">{it.kq_can_dat || '—'}</td></tr>)}</tbody></table></div>}
                            </>}
                          </>;
                        } else if (r.loai === 'chien_dich') {
                          return <><p className="font-semibold">{b.campaign?.name ?? '—'}</p>{b.campaign?.objective && <p>Mục tiêu: {b.campaign.objective}</p>}{(b.updates ?? []).slice(0,5).map((u: any, i: number) => <p key={i} className="mt-1">• {String(u.content ?? '').slice(0,200)}</p>)}</>;
                        } else {
                          return <p>{b.news?.content ?? '—'}</p>;
                        }
                      })()}
                  </div>
                )}
                <textarea value={editing[r.id] ?? ''} onChange={(e) => setEditing((m) => ({ ...m, [r.id]: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Góp ý (sửa trước khi gửi nếu cần)..." />
                <div className="flex gap-2">
                  <button onClick={() => doGui(r.id)} disabled={!!busyId} className="rounded-md bg-[#1e3a8a] px-4 py-1 text-sm font-semibold text-white disabled:opacity-50">{busyId === r.id ? '...' : 'Gửi'}</button>
                  <button onClick={() => doBoQua(r.id)} disabled={!!busyId} className="rounded-md border border-slate-200 px-3 py-1 text-xs disabled:opacity-50">Bỏ qua</button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function Screen() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'chat' | 'ke_hoach' | 'bao_cao' | 'chien_dich' | 'tin_thi_truong'>('chat');
  if (!can('quan_ly_cai_dat')) {
    return <AppSidebar><main className="p-6 text-sm text-slate-600">Không có quyền xem (cần Quản lý cài đặt).</main></AppSidebar>;
  }
  return (
    <AppSidebar>
      <main className="flex h-[calc(100vh-0px)] flex-col px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-[#0f2a4a]">Cố vấn Giám đốc</h1>
          <span className="text-xs text-slate-500">Chỉ ông thấy — theo MỤC TIÊU + PHẠM VI + ĐẦU RA</span>
          <div className="ml-auto flex gap-1 rounded-full bg-slate-100 p-1">
            <button onClick={() => setTab('chat')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === 'chat' ? 'bg-[#0f2a4a] text-white shadow' : 'text-slate-600'}`}>Chat</button>
            <button onClick={() => setTab('ke_hoach')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === 'ke_hoach' ? 'bg-[#0f2a4a] text-white shadow' : 'text-slate-600'}`}>Kế hoạch</button>
            <button onClick={() => setTab('bao_cao')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === 'bao_cao' ? 'bg-[#0f2a4a] text-white shadow' : 'text-slate-600'}`}>Báo cáo</button>
            <button onClick={() => setTab('chien_dich')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === 'chien_dich' ? 'bg-[#0f2a4a] text-white shadow' : 'text-slate-600'}`}>Chiến dịch</button>
            <button onClick={() => setTab('tin_thi_truong')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === 'tin_thi_truong' ? 'bg-[#0f2a4a] text-white shadow' : 'text-slate-600'}`}>Tin TT</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'chat' ? <ChatPanel full />
            : tab === 'ke_hoach' ? <DanhGiaList loai="ke_hoach" />
            : tab === 'bao_cao' ? <DanhGiaList loai="bao_cao" />
            : tab === 'chien_dich' ? <DanhGiaList loai="chien_dich" />
            : <DanhGiaList loai="tin_thi_truong" />}
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
