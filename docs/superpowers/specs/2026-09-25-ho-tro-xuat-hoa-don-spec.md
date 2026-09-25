# Hỗ trợ xuất hóa đơn — Spec chốt (demo đã duyệt)

Ngày chốt: 2026-09-25 — Nhóm Kế toán, chỉ Admin thấy mặc định, sau share cho kế toán.

> File này tổng hợp toàn bộ trao đổi ông–tôi để khi làm thật không bị lệch. Chưa làm code cho đến khi ông chốt “làm đi”.

## 1. Bối cảnh nghiệp vụ
- Nhập xuất thực làm chuẩn chỉ, nhưng khách đa số không lấy hóa đơn; khách chuyển khoản theo công nợ thực.
- Phải tự xuất hóa đơn để cân kho thực vs kho thuế.
- Hàng hóa: mã thực và mã thuế có mã chung / mã riêng / mã lệch nhưng quy đổi qua 2 cột mã tham chiếu.
- Demo dùng 2 file ở `Tailieu_Lifepro/`: `TK 23.9.xlsx` (tồn thuế, 233 dòng) và `Tổng hợp nhật xuất tồn (42).xlsx` (tồn thực, ~1.028 dòng).

## 2. Danh mục nền (DM) — 2 bảng
- **DM_Thue**: Mã thuế, Tên thuế, Ma_ThamChieu (Cap1), Ma_ThamChieu_Cap2 (Cap2), Giá chưa VAT, VAT%, Tồn thuế (đọc từ file tồn). Mỗi mã thuế có VAT% riêng (8%/10%) — cột VAT import từ file danh mục và lưu trong DM.
- **DM_Thuc**: Mã thực, Tên thực, Ma_ThamChieu, Cap2.
- **Quản lý tham chiếu**: Tab con riêng sửa Cap1/Cap2 (ví dụ bóng/bi gầm gom chung Cap2 = AZ100LASER, F9BLACKHAWK — nhiều mã bóng khác chân/màu gom về 1 mã cha).
- **Import DM**: “Có rồi bỏ qua, chưa có thêm mới”. Có sản phẩm mới thì thêm dòng.
- **Thêm mới nhập tay**: Nút “+ Thêm mã thuế / + Thêm mã thực” ngay trên Tab 1 — form nhập Mã, Tên, Cap1, Cap2, Giá chưa VAT, VAT%; mã đã có báo trùng.
- **Hiển thị**: Bảng DM Thuế hiện luôn 2 cột Giá chưa VAT & VAT% (nền vàng) để dễ kiểm — đã chốt “không cần ẩn”, cứ để hiện.

## 3. Import tồn hàng ngày (định dạng cố định từ PM)
- **Tồn thuế**: đọc cột `Tồn thuế` + `SL_ThamChieu`; file có thêm 2 cột Giá chưa VAT & VAT do kế toán thêm — dùng làm giá mặc định, nhưng thuế suất lấy từ DM.
- **Tồn thực**: đọc cột `Khả dụng` (và các cột số cuối tương ứng).
- Lưu theo ngày; hôm sau import file mới ghi đè.
- **Thiếu Cap**: sau import, nếu có dòng tồn nào **chưa có Cap1/Cap2** (mã mới chưa gán tham chiếu), hiện bảng **“⚠ mã chưa có mã tham chiếu”** ngay dưới 2 nút Import ở Tab 2 (So tồn): mỗi dòng có Mã, Tên, ô chọn **Cap có sẵn (dropdown từ DM)** hoặc **“+ Gõ Cap mới…”** (hiện ô nhập Cap mới), Cap1 bắt buộc, Cap2 tùy chọn; bấm **Lưu gán Cap** mới cho so tồn chính xác. Cho phép **Để sau** nếu chưa gán ngay.

## 4. So tồn (lõi) — 4 cột như bảng bán hàng
- Gom theo `Ma_ThamChieu` → **Tồn thuế 1 / Tồn thực 1**; nếu có Cap2 thì gom tiếp → **Tồn thuế 2 / Tồn thực 2**. Thừa = Thuế − Thực.
- Hiển thị 4 cột tồn trong bảng So tồn và cả trong bảng nhập liệu hóa đơn để soi. Thừa nhiều tô đỏ để ưu tiên xuất.
- Gợi ý luôn dùng **mã + tên thuế** (hóa đơn thuế phải ghi mã thuế).

## 5. Gợi ý hóa đơn — theo tổng tiền đã VAT ông nhập
- **Đích**: tổng tiền đã VAT ông nhập (ví dụ 100.000.000). Mỗi dòng: `thành tiền đã VAT = SL × Giá đã VAT`; `Giá đã VAT = Giá chưa VAT × (1+VAT%)`, ngược lại `Giá chưa VAT = Giá đã VAT ÷ (1+VAT%)`.
- **Lệch**: gợi ý lệch tối đa **10.000đ**; có nút **“Sửa giá dòng cuối cho khớp 100%”** — chỉ chỉnh dòng cuối, khớp khít.
- **Mặc định giá**: lấy **giá khai trong DM Thuế** khi gợi ý.
- **Cơ chế “đã chốt”**: mỗi ô có trạng thái — Trống / Máy gợi ý (chấm cam) / Ông đã chốt (viền đậm + chấm xanh). Cứ khi ông gõ tay vào ô (đổi mã, SL 5→3, giá 1.350k→1.200k dù là giá chưa VAT hay đã VAT) thì ô đó thành “đã chốt” — bấm Gợi ý lần sau máy chỉ lấp ô chưa chốt, giữ nguyên ô đã chốt. Hai ô giá liên thông: sửa ô nào thì cặp giá đó cùng chốt. Mỗi ô đã chốt có nút **↺ gỡ chốt**; có nút **Làm mới gợi ý** để gợi ý lại từ đầu.
- **Bốc hàng**: ưu tiên **thừa nhiều trước**; thừa 1–2 vẫn giữ làm dự phòng, dùng khi hết lựa chọn. Random 3–5 dòng (Option 1/2).

### Ba option
- **Option 1 — Random toàn bộ**: bốc 3–5 mã thừa nhiều nhất, sao cho tổng đã VAT gần đích nhất (≤10k).
- **Option 2 — Nhập tay 1–2 mã + random thêm**: ông nhập 1–2 mã (có/không SL) → nếu chưa nhập SL thì gợi ý cả SL, nếu đã nhập SL thì giữ SL và chỉ bốc thêm dòng cho đủ. Ô nào đã nhập là đã chốt.
- **Option 3 — Đúng giá thực (chọn khách)**:
  - Trên: **Chọn khách + Từ ngày → Đến ngày** → bấm “Xem sổ chi tiết” → ra sổ chi tiết của khách trong khoảng ngày, lấy từ sổ chi tiết đã import — mỗi dòng: **Ngày | Mã thực · Tên thực | Mã thuế · Tên thuế | Cap1 · Cap2 | 4 cột tồn | SL thực · Đơn giá thực · Thành tiền**. Hiển thị tối đa **10 mã theo doanh số cao nhất**, có thanh kéo xem thêm.
  - Ô **“Tổng tiền đã VAT cần xuất cho khách này” đặt NGAY DƯỚI bảng khách, TRÊN bảng nhập liệu** (đã chốt — Option 1/2 để trên, Option 3 dời xuống cho liền mạch).
  - Dưới: bảng nhập liệu vẫn cho sửa mã/SL/giá như Option 1/2, mặc định giá khai. Nút **“Gợi ý hóa đơn cho khách này”** (riêng Option 3, thay nút Gợi ý thường) — máy lấy luôn dữ liệu bảng trên, chọn hàng **gần giống thực**, ưu tiên mã thừa thuế, phân bổ SL theo tỷ trọng doanh số thực sao cho tổng gần đúng tiền khách trả (≤10k). Không random linh tinh.
  - Kế toán biết khách trả cho đơn từ ngày nào đến ngày nào → nhập khoảng ngày, nhập tổng tiền khách trả, bấm gợi ý là ra hóa đơn gần đúng.

## 6. Bảng nhập liệu hóa đơn
- Cột: # | Mã thuế (chọn) | Tên thuế | Số lượng | Giá chưa VAT | VAT% | Giá đã VAT | Thành tiền đã VAT | Tồn thuế 1 | Tồn thực 1 | Tồn thuế 2 | Tồn thực 2 | Xóa.
- Chữ nhỏ **11,5px** cho gọn; tiền tách **dấu chấm hàng nghìn** (100.000.000). 4 cột tồn nền xám nhạt để soi.
- **2 giá liên thông**: sửa giá chưa VAT ↔ giá đã VAT tự nhảy theo VAT% riêng.
- Nút **+ Thêm dòng** nằm ngay trong ô cuối bảng cho gọn. Bấm Gợi ý chỉ lấp ô chưa chốt; bấm Sửa giá dòng cuối khớp 100%.

## 7. Lưu & Xuất + kiểm soát tồn
- Nút **“Lưu & Xuất Excel/CSV (MISA)”** — đầu ra **Excel hoặc CSV theo mẫu import MISA** để up thẳng.
- Bấm Lưu & Xuất → **trừ tạm vào tồn thuế đang hiển thị trong ngày** để lần gợi ý sau không bốc trùng; hôm sau import file mới ghi đè lại cho chuẩn. Ghi lịch sử.
- **Tab Lịch sử**: danh sách các lần đã Lưu & Xuất (thời gian, khách nếu có, tổng đã VAT, số dòng, đã trừ, tải lại file).

## 8. UI/UX — 4 tab
- **Tab 1 Danh mục**: 2 bảng Thuế/Thực cạnh nhau, nút Import, nút Thêm mã, tab con Cap1/Cap2.
- **Tab 2 So tồn**: 2 nút Import tồn + bảng 4 cột tồn (thuế1/thực1/thuế2/thực2), thừa tô đỏ.
- **Tab 3 Gợi ý hóa đơn**: 3 chip Option; Option 3 có thêm khối chọn khách + khoảng ngày + bảng sổ chi tiết + ô tổng tiền cho khách + bảng nhập liệu chung.
- **Tab 4 Lịch sử**.
- Tông trắng–xanh như bảng Tài chính hiện tại.

## 9. Phân quyền & nhóm menu
- Menu mới **“Nhóm Kế toán” → “Hỗ trợ xuất hóa đơn”**, mặc định chỉ Admin thấy; sau share cho kế toán.

## 10. Thuật toán gợi ý (demo đã làm)
- Pool ưu tiên thừa nhiều; Option 3 pool ưu tiên 10 mã của khách trước.
- Chia đều SL ban đầu, rồi **tinh chỉnh SL ±1 ở ô chưa chốt để tổng gần đích nhất (hill climb)**, mục tiêu ≤10k. Nếu vẫn lệch >10k và còn chỗ (<5 dòng) thì thêm dòng nhỏ nhất. `goiY()` và `goiYKhach()` đều áp dụng. `suaGiaCuoi()` chỉnh giá đã VAT dòng cuối = (đích − tổng trước cuối)/SL cuối, làm tròn tiền, đồng bộ giá chưa VAT.

## 11. Demo hiện tại
- File: `H:\Lifepro_BaoCao\.tmp\demo-hoa-don.html` (mở bằng trình duyệt, không cần server).
- Đã áp dụng: tiền chấm hàng nghìn, chữ nhỏ, 4 cột tồn, thêm dòng trong bảng, lệch ≤10k, sửa giá cuối 100%, giữ ô đã chốt (chấm cam/xanh, viền đậm, nút ↺), Option 3 dời tổng tiền xuống dưới bảng khách + khoảng ngày + 4 cột tồn trong sổ chi tiết.

## 12. Việc tiếp theo (khi ông chốt “làm đi”)
1. Tạo migration: bảng DM, tồn theo ngày, lịch sử hóa đơn.
2. Import DM + tồn (định dạng cố định).
3. So tồn 4 cột + API.
4. Gợi ý 3 option + 2 giá liên thông + giữ chốt + lệch ≤10k + sửa giá cuối 100%.
5. Xuất MISA + trừ tạm tồn + lịch sử + phân quyền Nhóm Kế toán.

— Hết spec chốt demo —
