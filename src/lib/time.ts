/** Chuẩn hóa hiển thị thời gian VN — mọi timestamptz từ DB là UTC, hiển thị Asia/Ho_Chi_Minh + AM/PM */

const VN_TZ = 'Asia/Ho_Chi_Minh';

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** 20/08/2026, 02:30:15 PM — dùng cho nhật ký (đầy đủ) */
export function fmtDateTimeVN(v: string | null | undefined): string {
  const d = toDate(v);
  if (!d) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  }).format(d);
}

/** 20/08/2026 02:30 PM — cho comment (gọn, không giây) */
export function fmtCommentTimeVN(v: string | null | undefined): string {
  const d = toDate(v);
  if (!d) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** 20/08/2026 — chỉ ngày */
export function fmtDateVN(v: string | null | undefined): string {
  const d = toDate(v);
  if (!d) return '';
  // date-only (YYYY-MM-DD) không có TZ, hiển thị nguyên
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    const [y, m, day] = v.trim().split('-');
    return `${day}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat('vi-VN', { timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
