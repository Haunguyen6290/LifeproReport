-- 0002_login_by_username.sql — cho phép đăng nhập bằng tên đăng nhập (username)
-- Nhân viên quen hệ thống cũ gõ "admin" thay vì email.
-- Hàm security definer trả về email ứng với username để app gọi Supabase signIn.
create or replace function public.email_for_username(uname text)
returns text
language sql stable security definer set search_path = public
as $$
  select au.email
  from public.profiles p
  join auth.users au on au.id = p.id
  where p.username = lower(trim(coalesce(uname, '')))
    and p.status = 'ACTIVE';
$$;
