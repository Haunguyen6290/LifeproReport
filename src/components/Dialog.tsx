'use client';
import { useEffect } from 'react';

export function Dialog({ open, onClose, title, size, quickClose, children }: { open: boolean; onClose: () => void; title: string; size?: 'default' | 'wide' | 'xwide'; quickClose?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    if (!open || !quickClose) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, quickClose, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {quickClose ? (
        <button aria-label="Đóng" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      )}
      <div role="dialog" aria-modal="true" aria-label={title} className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ${size === 'xwide' ? 'max-w-[1200px]' : size === 'wide' ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Đóng" className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
