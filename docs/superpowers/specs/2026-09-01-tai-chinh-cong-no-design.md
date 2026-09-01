# Spec — Trang Tài chính: Bán hàng thu tiền + Cảnh báo công nợ quá hạn

Ngày: 2026-09-01 · Trạng thái: chờ ông chủ duyệt
Nguồn tham chiếu nghiệp vụ: `Bao_cao_cong_no_qua_han.xlsx` và `Bao_cao_banhang_thutien.xlsx` (đặt tại thư mục gốc repo, giữ lại làm mẫu đối chiếu).

## 1. Mục tiêu

Đưa 2 báo cáo kế toán đang làm tay bằng Excel vào phần mềm:

1. **Công nợ quá hạn** — hàng tuần/tháng (ngày 10/15/20/25/30) nạp sổ 131, hệ thống tự cảnh báo khách có công nợ phát sinh trước mốc (hạn cho phép) mà chưa thu xong, để giục kinh doanh thu tiền hoặc thu hàng — căn cứ trừ KPI.
2. **Bán hàng thu tiền** — bảng Kế hoạch / Thực hiện / % theo từng NVKD, gom miền Hà Nội / Sài Gòn / Tổng công ty, đúng mẫu sheet `Bao_Cao` của Excel.

**Bất biến cốt lõi:** dư nợ tại ngày D = Số dư gốc (tại "ngày làm gốc") + toàn bộ chứng từ TK131 từ sau ngày gốc đến hết D. Số dư gốc là sự kiện lịch sử, chỉ đổi khi người dùng chủ động "dồn mốc".

## 2. Phạm vi & không nằm trong phạm vi

**Phạm vi:** bảng dữ liệu + import + tính toán + 2 tab báo cáo + tham số trong Cài đặt + trang mới "Tài chính" trong nhóm Kinh doanh + dồn mốc số dư gốc.

**Không làm (YAGNI):**
- Chi tiết chứng từ từng khách khi bấm dòng (ông đã chốt: chỉ cần bảng tổng hợp như Excel)
- Tự động trừ KPI / bắn tin nhắc nợ định kỳ (giai đoạn 2 nếu ông yêu cầu)
- Nhập DataKH nhiều lần: chỉ dùng ở lần import đầu tiên để lấy số dư gốc 01/01/2026

## 3. Mô hình dữ liệu (migration 0030_tai_chinh.sql)

### 3.1 `receivable_rows` — chứng từ sổ chi tiết TK131
```
id uuid pk
ngay date not null                 -- ngày chứng từ (đã quy đổi dd/mm/yyyy → date)
so_ct text not null default ''     -- số hiệu chứng từ
ma_kh text not null default ''     -- mã đối tác (khớp customers.ma_kh)
ten_kh text not null default ''    -- tên đối tác nguyên văn từ sổ
dien_giai text not null default ''
tk_doi_ung text not null default ''-- TK đối ứng, vd 112101, 51111
so_no numeric not null default 0
so_co numeric not null default 0
du_dong numeric                    -- số dư dòng cuối sổ (bỏ trống được)
import_batch text                  -- mã lô import để debug
created_at
```
Index: `(ngay)`, `(ma_kh, ngay)`. RLS: select cho mọi authenticated (giống sales_rows); insert/update/delete chỉ `quan_ly_cai_dat`.

### 3.2 `customer_base_balance` — số dư gốc từng khách
```
ma_kh text pk
ten_kh text
du_no numeric not null default 0   -- nợ đầu kỳ (+) / có đầu kỳ (−)
ngay_moc date not null             -- ngày làm gốc, ban đầu 2026-01-01
updated_at
```
RLS giống receivable_rows. Đây là bảng duy nhất chứa "số dư đầu kỳ theo khách" — chính là cột F sheet DataKH lần nạp đầu.

### 3.3 Tham số trong bảng `settings` (khóa JSON, quản lý qua Cài đặt chung)
- `DEBT_GRACE_DAYS` — số, mặc định `90` (60/120 tùy chỉnh được)
- `DEBT_BASE_DATE` — ngày làm gốc, mặc định `2026-01-01` (chỉ đổi qua chức năng dồn mốc §7)
- `RECEIVABLE_TK_MAP` — mảng `{ "ma": "5111", "nhom": "Doanh thu" | "Trả lại" | "Thu tiền" }`, seed đúng bảng ThamSo của Excel:
  - 51111/5111 → Doanh thu; 521 → Trả lại; 111, 112, 131, 1368, 3361, 3413, 3414, 6426 → Thu tiền
- `FINANCE_PLAN` — mảng dòng khai báo kế hoạch, seed cấu trúc từ sheet Khai_Bao:
  `{ "thang": "2026-07", "ten": "Mai Đình Chiến", "mien": "Hà Nội", "kh_doanh_so": 650000000, "kh_thu_tien": 650000000 }`

### 3.4 Quyền
Permission mới `xem_tai_chinh` (thêm vào bảng roles như các permission hiện hữu, seed cho Admin + các vai trò quản lý). Import/đổi tham số đòi `quan_ly_cai_dat` như cũ.

## 4. Nhập dữ liệu — nút "Import sổ 131" trên trang Tài chính

Dialog import nhận file `.xlsx/.xls` do MISA xuất (hoặc sheet TK131 tách riêng):

1. **Chọn sheet**: tự tìm sheet có tiêu đề "TK" / "131" (vd `TK131`, `Tai_khoan_131`); ông chọn lại tay nếu tên lạ.
2. **Parse 6 cột** theo đúng layout sổ S38-DN (dòng tiêu đề kép ở dòng 10-11, dữ liệu từ dòng 14): Tài khoản (B) | Số CT (C) | Ngày (D, chuỗi dd/mm/yyyy hoặc date) | Mã đối tác (E) | Diễn giải (G) | TK đối ứng (H) | Nợ (I) | Có (J) | Số dư Nợ (K). Bỏ dòng "Số dư đầu kỳ / PS trong kỳ / chữ ký".
3. **Đọc metadata từ chính file**: tiêu đề "Từ ngày: X đến ngày: Y" (để xác định vùng) và giá trị "Số dư đầu kỳ" dòng K (đối chiếu toàn công ty).
4. **Nếu file kèm sheet DataKH** (lần import đầu): đọc cột "Nợ 01/01/2026" → ghi `customer_base_balance` ngay_moc = DEBT_BASE_DATE. File chỉ có TK131 → giữ nguyên số gốc đã lưu.

### Cổng kiểm tra trước khi lưu (fail = từ chối ghi, hiển thị lý do)
| # | Kiểm tra | Cách |
|---|---|---|
| 1 | Cân đối nội bộ vùng mới | ΣNợ − ΣCó + số dư đầu kỳ của file = số dư dòng cuối sổ của file |
| 2 | Liền mạch dòng thời gian | số dư đầu kỳ khai trong file = số hệ thống tự tính tại ngày bắt đầu vùng (gốc + Σ chứng từ cũ trước đó). Vùng import bắt đầu đúng sau ngày cuối đã có → không có gì để đối thì skip |
| 3 | Tổng đầu kỳ theo khách = tổng đầu kỳ toàn công ty | Σ customer_base_balance = metadata số dư gốc |
| Cảnh báo mềm (không chặn) | mã đối tác trong sổ chưa có trong customers; tên trùng nhiều mã (như sheet CanhBaoMaKH) | hiển thị danh sách để ông bổ sung khách |

### Chiến lược ghi theo vùng thời gian (không "đè sạch")
- Xóa toàn bộ `receivable_rows` có `ngay` trong [X, Y] của file, chèn lại đúng vùng đó.
- Vùng ngoài [X, Y] giữ nguyên → ông import ngắn (từ 01/09) hay dài (từ 01/01) đều đúng, chỉ cần file sau "phủ" tới ngày file trước đã chứa; kiểm tra #2 phát hiện nếu có khoảng hở.

## 5. Tab Công nợ quá hạn

Chọn kỳ báo cáo (mặc định tháng hiện tại). Mốc chốt kiểm tra:
```
D = ngày đầu tháng ( ngày_cuối_cùng_của_tháng_hiện_tại − DEBT_GRACE_DAYS ngày )
```
- Hạn 90, chạy T9 (cuối T9 = 30/09 → lùi 90 ngày = 02/07 → đầu tháng) → D = 01/07 ✓ đúng ví dụ của ông
- Hạn 60, chạy T9 → 30/09 − 60 = 01/08 → D = 01/08 ✓
- Chạy giữa tháng nào cũng chốt theo tháng đó → công thức ổn định, không phụ thuộc ngày chạy.
- Ngày lập báo cáo E = ngày cuối cùng có chứng từ trong DB (hoặc ngày ông chọn).

Bảng kết quả — liệt kê **toàn bộ khách** (mặc định giống Excel), 11 cột như `BaoCaoQuaHan`, tính theo từng mã KH:

| Cột | Công thức (nguồn) |
|---|---|
| STT | |
| Mã KH / Tên KH / NVKD / Tỉnh | customers + customer_base_balance (NVKD = kinh doanh quản lý trong hồ sơ khách) |
| Công nợ đầu kỳ | du_no(gốc) + Σ(Nợ−Có) chứng từ `gốc ≤ ngay < D` |
| Doanh số phát sinh trong kỳ | Σ(Nợ−Có) nhóm **Doanh thu**, `D ≤ ngay ≤ E` |
| Doanh số hàng trả lại | Σ(Có−Nợ) nhóm **Trả lại**, cùng khung |
| Doanh thu thu tiền | Σ(Có−Nợ) nhóm **Thu tiền**, cùng khung |
| Tổng giảm trừ | Trả lại + Thu tiền |
| Số còn thiếu | max(Công nợ đầu kỳ − Tổng giảm trừ, 0) |
| Cảnh báo | Tổng giảm trừ < Công nợ đầu kỳ → "QUÁ HẠN", ngược lại "Đạt yêu cầu" |

Ghi chú: khác Excel (đầu kỳ chốt tại S cố định), phần mềm coi "trong kỳ" = [D, E] với E là ngày lập ông chọn → chạy giữa tháng vẫn thấy số mới nhất. Phân loại theo `RECEIVABLE_TK_MAP`: khớp TK đối ứng theo **tiền tố dài nhất**.

**UI:** bảng rộng, cột tự co theo nội dung (`w-auto`, số format `1.234.567`, tabular-nums), tiền tệ right-align; dòng QUÁ HẠN nền đỏ nhạt; lọc: trạng thái / NVKD / vùng / tìm tên+mã; sắp xếp mặc định Số còn thiếu giảm dần; bấm cột để đổi sort; tổng dòng cuối; nút **Xuất Excel** (dùng xlsx có sẵn). Đối thử với file mẫu: ra đúng 8 khách QUÁ HAN.

## 6. Tab Bán hàng thu tiền

Chọn tháng (mặc định tháng trước — vì doanh số tháng hiện tại chưa đóng). Layout **đúng sheet Bao_Cao**:

```
Chỉ tiêu | HÀ NỘI: [từng NVKD... | Tổng HN] | SÀI GÒN: [... | Tổng SG] | Tổng Công ty
Kế hoạch / Thực hiện / % thực hiện   ← Doanh số bán hàng
Kế hoạch / Thực hiện / % thực hiện   ← Doanh thu thu tiền
```

- **Kế hoạch**: tra `FINANCE_PLAN[tháng][NVKD]`; thiếu → hiện "—".
- **Thực hiện Doanh số** = Σ `sales_rows.thanh_tien` trong tháng, quy NVKD theo **hồ sơ khách hàng** (`customers.assigned_to` — như ông yêu cầu "lấy danh sách khách làm data gốc"), fallback cột `kinh_doanh` của dòng bán hàng khi khách chưa có NVKD. Khách thuộc NVKD không có trong danh mục khai báo → gom vào cột "Khác" để không lọt số.
- **Thực hiện Thu tiền** = Σ(Có−Nợ) các chứng từ nhóm "Thu tiền" trong sổ 131 của tháng, nhóm theo khách → NVKD tương tự.
- % thực hiện = Thực hiện/Kế hoạch. Miền lấy từ `FINANCE_PLAN.mien` của NVKD.
- Kèm bảng phụ **chi tiết theo khách** (giống cột F/G sheet DataKH bản thu tiền): từng khách có doanh số bao nhiêu, thu được bao nhiêu, còn thiếu bao nhiêu — vẫn cùng layout bảng co cột.

## 7. Dồn mốc số dư gốc (chống phình dữ liệu 5–10 năm)

Trong Cài đặt chung → khối "Công nợ":
- Nút **"Dồn mốc mới"** → chọn ngày (vd 01/01/2031) → hệ thống tính `du_no = gốc + Σ(Nợ−Có) chứng từ ≤ ngày` cho từng khách, ghi đè `customer_base_balance` với `ngay_moc` mới; đối chiếu khớp Σ = dư hệ thống tại mốc cũ → hoàn tất. **Không tự xóa chứng từ cũ.**
- Nút riêng **"Xóa chứng từ trước mốc"** (chỉ hiện sau khi dồn, có confirm gõ tay): xóa receivable_rows `ngay < ngay_moc` → DB gọn về dữ liệu từ mốc hiện tại, mọi báo cáo từ đó chạy nhẹ như năm đầu.
- Báo cáo luôn tính theo công thức §5 với DEBT_BASE_DATE hiện hành — dồn mốc không đổi kết quả (kiểm tra bằng đối chiếu Σ trước/sau).

## 8. Trang & điều hướng

- Route `/tai-chinh`, component màn client dùng `AppSidebar`, nhóm menu **Kinh doanh**, nhãn "Tài chính", icon tiền, cần quyền `xem_tai_chinh`.
- Header trang: tên kỳ đang xem + nút **Import sổ 131** (chỉ hiện với `quan_ly_cai_dat`).
- Cài đặt chung thêm khối "Công nợ & Tài chính": hạn (ngày), bảng RECEIVABLE_TK_MAP (thêm/sửa/xóa dòng prefix→nhóm), danh mục NVKD + kế hoạch theo tháng (bảng editable), 2 nút dồn mốc/xóa chứng từ.

## 9. API

- `POST /api/finance/import-131` — multipart file; chạy parse + 3 kiểm tra + ghi theo vùng; trả `{ok, soDong, tuNgay, denNgay, canhBao[], ketQuaKiemTra[]}`.
- `GET /api/finance/debt? thang=2026-09` — chạy aggregate trên server (SQL), trả bảng 11 cột + D đã tính.
- `GET /api/finance/collections? thang=2026-07` — trả cấu trúc Bao_Cao (kế hoạch/thực hiện/% theo người, miền, tổng).
- `GET/PUT /api/finance/params` (settings trên) — `quan_ly_cai_dat`.
- `POST /api/finance/rebase` — dồn mốc; `POST /api/finance/purge` — xóa chứng từ cũ (confirm token).

Aggregate chạy bằng RPC PostgreSQL (như sales_report hiện tại) trên receivable_rows + customers: 5 năm ≈ 90–100k dòng, có index `(ma_kh, ngay)` → ms.

## 10. Kiểm thử

- **Unit** (vitest, file `tests/finance.*.test.ts`): quy đổi ngày dd/mm/yyyy + date Excel; phân loại TK theo tiền tố dài nhất; hàm tính D (90/60); đối chiếu vùng ghi đè; tính bảng nợ trên dữ liệu giả định.
- **Đối chuẩn Excel**: viết script tạm nạp `Bao_cao_cong_no_qua_han.xlsx` → chạy API debt với cùng tham số file (S = 31/05/2026, E = 30/07/2026, hạn 2 tháng) → so 857 dòng, yêu cầu khớp tuyệt đối (lệch 0đ, đúng 8 QUÁ HẠN). `Bao_cao_banhang_thutien.xlsx` → so bảng Bao_Cao tháng 7 (4 NVKD, 2 chỉ tiêu) khớp từng ô thực hiện. Script đối chiếu giữ trong `scripts/`, không vào luồng production.
- **Import thủ công trên dev**: file một lần (2 sheet), file chỉ TK131 (vùng chồng lấn → ghi đè đúng), file có khoảng hở ngày → chặn kèm thông báo lệch.
- **Phân quyền**: nhân viên không có `xem_tai_chinh` không thấy menu/trang/API trả 403.

## 11. Rủi ro đã biết

- Ngày trong sổ có thể là text "dd/mm/yyyy" lẫn date thật → parser phải xử cả hai (kiểm tra #1 chống lọt dòng sai ngày).
- 2 dòng chứng từ không có mã đối tác trong file mẫu → cho phép import, gắn nhãn "không rõ KH", chỉ xuất hiện ở cảnh báo mềm.
- `RECEIVABLE_TK_MAP` sai sẽ sai cả bảng nợ → mặc định seed đúng như Excel; UI Cài đặt có nút "Khôi phục mặc định".
