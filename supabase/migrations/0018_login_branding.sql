-- 0018_login_branding.sql
-- Cá nhân hoá trang đăng nhập: dòng chào mừng, phụ đề và logo — mỗi dự án một kiểu.
-- Trang đăng nhập đọc qua API route (service role) nên KHÔNG cần mở quyền anon đọc settings.

insert into public.settings (key, value) values
 ('LOGIN_TITLE', 'Chào mừng anh chị em Lifepro'),
 ('LOGIN_SUBTITLE', 'Vui lòng đăng nhập để sử dụng hệ thống'),
 ('LOGO_URL', '')
on conflict (key) do nothing;
