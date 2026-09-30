-- Xem tất cả vai trò và quyền hiện có
SELECT
    id,
    name,
    description,
    permissions,
    is_system,
    created_at
FROM public.roles
ORDER BY
    CASE
        WHEN name = 'ADMIN' THEN 1
        WHEN name = 'Admin' THEN 2
        WHEN name = 'Giám đốc' THEN 3
        WHEN name IN ('SALES', 'Kinh doanh') THEN 4
        ELSE 5
    END,
    name;
