/** Chuẩn hóa mã khách hàng — khớp fn_norm_ma trong DB (0033):
 *  bỏ mọi ký tự không phải chữ/số (giữ cả tiếng Việt có dấu), lowercase.
 *  Dùng ở Node fallback khi hàm SQL sales_report/sales_detail chưa có migration mới. */
export function normMa(t: unknown): string {
  return String(t ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
