export function fmtDot(n: number | string | null | undefined): string {
  if (n == null || n === '') return '';
  const num = typeof n === 'string' ? Number(String(n).replace(/\./g, '').replace(/,/g, '')) : Number(n);
  if (isNaN(num)) return '';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
export function parseDot(s: string | number | null | undefined): number {
  if (s == null) return 0;
  const v = String(s).replace(/\./g, '').replace(/,/g, '').trim();
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
export function fmtVND(n: number): string {
  return Number(n || 0).toLocaleString('vi-VN');
}

/** Tinh so ton 4 cot tu 2 bang ton theo ngay (client fallback khi chua co RPC) */
export type TonRow = { cap1: string; cap2: string; ten: string; thue1: number; thuc1: number; thue2: number | string; thuc2: number | string; thua: number };

/** Goi y: chia SL de gan dich nhat (hill climb), chi dong chua chot */
export function tuneSL(
  need: number,
  inv: { sl: string; giaDa: string; lk: { sl: boolean } }[],
  idxs: number[],
): void {
  let guard = 40;
  let tong = inv.reduce((s, r) => s + (parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0), 0);
  while (guard-- > 0) {
    let bestIdx = -1;
    let bestDelta = 0;
    let bestAbs = Math.abs(tong - need);
    for (const i of idxs) {
      const giaDa = parseDot(inv[i].giaDa) || 1;
      const curSL = parseDot(inv[i].sl) || 1;
      const upTong = tong + giaDa;
      if (Math.abs(upTong - need) < bestAbs) { bestAbs = Math.abs(upTong - need); bestIdx = i; bestDelta = 1; }
      if (curSL > 1) {
        const downTong = tong - giaDa;
        if (Math.abs(downTong - need) < bestAbs) { bestAbs = Math.abs(downTong - need); bestIdx = i; bestDelta = -1; }
      }
    }
    if (bestIdx >= 0) {
      inv[bestIdx].sl = String(parseDot(inv[bestIdx].sl) + bestDelta);
      tong = inv.reduce((s, r) => s + (parseDot(r.sl) || 0) * (parseDot(r.giaDa) || 0), 0);
    } else break;
  }
}

export function calcGiaDa(giaChua: number, vat: number): number {
  return Math.round(giaChua * (1 + vat / 100));
}
export function calcGiaChua(giaDa: number, vat: number): number {
  return Math.round(giaDa / (1 + vat / 100));
}
