'use client';
import { useCallback, useEffect, useState } from 'react';

export function ImageLightbox({ srcs, index, onClose }: { srcs: string[]; index: number; onClose: () => void }) {
  const [cur, setCur] = useState(index);

  const prev = useCallback(() => setCur((i) => (i - 1 + srcs.length) % srcs.length), [srcs.length]);
  const next = useCallback(() => setCur((i) => (i + 1) % srcs.length), [srcs.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, next, prev]);

  if (!srcs.length || cur < 0 || !srcs[cur]) return null;
  const showNav = srcs.length > 1;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <button onClick={onClose} aria-label="Đóng" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lg font-bold text-white hover:bg-white/25">✕</button>
      <img src={srcs[cur]} alt="Ảnh" onClick={(e) => e.stopPropagation()} className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl" />
      {showNav && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Ảnh trước" className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/25">‹</button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Ảnh sau" className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/25">›</button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">{cur + 1} / {srcs.length}</div>
        </>
      )}
    </div>
  );
}
