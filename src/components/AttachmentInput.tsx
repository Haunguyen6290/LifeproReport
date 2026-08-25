'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Uploaded = { storage_path: string; public_url: string };

export function AttachmentInput({ value, onChange }: { value: Uploaded[]; onChange: (v: Uploaded[]) => void }) {
  const [previews, setPreviews] = useState<{ url: string; busy: boolean }[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    setPreviews(value.map((a) => ({ url: a.public_url, busy: false })));
  }, [value]);

  async function compress(file: File): Promise<Blob> {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.8));
  }

  async function uploadFiles(files: FileList | File[]) {
    setErr('');
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const next = [...value];
    const newPreviews: { url: string; busy: boolean }[] = [];
    for (const f of arr) {
      const idx = next.length;
      newPreviews.push({ url: URL.createObjectURL(f), busy: true });
      next.push({ storage_path: '', public_url: '' });
      onChange([...next]);
      setPreviews([...previews, ...newPreviews]);
      try {
        const blob = await compress(f);
        const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from('attachments').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        const pub = supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl;
        next[idx] = { storage_path: path, public_url: pub };
        onChange([...next]);
      } catch (e: any) {
        setErr('Upload thất bại: ' + (e?.message ?? ''));
      }
    }
    setPreviews(next.map((a) => ({ url: a.public_url, busy: false })));
  }

  function remove(i: number) {
    const next = value.filter((_, idx) => idx !== i);
    onChange(next);
    setPreviews(next.map((a) => ({ url: a.public_url, busy: false })));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {previews.map((p, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-md border border-slate-200">
            <img src={p.url} alt={`ảnh ${i + 1}`} className="h-full w-full object-cover" />
            {p.busy && <div className="absolute inset-0 grid place-items-center bg-black/40 text-xs text-white">đang tải…</div>}
            <button type="button" onClick={() => remove(i)} aria-label="Xóa ảnh" className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white">×</button>
          </div>
        ))}
        <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-md border-2 border-dashed border-[var(--color-muted)] text-xs text-slate-600 hover:border-[var(--color-primary)] hover:text-[#1e3a8a]">
          + Ảnh
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
        </label>
      </div>
      {err && <p className="mt-1 text-xs text-[var(--color-destructive)]">{err}</p>}
      <input
        className="hidden"
        onPaste={(e) => {
          const items = e.clipboardData?.items ?? [];
          const files: File[] = [];
          for (let i = 0; i < items.length; i++) if (items[i].kind === 'file') { const f = items[i].getAsFile(); if (f) files.push(f); }
          if (files.length) uploadFiles(files);
        }}
      />
    </div>
  );
}
