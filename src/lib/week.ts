/** Week helpers — T2 -> T7, deadline 17h30 VN, isLate theo created_at lần nộp đầu */

export const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;
export type Day = (typeof DAYS)[number];

/** 'T2,T4,T6' -> ['T2','T4','T6'] */
export function parseDays(s: string): Day[] {
  return (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x): x is Day => (DAYS as readonly string[]).includes(x));
}

export function joinDays(list: Day[]): string {
  return list.join(',');
}

export function weekBounds(d: Date): { tu: string; den: string } {
  const day = d.getUTCDay() || 7;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() - (day - 1));
  const sat = new Date(mon);
  sat.setUTCDate(mon.getUTCDate() + 5);
  return { tu: mon.toISOString().slice(0, 10), den: sat.toISOString().slice(0, 10) };
}

function toDateOnly(v: string | Date): Date {
  if (v instanceof Date) return new Date(v);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00Z');
  return new Date(s);
}

/** Deadline Kế hoạch: 17h30 VN Thứ 7 tuần trước tuanTu (T2) */
export function deadlineKH(tuanTu: string | Date): Date {
  const d = toDateOnly(tuanTu);
  const satBefore = new Date(d);
  satBefore.setUTCDate(d.getUTCDate() - 2);
  return new Date(
    Date.UTC(satBefore.getUTCFullYear(), satBefore.getUTCMonth(), satBefore.getUTCDate(), 10, 30, 0, 0),
  );
}

/** Alias for deadlineKH */
export const deadlinePlan = deadlineKH;

/** Deadline Báo cáo: 17h30 VN Thứ 2 tuần kế (tuanTu + 7 ngày) */
export function deadlineBC(tuanTu: string | Date): Date {
  const d = toDateOnly(tuanTu);
  const nextMon = new Date(d);
  nextMon.setUTCDate(d.getUTCDate() + 7);
  return new Date(
    Date.UTC(nextMon.getUTCFullYear(), nextMon.getUTCMonth(), nextMon.getUTCDate(), 10, 30, 0, 0),
  );
}

export const deadlineReport = deadlineBC;

/** Generic deadline helper */
export function deadline(tuanTu: string | Date, kind: 'plan' | 'report'): Date {
  return kind === 'plan' ? deadlineKH(tuanTu) : deadlineBC(tuanTu);
}

/** True if submitted after deadline (so sánh theo thời điểm nộp đầu created_at) */
export function isLate(created_at: string | Date, dl: string | Date | Date): boolean {
  const a = toDateOnly(created_at);
  const b = toDateOnly(dl as string | Date);
  return a.getTime() > b.getTime();
}
