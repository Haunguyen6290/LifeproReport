import { normText } from './format';

export type CustomerFilters = { q: string; assignedTo: string; tierId: string; statusId: string };

type Filterable = { ma_kh: string; ten_kh: string; sdt: string; assigned_to: string; tier_id: string | null; status_id: string | null };

export function filterCustomers<T extends Filterable>(rows: T[], f: CustomerFilters): T[] {
  const q = normText(f.q);
  const qDigits = f.q.replace(/\D+/g, '');
  return rows.filter((r) => {
    if (q) {
      const hayText = `${normText(r.ma_kh)} ${normText(r.ten_kh)}`.includes(q);
      const hayPhone = qDigits.length >= 3 && r.sdt.replace(/\D+/g, '').includes(qDigits);
      if (!hayText && !hayPhone) return false;
    }
    if (f.assignedTo && r.assigned_to !== f.assignedTo) return false;
    if (f.tierId && r.tier_id !== f.tierId) return false;
    if (f.statusId && r.status_id !== f.statusId) return false;
    return true;
  });
}

export type SortKey = 'name' | 'tier' | 'assignee' | 'province';
export type SortDir = 'asc' | 'desc';
export type SortStack = { key: SortKey; dir: SortDir }[];

const TIER_ORDER: Record<string, number> = { 'A+': 0, A: 1, 'B+': 2, B: 3, C: 4, D: 5 };

export function sortCustomers<T extends { ten_kh: string; tier?: { code?: string } | null; assigned?: { full_name?: string } | null; tinh_thanh?: string | null; created_at?: string }>(
  rows: T[],
  stack: SortStack,
): T[] {
  if (stack.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const s of stack) {
      let d = 0;
      if (s.key === 'name') d = a.ten_kh.localeCompare(b.ten_kh, 'vi');
      else if (s.key === 'tier') d = (TIER_ORDER[a.tier?.code ?? ''] ?? 99) - (TIER_ORDER[b.tier?.code ?? ''] ?? 99);
      else if (s.key === 'assignee') d = (a.assigned?.full_name ?? '').localeCompare(b.assigned?.full_name ?? '', 'vi');
      else if (s.key === 'province') d = (a.tinh_thanh ?? '').localeCompare(b.tinh_thanh ?? '', 'vi');
      if (d !== 0) return s.dir === 'asc' ? d : -d;
    }
    return 0;
  });
}

export type IncomingRow = Record<string, string>;
export type ImportResult = {
  added: IncomingRow[];
  dupes: { MaKH: string; lyDo: string }[];
  errors: { MaKH: string; ten: string; lyDo: string }[];
  pending: { MaKH: string; ten: string; sdt: string; kinhDoanh: string; data: IncomingRow }[];
  warnings: string[];
};

export function applyImportRules(
  incoming: IncomingRow[],
  existingMa: ReadonlySet<string>,
  existingSdt: Readonly<Record<string, string>>,
  knownUsers: ReadonlySet<string>,
): ImportResult {
  const out: ImportResult = { added: [], dupes: [], errors: [], pending: [], warnings: [] };
  const sdtSeen: Record<string, string> = { ...existingSdt };
  let maSet = new Set(existingMa);
  for (const it of incoming) {
    const ma = String(it.MaKH || '').trim().toUpperCase().replace(/\s+/g, '_');
    const ten = String(it.TenKH || '').trim();
    const sdt = String(it.SDT || '').trim();
    if (!ma) { out.errors.push({ MaKH: '(thiếu mã)', ten, lyDo: 'Thiếu Mã khách hàng' }); continue; }
    if (!ten) { out.errors.push({ MaKH: ma, ten: '', lyDo: 'Thiếu Tên khách hàng' }); continue; }
    if (!sdt) { out.errors.push({ MaKH: ma, ten, lyDo: 'Thiếu Số điện thoại' }); continue; }
    if (maSet.has(ma)) { out.dupes.push({ MaKH: ma, lyDo: 'Trùng mã đã tồn tại — bỏ qua' }); continue; }
    const owner = String(it.KinhDoanh || '').trim().toLowerCase();
    if (!knownUsers.has(owner)) {
      out.pending.push({ MaKH: ma, ten, sdt, kinhDoanh: it.KinhDoanh || '(trống)', data: it });
      continue;
    }
    const nums = sdt.split(/[,;/]+/).map((x) => x.replace(/\D+/g, '')).filter(Boolean);
    for (const n of nums) {
      if (sdtSeen[n] && sdtSeen[n] !== ma) out.warnings.push(`⚠ ${ma} và ${sdtSeen[n]} trùng SĐT ${n}`);
      sdtSeen[n] = ma;
    }
    maSet = new Set(maSet).add(ma);
    out.added.push({ ...it, MaKH: ma, KinhDoanh: owner });
  }
  return out;
}
