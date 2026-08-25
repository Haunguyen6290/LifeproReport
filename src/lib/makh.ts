import { normText } from './format';

const STOP = new Set([
  'cong', 'ty', 'tnhh', 'cua', 'hang', 'gara', 'garage', 'oto', 'o', 'to',
  'noi', 'that', 'dai', 'ly', 'phan', 'phoi', 'guong', 'den', 'cham', 'soc',
  'rua', 'xe', 'phu', 'kien',
]);

export function buildMaKH(ten: string, tinh: string, existing: ReadonlySet<string> = new Set()): string {
  const prov = normText(tinh).split(' ').filter(Boolean).map((w) => w.charAt(0)).join('').toUpperCase();
  const words = normText(ten).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  const core = words.filter((w) => !STOP.has(w));
  const base0 = core.length ? core : words;
  let tail = base0.slice(-2);
  if (tail.join('').length < 6 && base0.length >= 3) tail = base0.slice(-3);
  const base = (prov ? prov + '_' : '') + tail.join('').toUpperCase();
  if (!base) return '';
  let code = base;
  let i = 2;
  while (existing.has(code)) code = base + i++;
  return code;
}
