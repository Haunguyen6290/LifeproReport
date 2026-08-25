/** OKR validators — chặn cứng 1-3 O / 2-5 KR, KR phải có số, O cảnh báo nếu có số */

export const hasNumber = (s: string): boolean =>
  /\d/.test(s) || s.includes('%') || /đ\b/i.test(s);

export function validateKRs(
  list: string[],
  oCount: number,
): { ok: boolean; msg: string } {
  if (oCount < 1 || oCount > 3)
    return { ok: false, msg: 'Mỗi người 1-3 mục tiêu' };
  if (list.length < 2 || list.length > 5)
    return { ok: false, msg: 'Mỗi O cần 2-5 KR' };
  for (const k of list)
    if (!hasNumber(k)) return { ok: false, msg: `KR "${k}" phải có số` };
  return { ok: true, msg: '' };
}

export const warnObjective = (o: string): string =>
  hasNumber(o) ? 'Số nên để ở KR' : '';

export function validateObjective(text: string): { ok: boolean; warn: string } {
  const t = (text ?? '').trim();
  if (!t) return { ok: false, warn: 'Objective không được trống' };
  return { ok: true, warn: warnObjective(t) };
}

// alias for backwards compat / alternative naming
export const hasNumberInObjective = hasNumber;
export const validateO = validateObjective;

export function periodLabel(tu: string, den: string): string {
  const fmt = (d: string): string => {
    if (!d) return '';
    const t = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const [y, m, day] = t.split('-');
      return `${day}/${m}/${y}`;
    }
    const dt = new Date(t);
    if (!isNaN(dt.getTime())) {
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const yy = dt.getUTCFullYear();
      return `${dd}/${mm}/${yy}`;
    }
    return t;
  };
  return `${fmt(tu)} - ${fmt(den)}`;
}
