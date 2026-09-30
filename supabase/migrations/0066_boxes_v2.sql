-- ===================================================================
-- Migration 0066: Quản lý Android Box Lifepro SmartVOICE
-- Tạo ngày: 2026-09-30
-- Mục đích: Theo dõi các box đã bán, quản lý kích hoạt
-- Cập nhật: 2026-09-30 - Thêm ALTER TABLE để tương thích với bảng đã tồn tại
-- ===================================================================

-- 1. Tạo bảng boxes (nếu chưa có) - chỉ cột ID
CREATE TABLE IF NOT EXISTS boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- 2. Thêm các cột mới nếu bảng đã tồn tại (từ migration cũ)
-- Cột định danh
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS android_id TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS imei TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- Cột thiết bị cơ bản
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS box_name TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS device_model TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS device_manufacturer TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS android_version TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS android_sdk_int INTEGER;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS app_version_code INTEGER;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS app_version_name TEXT;

-- Cột CPU
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS cpu_name TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS cpu_max_freq TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS cpu_abi TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS cpu_cores INTEGER;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS ram_total_gb INTEGER;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS storage_total_gb INTEGER;

-- Cột build info
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS build_fingerprint TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS build_brand TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS build_product TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS locale TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS network_operator TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS network_country TEXT;

-- Cột khách hàng
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS vehicle_info TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS dealer_name TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS installation_date DATE;

-- Cột kích hoạt
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS activation_code TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS is_activated BOOLEAN DEFAULT FALSE;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ;

-- Cột trạng thái
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS warranty_until DATE;
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS notes TEXT;

-- Cột timestamp
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Cột metadata
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Cập nhật giá trị mặc định cho status
UPDATE boxes SET status = 'active' WHERE status IS NULL;
ALTER TABLE boxes ALTER COLUMN status SET DEFAULT 'active';

-- 4. Thêm/Cập nhật constraints
DO $$
BEGIN
    -- Xóa constraint cũ nếu có (để tránh lỗi duplicate)
    ALTER TABLE boxes DROP CONSTRAINT IF EXISTS unique_identifiers;
    ALTER TABLE boxes DROP CONSTRAINT IF EXISTS at_least_one_identifier;
    ALTER TABLE boxes DROP CONSTRAINT IF EXISTS valid_status;

    -- Thêm lại constraint mới
    ALTER TABLE boxes ADD CONSTRAINT unique_identifiers
        UNIQUE NULLS NOT DISTINCT (android_id, imei, serial_number);

    ALTER TABLE boxes ADD CONSTRAINT at_least_one_identifier
        CHECK (android_id IS NOT NULL OR serial_number IS NOT NULL);

    ALTER TABLE boxes ADD CONSTRAINT valid_status
        CHECK (status IN ('active', 'inactive', 'warranty', 'returned', 'defective'));
END $$;

-- 5. Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_boxes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_boxes_updated_at ON boxes;
CREATE TRIGGER trigger_boxes_updated_at
    BEFORE UPDATE ON boxes
    FOR EACH ROW
    EXECUTE FUNCTION update_boxes_updated_at();

-- 6. Index cho tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_boxes_android_id ON boxes(android_id) WHERE android_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_imei ON boxes(imei) WHERE imei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_serial ON boxes(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_activation_code ON boxes(activation_code) WHERE activation_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_first_seen ON boxes(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_boxes_last_seen ON boxes(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_boxes_is_activated ON boxes(is_activated);
CREATE INDEX IF NOT EXISTS idx_boxes_status ON boxes(status);
CREATE INDEX IF NOT EXISTS idx_boxes_customer_phone ON boxes(customer_phone) WHERE customer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_dealer_name ON boxes(dealer_name) WHERE dealer_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_box_name ON boxes(box_name) WHERE box_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_metadata_gin ON boxes USING gin(metadata);

-- 7. Bật Row Level Security (RLS)
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;

-- 8. Xóa policy cũ nếu có
DROP POLICY IF EXISTS "Allow service role to insert" ON boxes;
DROP POLICY IF EXISTS "Allow service role to select" ON boxes;
DROP POLICY IF EXISTS "Allow service role to update" ON boxes;
DROP POLICY IF EXISTS "Allow authenticated read access" ON boxes;
DROP POLICY IF EXISTS "Allow authenticated update" ON boxes;

-- 9. Tạo lại policy
CREATE POLICY "Allow service role to insert" ON boxes
    FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Allow service role to select" ON boxes
    FOR SELECT TO service_role USING (true);

CREATE POLICY "Allow service role to update" ON boxes
    FOR UPDATE TO service_role USING (true);

CREATE POLICY "Allow authenticated read access" ON boxes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated update" ON boxes
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 10. Comment giải thích
COMMENT ON TABLE boxes IS 'Theo dõi các box Lifepro SmartVOICE đã bán - dữ liệu tự động từ app Android + thông tin khách hàng nhập tay';
COMMENT ON COLUMN boxes.android_id IS 'Settings.Secure.ANDROID_ID - định danh duy nhất (99% trường hợp)';
COMMENT ON COLUMN boxes.imei IS 'IMEI thiết bị (thường trống vì app không có quyền READ_PHONE_STATE)';
COMMENT ON COLUMN boxes.serial_number IS 'Build.SERIAL - có thể trùng lặp giữa các box Trung Quốc';
COMMENT ON COLUMN boxes.box_name IS 'Tên tùy chỉnh cho box (VD: "Box Xe Audi - HN001") - nhập tay từ dashboard';
COMMENT ON COLUMN boxes.device_model IS 'Tên model hiển thị (tự động từ app)';
COMMENT ON COLUMN boxes.device_manufacturer IS 'Nhà sản xuất chipset (tự động)';
COMMENT ON COLUMN boxes.ram_total_gb IS 'Tổng RAM làm tròn (GB) - app gửi 8, 4, 2... (tự động)';
COMMENT ON COLUMN boxes.storage_total_gb IS 'Tổng bộ nhớ làm tròn (GB) - app gửi 128, 64, 32... (tự động)';
COMMENT ON COLUMN boxes.cpu_name IS 'Tên CPU đầy đủ (VD: "Qualcomm Snapdragon 680") - tự động từ app';
COMMENT ON COLUMN boxes.cpu_max_freq IS 'Tần số CPU tối đa (VD: "2.40 GHz") - tự động từ app';
COMMENT ON COLUMN boxes.cpu_abi IS 'Kiến trúc CPU hỗ trợ (tự động, VD: "arm64-v8a")';
COMMENT ON COLUMN boxes.cpu_cores IS 'Số lõi CPU (tự động)';
COMMENT ON COLUMN boxes.customer_name IS 'Tên khách hàng (nhập tay)';
COMMENT ON COLUMN boxes.customer_phone IS 'SĐT khách hàng (nhập tay)';
COMMENT ON COLUMN boxes.vehicle_info IS 'Thông tin xe lắp đặt (nhập tay, VD: "Audi A4 2020 - 30A-12345")';
COMMENT ON COLUMN boxes.dealer_name IS 'Đại lý bán hàng (nhập tay hoặc auto-fill)';
COMMENT ON COLUMN boxes.activation_code IS 'Mã kích hoạt từ admin (null = chưa kích hoạt)';
COMMENT ON COLUMN boxes.is_activated IS 'Trạng thái kích hoạt (true/false)';
COMMENT ON COLUMN boxes.activation_expires_at IS 'Thời hạn kích hoạt (null = vĩnh viễn)';
COMMENT ON COLUMN boxes.status IS 'Trạng thái box: active (hoạt động), inactive (ngừng), warranty (bảo hành), returned (trả lại), defective (lỗi)';
COMMENT ON COLUMN boxes.warranty_until IS 'Ngày hết hạn bảo hành';
COMMENT ON COLUMN boxes.notes IS 'Ghi chú quản lý (nhập tay)';
COMMENT ON COLUMN boxes.metadata IS 'JSON linh hoạt: GPS lần đầu, build info chi tiết, lịch sử sửa chữa...';

-- 11. View thống kê tổng quan
CREATE OR REPLACE VIEW boxes_summary AS
SELECT
    COUNT(*) AS total_boxes,
    COUNT(*) FILTER (WHERE is_activated = true) AS activated_boxes,
    COUNT(*) FILTER (WHERE is_activated = false) AS pending_activation,
    COUNT(*) FILTER (WHERE status = 'active') AS active_boxes,
    COUNT(*) FILTER (WHERE status = 'warranty') AS warranty_boxes,
    COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '7 days') AS active_last_7days,
    COUNT(*) FILTER (WHERE first_seen_at > NOW() - INTERVAL '30 days') AS new_boxes_30days,
    AVG(ram_total_gb)::INTEGER AS avg_ram_gb,
    AVG(storage_total_gb)::INTEGER AS avg_storage_gb
FROM boxes;

COMMENT ON VIEW boxes_summary IS 'Thống kê tổng quan số lượng box, kích hoạt, hoạt động...';

-- 12. Function tìm kiếm nâng cao
CREATE OR REPLACE FUNCTION search_boxes(search_term TEXT)
RETURNS TABLE (
    id UUID,
    box_name TEXT,
    device_model TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    android_id TEXT,
    is_activated BOOLEAN,
    last_seen_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.box_name,
        b.device_model,
        b.customer_name,
        b.customer_phone,
        b.android_id,
        b.is_activated,
        b.last_seen_at
    FROM boxes b
    WHERE
        b.box_name ILIKE '%' || search_term || '%' OR
        b.customer_name ILIKE '%' || search_term || '%' OR
        b.customer_phone ILIKE '%' || search_term || '%' OR
        b.android_id ILIKE '%' || search_term || '%' OR
        b.imei ILIKE '%' || search_term || '%' OR
        b.activation_code ILIKE '%' || search_term || '%' OR
        b.vehicle_info ILIKE '%' || search_term || '%'
    ORDER BY b.last_seen_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION search_boxes IS 'Tìm kiếm box theo tên, khách hàng, SĐT, android_id, IMEI, mã kích hoạt...';
