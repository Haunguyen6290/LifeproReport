/** Chuẩn hoá query tiếng Việt: lowercase, bỏ dấu, bỏ ký tự đặc biệt, gom khoảng trắng. */
export function normalizeQuery(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
