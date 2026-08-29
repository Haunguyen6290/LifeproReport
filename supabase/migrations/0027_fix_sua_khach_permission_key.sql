-- 0027_fix_sua_khach_permission_key.sql
-- Sửa lệch phím quyền: UI/RLS dùng 'sua_khach_bat_ky' nhưng Phân quyền lại lưu 'sua_khach_hang'.
-- Với mọi vai trò đã tích 'sua_khach_hang' -> thêm 'sua_khach_bat_ky' để không mất quyền đã cấu hình.

update public.roles
set permissions = (
  select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
  from jsonb_array_elements_text(
    permissions - 'sua_khach_hang' || '["sua_khach_bat_ky"]'::jsonb
  ) value
)
where permissions ? 'sua_khach_hang';
