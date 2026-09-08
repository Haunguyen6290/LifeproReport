'use client';
import { useEffect, useState } from 'react';
import { use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { CommentList } from '@/components/CommentList';
import { GrowArea } from '@/components/GrowArea';
import { AttachmentInput } from '@/components/AttachmentInput';
import { fmtDateVN, fmtCommentTimeVN } from '@/lib/time';
import { categoryItems } from '@/lib/categories';

type Row = {
  id: string;
  user_id: string;
  ngay: string;
  product_group_id: string | null;
  nhom_van_de_id: string | null;
  so_luong: number | null;
  thuc_trang: string;
  de_xuat: string;
  trang_thai: string;
  y_kien_quan_ly: string;
  created_at: string;
  user?: { full_name?: string };
};

type Update = { id: string; content: string; created_at: string; reporter?: { full_name?: string } | null };

function StatusDot({ v }: { v: string }) {
  const cls = v === 'Đã xử lý' ? 'bg-emerald-500' : v === 'Đang giải quyết' ? 'bg-amber-500' : 'bg-red-500';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} title={v} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RequireAuth>
      <Screen params={params} />
    </RequireAuth>
  );
}

function Screen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { userId, can } = useAuth();
  const [row, setRow] = useState<Row | null>(null);
  const [spName, setSpName] = useState('');
  const [vdName, setVdName] = useState('');
  const [updates, setUpdates] = useState<Update[]>([]);
  const [newContent, setNewContent] = useState('');
  const [imgs, setImgs] = useState<{ storage_path: string; public_url: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: r } = await supabase
      .from('warehouse_reports')
      .select('id, user_id, ngay, product_group_id, nhom_van_de_id, so_luong, thuc_trang, de_xuat, trang_thai, y_kien_quan_ly, created_at, user:profiles!warehouse_reports_user_id_fkey(full_name)')
      .eq('id', id)
      .single();
    if (!r) return;
    const ro = r as any;
    setRow(ro);
    if (ro.product_group_id) {
      const { data: c } = await supabase.from('category_items').select('name').eq('id', ro.product_group_id).single();
      setSpName((c as any)?.name ?? '');
    } else setSpName('');
    if (ro.nhom_van_de_id) {
      const { data: c } = await supabase.from('category_items').select('name').eq('id', ro.nhom_van_de_id).single();
      setVdName((c as any)?.name ?? '');
    } else setVdName('');

    const { data: ups } = await supabase
      .from('warehouse_report_updates')
      .select('id, content, created_at, reporter:profiles!warehouse_report_updates_reporter_id_fkey(full_name)')
      .eq('report_id', id)
      .order('created_at', { ascending: false });
    // fallback gracefully if table not yet migrated
    if (ups) setUpdates(ups as any);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function postUpdate() {
    if (!newContent.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('warehouse_report_updates')
        .insert({ report_id: id, reporter_id: userId, content: newContent.trim() })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      for (const im of imgs) {
        await supabase.from('attachments').insert({ owner_type: 'warehouse_report', owner_id: data.id, storage_path: im.storage_path, public_url: im.public_url, uploader_id: userId });
      }
      try {
        const me2 = (await supabase.from('profiles').select('full_name').eq('id', userId).single()).data;
        await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Cập nhật báo cáo kho', entity_type: 'warehouse_report', entity_id: id, details: { update_id: data.id, full_name: (me2 as any)?.full_name ?? '' } });
      } catch {}
      try {
        const nm = (await supabase.from('profiles').select('full_name').eq('id', userId).single()).data?.full_name ?? '';
        await fetch('/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventKey: 'TB_BAO_CAO_KHO', text: `[Cập nhật kho] ${row?.ngay ?? ''} · ${vdName || '—'}\nNgười gửi: ${nm}\n${newContent.trim().slice(0, 300)}` }) });
      } catch {}
      setNewContent('');
      setImgs([]);
      await load();
    } catch (e: any) {
      alert(e?.message ?? 'Không gửi được cập nhật');
    } finally {
      setBusy(false);
    }
  }

  if (!row) return <AppSidebar><main className="w-full px-4 py-6 sm:px-6 text-slate-600">Đang tải…</main></AppSidebar>;

  const isAdmin = can('quan_ly_nguoi_dung');
  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5';

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <a href="/bao-cao-kho" className="mb-3 inline-block text-sm font-semibold text-[#1e3a8a] hover:underline">← Báo cáo kho</a>

        <div className={`${card} border-l-4 border-l-[#1e3a8a]`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-[#1e3a8a]">{fmtDateVN(row.ngay)} · {fmtCommentTimeVN(row.created_at).split(' ').pop() ?? ''}</p>
              <p className="mt-1 text-xs text-slate-600">Người tạo: <b className="text-slate-900">{(row as any).user?.full_name ?? ''}</b></p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <StatusDot v={row.trang_thai} />
              <span className="font-semibold text-slate-700">{row.trang_thai}</span>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-xs text-slate-500">Nhóm SP</span><p className="font-medium text-slate-900">{spName || '—'}</p></div>
            <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-xs text-slate-500">Nhóm vấn đề</span><p className="font-medium text-slate-900">{vdName || '—'}</p></div>
            <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-xs text-slate-500">Số lượng</span><p className="font-medium text-slate-900">{row.so_luong != null ? String(row.so_luong) : '—'}</p></div>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div><span className="text-xs font-semibold text-slate-700">Thực trạng</span><p className="whitespace-pre-wrap text-slate-900">{row.thuc_trang}</p></div>
            {row.de_xuat && <div><span className="text-xs font-semibold text-slate-700">Đề xuất</span><p className="whitespace-pre-wrap text-slate-700">{row.de_xuat}</p></div>}
            {row.y_kien_quan_ly && <div className="rounded-lg bg-amber-50 px-3 py-2"><span className="text-xs font-semibold text-amber-800">Ý kiến quản lý</span><p className="text-sm text-amber-900">{row.y_kien_quan_ly}</p></div>}
          </div>
        </div>

        <div className={`${card} mt-4`}>
          <h3 className="text-sm font-bold text-[#1e3a8a]">Cập nhật</h3>
          <GrowArea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Thêm cập nhật cho phiếu này…" rows={2} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]" />
          <div className="mt-2">
            <AttachmentInput value={imgs} onChange={setImgs} />
          </div>
          <div className="mt-2 flex justify-end">
            <button onClick={postUpdate} disabled={busy || !newContent.trim()} className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">
              {busy ? 'Đang gửi…' : 'Gửi cập nhật'}
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {updates.length === 0 ? <p className="text-sm text-slate-600">Chưa có cập nhật nào.</p> : updates.map((u) => (
              <div key={u.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">{u.reporter?.full_name ?? ''}</span>
                  <span>·</span>
                  <span>{fmtCommentTimeVN(u.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{u.content}</p>
              </div>
            ))}
          </div>
        </div>

        <CommentList targetType="warehouse_report" targetId={id} />
      </main>
    </AppSidebar>
  );
}
