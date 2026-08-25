import { normText } from './format';

export type Opt = { id: string; label: string; sub?: string };

/** Lọc gợi ý theo token: mỗi token query phải là chuỗi con của 1 token trong tên/mã (không phân biệt dấu, bỏ qua gạch dưới). */
export function filterOptions(options: Opt[], q: string, exclude: string[]): Opt[] {
  const nq = normText(q).replace(/_/g, ' ');
  if (!nq.trim()) return options.filter((o) => !exclude.includes(o.id));
  const qTokens = nq.split(/\s+/).filter(Boolean);
  return options.filter((o) => {
    if (exclude.includes(o.id)) return false;
    const cand = normText((o.label + ' ' + (o.sub ?? '')).replace(/_/g, ' '));
    const candTokens = cand.split(/\s+/).filter(Boolean);
    return qTokens.every((qt) => candTokens.some((ct) => ct.includes(qt)));
  });
}
