'use client';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name: string) {
  const palette = [
    'bg-[#1e3a8a] text-white',
    'bg-[#0e7490] text-white',
    'bg-[#7c3aed] text-white',
    'bg-[#be123c] text-white',
    'bg-[#0f766e] text-white',
    'bg-[#a16207] text-white',
    'bg-[#1d4ed8] text-white',
    'bg-[#9333ea] text-white',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return <img src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold ${colorFor(name || '?')}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      title={name}
    >
      {initials(name || '?')}
    </span>
  );
}
