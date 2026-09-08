'use client';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { mapTable } from '@/lib/import-map';
import { normText } from '@/lib/format';
import { applyImportRules, type ImportResult } from '@/lib/customers';
import { notifyTelegram } from '@/lib/notify';

type Preview = ImportResult & { total: number };

function Screen() {
  const { userId, username, can } = useAuth();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [users, setUsers] = useState<{ id: string; username: string; full_name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('id, username, full_name').eq('status', 'ACTIVE');
      setUsers((data ?? []) as { id: string; username: string; full_name: string }[]);
    })();
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setMsg(''); setPreview(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const table = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    const mapped = mapTable(table);
    const [{ data: existing }, { data: freshUsers }] = await Promise.all([
      supabase.from('customers').select('ma_kh, sdt'),
      supabase.from('profiles').select('username, full_name').eq('status', 'ACTIVE'),
    ]);
    const maSet = new Set(((existing ?? []) as { ma_kh: string }[]).map((x) => x.ma_kh));
    const sdtMap: Record<string, string> = {};
    for (const r of (existing ?? []) as { ma_kh: string; sdt: string }[]) {
      for (const n of String(r.sdt || '').split(/[,;/]+/)) { const d = n.replace(/\D+/g, ''); if (d) sdtMap[d] = r.ma_kh; }
    }
    const freshKnown = new Set([
      ...((freshUsers ?? []) as { username: string; full_name: string }[]).map((u) => u.username.toLowerCase()),
      ...((freshUsers ?? []) as { username: string; full_name: string }[]).map((u) => normText(u.full_name)),
    ]);
    // đồng bộ dropdown
    if (freshUsers) setUsers(freshUsers as any);
    const res = applyImportRules(mapped, maSet, sdtMap, freshKnown);
    setPreview({ ...res, total: mapped.length });
  }

  async function doImport() {
    if (!preview) return;
    setBusy(true); setMsg('');
    const [{ data: cat }, { data: freshUsersForImport }] = await Promise.all([
      supabase.from('categories').select('id, category_items(id,name)').eq('slug', 'trang_thai_kh').single(),
      supabase.from('profiles').select('id, username, full_name').eq('status', 'ACTIVE'),
    ]);
    const statusByName = new Map<string, string>(((cat as any)?.category_items ?? []).map((i: any) => [i.name, i.id]));
    const usersForMap = (freshUsersForImport ?? []) as { id: string; username: string; full_name: string }[];
    const userByName = new Map<string, string>([
      ...usersForMap.map((u) => [u.username.toLowerCase(), u.id] as const),
      ...usersForMap.map((u) => [normText(u.full_name), u.id] as const),
    ]);
    function findUserId(raw: string): string | null {
      const k = String(raw ?? '').trim();
      if (!k) return null;
      const a = userByName.get(k.toLowerCase()) ?? userByName.get(normText(k));
      if (a) return a;
      // Fallback: tên viết tắt trong Excel (vd "Trung Chinh" so với "Nguyễn Trung Chính")
      const nk = normText(k);
      for (const u of usersForMap) if (normText(u.full_name).includes(nk) || nk.includes(normText(u.full_name))) return u.id;
      return null;
    }
    let addedCount = 0;
    // 1) Nhóm khớp Kinh doanh
    for (const it of preview.added) {
      const statusId = statusByName.get(it.TrangThai) ?? statusByName.get('Đang theo dõi') ?? null;
      const assignedId = findUserId(it.KinhDoanh ?? '') ?? userId;
      const payload = {
        ma_kh: it.MaKH, ten_kh: it.TenKH, assigned_to: assignedId, sdt: it.SDT,
        facebook: it.Facebook ?? '', google_maps: it.GoogleMaps ?? '',
        dia_chi: it.DiaChi ?? '', quan_huyen: it.QuanHuyen ?? '', tinh_thanh: it.TinhTP ?? '',
        nguoi_quyet_dinh: it.NguoiQuyetDinh ?? '', chuc_vu: it.ChucVu ?? '',
        status_id: statusId, ghi_chu: it.GhiChu ?? '',
        created_by: userId, updated_by: userId,
      };
      const { error } = await supabase.from('customers').insert(payload);
      if (!error) addedCount++;
    }
    // 2) Nhóm chờ gán: vẫn cho lưu, cố gắng khớp tên (kể cả viết tắt) trước khi rơi về người import
    let pendingImported = 0;
    for (const p of preview.pending) {
      const it = p.data;
      const statusId = statusByName.get(it.TrangThai) ?? statusByName.get('Đang theo dõi') ?? null;
      const assignedId = findUserId(p.kinhDoanh ?? it.KinhDoanh ?? '') ?? userId;
      const payload = {
        ma_kh: p.MaKH, ten_kh: p.ten, assigned_to: assignedId, sdt: p.sdt,
        facebook: it.Facebook ?? '', google_maps: it.GoogleMaps ?? '',
        dia_chi: it.DiaChi ?? '', quan_huyen: it.QuanHuyen ?? '', tinh_thanh: it.TinhTP ?? '',
        nguoi_quyet_dinh: it.NguoiQuyetDinh ?? '', chuc_vu: it.ChucVu ?? '',
        status_id: statusId, ghi_chu: it.GhiChu ?? '',
        created_by: userId, updated_by: userId,
      };
      const { error } = await supabase.from('customers').insert(payload);
      if (!error) pendingImported++;
    }
    await supabase.from('import_batches').insert({
      file_name: 'upload', added: addedCount + pendingImported, dupes: preview.dupes.length,
      errors: preview.errors, pending: preview.pending.map((p) => ({ MaKH: p.MaKH, ten: p.ten, kinhDoanh: p.kinhDoanh })),
      warnings: preview.warnings, actor_id: userId,
    });
    let _nmI = '';
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); _nmI = (me2 as any)?.full_name ?? ''; await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Import Excel', entity_type: 'customer', entity_id: null, details: { added: addedCount, pending_imported: pendingImported, dupes: preview.dupes.length, errors: preview.errors.length, pending: 0, full_name: _nmI } }); } catch {}
    notifyTelegram('TB_IMPORT', `[Import] Thêm ${addedCount} khách, ${preview.dupes.length} trùng\nNgười import: ${_nmI}`);
    setBusy(false);
    setMsg(`Đã thêm ${addedCount + pendingImported} khách (${addedCount} khớp Kinh doanh, ${pendingImported} tạm gán về bạn — yêu cầu kinh doanh sửa phụ trách sau).`);
  }

  async function assignPending(p: { MaKH: string; ten: string; sdt: string; data: Record<string, string> }, toUser: string) {
    const it = p.data;
    const { data: cat2 } = await supabase.from('categories').select('id, category_items(id,name)').eq('slug', 'trang_thai_kh').single();
    const statusByName2 = new Map<string, string>(((cat2 as any)?.category_items ?? []).map((i: any) => [i.name, i.id]));
    const statusId2 = statusByName2.get(it.TrangThai) ?? statusByName2.get('Đang theo dõi') ?? null;
    const userByName2 = new Map<string, string>([
      ...users.map((u) => [u.username.toLowerCase(), u.id] as const),
      ...users.map((u) => [normText(u.full_name), u.id] as const),
    ]);
    const assignedId2 = userByName2.get(String(toUser).toLowerCase()) ?? userId;
    const payload = {
      ma_kh: p.MaKH, ten_kh: p.ten, assigned_to: assignedId2, sdt: p.sdt,
      facebook: it.Facebook ?? '', google_maps: it.GoogleMaps ?? '',
      dia_chi: it.DiaChi ?? '', quan_huyen: it.QuanHuyen ?? '', tinh_thanh: it.TinhTP ?? '',
      nguoi_quyet_dinh: it.NguoiQuyetDinh ?? '', chuc_vu: it.ChucVu ?? '',
      status_id: statusId2, ghi_chu: it.GhiChu ?? '',
      created_by: userId, updated_by: userId,
    };
    const { error } = await supabase.from('customers').insert(payload);
    if (error) { alert(error.message); return; }
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Import — gán người phụ trách', entity_type: 'customer', entity_id: null, details: { ma_kh: p.MaKH, to: toUser, full_name: me2?.full_name ?? '' } }); } catch {}
    setPreview((prev) => prev ? { ...prev, pending: prev.pending.filter((x) => x.MaKH !== p.MaKH) } : prev);
  }

  if (!can('import_khach')) return <AppSidebar><main className="w-full px-6 py-10 text-slate-600">Bạn không có quyền import.</main></AppSidebar>;

  const card = 'rounded-xl border border-slate-200 bg-white p-4 backdrop-blur';
  const selCls = 'rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-ring)]';

  return (
    <AppSidebar>

      <main className="w-full px-4 py-6 sm:px-6">
        <h1 className="mb-5 text-2xl font-bold tracking-tight">Import khách hàng từ Excel</h1>
        <div className={`${card} mb-4`}>
          <p className="mb-3 text-sm text-slate-600">Chọn file .xlsx/.csv. Dòng đầu phải là tên cột. Trùng mã sẽ bỏ qua, thiếu SĐT báo lỗi, không khớp người phụ trách đưa vào hàng chờ.</p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="text-sm" />
        </div>

        {preview && (
          <>
            <div className={`${card} mb-4`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  Tổng <b>{preview.total}</b> dòng ·
                  <span className="ml-2 text-green-700">thêm {preview.added.length}</span> ·
                  <span className="ml-2 text-slate-600">trùng {preview.dupes.length}</span> ·
                  <span className="ml-2 text-[var(--color-destructive)]">lỗi {preview.errors.length}</span> ·
                  <span className="ml-2 text-amber-700">chờ gán {preview.pending.length}</span>
                </div>
                <button onClick={doImport} disabled={busy || (preview.added.length + preview.pending.length === 0)} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">{busy ? 'Đang import…' : 'Thực hiện import'}</button>
              </div>
              {msg && <p className="text-sm font-medium text-[#1e3a8a]">{msg}</p>}
              {preview.warnings.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-amber-700">{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              {preview.errors.length > 0 && (
                <div className="mt-3"><div className="mb-1 text-xs font-semibold text-[var(--color-destructive)]">Dòng lỗi:</div>
                  <ul className="space-y-0.5 text-xs text-slate-600">{preview.errors.map((er, i) => <li key={i}><span className="font-mono">{er.MaKH}</span> {er.ten} — {er.lyDo}</li>)}</ul></div>
              )}
            </div>

            {preview.pending.length > 0 && (
              <div className={card}>
                <div className="mb-2 text-sm font-semibold">Chờ gán người phụ trách ({preview.pending.length})</div>
                <ul className="divide-y divide-[var(--color-border)] text-sm">
                  {preview.pending.map((p) => (
                    <li key={p.MaKH} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="font-medium">{p.ten}</span><span className="text-slate-600">{p.sdt}</span>
                      <span className="ml-auto flex items-center gap-2">
                        <select defaultValue="" className={selCls} onChange={(e) => { if (e.target.value) assignPending(p, e.target.value); }}><option value="" disabled>Gán cho…</option>{users.map((u) => <option key={u.username} value={u.username}>{u.full_name}</option>)}</select>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
