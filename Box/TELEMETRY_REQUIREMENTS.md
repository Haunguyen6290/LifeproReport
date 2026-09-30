# YÊU CẦU KỸ THUẬT: Dashboard Quản Lý Box Lifepro SmartVOICE

**Mục đích:** Giao diện web để xem, quản lý các box đã bán, theo dõi kích hoạt

**Database:** Supabase (đã tạo bảng `boxes` bằng file SQL đi kèm)

**Công nghệ đề xuất:** Next.js + Supabase Client (hoặc bất kỳ framework nào anh quen)

---

## 1. THÔNG TIN KẾT NỐI SUPABASE

```
URL: https://kibxnlhgdprkevqnbtfy.supabase.co
Anon Key: (dùng key bắt đầu bằng eyJ... từ Supabase Settings > API)
Service Role Key: sb_secret_SB2Nzf4GaMZCYxAnfIp53w_RYEnvA8k
```

**Lưu ý:**
- Dashboard web dùng **Anon Key** (đọc dữ liệu, policy đã cho phép)
- App Android dùng **Service Role Key** (ghi dữ liệu)

---

## 2. CẤU TRÚC BẢNG `boxes`

| Cột | Kiểu | Mô tả | Bắt buộc |
|-----|------|-------|----------|
| `id` | UUID | Primary key tự động | ✅ |
| `android_id` | TEXT | Định danh Android (Settings.Secure.ANDROID_ID) | ⚠️ Ít nhất 1 trong 3 |
| `imei` | TEXT | IMEI thiết bị (nếu có quyền) | ⚠️ Ít nhất 1 trong 3 |
| `serial_number` | TEXT | Build.SERIAL | ⚠️ Ít nhất 1 trong 3 |
| `device_model` | TEXT | Tên model (vd: "T95 MAX") | ✅ |
| `device_manufacturer` | TEXT | Nhà sản xuất (vd: "Allwinner") | ✅ |
| `android_version` | TEXT | Phiên bản Android (vd: "12") | ✅ |
| `app_version_code` | INTEGER | Version code app (vd: 40) | ✅ |
| `app_version_name` | TEXT | Version name app (vd: "2.5.4") | ✅ |
| `activation_code` | TEXT | Mã kích hoạt (null nếu chưa có) | ❌ |
| `is_activated` | BOOLEAN | Trạng thái kích hoạt | ✅ (mặc định false) |
| `first_seen_at` | TIMESTAMPTZ | Lần đầu tiên box gửi dữ liệu lên | ✅ (tự động) |
| `last_seen_at` | TIMESTAMPTZ | Lần gần nhất box gửi dữ liệu | ✅ (tự động) |
| `activated_at` | TIMESTAMPTZ | Thời điểm được kích hoạt | ❌ |
| `metadata` | JSONB | Dữ liệu tùy chỉnh (GPS, ghi chú...) | ❌ |

---

## 3. NGHIỆP VỤ APP ANDROID

### 3.1. Khi nào gửi?
- **Lần đầu tiên app chạy** (sau khi cài đặt)
- **Chỉ gửi 1 lần duy nhất** (lưu flag vào SharedPreferences/DataStore)
- Nếu không có mạng → lưu lại, gửi sau khi có mạng

### 3.2. Dữ liệu gửi đi
```json
{
  "android_id": "abc123...",
  "imei": "357...",
  "serial_number": "unknown",
  "device_model": "T95 MAX",
  "device_manufacturer": "Allwinner",
  "android_version": "12",
  "app_version_code": 40,
  "app_version_name": "2.5.4",
  "activation_code": null,
  "is_activated": false,
  "metadata": {}
}
```

### 3.3. API Endpoint
**POST** `https://kibxnlhgdprkevqnbtfy.supabase.co/rest/v1/boxes`

**Headers:**
```
Content-Type: application/json
apikey: sb_secret_SB2Nzf4GaMZCYxAnfIp53w_RYEnvA8k
Authorization: Bearer sb_secret_SB2Nzf4GaMZCYxAnfIp53w_RYEnvA8k
Prefer: resolution=merge-duplicates
```

**Logic:**
- Nếu box đã tồn tại (dựa trên android_id/imei/serial) → **UPDATE** `last_seen_at`
- Nếu box chưa tồn tại → **INSERT** mới

---

## 4. YÊU CẦU GIAO DIỆN DASHBOARD

### 4.1. Trang chính: Danh sách Box

**Hiển thị dạng bảng:**

| STT | Model | Nhà SX | Android | App Ver | Định Danh | Lần Đầu | Lần Cuối | Kích Hoạt | Hành Động |
|-----|-------|--------|---------|---------|-----------|---------|----------|-----------|-----------|
| 1 | T95 MAX | Allwinner | 12 | 2.5.4 | `abc123...` | 28/09 14:23 | 30/09 09:15 | ✅ Đã kích hoạt | [Chi tiết] |
| 2 | X96 Max | Rockchip | 11 | 2.5.3 | `def456...` | 29/09 10:05 | 29/09 10:05 | ❌ Chưa kích hoạt | [Chi tiết] [Kích hoạt] |

**Chức năng:**
- Sắp xếp theo: Lần đầu, Lần cuối, Trạng thái kích hoạt
- Lọc: Đã kích hoạt / Chưa kích hoạt
- Tìm kiếm: Theo android_id, imei, serial, model
- Phân trang (mỗi trang 50-100 box)

### 4.2. Trang chi tiết Box

**Thông tin đầy đủ:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THÔNG TIN BOX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 Thiết bị
   • Model: T95 MAX
   • Nhà sản xuất: Allwinner
   • Android: 12
   
🔑 Định danh
   • Android ID: abc123...
   • IMEI: 357...
   • Serial: unknown
   
📦 App
   • Phiên bản: 2.5.4 (code 40)
   
⏰ Thời gian
   • Lần đầu: 28/09/2026 14:23:15
   • Lần cuối: 30/09/2026 09:15:42
   
✅ Kích hoạt
   • Trạng thái: Đã kích hoạt
   • Mã: LIFEPRO-ABC123
   • Kích hoạt lúc: 29/09/2026 16:30:00
   
📝 Ghi chú (metadata)
   [Form nhập tự do, lưu vào metadata JSON]
```

**Chức năng:**
- **Nút "Kích hoạt"** (nếu chưa kích hoạt):
  - Nhập mã kích hoạt → UPDATE `activation_code`, `is_activated = true`, `activated_at = NOW()`
- **Nút "Sửa ghi chú"**:
  - Nhập ghi chú → UPDATE `metadata`

### 4.3. Thống kê tổng quan (Dashboard Home)

```
┌─────────────────────────────────────────┐
│  📊 TỔNG QUAN                            │
├─────────────────────────────────────────┤
│  Tổng box đã bán:        152            │
│  Đã kích hoạt:           148 (97.4%)    │
│  Chưa kích hoạt:         4 (2.6%)       │
│  Box mới hôm nay:        3              │
│  Box hoạt động 7 ngày:   145            │
└─────────────────────────────────────────┘

📈 Biểu đồ theo thời gian (line chart)
   - Số box mới mỗi ngày (7/14/30 ngày gần nhất)
   
📊 Biểu đồ theo model (pie/bar chart)
   - Phân bố model thiết bị
   - Phân bố phiên bản Android
```

---

## 5. QUERY MẪU (Supabase JavaScript Client)

### 5.1. Lấy danh sách box (có phân trang)
```javascript
const { data, error } = await supabase
  .from('boxes')
  .select('*')
  .order('first_seen_at', { ascending: false })
  .range(0, 49); // Trang 1 (0-49)
```

### 5.2. Lọc box chưa kích hoạt
```javascript
const { data, error } = await supabase
  .from('boxes')
  .select('*')
  .eq('is_activated', false)
  .order('first_seen_at', { ascending: false });
```

### 5.3. Tìm kiếm theo android_id
```javascript
const { data, error } = await supabase
  .from('boxes')
  .select('*')
  .ilike('android_id', '%abc123%');
```

### 5.4. Kích hoạt box
```javascript
const { data, error } = await supabase
  .from('boxes')
  .update({
    activation_code: 'LIFEPRO-XYZ789',
    is_activated: true,
    activated_at: new Date().toISOString()
  })
  .eq('id', 'uuid-box-id');
```

### 5.5. Thống kê tổng số box
```javascript
const { count, error } = await supabase
  .from('boxes')
  .select('*', { count: 'exact', head: true });
```

### 5.6. Đếm box đã kích hoạt
```javascript
const { count, error } = await supabase
  .from('boxes')
  .select('*', { count: 'exact', head: true })
  .eq('is_activated', true);
```

---

## 6. BẢO MẬT

- **Anon key** (dashboard web): Chỉ đọc dữ liệu (RLS policy đã cấu hình)
- **Service role key** (app Android): Có quyền ghi (được mã hóa trong app, không lộ ra ngoài)
- **HTTPS bắt buộc:** Mọi kết nối đều qua HTTPS
- **Không lưu thông tin nhạy cảm:** IMEI/Serial chỉ để định danh, không phải dữ liệu cá nhân người dùng

---

## 7. LƯU Ý KHI TRIỂN KHAI

1. **App Android gửi ngầm:**
   - Không hiển thị dialog/toast khi gửi
   - Gửi trên background thread (Kotlin Coroutines)
   - Retry 3 lần nếu thất bại, sau đó bỏ qua

2. **Dashboard web:**
   - Realtime update (Supabase Realtime): Box mới xuất hiện → tự động hiển thị
   - Export Excel/CSV: Xuất danh sách box để báo cáo

3. **Mở rộng sau:**
   - Gửi GPS location vào `metadata` (nếu cần)
   - Gửi thông tin lỗi crash (nếu cần)
   - Theo dõi số lần sử dụng voice command (nếu cần)

---

## 8. FILE CẦN CHẠY

1. **`supabase_boxes_table.sql`** → Chạy trên Supabase SQL Editor để tạo bảng
2. **`TELEMETRY_REQUIREMENTS.md`** (file này) → Tài liệu cho dev web dashboard
3. **Code Android** (file Kotlin) → Tích hợp vào app SmartVOICE

---

**Mọi thắc mắc kỹ thuật, ping anh Claude Code bên kia nhé!** 🚀
