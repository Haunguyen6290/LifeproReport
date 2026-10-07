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

function DanhGiaList({ loai }: { loai: 'ke_hoach' | 'bao_cao' }) {
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
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [filter, tuanTu, loai]);

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
          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badge(r.ket_qua)}`}>{r.ket_qua}</span>
                  <span className="text-sm font-semibold">{r.ten_nhan_vien}</span>
                  <span className="text-xs text-slate-500">{r.loai === 'ke_hoach' ? 'Kế hoạch' : 'Báo cáo'} · tuần {r.tuan_tu}→{r.tuan_den}</span>
                  <span className="ml-auto text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
                {r.ly_do && <p className="text-sm text-slate-700"><span className="font-semibold">Lý do:</span> {r.ly_do}</p>}
                {r.dau_hieu_doi_pho && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Dấu hiệu đối phó: {r.dau_hieu_doi_pho}</p>}
                <textarea value={editing[r.id] ?? ''} onChange={(e) => setEditing((m) => ({ ...m, [r.id]: e.target.value }))} rows={4} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Góp ý soạn sẵn..." />
                <div className="flex gap-2">
                  <button onClick={() => doGui(r.id)} disabled={!!busyId} className="rounded-md bg-[#1e3a8a] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{busyId === r.id ? '...' : 'Gửi cho nhân viên'}</button>
                  <button onClick={() => doBoQua(r.id)} disabled={!!busyId} className="rounded-md border border-slate-200 px-4 py-1.5 text-sm disabled:opacity-50">Bỏ qua</button>
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
  const [tab, setTab] = useState<'chat' | 'ke_hoach' | 'bao_cao'>('chat');
  if (!can('quan_ly_cai_dat')) {
    return <AppSidebar><main className="p-6 text-sm text-slate-600">Không có quyền xem (cần Quản lý cài đặt).</main></AppSidebar>;
  }
  return (
    <AppSidebar>
      <main className="flex h-[calc(100vh-0px)] flex-col px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-[#0f2a4a]">Cố vấn Giám đốc</h1>
          <span className="text-xs text-slate-500">Chỉ ông thấy — AI chấm Kế hoạch/Báo cáo theo chuẩn SMART, ông bấm Gửi/Bỏ qua</span>
          <div className="ml-auto flex gap-1 rounded-full bg-slate-100 p-1">
            <button onClick={() => setTab('chat')} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === 'chat' ? 'bg-[#0f2a4a] text-white shadow' : 'text-slate-600'}`}>Chat</button>
            <button onClick={() => setTab('ke_hoach')} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === 'ke_hoach' ? 'bg-[#0f2a4a] text-white shadow' : 'text-slate-600'}`}>Kế hoạch</button>
            <button onClick={() => setTab('bao_cao')} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === 'bao_cao' ? 'bg-[#0f2a4a] text-white shadow' : 'text-slate-600'}`}>Báo cáo</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'chat' ? <ChatPanel full /> : tab === 'ke_hoach' ? <DanhGiaList loai="ke_hoach" /> : <DanhGiaList loai="bao_cao" />}
        </div>
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
