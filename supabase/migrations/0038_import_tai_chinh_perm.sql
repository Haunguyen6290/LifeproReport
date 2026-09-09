-- 0038_import_tai_chinh_perm.sql
-- Tách quyền "Import Excel Tài chính (sổ 131)" thành permission riêng (import_tai_chinh),
-- thay vì buộc kế toán phải có "Quản lý cài đặt". Seed cho vai trò ADMIN.

do $$ begin
  if exists (select 1 from public.roles where name = 'ADMIN')
     and not exists (select 1 from jsonb_array_elements_text((select permissions from public.roles where name='ADMIN')) e where e = 'import_tai_chinh') then
    update public.roles set permissions = (permissions || '["import_tai_chinh"]'::jsonb) where name = 'ADMIN';
  end if;
end $$;
