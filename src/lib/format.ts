export function normText(s: unknown): string {
  let t = String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  t = t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  return t;
}

export function fmtPhone(s: unknown): string {
  const d = String(s ?? '').replace(/\D+/g, '');
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return String(s ?? '').trim();
}

export function fmtPhones(s: unknown): string {
  return String(s ?? '')
    .split(/[,;/]+/)
    .map(fmtPhone)
    .filter((p) => p !== '')
    .join(', ');
}
