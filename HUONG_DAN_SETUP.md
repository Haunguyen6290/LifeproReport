# Hướng dẫn Setup lần đầu

## Bước 1: Tạo project Supabase
1. Vào https://supabase.com → Tạo project mới
2. Chọn region gần nhất (Singapore)
3. Đặt mật khẩu database

## Bước 2: Chạy migrations
1. Vào **SQL Editor** trong Supabase Dashboard
2. Copy nội dung từng file trong folder `supabase/migrations/` (theo thứ tự số)
3. Chạy từng file một

## Bước 3: Tạo tài khoản Admin đầu tiên
1. Vào **Authentication** → **Users** → **Add user**
2. Điền:
   - Email: `admin@lifepro.vn` (hoặc email bạn muốn)
   - Password: `admin123456`
   - Auto Confirm User: **BẬT** (tick)
3. Click **Create user**

**Hệ thống tự động gán quyền Admin cho user đầu tiên!**

## Bước 4: Lấy thông tin kết nối
Vào **Settings** → **API**:
- `Project URL` → Copy
- `anon public` key → Copy
- `service_role secret` key → Copy (giữ bí mật!)

## Bước 5: Deploy lên Vercel
1. Push code lên GitHub
2. Vào https://vercel.com → **Add New Project**
3. Import repository
4. Thêm 3 biến môi trường:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = anon public
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role secret
5. Click **Deploy**

## Bước 6: Đăng nhập
1. Vào `https://ten-du-an.vercel.app`
2. Đăng nhập bằng:
   - Email: `admin@lifepro.vn`
   - Password: `admin123456`
3. **Đổi mật khẩu ngay sau khi đăng nhập lần đầu!**

---

## Lưu ý bảo mật
- ⚠️ **Đổi password admin ngay sau khi setup**
- ⚠️ **Không share `service_role secret` key**
- ⚠️ Bật RLS (Row Level Security) cho tất cả bảng
- ⚠️ Backup database định kỳ

## Hỗ trợ
- Nếu quên mật khẩu: Reset qua Supabase Dashboard → Authentication → Users
- Nếu cần tạo thêm user: Vào **Cài đặt** → **Quản lý người dùng**
