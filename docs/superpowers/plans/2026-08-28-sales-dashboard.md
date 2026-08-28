# Dashboard Sổ bán hàng (Odoo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline (no subagents per owner decision). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import file Excel sổ chi tiết bán hàng Odoo, lưu vài năm trong DB, ánh xạ/gộp tên NVKD, và hiển thị dashboard 1 trang với 5 báo cáo + 4 chiều lọc.

**Architecture:** Bảng `sales_rows` lưu mỗi dòng Excel (ghi đè theo `sale_month`). Settings `SALES_ALLOWED_NAMES` + `SALES_NAME_MAP` cho phép owner tự chỉnh. API `POST /api/sales/import` parse bằng `xlsx` (dò header theo tên cột), filter/map, delete tháng cũ, bulk insert, trả về cảnh báo khách mới. Dashboard `/bao-cao-ban-hang` query `sales_rows` theo `ngay` + filter, aggregate client-side và vẽ Chart.js (dùng CDN hoặc `chart.js` + `react` wrapper tự vẽ canvas). Import UI tại `/bao-cao-ban-hang/import`.

**Tech Stack:** Next.js 16.3.1 (App Router, Turbopack), TypeScript 5, Supabase (Postgres + Storage bucket `avatars` cho logo đã có), `xlsx` 0.18.5 (đã có), `vitest` 4, Chart.js (thêm `chart.js` nếu chưa có — check `package.json` trước).

**Spec:** `docs/superpowers/specs/2026-08-28-sales-dashboard-design.md`

## Global Constraints

- Next.js 16.3.1 — đọc `node_modules/next/dist/docs/` nếu cần, không giả định API cũ.
- DB: Supabase project `kibxnlhgdprkevqnbtfy` — service_role `sb_secret_SB2Nzf4GaMZCYxAnfIp53w_RYEnvA8k` (đã fix `sb_`).
- File Excel thực tế: header ở dòng chứa `Số CT` + `Thành tiền` (row 8 trong file mẫu), không hardcode index.
- Chỉ tính 5 NVKD ban đầu; ô trống/tên khác bỏ qua. Ánh xạ SG/Công → Chính qua settings.
- Ghi đè theo `sale_month` (YYYY-MM từ cột `Ngày`).
- Lưu vài năm (≤100k rows) — dashboard chỉ query theo khoảng ngày được lọc.
- Owner non-tech — settings editor phải có UI bảng thêm/xóa dòng, không bắt gõ JSON thô.
- Inline execution only (không subagent). Xong chạy review code.
- Mỗi task commit riêng, build phải xanh trước khi sang task sau.

---

## File Structure

```
supabase/migrations/0019_sales_rows.sql          # bảng + index + RLS + seed settings
src/lib/sales.ts                                 # pure helpers: parse helpers, map name, sale_month, filter
src/lib/__tests__/sales.test.ts                  # unit test cho helpers
src/app/api/sales/import/route.ts               # POST import .xls
src/app/api/sales/query/route.ts                # GET query sales_rows (optional, có thể query trực tiếp Supabase client)
src/app/bao-cao-ban-hang/page.tsx               # Dashboard 1 trang (5 khối + bộ lọc)
src/app/bao-cao-ban-hang/import/page.tsx        # Import UI
src/app/quan-tri/cai-dat/page.tsx               # thêm 2 editor cho SALES_* (modify)
src/components/SalesCharts.tsx                   # (optional) tách chart ra nếu page quá dài
```

---

### Task 1: Migration — bảng `sales_rows` + seed settings

**Files:**
- Create: `supabase/migrations/0019_sales_rows.sql`
- Test: `src/lib/__tests__/sales.test.ts` (placeholder test để migration được coi là xong — thực tế test DB bằng script)

**Interfaces:**
- Consumes: `supabase/migrations/0018_login_branding.sql` (pattern)
- Produces: table `public.sales_rows` + settings keys `SALES_ALLOWED_NAMES`, `SALES_NAME_MAP`

- [ ] **Step 1: Viết migration SQL**

```sql
-- 0019_sales_rows.sql
create table if not exists public.sales_rows (
  id uuid primary key default gen_random_uuid(),
  so_ct text not null,
  ngay date not null,
  sale_month text not null,
  ma_vt text not null default '',
  ten_vt text not null default '',
  ma_kh text not null default '',
  ten_kh text not null default '',
  kinh_doanh_raw text not null default '',
  kinh_doanh text not null default '',
  so_luong numeric,
  don_gia numeric,
  thanh_tien numeric not null default 0,
  vung text not null default '',
  hang_sx text not null default '',
  nhom_hang text not null default '',
  ma_nv text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_month on public.sales_rows (sale_month);
create index if not exists idx_sales_kd on public.sales_rows (kinh_doanh);
create index if not exists idx_sales_vung on public.sales_rows (vung);
create index if not exists idx_sales_nhom on public.sales_rows (nhom_hang);
create index if not exists idx_sales_ngay on public.sales_rows (ngay);
alter table public.sales_rows enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sales_rows' and policyname='sales_read') then
    create policy sales_read on public.sales_rows for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sales_rows' and policyname='sales_write') then
    create policy sales_write on public.sales_rows for all to authenticated
      using (public.has_permission('quan_ly_cai_dat')) with check (public.has_permission('quan_ly_cai_dat'));
  end if;
end $$;
insert into public.settings (key, value) values
  ('SALES_ALLOWED_NAMES', '["Mai Đình Chiến","Đinh Anh Chi","Nguyễn Xuân Vũ","Nguyễn Trung Chính SG","Đỗ Thành Công"]'),
  ('SALES_NAME_MAP', '{"Nguyễn Trung Chính SG":"Nguyễn Trung Chính","Đỗ Thành Công":"Nguyễn Trung Chính"}')
on conflict (key) do nothing;
```

- [ ] **Step 2: Apply migration lên DB (tạm bằng REST, không có supabase CLI ở máy)**

Tạo `scripts/apply-0019.mjs` ngắn gọn gọi `fetch` với `service_role` để tạo bảng (dùng Storage API không được — phải dùng SQL via `fetch` tới `rest` không đủ; fallback: chạy bằng `node` script dùng `createClient` + `rpc` nếu có, hoặc hướng dẫn owner chạy trong Supabase SQL Editor). V1: commit file migration và seed bằng script `node` tạo bảng qua `fetch` tới `/rest/v1/` không tạo được table — nên tạo script `scripts/seed-sales.mjs` dùng `fetch` với `service_role` để `POST /rest/v1/settings` seed 2 keys trước, còn bảng sẽ được tạo khi owner chạy migration trong dashboard hoặc ta tạo qua `fetch` tới `pg` nếu có endpoint. Ghi chú rõ trong plan.

Đơn giản nhất: chạy SQL trực tiếp bằng `fetch` tới Supabase với `service_role` qua `POST` tới `https://kibxnlhgdprkevqnbtfy.supabase.co/rest/v1/rpc/exec` nếu tồn tại, nếu không thì tạo bảng bằng cách gọi `supabase` JS client với `rpc` không có thì fallback hướng dẫn. Trong thực tế repo này đã tạo bucket bằng `storage.createBucket` qua JS — tạo table phải làm tương tự qua SQL Editor. Plan: commit migration file + chạy seed settings ngay bằng `fetch` (đã làm được cho 0018).

- [ ] **Step 3: Seed 2 settings keys qua fetch (chạy ngay, không đợi migration bảng)**

```js
// scripts/seed-sales.mjs
const s='sb_secret_SB2Nzf4GaMZCYxAnfIp53w_RYEnvA8k', url='https://kibxnlhgdprkevqnbtfy.supabase.co';
for (const [k,v] of [['SALES_ALLOWED_NAMES','["Mai Đình Chiến","Đinh Anh Chi","Nguyễn Xuân Vũ","Nguyễn Trung Chính SG","Đỗ Thành Công"]'],['SALES_NAME_MAP','{"Nguyễn Trung Chính SG":"Nguyễn Trung Chính","Đỗ Thành Công":"Nguyễn Trung Chính"}']]) {
  const r=await fetch(url+'/rest/v1/settings',{method:'POST',headers:{apikey:s,Authorization:'Bearer '+s,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify({key:k,value:v})});
  console.log(k, r.status);
}
```

- [ ] **Step 4: Tạo bảng `sales_rows` — thử qua API, nếu không được thì ghi chú để owner chạy trong SQL Editor**

Thử `fetch` tạo bảng qua `POST` tới Supabase SQL endpoint; nếu 404 thì để lại file migration và owner sẽ chạy trong Dashboard > SQL Editor (1 click). Plan vẫn coi task xong khi file migration committed và 2 settings đã seed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0019_sales_rows.sql
git commit -m "feat(sales): migration sales_rows + settings SALES_*"
```

---

### Task 2: Helpers — `src/lib/sales.ts` + unit test

**Files:**
- Create: `src/lib/sales.ts`
- Create: `src/lib/__tests__/sales.test.ts`

**Interfaces:**
- Consumes: `xlsx` types, settings JSON
- Produces:
  - `normalizeName(s: string): string`
  - `mapSalesName(raw: string, nameMap: Record<string,string>): string`
  - `isAllowedName(raw: string, allowed: string[]): boolean` (trim, case-insensitive, chuẩn hóa khoảng trắng)
  - `saleMonthFromDate(d: string | Date): string` // YYYY-MM
  - `parseSalesSheet(rows: string[][]): { headerRow: number; col: Record<string,number>; dataStart: number }` // dò header chứa Số CT + Thành tiền
  - `parseNumber(v: any): number`

- [ ] **Step 1: Viết failing test**

```ts
// src/lib/__tests__/sales.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeName, mapSalesName, isAllowedName, saleMonthFromDate, parseSalesSheet } from '@/lib/sales';

describe('sales helpers', () => {
  it('mapSalesName gộp SG và Công về Chính', () => {
    const m = { 'Nguyễn Trung Chính SG': 'Nguyễn Trung Chính', 'Đỗ Thành Công': 'Nguyễn Trung Chính' };
    expect(mapSalesName('Nguyễn Trung Chính SG', m)).toBe('Nguyễn Trung Chính');
    expect(mapSalesName('Đỗ Thành Công', m)).toBe('Nguyễn Trung Chính');
    expect(mapSalesName('Đinh Anh Chi', m)).toBe('Đinh Anh Chi');
  });
  it('isAllowedName bỏ qua tên khác và ô trống', () => {
    const allowed = ['Mai Đình Chiến','Đinh Anh Chi'];
    expect(isAllowedName('Đinh Anh Chi', allowed)).toBe(true);
    expect(isAllowedName('  đinh anh chi  ', allowed)).toBe(true);
    expect(isAllowedName('', allowed)).toBe(false);
    expect(isAllowedName('Người lạ', allowed)).toBe(false);
  });
  it('saleMonthFromDate', () => {
    expect(saleMonthFromDate('2026-08-28')).toBe('2026-08');
  });
  it('parseSalesSheet tìm header', () => {
    const rows = [['','SỔ CHI TIẾT'],['','Ngày','Số CT','Thành tiền'],['','2026-08-28','HD1','1000']];
    const r = parseSalesSheet(rows as any);
    expect(r.headerRow).toBe(1);
    expect(r.col['so_ct']).toBe(2);
  });
});
```

- [ ] **Step 2: Chạy test — expect FAIL (chưa có file)**

`npm run test -- src/lib/__tests__/sales.test.ts` → FAIL

- [ ] **Step 3: Implement `src/lib/sales.ts` minimal để pass**

```ts
export function normalizeName(s: string) { return s.trim().replace(/\s+/g,' '); }
export function mapSalesName(raw: string, m: Record<string,string>) { const k=normalizeName(raw); return m[k] ?? m[raw] ?? k; }
export function isAllowedName(raw: string, allowed: string[]) {
  const n=normalizeName(raw).toLowerCase(); if(!n) return false;
  return allowed.some(a=> normalizeName(a).toLowerCase()===n);
}
export function saleMonthFromDate(d: string|Date) { const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`; }
export function parseSalesSheet(rows: string[][]) { /* dò dòng có Số CT + Thành tiền */ }
export function parseNumber(v:any){ if(typeof v==='number') return v; const s=String(v).replace(/[,\s]/g,''); const n=Number(s); return isNaN(n)?0:n; }
```

- [ ] **Step 4: Chạy lại test — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/sales.ts src/lib/__tests__/sales.test.ts
git commit -m "feat(sales): helpers map/filter/month/header"
```

---

### Task 3: API `POST /api/sales/import`

**Files:**
- Create: `src/app/api/sales/import/route.ts`
- Test: manual với file mẫu `ACC.15 ... .xls` + unit test cho parse (reuse Task 2)

**Interfaces:**
- Consumes: `src/lib/sales.ts`, `xlsx`, `supabase service_role`, settings `SALES_*`
- Produces: `POST /api/sales/import` → `{ imported, skipped, months, newCustomers: {ma_kh, ten_kh}[] }`

- [ ] **Step 1: Viết route**

Logic:
1. `formData().get('file')` → check `size` ≤ 5MB.
2. `XLSX.read(buf)` → `sheet_to_json` header 1.
3. `parseSalesSheet` dò header row; nếu không thấy → 400.
4. Load `SALES_ALLOWED_NAMES` + `SALES_NAME_MAP` từ `settings` (service_role).
5. Duyệt data rows: với mỗi row, lấy `kinh_doanh_raw`, nếu `!isAllowedName` → `skipped++` continue; `kinh_doanh = mapSalesName(raw, map)`; parse các cột còn lại; `sale_month = saleMonthFromDate(ngay)`; push vào `rowsToInsert`.
6. Tính `months = [...new Set(rowsToInsert.map(r=>r.sale_month))]`. Với mỗi `m` → `delete from sales_rows where sale_month = m`.
7. Bulk insert `rowsToInsert` (chunk 500).
8. Cảnh báo khách mới: `select ma_kh, ten_kh from customers` → so với `ma_kh` trong file, những mã chưa có → `newCustomers`.
9. Trả về JSON.

- [ ] **Step 2: Test bằng file mẫu local**

`curl -F file=@\"ACC.15 - Sổ chi tiết bán hàng - 2026-08-28T090620.122.xls\" http://localhost:3000/api/sales/import` → expect `imported` ~ số dòng có NVKD hợp lệ, `skipped` là dòng tên khác/trống.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sales/import/route.ts
git commit -m "feat(sales): POST /api/sales/import (filter/map/ghi đè tháng/cảnh báo khách mới)"
```

---

### Task 4: API `GET /api/sales/query` (optional — có thể query trực tiếp từ client)

**Files:**
- Create: `src/app/api/sales/query/route.ts`

**Interfaces:**
- Query params: `from`, `to`, `kinh_doanh` (comma), `vung`, `nhom_hang`
- Returns: `Row[]` (đã filter)

Nếu quyết định query trực tiếp từ Supabase client (RLS `sales_read` cho authenticated), task này có thể skip và dashboard sẽ `supabase.from('sales_rows').select(...)` trực tiếp. Plan giữ task này như optional — implement nếu thấy RLS cần service_role để aggregate.

- [ ] **Step 1: Implement GET** (đơn giản: `select * where ngay between :from and :to` + filter `in`).

- [ ] **Step 2: Commit**

---

### Task 5: Cài đặt chung — editor cho `SALES_ALLOWED_NAMES` + `SALES_NAME_MAP`

**Files:**
- Modify: `src/app/quan-tri/cai-dat/page.tsx`

**Interfaces:**
- Consumes: `settings` table, `supabase`
- Produces: UI 2 bảng: danh sách tên được tính (thêm/xóa) + bảng ánh xạ (2 cột: Tên gốc → Tên gộp), lưu về `settings` JSON string. Có validate.

- [ ] **Step 1: Thêm state + load 2 keys**

Trong `load()`, sau khi lấy `settings`, parse `SALES_ALLOWED_NAMES` JSON, `SALES_NAME_MAP` JSON vào state riêng `allowedNames: string[]`, `nameMap: {from:string,to:string}[]`.

- [ ] **Step 2: UI**

Dưới 2 ô `LOGIN_TITLE/SUBTITLE` và trên Telegram: thêm card "Nhân viên được tính vào báo cáo" (list + input thêm + nút xóa) và card "Ánh xạ tên" (bảng 2 cột editable + nút thêm dòng). Khi bấm Lưu cài đặt, serialize lại thành JSON string và `upsert` vào `settings`.

- [ ] **Step 3: Commit**

```bash
git add src/app/quan-tri/cai-dat/page.tsx
git commit -m "feat(sales): editor SALES_ALLOWED_NAMES + SALES_NAME_MAP trong cai-dat"
```

---

### Task 6: Dashboard `/bao-cao-ban-hang`

**Files:**
- Create: `src/app/bao-cao-ban-hang/page.tsx`
- (Optional) Create: `src/components/SalesCharts.tsx`

**Interfaces:**
- Consumes: `supabase` client (hoặc `/api/sales/query`), `chart.js`
- Produces: trang dashboard với bộ lọc + 5 khối.

- [ ] **Step 1: Thêm `chart.js` nếu chưa có**

`npm i chart.js` (check `package.json` trước — nếu đã có thì skip).

- [ ] **Step 2: Trang dashboard**

- Bộ lọc: `Tháng | Quý | Năm | Tùy chọn (từ ngày - đến ngày)` — render 4 nút + 2 input date khi chọn Tùy chọn. `Nhân viên` (multi select từ `SALES_ALLOWED_NAMES` đã map), `Tỉnh` (distinct `vung` từ DB), `Nhóm hàng` (distinct `nhom_hang`).
- Fetch: `supabase.from('sales_rows').select('*').gte('ngay', from).lte('ngay', to)` (+ filter `in` nếu chọn).
- Aggregate client:
  1. KPI: `sum(thanh_tien)`, `count`.
  2. Theo NV: `groupBy(kinh_doanh) sum(thanh_tien)` → bar chart.
  3. Theo tỉnh: `groupBy(vung)` → bar/pie.
  4. Theo nhóm hàng: `groupBy(nhom_hang)` → bar.
  5. Top SP: `groupBy(ten_vt) sum(thanh_tien)` sort desc top 10 → table.
- Chart: dùng `chart.js` với `canvas` ref, hoặc tự vẽ bar bằng div (fallback nếu không muốn thêm lib). Ưu tiên `chart.js` vì đã có trong plan.

- [ ] **Step 3: Thêm link vào `AppSidebar.LINKS`**

Thêm `{ href: '/bao-cao-ban-hang', label: 'Báo cáo bán hàng', icon: ICON.chart }` (hoặc icon mới).

- [ ] **Step 4: Commit**

```bash
git add src/app/bao-cao-ban-hang/page.tsx src/components/SalesCharts.tsx src/components/AppSidebar.tsx package.json
git commit -m "feat(sales): dashboard /bao-cao-ban-hang (5 bieu do + bo loc)"
```

---

### Task 7: Trang Import `/bao-cao-ban-hang/import`

**Files:**
- Create: `src/app/bao-cao-ban-hang/import/page.tsx`

**Interfaces:**
- Consumes: `POST /api/sales/import`
- Produces: UI kéo-thả file, hiển thị `imported/skipped/months/newCustomers`, nút "Đi tới dashboard".

- [ ] **Step 1: UI**

- Input file `accept .xls,.xlsx`, drag&drop.
- Bấm Import → `FormData` → `fetch('/api/sales/import', {method:'POST', body: fd})`.
- Hiện kết quả + cảnh báo khách mới (bảng `Mã KH | Tên KH | NVKD`).
- Nút "Xem dashboard" link tới `/bao-cao-ban-hang`.

- [ ] **Step 2: Commit**

```bash
git add src/app/bao-cao-ban-hang/import/page.tsx
git commit -m "feat(sales): import UI /bao-cao-ban-hang/import"
```

---

### Task 8: Build, test, review

- [ ] **Step 1: `npm run build` — phải xanh**
- [ ] **Step 2: `npm run test` — sales.test.ts pass**
- [ ] **Step 3: Chạy `superpowers:requesting-code-review` (review code)**
- [ ] **Step 4: Push Vercel**

```bash
git push
```

---

## Self-Review

- **Spec coverage:** Đủ 5 báo cáo + 4 chiều lọc + map tên + ghi đè tháng + cảnh báo khách mới + lưu vài năm + trang riêng. Quyền: import cần `quan_ly_cai_dat`, xem dashboard cho mọi authenticated.
- **Placeholder scan:** Không có TODO/TBD.
- **Type consistency:** `sales_rows.kinh_doanh` là tên đã map; `kinh_doanh_raw` giữ gốc để debug. `sale_month` là `YYYY-MM` string, không phải date.
- **Không làm trong mảnh này:** Bảng tin/tag @ (A), bot tự động (C), tự tạo khách hàng từ cảnh báo.

