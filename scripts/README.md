# Scripts Setup

## Tạo tài khoản Admin mặc định

Chạy script này **sau khi đã setup Supabase** để tạo tài khoản admin:

```bash
node scripts/create-default-admin.mjs
```

**Thông tin đăng nhập:**
- Username: `admin`
- Password: `123456`

⚠️ **Bắt buộc đổi password ngay lần đăng nhập đầu tiên**

### Yêu cầu:
- File `.env.local` đã có `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`
- Database đã chạy migration (bảng `profiles`, `roles` đã tồn tại)

### Lưu ý:
- Script chỉ tạo admin khi **chưa có user nào** trong hệ thống
- Nếu đã có user, script sẽ bỏ qua và báo "Đã có user trong hệ thống"
