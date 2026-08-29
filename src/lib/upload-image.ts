import { supabase } from '@/lib/supabase/client';

/** Nén + upload 1 ảnh lên bucket, trả về {storage_path, public_url}. Dùng chung cho chọn file lẫn dán (paste). */
export async function uploadImage(file: File, bucket = 'attachments'): Promise<{ storage_path: string; public_url: string }> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.82));
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const public_url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return { storage_path: path, public_url };
}

/** Lấy các file ảnh từ sự kiện paste (Ctrl+V). */
export function imagesFromPaste(e: React.ClipboardEvent): File[] {
  const items = e.clipboardData?.items ?? [];
  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) files.push(f);
    }
  }
  return files;
}
