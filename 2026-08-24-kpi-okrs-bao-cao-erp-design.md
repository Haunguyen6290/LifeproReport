# ĐẶC TẢ CHUYỂN ĐỔI — MODULE OKR & BÁO CÁO (KPI LIFEPRO → SUPABASE + VERCEL)

> **Mục đích:** Bản này để ông duyệt nghiệp vụ và để bên dev ERP làm mà KHÔNG phải đọc lại code Apps Script/Sheets cũ.
> **Ngày chốt:** 2026-08-24 | **Nền tảng mới:** Next.js (Vercel) + Supabase (Auth + Postgres) — là 1 module trong ERP đang chạy.
> **Nguyên tắc:** Làm mới hoàn toàn, không mang dữ liệu cũ sang. Bỏ hẳn KPI (không chấm điểm).
> **Bản sửa (2026-08-24, sau trao đổi với ông):** (1) OKR bỏ cấp phòng ban — liên kết 2 tầng: O công ty → KR công ty → O cá nhân (gắn đúng 1 KR công ty, bắt buộc) → KR cá nhân; (2) Báo cáo vấn đề KHÔNG tạo mới — đổi tên Thị trường thành **Báo cáo Tổng hợp KD**, giữ nguyên trường; (3) Báo cáo tuần ghi đè + log, đúng/trễ chốt theo lần nộp đầu; (4) Báo cáo kho thêm danh mục **Nhóm vấn đề** (seed 6 mục), Nhóm sản phẩm để trống vẫn lưu.
> **Bản sửa lần 2 (2026-08-24, đợt 2 — sau khi xem 2 ảnh AppScript cũ):** (5) Kế hoạch/Báo cáo tuần chuyển sang **từng dòng công việc** (bảng con), không còn 1 ô text; (6) **Báo cáo tuần khóa vào Kế hoạch** — tuần chưa có kế hoạch thì không mở được báo cáo; (7) **OKR có Check-in hàng tuần** (tiến độ + mức tự tin + vướng mắc + cần hỗ trợ); (8) **Quy ước hiển thị chung:** nhập dạng ô → lưu xong hiển thị dạng **card** → bấm Sửa quay lại dạng ô; danh sách nhiều người thì **bảng gọn, bấm 1 hàng nở thành card**, dưới card có phần **Duyệt / Xác nhận / Góp ý**.

---

## 1. Ranh giới module

- **Nằm trong ERP**, dùng chung:
  - 1 tài khoản đăng nhập cho cả ERP (Supabase Auth đã có)
  - Danh sách nhân viên, phòng ban, tài khoản của ERP — module này KHÔNG tự quản riêng
  - Danh mục **Nhóm sản phẩm** (`san_pham`) đã có sẵn trong ERP — báo cáo kho sẽ gắn vào đó, **để trống không bắt lỗi** (có nhóm lâu ngày không khai)
- **Module này chỉ làm 4 việc (sau khi gộp):**
  1. OKR liên kết (2 tầng: Công ty → Cá nhân)
  2. Báo cáo tuần (Kinh doanh, ghi đè)
  3. Báo cáo kho (gồm Nhóm vấn đề mới + Nhóm sản phẩm có sẵn)
  4. **Báo cáo Tổng hợp KD** — chính là **Báo cáo Thị trường** cũ đổi tên, giữ nguyên trường, không đẻ thêm bảng `issues`
- Không làm lại KPI, không chấm điểm tự động, không mang Sheet cũ sang

## 2. OKR liên kết — quan trọng nhất

> **Ghi chú nguồn:** Quy tắc câu chữ và số lượng dưới đây theo *"OKRs Hiểu Đúng Làm Đúng"* (SEONGON/VNOKRs).
> Áp dụng mức **C — vừa phải:** chặn cứng những lỗi làm sai bản chất, còn lại chỉ gợi ý để không làm khó người mới.
> **Chuỗi liên kết (chốt 24/08):** **O công ty → KR công ty → O cá nhân (gắn đúng 1 KR công ty, bắt buộc) → KR cá nhân.** Không có cấp phòng ban.

**Ai làm:** Tất cả nhân viên đều có OKR, nhưng liên kết 2 tầng: **Công ty (do Admin tạo) → Cá nhân** (mỗi NV chọn KR công ty trong cùng kỳ hạn rồi viết O + KR của mình). Admin phải tạo OKR công ty trước, nhân viên mới tạo được của mình.

**Cấp liên kết (móc nối):**
- Công ty đặt mục tiêu lớn (VD: tăng doanh số 20% → tách thành các KR có số)
- Cá nhân đặt mục tiêu gắn vào **đúng 1 KR công ty** trong cùng khoảng Từ–Đến ngày (muốn góp vào nhiều KR thì tạo O thứ 2, vẫn trong hạn mức 1–3 O)

**Chu kỳ:** **Từ ngày → Đến ngày** do người tạo tự chọn — linh hoạt, không bó vào khung tháng/quý cố định. Ông muốn chạy 01/09 → 31/12 (hơn 1 quý) hay 6 tháng/năm đều được. Hệ thống có ô gợi ý quy đổi "tương đương Tháng/Quý/6 tháng/Năm" để dễ lọc, nhưng không bắt buộc.

**Quy tắc đặt cho đúng (mức C):**

| Nội dung | Quy tắc | App làm gì |
|---|---|---|
| **Số lượng** | Mỗi người **1-3 mục tiêu**, mỗi mục tiêu **2-5 kết quả chính**. Nhiều hơn là loãng, quý 13 tuần không làm kịp | **Chặn cứng:** quá 3 mục tiêu hoặc quá 5 kết quả/mục tiêu thì không cho lưu |
| **Mục tiêu (O)** | Câu truyền cảm hứng, **không chứa số** — VD đúng "Bứt phá doanh số Q4", sai "Tăng 20% doanh số" | **Gợi ý:** nếu O có chữ số/%/đ thì báo "số nên để ở Kết quả chính" nhưng vẫn cho lưu |
| **Kết quả chính (KR)** | **Bắt buộc có số để đo** — VD "Chốt 5 khách mới", "Đạt 2 tỷ". Không đo bằng việc hoàn thành mà đo bằng giá trị thu được | **Chặn cứng:** KR không có số thì không cho lưu |
| **Kiểm tra cuối** | "Nếu hoàn thành hết KR thì O đã đạt chưa?" — nếu chưa đạt nghĩa là KR đặt sai | **Nút "Thử OKR":** app hỏi câu này trước khi lưu để tự kiểm tra |
| **Loại mục tiêu** | Mới làm thì mặc định **Cam kết** (phải đạt 100% = 1.0). Quen rồi mới dùng **Kéo giãn** (đạt 0.6-0.7 đã giỏi như Google) | Mặc định là Cam kết. Có nút chọn Tham vọng khi đã quen |
| **Điểm số** | 2 loại: **% tiến độ** cập nhật hàng tuần + **điểm cuối kỳ 0.0-1.0** tự chấm. Không dùng điểm này để tính lương | Tự tính % trung bình các KR, không link sang bảng lương |
| **Trong suốt** | Ai cũng xem được OKR của nhau (minh bạch tạo cam kết) | Mặc định công khai toàn công ty |
| **Gắn kết** | O cá nhân bắt buộc gắn 1 KR công ty trong cùng kỳ hạn | **Chặn cứng:** không chọn KR công ty thì không cho lưu O cá nhân; chọn KR khác kỳ hạn cũng chặn |

**Luồng thực tế:**
1. **Admin tạo OKR công ty** (O + KR, `parent_kr_id = null`). Đây là tiên quyết — chưa có thì nhân viên thấy dòng nhắc "Admin chưa tạo OKR công ty cho kỳ này".
2. Nhân viên tạo OKR cá nhân theo đúng 3 bước: **(1) chọn 1 KR công ty trong cùng kỳ hạn → (2) viết O của mình → (3) viết các KR của mình.**
3. Gửi → Quản lý xem, góp ý/nhận xét (duyệt hoặc yêu cầu sửa) — **mỗi tuần Check-in 1 lần:** cập nhật % tiến độ, mức tự tin (Tốt/Ổn/Không ổn), vướng gì, cần gì. Thiếu Check-in là nguyên nhân số 1 thất bại
4. Trong kỳ, cập nhật tiến độ, đổi trạng thái: Mới → Đang làm → Hoàn thành/Chưa đạt
5. Xem dạng cây/lưới để thấy mục tiêu nào đang chậm — dạng **O công ty → KR công ty → các O cá nhân gắn dưới → KR cá nhân** (nhiều người cùng gắn 1 KR công ty thì xếp dưới KR đó)

**Gửi lại:** Cùng kỳ hạn gửi lại thì bản mới đè lên, bản cũ lưu lịch sử.

### 2.1 Check-in hàng tuần (chốt đợt 2 — 24/08)

Trước đây OKR chỉ có 1 con số tiến độ, không có lịch sử. Nay mỗi tuần **check-in 1 lần** cho từng mục tiêu:

| Ô nhập | Kiểu | Ghi chú |
|---|---|---|
| **Tuần** | tự lấy tuần hiện tại (T2→T7) | 1 dòng check-in / 1 mục tiêu / 1 tuần |
| **Tiến độ (%)** | thanh trượt 0–100 | cập nhật luôn `tien_do` của mục tiêu để cây đổi màu |
| **Mức tự tin** | 🟢 Tốt · 🟡 Ổn · 🔴 Không ổn | mặt cười cho dễ chọn |
| **Vướng mắc** | ô chữ 2 dòng | đang tắc ở đâu |
| **Cần hỗ trợ** | ô chữ 2 dòng | cần ai giúp gì |

- **Hiển thị:** nhập dạng ô → lưu xong thành **card check-in** xếp theo tuần (mới nhất trên cùng), dưới card có phần **Góp ý của quản lý**. Bấm Sửa thì card mở lại thành ô.
- Trong **cây OKR**, mục tiêu nào **chưa check-in tuần này** thì hiện nhắc *"Chưa check-in tuần T35"* — quản lý nhìn là biết ai bỏ.
- Không chấm điểm, không link lương. Check-in chỉ để thấy sớm mục tiêu đang chậm.

## 3. Báo cáo tuần — chỉ nhân viên Kinh doanh

> **Chốt đợt 2 (24/08):** Kế hoạch và Báo cáo tuần là **một cặp gắn chặt**, mỗi việc là **1 dòng** (không còn 1 ô text chung). **Chưa có Kế hoạch tuần thì không mở được Báo cáo tuần.**

### 3.1 Kế hoạch tuần — nhập dạng ô, mỗi việc 1 dòng

Phần trên (chung cho cả tuần):
- **Tuần:** chọn tuần (T2 → T7), hiện kèm **Hạn nộp kế hoạch** (17h30 T7 tuần trước) — chỉ để xem.
- **Mục tiêu tuần này \*:** ô chữ 2 dòng — "Tuần này bạn muốn đạt gì? Gắn với OKR."

Bảng công việc (bấm `+ Thêm công việc` để thêm dòng):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| **Công việc \*** | ô chữ 2 dòng | VD "Gặp KH ABC chốt đơn" |
| **Kết quả cần đạt** | ô chữ 2 dòng | nên có số — VD "2 đơn" |
| **Ngày dự kiến (T2–T7)** | chọn nhiều ngày | 1 việc có thể làm nhiều ngày |
| **Ưu tiên** | Cao / Trung bình / Thấp | hiện màu ở phần xem |
| **Gắn KR cá nhân** | chọn từ OKR kỳ này | để biết việc này kéo KR nào (không bắt buộc) |
| **×** | nút | bỏ dòng |

### 3.2 Báo cáo tuần — tự đổ từ Kế hoạch

- **Khóa vào kế hoạch:** tuần chưa có Kế hoạch → nút Báo cáo tuần **mờ đi** + dòng nhắc *"Hãy gửi Kế hoạch tuần trước đã."*
- Mở lên: mỗi dòng kế hoạch thành **1 dòng báo cáo**, cột `Công việc theo kế hoạch` + `KQ cần đạt` **để mờ, không sửa được**.

Phần trên (tổng quan tuần):
- **Mục tiêu tuần đã đặt** — để mờ, lấy từ kế hoạch
- **Tự đánh giá mục tiêu tuần \*:** Đạt / Đạt một phần / Chưa đạt
- **Tỷ lệ hoàn thành chung (%)** — tự tính trung bình các dòng, cho sửa tay
- **Điểm nổi bật trong tuần** · **Khó khăn / vướng mắc** · **Đề xuất / kiến nghị** — 3 ô chữ 2 dòng

Bảng kết quả từng việc (**bỏ cột Đề xuất ở dòng vì đã có ô Đề xuất chung ở trên**):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| Ngày · Công việc theo kế hoạch · KQ cần đạt | để mờ | tự đổ từ kế hoạch |
| **Việc đã làm được \*** | ô chữ | bắt buộc |
| **% HT** | số 0–100 | |
| **Tự đánh giá \*** | Hoàn thành / Hoàn thành một phần / Chưa xong | |
| **Nguyên nhân chưa đạt** | ô chữ | **bắt buộc khi % < 100 hoặc Tự đánh giá ≠ Hoàn thành** |

- **Ghi đè + log:** Cùng tuần mỗi người chỉ có **1 bản Kế hoạch + 1 bản Báo cáo**. Sửa thì đè lên, chỉ hiện bản cuối, có ghi thêm `· sửa lúc HH:mm dd/MM`.
- Quản lý xem và **góp ý / duyệt / xác nhận** ngay dưới card (xem §3.3).

### 3.3 Cách hiển thị — nhập ô → xem card → sửa lại về ô

| Trạng thái | Hình thức |
|---|---|
| **Nhập mới** | dạng **ô** (bảng gõ nhanh như §3.1 / §3.2) |
| **Lưu xong** | dạng **card** đẹp: tên người, tuần, đúng hạn/trễ, liệt kê từng việc rõ ràng; dưới card là phần **Duyệt / Xác nhận / Góp ý** của quản lý (nhân viên mở lại cũng thấy góp ý) |
| **Bấm Sửa** | card mở lại thành **dạng ô**, lưu xong quay về card; chỉ hiện bản mới nhất + `sửa lúc …` |
| **Quản lý xem nhiều người** | **bảng gọn** trước (mỗi người 1 hàng: tên · đúng/trễ · % hoàn thành · đã nộp chưa), **bấm 1 hàng thì nở ra thành card đầy đủ** — so sánh nhanh, ai chưa nộp thấy ngay |
| **Nhân viên xem của mình** | luôn là **card** |

> **Nhắc đúng hạn (không chấm điểm, không chặn):** Vẫn lưu được dù trễ, nhưng khi bấm Lưu sẽ hiện ngay dòng nhắc màu — kiểu *"Bạn đã nộp trễ so với thời gian quy định (hạn là 17h30 T7 / 17h30 T2). Vẫn đã lưu, hãy cố đúng hạn tuần sau."* Áp dụng cho cả **Kế hoạch tuần** và **Báo cáo tuần**. **Đúng/trễ chốt theo lần nộp đầu (`created_at`), không đổi khi sửa:** nộp 16h T7 là đúng hạn, dù hôm sau sửa thì vẫn đúng hạn (hiển thị thêm `· sửa lúc HH:mm`); nộp 20h T7 đã trễ thì sửa sau vẫn trễ.

## 4. Báo cáo Tổng hợp KD — chính là Báo cáo Thị trường cũ đổi tên (không tạo mới)

> **Chốt 24/08:** Module **Báo cáo vấn đề** trong bản đầu chính là **Báo cáo Thị trường** đã chạy ổn định (`/thi-truong`, bảng `market_news`, dialog `AddNewsDialog`). Để không chồng chéo, **KHÔNG tạo bảng `issues` mới**, chỉ **đổi tên hiển thị** `Thị trường → Báo cáo Tổng hợp KD` trên sidebar + tiêu đề. Giữ nguyên đường dẫn `/thi-truong` (alias `/bao-cao-tong-hop` redirect) và toàn bộ data cũ.

**Giữ nguyên trường (giàu hơn spec §4 ban đầu, chỉ đổi label):**

| Trường hiện tại | Đổi label hiển thị | Ghi chú |
|---|---|---|
| `Ngày` / `ngay` | `Ngày` | chọn ngày xảy ra vấn đề |
| `Loại tin` (`loai_tin_tt`) | `Nhóm vấn đề` | dropdown từ danh mục, không gõ tay |
| `Nội dung` | `Chi tiết vấn đề` | **rộng hết cỡ, cao 3 dòng**, auto wrap |
| `Đề xuất` (`suggested_action`) | `Đề xuất` | **rộng hết cỡ, cao 2 dòng**, auto wrap |
| `Mức độ quan trọng` / `Nguồn` / `Sản phẩm` | giữ nguyên | giữ vì giàu hơn spec, không co |
| Trạng thái (`MOI`/`THAOLUAN`/`KETLUAN`) + Kết luận đã/chưa xử lý | `Trạng thái` | do quản lý/admin ghi; Ý kiến QL hiện cùng dòng ở danh sách |

- Dialog `Ghi tin` chỉ đổi label cho khớp (Chi tiết 3 dòng, Đề xuất 2 dòng), logic giữ nguyên.

> **Nhắc nội dung (không chặn):** Lưu mà **không ghi Đề xuất** → hiện *"Bạn chưa ghi đề xuất, hãy thêm để quản lý xử lý nhanh hơn."* — vẫn cho lưu.

## 5. Báo cáo kho — gắn Nhóm sản phẩm có sẵn

> **Chốt 24/08 — Nhóm sản phẩm đã có:** chính là danh mục `san_pham` của ERP (Bóng LED L55, TPMS, Camera lùi...) — báo cáo kho dropdown từ đó, **để trống vẫn cho lưu** (không bắt lỗi, vì có nhóm lâu ngày không khai). Không hardcode trong code.
> **Nhóm vấn đề mới (danh mục, không hardcode):** tạo danh mục mới (slug vd `nhom_van_de_kho`) trong `categories`/`category_items`, admin sửa ở **Danh mục**, seed sẵn 6 mục: **Thiếu vỏ hộp · Hộp xấu · Thiếu linh kiện · Hàng lâu ngày · Hàng trả lại · Hàng đề xuất thanh lý.**

**Hiển thị:** Dạng **bảng danh sách chi tiết** (mỗi dòng là 1 mặt hàng/nhóm hàng).
**Thêm mới:** Bấm "Thêm báo cáo" → **hộp thoại (dialog) nổi trên nền cũ**, giống báo cáo tổng hợp ở §4.

**Các ô khi nhập (trong dialog):**
- **Ngày:** ngày báo cáo
- **Nhóm sản phẩm:** chọn từ danh mục đã có sẵn trong ERP (dropdown), không gõ tay, không hardcode
- **Số lượng**
- **Vấn đề/Thực trạng:** ô nhập chữ — **rộng hết cỡ, cao 3 dòng**, tự động xuống dòng khi quá chiều ngang
- **Đề xuất/Trạng thái:** gồm **1 ô nhập chữ (cao 2 dòng, tự xuống dòng)** + **1 ô chọn trạng thái:** Chờ giải quyết / Đang giải quyết / Đã xử lý

**Hiển thị ở danh sách (ngoài dialog):** ngoài các cột trên, mỗi dòng còn có **Ý kiến của Quản lý** + trạng thái đã chọn.

- Chỉ bộ phận Kho làm (admin hỗ trợ xem/xử lý)
- Theo tuần hiện tại, thêm/sửa/xóa dòng trong tuần; sang tuần mới tự vào **Lịch sử** (xem theo tuần, nhóm lại)

## 6. Thêm bớt dòng & nhập từ Excel — linh hoạt

Vì KPI thay đổi hàng tháng (nay bỏ rồi nhưng OKR/báo cáo cũng cần linh hoạt):
- Mọi bảng (OKR, báo cáo kho) cho **thêm/sửa/xóa dòng thoải mái** trong kỳ
- Có nút **nhập từ Excel** (import) để đỡ gõ tay — chọn file, xem trước, xác nhận là đổ vào
- Danh mục (Nhóm sản phẩm) do ERP quản ở Cài đặt, không nằm cứng trong code

## 7. Ai được làm gì

- Đăng nhập 1 lần dùng cả ERP
- **Kinh doanh:** OKR + Báo cáo tuần + Báo cáo vấn đề (+ xem Bảng tin nếu có)
- **Kho:** chỉ Báo cáo kho (+ xem Bảng tin)
- **Admin/Quản lý:** xem tất cả, góp ý/duyệt OKR và báo cáo, quản lý danh mục
- Chặn quyền ở máy chủ, giao diện chỉ ẩn/hiện cho tiện — không dựa vào giao diện để bảo mật

## 8. Dashboard — 3 tab

- **Tab OKR:** dạng cây móc nối **Công ty → KR công ty → Cá nhân** (không có cấp Phòng), mục chậm hiện màu khác để thấy sớm; lọc theo **Từ ngày → Đến ngày**.
- **Tab Báo cáo Tổng hợp KD:** chính là Báo cáo KD hiện tại (Kế hoạch tuần → Báo cáo tuần gộp với Báo cáo Tổng hợp KD của Kinh doanh); hiện ai nộp trễ, ai thiếu đề xuất (dòng nhắc). Tên hiển thị mới là **Báo cáo Tổng hợp KD**, đường dẫn `/thi-truong` giữ lại (alias `/bao-cao-tong-hop`).
- **Tab Kho:** theo Nhóm sản phẩm (có thể trống), Số lượng, Thực trạng, Đề xuất/Trạng thái (Chờ/Đang/Đã xử lý) + **Nhóm vấn đề** mới (6 mục seed); lọc theo **Từ ngày → Đến ngày**.
- Phân quyền tab: Kho chỉ thấy tab Kho; Kinh doanh thấy OKR + Báo cáo Tổng hợp KD; Admin thấy cả 3.

## 9. Luồng chung (áp dụng cho cả OKR và báo cáo)

Tạo/nhập → Gửi → Quản lý xem/góp ý → Cập nhật (OKR: Check-in hàng tuần) → Lịch sử giữ lại. Riêng **Báo cáo tuần** là **ghi đè** trong tuần (T2–T7), lịch sử nằm ở `audit_logs` (xem đúng/trễ theo `created_at` lần nộp đầu).

---

## Phụ lục A — Cho dev (không cần đọc code cũ)

| Sheet cũ (Apps Script) | Bảng Supabase gợi ý | Ghi chú chuyển đổi |
|---|---|---|
| `_NHANSU`, `_TAIKHOAN`, `_PHIEN` | **Dùng chung** `profiles/users` của ERP | Bỏ, không tạo lại. Module chỉ tham chiếu `user_id` |
| `_TUAN` | **Tính động theo ngày (T2→T7)** — deadline KH 17h30 T7 tuần trước, BC 17h30 T2 tuần kế | Tuần T2–T7, không đẻ 52 dòng sẵn; đúng/trễ theo `created_at` lần nộp đầu, `updated_at` chỉ để hiển thị sửa |
| `D_OKR` | `okrs` (id, user_id, `tu_ngay→den_ngay` khung chính linh hoạt, `loai_ky_goi_y`, `objective`, `is_company`, `trang_thai`, `tien_do`) + `okr_key_results` (id, `okr_id`, `noi_dung`, `parent_kr_id` FK nullable) + **`okr_check_ins`** (id, `okr_id`, `user_id`, `tuan_tu`, `tien_do`, `tu_tin` enum Tốt/Ổn/Không ổn, `vuong_mac`, `can_ho_tro`, `created_at`, `updated_at`) | `parent_kr_id` là KR công ty mà O cá nhân gắn vào (bắt buộc, cùng kỳ hạn, 1:1); KR bắt buộc có số; O gợi ý không số; `is_company` để phân biệt OKR công ty/cá nhân; **check-in 1 dòng/tuần/mục tiêu, cập nhật luôn `okrs.tien_do`** |
| `D_PLAN`, `D_REPORT` | `weekly_plans` (id, user_id, `tuan_tu`, `tuan_den` = T2→T7, `muc_tieu_tuan`, `created_at`, `updated_at`) + **`weekly_plan_items`** (id, `plan_id`, `cong_viec`, `kq_can_dat`, `ngay_list` T2–T7, `uu_tien`, `kr_id` nullable, `sort_order`) + `weekly_reports` (id, user_id, `tuan_tu`, `tuan_den`, `tu_danh_gia`, `ty_le_ht`, `diem_noi_bat`, `kho_khan`, `de_xuat`, `created_at`, `updated_at`) + **`weekly_report_items`** (id, `report_id`, `plan_item_id` FK, `viec_da_lam`, `phan_tram`, `tu_danh_gia`, `nguyen_nhan`) — **ghi đè trong tuần, upsert theo `(user_id, tuan_tu)`**, chi tiết nằm ở bảng con | **Tách bảng (không JSON)** để dashboard lọc được "ai dồn việc T6", "KR nào chậm". Báo cáo **khóa vào kế hoạch**: chưa có `weekly_plans` cho tuần đó thì không cho tạo `weekly_reports`. Không `weekly_summaries`/`version+Hiệu lực`; tổng hợp tính động |
| `D_ISSUE` | **KHÔNG tạo — gộp vào `market_news`** (Báo cáo Tổng hợp KD) | Đổi tên Thị trường → Báo cáo Tổng hợp KD, giữ nguyên bảng/cột, chỉ đổi label hiển thị |
| `D_BaoCaoKho` | `warehouse_reports` (id, user_id, `ngay`, `product_group_id` FK nullable → `category_items(san_pham)`, `nhom_van_de_id` FK → `category_items(nhom_van_de_kho)`, `so_luong`, `thuc_trang` text 3 dòng, `de_xuat` text 2 dòng, `trang_thai` enum, `y_kien_quan_ly` text, `tuan_tu→tuan_den` T2–T7) | 6 Nhóm vấn đề seed sẵn, không hardcode; Nhóm SP để trống OK |
| `D_BangTin` | `news` (nếu ERP chưa có) | Hoặc dùng bảng tin sẵn của ERP |
| `_KPI_MASTER`, `_KPI_THANG`, `D_KPI`, `D_SOLIEU`, `D_Zalo` | **Bỏ hết** | Không chuyển — KPI đã bỏ |

**Lưu ý dev:** Ảnh bảng tin cũ từng lưu base64 trong ô Sheet (giới hạn 50k ký tự) → mới đổi sang lưu file vào Drive lấy URL. Sang Supabase dùng Storage, lưu URL vào bảng.

## Phụ lục B — Những gì BỎ (không làm ở hệ thống mới)

- Toàn bộ KPI: bảng KPI theo người, snapshot theo tháng, chấm tự động 8 loại, điểm trưởng bộ phận, in bảng KPI
- Form trên Google Sheet (F1-F5) và sheet báo cáo R_*
- Logic tính tuần sinh sẵn 52 tuần/năm — có thể tính động

---

**Ông duyệt bản này là bên kia làm được ngay, không cần mở code cũ.**
