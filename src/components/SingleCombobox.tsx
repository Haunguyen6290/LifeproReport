'use client';
import { useEffect, useRef, useState } from 'react';
import { filterOptions, type Opt } from '@/lib/combobox';

/**
 * Combobox chọn MỘT giá trị, kiểu "nhập rồi mới search":
 * - Bấm vào KHÔNG đổ cả danh sách ra (danh mục dài sẽ hoa mắt).
 * - Phải gõ chữ → mới hiện kết quả lọc → bấm/Enter để chọn.
 */
export function SingleCombobox({ options, value, onChange, placeholder, disabled, allowClear = true }: {
  options: Opt[]; value: string; onChange: (id: string) => void; placeholder?: string; disabled?: boolean; allowClear?: boolean;
}) {
  const selected = options.find((o) => o.id === value);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setQ(''); } }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Khi value đổi từ bên ngoài (hydrate), không cần làm gì vì hiển thị dựa vào `selected`.
  const filtered = filterOptions(options, q, []);
  const shown = filtered.slice(0, 50);
  const showList = open && !disabled && q.trim().length > 0;

  function pick(id: string) { onChange(id); setQ(''); setOpen(false); setHi(0); }
  function clear() { onChange(''); setQ(''); setOpen(false); }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (q.trim()) { setOpen(true); setHi((h) => Math.min(h + 1, shown.length - 1)); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { if (showList && shown[hi]) { e.preventDefault(); pick(shown[hi].id); } }
    else if (e.key === 'Escape') { setOpen(false); setQ(''); }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          role="combobox" aria-expanded={showList} aria-controls="scb-list" aria-autocomplete="list"
          value={showList ? q : (selected?.label ?? '')}
          disabled={disabled}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => { if (q.trim()) setOpen(true); }}
          onKeyDown={onKey}
          placeholder={placeholder ?? 'Nhập tên để tìm…'}
          className="w-full rounded-md border-[1.5px] border-[var(--color-muted)] bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-[var(--color-ring)]"
        />
        {allowClear && selected && !disabled && (
          <button type="button" onClick={clear} aria-label="Xóa lựa chọn" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--color-destructive)]">×</button>
        )}
      </div>
      {showList && (
        <ul id="scb-list" role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
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
