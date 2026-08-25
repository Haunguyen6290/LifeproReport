'use client';
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from './RequireAuth';
import { Dialog } from './Dialog';
import { Avatar } from './Avatar';

export function AvatarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId, fullName, avatarUrl, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Chỉ chọn file ảnh.'); return; }
    if (f.size > 4 * 1024 * 1024) { setErr('Ảnh tối đa 4MB.'); return; }
    setErr('');
    setPreview(URL.createObjectURL(f));
    // store file for upload
    (fileRef.current as any)._file = f;
  }

  async function doUpload() {
    const f: File | undefined = (fileRef.current as any)?._file;
    if (!f) { setErr('Chưa chọn ảnh.'); return; }
    setBusy(true); setErr('');
    try {
      // compress nhẹ
      const bmp = await createImageBitmap(f);
      const scale = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.85));
      const path = `${userId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const { error: updErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      if (updErr) {
        // fallback nếu cột chưa có
        if (String(updErr.message).includes('avatar_url')) throw new Error('DB chưa có cột avatar_url — chạy migration 0009 trước.');
        throw updErr;
      }
      await refresh();
      setPreview(null);
      if (fileRef.current) { fileRef.current.value = ''; (fileRef.current as any)._file = undefined; }
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Upload thất bại.');
    } finally { setBusy(false); }
  }

  async function removeAvatar() {
    setBusy(true); setErr('');
    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: '' }).eq('id', userId);
      if (error) throw error;
      await refresh();
      onClose();
    } catch (e: any) { setErr(e?.message ?? 'Xóa thất bại.'); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Đổi avatar">
      <div className="flex flex-col items-center gap-4">
        <Avatar name={fullName || '?'} src={preview ?? avatarUrl ?? null} size={96} />
        <div className="text-sm font-semibold">{fullName}</div>
        <label className="rounded-md border border-slate-200 px-4 py-2 text-sm hover:border-[#1e3a8a] cursor-pointer">
          Chọn ảnh
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </label>
        {preview && <p className="text-xs text-slate-600">Xem trước ảnh mới — bấm Lưu để cập nhật.</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex w-full justify-end gap-2">
          {avatarUrl ? <button onClick={removeAvatar} disabled={busy} className="rounded-md border border-slate-200 px-4 py-2 text-sm disabled:opacity-60">Xóa avatar</button> : null}
          <button onClick={onClose} disabled={busy} className="rounded-md border border-slate-200 px-4 py-2 text-sm">Hủy</button>
          <button onClick={doUpload} disabled={busy || !preview} className="rounded-md bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
      </div>
    </Dialog>
  );
}
