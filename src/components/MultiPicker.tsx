'use client';
import { useEffect, useRef, useState } from 'react';

// Chọn nhiều bằng checkbox (giống lọc Báo cáo bán hàng), kết quả hiển thị dạng chip (giống Combobox cũ)
export function MultiPicker({ options, value, onChange, placeholder, disabled }: {
  options: { id: string; label: string }[]; value: string[]; onChange: (ids: string[]) => void; placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = q.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 80)
    : options.slice(0, 80);
  const allChecked = options.length > 0 && value.length === options.length;

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }
  function remove(id: string) { onChange(value.filter((x) => x !== id)); }

  const chipClass = 'inline-flex items-center gap-1 rounded-full bg-[color:rgba(37,99,235,0.12)] px-2 py-0.5 text-xs font-semibold text-[#1e3a8a]';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-2 rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm text-left outline-none focus:border-[var(--color-ring)] disabled:opacity-60"
      >
        <span className="truncate text-slate-600">{value.length === 0 ? (placeholder ?? 'Chọn…') : `${value.length} mục đã chọn`}</span>
        <span className="shrink-0 text-[10px]">▼</span>
      </button>

      {value.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {value.map((id) => {
            const opt = options.find((o) => o.id === id);
            return (
              <span key={id} className={chipClass}>
                {opt?.label ?? id}
                {!disabled && <button type="button" onClick={() => remove(id)} aria-label={`Bỏ ${opt?.label ?? id}`} className="text-slate-600 hover:text-[var(--color-destructive)]">×</button>}
              </span>
            );
          })}
        </div>
      )}

      {open && !disabled && (
        <div className="absolute left-0 z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[#e2e8f0] bg-white p-2 shadow-lg">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm..."
            className="mb-2 w-full rounded border border-[#e2e8f0] px-2 py-1.5 text-xs outline-none focus:border-[#16A97B]"
          />
          <div className="mb-1 flex gap-1">
            <button
              type="button"
              onClick={() => onChange(allChecked ? [] : options.map((o) => o.id))}
              className="rounded bg-[#f1f5f9] px-2 py-1 text-[11px] font-semibold text-[#334155] hover:bg-[#e2e8f0]"
            >
              {allChecked ? 'Bỏ hết' : 'Chọn hết'}
            </button>
            <button type="button" onClick={() => { setQ(''); setOpen(false); }} className="ml-auto rounded bg-[#16A97B] px-2 py-1 text-[11px] font-semibold text-white">Xong</button>
          </div>
          {filtered.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[#f0f4f8]">
              <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} className="h-3.5 w-3.5 rounded border-slate-300" />
              <span className="min-w-0 flex-1 truncate" title={o.label}>{o.label}</span>
            </label>
          ))}
          {filtered.length === 0 && <p className="px-2 py-1 text-xs text-[#64748b]">Không tìm thấy</p>}
        </div>
      )}
    </div>
  );
}
