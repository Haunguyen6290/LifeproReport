-- ===================================================================
-- Migration 0067: Tạo tài khoản admin mặc định
-- Tạo ngày: 2026-09-30
-- Mục đích: Tự động tạo admin@lifepro.vn / admin123456 khi setup mới
-- ===================================================================

-- 1. Đảm bảo có role admin
INSERT INTO roles (id, name, description, permissions)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Admin',
  'Quản trị viên hệ thống',
  ARRAY['quan_ly_cai_dat', 'xem_tai_chinh', 'ke_toan', 'xem_box']
)
ON CONFLICT (id) DO UPDATE SET
  permissions = EXCLUDED.permissions;

-- 2. Tạo profile admin mặc định (chờ auth.users được tạo thủ công)
-- Lưu ý: Không thể tạo trực tiếp vào auth.users qua SQL
-- Phải dùng Supabase Dashboard hoặc API

-- 3. Function tự động gán role admin cho user đầu tiên
CREATE OR REPLACE FUNCTION auto_assign_first_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Nếu đây là user đầu tiên trong hệ thống
  IF (SELECT COUNT(*) FROM profiles) = 0 THEN
    NEW.role_id = '00000000-0000-0000-0000-000000000001'; -- Admin role
    NEW.full_name = 'Administrator';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger tự động gán admin cho user đầu tiên
DROP TRIGGER IF EXISTS trigger_auto_first_admin ON profiles;
CREATE TRIGGER trigger_auto_first_admin
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_first_admin();

COMMENT ON FUNCTION auto_assign_first_admin IS 'Tự động gán role Admin cho user đầu tiên đăng ký';
