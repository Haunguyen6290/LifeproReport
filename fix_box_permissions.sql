-- Sửa lại phân quyền xem_box cho đúng tên vai trò
DO $$
BEGIN
    -- Thêm quyền xem_box vào ADMIN
    IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'ADMIN')
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text((SELECT permissions FROM public.roles WHERE name='ADMIN')) e WHERE e = 'xem_box') THEN
        UPDATE public.roles SET permissions = (permissions || '["xem_box"]'::jsonb) WHERE name = 'ADMIN';
    END IF;

    -- Thêm quyền xem_box vào GIÁM_ĐỐC
    IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'GIÁM_ĐỐC')
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text((SELECT permissions FROM public.roles WHERE name='GIÁM_ĐỐC')) e WHERE e = 'xem_box') THEN
        UPDATE public.roles SET permissions = (permissions || '["xem_box"]'::jsonb) WHERE name = 'GIÁM_ĐỐC';
    END IF;

    -- Thêm quyền xem_box vào SALES (nếu có)
    IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'SALES')
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text((SELECT permissions FROM public.roles WHERE name='SALES')) e WHERE e = 'xem_box') THEN
        UPDATE public.roles SET permissions = (permissions || '["xem_box"]'::jsonb) WHERE name = 'SALES';
    END IF;
END $$;

-- Kiểm tra kết quả
SELECT name, permissions
FROM public.roles
WHERE name IN ('ADMIN', 'GIÁM_ĐỐC', 'SALES')
ORDER BY name;
