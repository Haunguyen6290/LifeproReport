'use client';
import { useCallback } from 'react';
import { uploadImage, imagesFromPaste } from '@/lib/upload-image';

type Uploaded = { storage_path: string; public_url: string };

/** Bắt Ctrl+V trên ô nhập, upload ảnh dán vào, gọi add(uploaded) cho mỗi ảnh. Trả về handler onPaste. */
export function usePasteUpload(add: (up: Uploaded) => void): (e: React.ClipboardEvent) => void {
  return useCallback(async (e: React.ClipboardEvent) => {
    const files = imagesFromPaste(e);
    if (files.length === 0) return;
    e.preventDefault();
    for (const f of files) {
      try { add(await uploadImage(f)); } catch { /* bỏ lỗi ảnh */ }
    }
  }, [add]);
}
