-- 0009_avatar_and_audit_visibility.sql
-- 1) Avatar cho comment/nhật ký: thêm avatar_url vào profiles
-- 2) Nhật ký phải thấy đủ mọi tài khoản: cấp xem_log cho SALES (nếu chưa có)

alter table public.profiles add column if not exists avatar_url text not null default '';

-- Cấp xem_log cho vai trò SALES để nhật ký hiển thị với mọi nhân viên
-- (ADMIN đã có sẵn; các vai trò tự tạo muốn thấy nhật ký thì tick xem_log ở Phân quyền)
update public.roles
set permissions = (
  select jsonb_agg(distinct elem)
  from jsonb_array_elements_text(permissions || '["xem_log"]'::jsonb) as elem
)
where name = 'SALES' and not (permissions ? 'xem_log');

-- Ghi chú: RLS audit_logs hiện là log_read using (true) cho mọi authenticated,
-- nên ADMIN xem được log của SALES và ngược lại nếu có xem_log. Không cần đổi RLS.
