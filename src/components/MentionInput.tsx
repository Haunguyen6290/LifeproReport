'use client';
import { useState, useRef, useEffect } from 'react';
import { GrowArea } from '@/components/GrowArea';

export function MentionInput({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string, mentions: string[]) => void; placeholder?: string; rows?: number;
}) {
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Load profiles for mention
  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase/client');
        const { data } = await supabase.from('profiles').select('id, full_name').eq('status', 'ACTIVE').order('full_name');
        setUsers((data ?? []) as any);
      } catch {}
    })();
  }, []);

  const candidates = (() => {
    if (!q) return [];
    const nq = q.toLowerCase().replace(/_/g, ' ');
    return users.filter((u) => u.full_name.toLowerCase().includes(nq)).slice(0, 8);
  })();

  function insertMention(user: { id: string; full_name: string }) {
    // Replace last @query with @FullName
    const lastAt = value.lastIndexOf('@');
    if (lastAt === -1) return;
    const next = value.slice(0, lastAt) + '@' + user.full_name + ' ' + value.slice(lastAt + 1 + q.length);
    const mentions = extractMentions(next, users);
    onChange(next, mentions);
    setShow(false); setQ('');
  }

  function extractMentions(text: string, all: typeof users): string[] {
    const ids: string[] = [];
    for (const u of all) if (text.includes('@' + u.full_name)) ids.push(u.id);
    return ids;
  }

  function onInput(v: string) {
    const lastAt = v.lastIndexOf('@');
    if (lastAt !== -1) {
      const after = v.slice(lastAt + 1);
      // If @ is followed by space or at end, show all? only if query without space length <20
      if (after.length <= 20 && !after.includes('\n')) {
        // Check if @ is at start or preceded by space
        if (lastAt === 0 || /\s/.test(v[lastAt - 1])) {
          setQ(after);
          setShow(true);
          setHi(0);
        } else { setShow(false); }
      } else setShow(false);
    } else setShow(false);
    const mentions = extractMentions(v, users);
    onChange(v, mentions);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!show || candidates.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, candidates.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); insertMention(candidates[hi]); }
    else if (e.key === 'Escape') setShow(false);
  }

  return (
    <div ref={ref} className="relative">
      <GrowArea value={value} onChange={(e) => onInput(e.target.value)} onKeyDown={onKey} placeholder={placeholder ?? 'Nhập @Tên để tag...'} rows={rows} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]" />
      {show && candidates.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {candidates.map((u, i) => (
            <li key={u.id} onMouseEnter={() => setHi(i)} onClick={() => insertMention(u)} className={`cursor-pointer px-3 py-1.5 text-sm ${i === hi ? 'bg-[#eff6ff] text-[#1e3a8a]' : ''}`}>@{u.full_name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
