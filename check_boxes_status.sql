-- Kiểm tra bảng boxes và quyền
SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'boxes') as table_exists,
    (SELECT permissions FROM public.roles WHERE name = 'Giám đốc') as giamdoc_permissions;
