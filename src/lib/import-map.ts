import { fmtPhone, normText } from './format';

export const IMPORT_MAP: Record<string, string> = {
  'ma khach hang': 'MaKH', 'ma khach': 'MaKH', 'ma kh': 'MaKH', 'makh': 'MaKH',
  'ten khach hang': 'TenKH', 'ten khach': 'TenKH', 'ten kh': 'TenKH', 'tenkh': 'TenKH',
  'kinh doanh quan ly': 'KinhDoanh', 'kinhdoanh quan ly': 'KinhDoanh', 'kinh doanh': 'KinhDoanh', 'kinhdoanh': 'KinhDoanh', 'nguoi phu trach': 'KinhDoanh',
  'sdt': 'SDT', 'so dien thoai': 'SDT', 'dien thoai': 'SDT',
  'mo hinh kinh doanh': 'MoHinhKD', 'mo hinh kd': 'MoHinhKD', 'loai kh': 'MoHinhKD', 'loai khach hang': 'MoHinhKD',
  'phan hang kh': 'PhanHang', 'phan hang': 'PhanHang', 'phan hang khach hang': 'PhanHang',
  'dia chi': 'DiaChi',
  'quan/huyen': 'QuanHuyen', 'quan huyen': 'QuanHuyen',
  'tinh/tp': 'TinhTP', 'tinh tp': 'TinhTP', 'tinh': 'TinhTP',
  'nguoi quyet dinh': 'NguoiQuyetDinh',
  'chuc vu': 'ChucVu',
  'facebook': 'Facebook',
  'google maps': 'GoogleMaps', 'google maps link': 'GoogleMaps', 'maps': 'GoogleMaps',
  'trang thai': 'TrangThai',
  'ghi chu': 'GhiChu', 'ghi chu thong tin': 'GhiChu',
};

export function normalizeHeader(h: string): string {
  return normText(h).replace(/\s*\(.*?\)\s*/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

export function mapTable(table: unknown[][]): Record<string, string>[] {
  if (!table?.length) return [];
  const header = table[0].map((h) => normalizeHeader(String(h ?? '')));
  const fields = header.map((h) => IMPORT_MAP[h] ?? null);
  const out: Record<string, string>[] = [];
  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    const o: Record<string, string> = {};
    let empty = true;
    for (let j = 0; j < fields.length; j++) {
      const f = fields[j];
      if (!f) continue;
      let v = row[j];
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      const s = String(v ?? '').trim();
      if (s) empty = false;
      o[f] = f === 'SDT' ? fmtPhone(s) : s;
    }
    if (!empty) out.push(o);
  }
  return out;
}
