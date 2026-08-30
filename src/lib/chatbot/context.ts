/** Map pathname hiện tại → phân hệ trợ lý để ưu tiên QA cùng phân hệ. */
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

/** Trả về phan_he khớp prefix dài nhất; '/' chỉ khớp exact '/'; không khớp → null. */
export function mapContextToPhanHe(pathname: string): string | null {
  if (pathname === '/') return CONTEXT_MAP['/'];
  for (const [prefix, phanHe] of Object.entries(CONTEXT_MAP)) {
    if (prefix === '/') continue;
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return phanHe;
  }
  return null;
}
