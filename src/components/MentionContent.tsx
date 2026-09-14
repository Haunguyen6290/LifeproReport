'use client';
import { useState } from 'react';
import { Dialog } from './Dialog';
import { Avatar } from './Avatar';

export type MentionProfile = { id: string; full_name: string; avatar_url?: string | null };

/** Tag @Tên — in đậm toàn bộ tên, bấm vào hiện dialog ảnh đại diện. */
export function MentionTag({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="font-semibold text-[#1e3a8a] hover:underline">@{name}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={name} quickClose>
        <div className="flex flex-col items-center gap-3">
          <Avatar name={name} src={avatarUrl ?? null} size={120} />
          <p className="text-sm font-semibold text-slate-900">{name}</p>
        </div>
      </Dialog>
    </>
  );
}

/**
 * Render nội dung có @mention. Khớp TOÀN BỘ tên (2/3/4 chữ) theo danh sách profiles
 * (khớp dài nhất trước). @ không khớp tên nào thì giữ nguyên dạng chữ thường.
 */
export function renderContent(content: string, profiles?: MentionProfile[]) {
  const byName = new Map<string, MentionProfile>();
  (profiles ?? []).forEach((p) => byName.set(p.full_name.trim().toLowerCase(), p));
  const names = [...byName.keys()].sort((a, b) => b.length - a.length); // dài nhất trước

  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < content.length) {
    if (content[i] === '@') {
      let matched: MentionProfile | undefined;
      let matchedText = '';
      for (const n of names) {
        const seg = content.slice(i + 1, i + 1 + n.length).toLowerCase();
        if (seg === n) { matched = byName.get(n); matchedText = content.slice(i + 1, i + 1 + n.length); break; }
      }
      if (matched) {
        out.push(<MentionTag key={key++} name={matchedText} avatarUrl={matched.avatar_url} />);
        i += 1 + matchedText.length;
        continue;
      }
    }
    let j = i;
    while (j < content.length && content[j] !== '@') j++;
    out.push(<span key={key++}>{content.slice(i, j)}</span>);
    i = j;
  }
  return out;
}
