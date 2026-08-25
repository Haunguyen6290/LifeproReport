'use client';
import { useEffect, useRef, useState } from 'react';
import { filterOptions, type Opt } from '@/lib/combobox';

export function Combobox({ options, value, onChange, placeholder, disabled }: {
  options: Opt[]; value: string[]; onChange: (ids: string[]) => void; placeholder?: string; disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = filterOptions(options, q, value);
  const shown = filtered.slice(0, 50);

  function pick(id: string) { onChange([...value, id]); setQ(''); setOpen(false); setHi(0); }
  function remove(id: string) { onChange(value.filter((v) => v !== id)); }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { if (open && shown[hi]) { e.preventDefault(); pick(shown[hi].id); } }
    else if (e.key === 'Escape') setOpen(false);
  }

  const selected = options.filter((o) => value.includes(o.id));

  return (
    <div ref={rootRef} className="relative">
      {selected.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {selected.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-[color:rgba(37,99,235,0.12)] px-2 py-0.5 text-xs font-semibold text-[#1e3a8a]">
              {s.label}
              {!disabled && <button type="button" onClick={() => remove(s.id)} aria-label={`Bỏ ${s.label}`} className="text-slate-600 hover:text-[var(--color-destructive)]">×</button>}
            </span>
          ))}
        </div>
      )}
      <input
        role="combobox" aria-expanded={open} aria-controls="cb-list" aria-autocomplete="list"
        value={q} disabled={disabled}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder ?? 'Nhập để tìm…'}
        className="w-full rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)]"
      />
      {open && !disabled && (
        <ul id="cb-list" role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-slate-600">Không có kết quả.</li>}
          {shown.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === hi}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(o.id)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === hi ? 'bg-[color:rgba(37,99,235,0.12)] text-[#1e3a8a]' : ''}`}>
              {o.label}{o.sub && <span className="ml-1 text-xs text-slate-600">{o.sub}</span>}
            </li>
          ))}
          {filtered.length > 50 && <li className="px-3 py-1 text-xs text-slate-600">… nhập thêm để lọc ({filtered.length} kết quả)</li>}
        </ul>
      )}
    </div>
  );
}
