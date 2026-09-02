/** Fallback khi DB chưa có danh mục tro_ly_phan_he (vd môi trường test hoặc trước migration 0036). */
export const CONTEXT_MAP: Record<string, string> = {
  '/okr': 'Trợ lý OKRs',
  '/bao-cao-tuan': 'Trợ lý Báo cáo tuần',
  '/bao-cao-kho': 'Trợ lý Kho',
  '/bao-cao-ban-hang': 'Trợ lý Kinh doanh',
  '/khach-hang': 'Trợ lý Khách hàng',
  '/thi-truong': 'Trợ lý Thị trường kinh doanh',
  '/chien-dich': 'Trợ lý Chiến dịch',
  '/tro-ly': 'Bộ não chung công ty',
  '/': 'Bộ não chung công ty',
};

/** Trả về phan_he khớp prefix dài nhất; '/' chỉ khớp exact '/'; không khớp → null.
 *  Giữ nguyên cho test/legacy. Luồng chính đã dùng `phanHeChoDuongDan` (load từ Danh mục). */
export function mapContextToPhanHe(pathname: string): string | null {
  if (pathname === '/') return CONTEXT_MAP['/'];
  for (const [prefix, phanHe] of Object.entries(CONTEXT_MAP)) {
    if (prefix === '/') continue;
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return phanHe;
  }
  return null;
}
