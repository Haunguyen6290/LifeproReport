# Dashboard Sổ bán hàng (Odoo) — Design Spec

**Ngày:** 2026-08-28
**Mảnh:** B — Import Excel sổ chi tiết bán hàng Odoo → Dashboard trực quan
**Trạng thái:** Đã duyệt (owner duyệt 2026-08-28)

---

## 1) Mục tiêu

- Cho phép Admin import file Excel `.xls` xuất từ Odoo (mẫu `ACC.15 - Sổ chi tiết bán hàng ... .xls`), lưu vào DB để xem lại qua nhiều năm mà không nặng.
- Dashboard 1 trang riêng với 5 báo cáo, bộ lọc linh hoạt (tháng/quý/năm/tùy ngày, theo NVKD, tỉnh, nhóm hàng). Sau này thêm báo cáo chỉ việc thêm khối mới.
- Chỉ tính 5 NVKD ban đầu; tên khác và ô trống bỏ qua. Có ánh xạ tên (SG/Công → Chính) để gộp doanh số. Có cảnh báo khách mới chưa có trong hệ thống.

## 2) Đầu vào (file thực tế đã đọc)

- File: `ACC.15 - Sổ chi tiết bán hàng - YYYY-MM-DD...xls`, 1 sheet, 65 cột, ~20-50 dòng/tháng (thực tế vài nghìn dòng/năm).
- Header thật ở **dòng 9** (0-index row 8): `Ngày | Số CT | Mã VT | Tên VT | Mã KH | Tên KH | Kinh doanh QL | Diễn giải | TK Công nợ | Số lượng | Đơn giá | Thành tiền | Vùng | Hãng SX | TK Doanh thu | Nhóm hàng | Mã NV | ...`
- 8 dòng đầu là tiêu đề/filter in ra từ Odoo, bỏ qua khi parse — dò dòng chứa `Số CT` + `Thành tiền` làm header.
- Cột dùng:
  - `Ngày` (YYYY-MM-DD), `Số CT` (mã chứng từ — khóa chống trùng khi import gộp), `Mã VT`, `Tên VT`, `Mã KH`, `Tên KH`, `Kinh doanh QL`, `Số lượng`, `Đơn giá`, `Thành tiền`, `Vùng` (= tỉnh thành), `Hãng SX`, `Nhóm hàng`, `Mã NV`.

## 3) Quy tắc nghiệp vụ

- **Danh sách NVKD được tính:** lưu trong `settings` key `SALES_ALLOWED_NAMES` (JSON array string). Mặc định 5 tên: `["Mai Đình Chiến","Đinh Anh Chi","Nguyễn Xuân Vũ","Nguyễn Trung Chính SG","Đỗ Thành Công"]`. Chỉ dòng có `Kinh doanh QL` nằm trong danh sách này mới được tính; ô trống / tên khác → bỏ qua, không lưu.
- **Ánh xạ tên:** lưu `settings` key `SALES_NAME_MAP` (JSON object string), ví dụ `{"Nguyễn Trung Chính SG":"Nguyễn Trung Chính","Đỗ Thành Công":"Nguyễn Trung Chính"}`. Khi lưu và khi query dashboard đều áp qua map này để gộp. Owner tự sửa trong Cài đặt chung.
- **Ghi đè theo tháng:** Khi import file, suy ra `YYYY-MM` từ cột `Ngày` (lấy min/max ngày trong file; nếu file chứa nhiều tháng thì theo từng tháng). Trước khi insert, **xóa hết `sales_rows` cũ có `sale_month` thuộc các tháng trong file**, rồi insert mới. Cho phép xuất lại cùng tháng nhiều lần, lần cuối là chuẩn.
- **Cảnh báo khách mới:** Sau khi parse, với mỗi `Mã KH`/`Tên KH` trong file mà chưa có trong `customers` (so theo `ma_kh` hoặc `ten_kh` chuẩn hóa), liệt kê ra cho owner xem. Nút "Tạo khách nhanh" (optional v1: chỉ cảnh báo, chưa tự tạo để tránh rác).
- **Dữ liệu lưu vài năm:** Mỗi dòng Excel = 1 row trong `sales_rows`. Ước ~100k dòng/5 năm vẫn nhẹ. Dashboard chỉ query theo khoảng ngày được lọc nên luôn nhanh.

## 4) Kiến trúc & DB

### 4.1 Bảng mới `sales_rows`

```sql
create table public.sales_rows (
  id uuid primary key default gen_random_uuid(),
  so_ct text not null,
  ngay date not null,
  sale_month text not null, -- YYYY-MM, generated from ngay for fast delete/filter
  ma_vt text not null default '',
  ten_vt text not null default '',
  ma_kh text not null default '',
  ten_kh text not null default '',
  kinh_doanh_raw text not null default '', -- tên gốc trong file
  kinh_doanh text not null default '',     -- sau ánh xạ
  so_luong numeric,
  don_gia numeric,
  thanh_tien numeric not null default 0,
  vung text not null default '',
  hang_sx text not null default '',
  nhom_hang text not null default '',
  ma_nv text not null default '',
  created_at timestamptz not null default now()
);
create index idx_sales_month on public.sales_rows (sale_month);
create index idx_sales_kd on public.sales_rows (kinh_doanh);
create index idx_sales_vung on public.sales_rows (vung);
create index idx_sales_nhom on public.sales_rows (nhom_hang);
create index idx_sales_ngay on public.sales_rows (ngay);
```

- RLS: `select` cho `authenticated`, `insert/delete` chỉ `quan_ly_cai_dat` hoặc `quan_ly_nguoi_dung` (reuse permission hiện có). Hoặc `service_role` qua API route (an toàn hơn).

### 4.2 Settings keys mới

- `SALES_ALLOWED_NAMES` (JSON array), `SALES_NAME_MAP` (JSON object). Seed mặc định như trên.
- Migration `0019_sales_rows.sql` tạo bảng + seed settings.

### 4.3 Luồng import

1. Client (trang `/bao-cao-ban-hang/import` hoặc `/quan-tri/...` — chọn 1) cho kéo file `.xls/.xlsx`.
2. Gọi `POST /api/sales/import` (FormData file). Server:
   - Đọc bằng `xlsx`, dò header row chứa `Số CT` & `Thành tiền`.
   - Với mỗi dòng: chuẩn hóa, filter theo `SALES_ALLOWED_NAMES`, map tên qua `SALES_NAME_MAP`, parse số.
   - Tính các `sale_month` trong file → `delete from sales_rows where sale_month in (...)`.
   - Bulk insert rows mới.
   - So với `customers` để ra danh sách khách mới → trả về trong response.
3. Trả về `{ imported: N, skipped: M, months: [...], newCustomers: [...] }` để UI hiển thị.

### 4.4 Dashboard

- Route mới: `/bao-cao-ban-hang` (1 trang riêng).
- Bộ lọc trên cùng: `Tháng | Quý | Năm | Tùy chọn (từ ngày - đến ngày)` + `Nhân viên (multi)` + `Tỉnh (Vùng)` + `Nhóm hàng`.
- Query: `select ... from sales_rows where ngay between :from and :to and kinh_doanh in (...) and vung in (...) and nhom_hang in (...)`. Gom nhóm ở server hoặc client (dưới 10k rows/filter thì client OK; lớn hơn thì aggregate ở server).
- 5 khối (dùng Chart.js):
  1. KPI: Tổng Thành tiền + Tổng số dòng (đơn).
  2. Cột: Doanh số theo nhân viên (`kinh_doanh`).
  3. Cột/Tròn: Doanh số theo tỉnh (`vung`).
  4. Cột: Doanh số theo nhóm hàng (`nhom_hang`).
  5. Bảng Top sản phẩm bán chạy theo `ten_vt` (sum `thanh_tien` desc, top 10).

## 5) Quyền & an toàn

- Import + sửa ánh xạ: chỉ `quan_ly_cai_dat` (Admin).
- Xem dashboard: mọi `authenticated` (hoặc thu hẹp sau nếu owner yêu cầu).
- Upload qua API route dùng `service_role` nên không phụ thuộc RLS client; file giới hạn 5MB.

## 6) Quy trình làm (inline, không subagent)

1. Migration `0019_sales_rows.sql` + seed settings.
2. API `POST /api/sales/import` + `GET /api/sales/query` (hoặc query trực tiếp Supabase từ client với RLS).
3. Trang Cài đặt chung: thêm 2 editor cho `SALES_ALLOWED_NAMES` + `SALES_NAME_MAP` (dạng textarea JSON có validate + UI bảng thêm/xóa dòng cho non-tech).
4. Trang Dashboard `/bao-cao-ban-hang` + import UI.
5. Build check → review code → giao.

## 7) Rủi ro & lưu ý

- File Odoo có thể đổi thứ tự cột — dò header bằng tên cột, không dựa index cứng.
- Tên NVKD trong file có thể thừa/thiếu khoảng trắng, dấu — chuẩn hóa `trim` + so sánh không phân biệt hoa thường khi filter.
- Vài tháng đầu data ít, biểu đồ vẫn hiện "Chưa có dữ liệu" rõ ràng.

## 8) Không làm trong mảnh này

- Bảng tin + tag @ (mảnh A/A+), bot tự động (mảnh C) — làm sau.
- Tự tạo khách hàng từ cảnh báo (chỉ cảnh báo ở v1).

## 9) Tiêu chí xong

- Import file mẫu `ACC.15 ... .xls` thành công, data lưu DB, import lại cùng tháng ghi đè đúng.
- Đổi ánh xạ trong Cài đặt chung và thấy dashboard gộp đúng.
- Dashboard lọc theo tháng/quý/năm/tùy ngày + 3 chiều (NV, tỉnh, nhóm hàng) ra đúng 5 báo cáo.
- Build xanh, push Vercel OK.
