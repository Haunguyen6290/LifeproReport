-- ===================================================================
-- Migration 0066: Quản lý Android Box Lifepro SmartVOICE
-- Tạo ngày: 2026-09-30
-- Mục đích: Theo dõi các box đã bán, quản lý kích hoạt
-- ===================================================================

-- 1. Tạo bảng boxes
CREATE TABLE IF NOT EXISTS boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Thông tin định danh thiết bị (ít nhất 1 trong 3 phải có)
    android_id TEXT,
    imei TEXT,
    serial_number TEXT,

    -- Thông tin thiết bị
    device_model TEXT NOT NULL,              -- Ví dụ: "T95 MAX"
    device_manufacturer TEXT NOT NULL,       -- Ví dụ: "Allwinner"
    android_version TEXT NOT NULL,           -- Ví dụ: "12"

    -- Thông tin app
    app_version_code INTEGER NOT NULL,       -- Ví dụ: 40
    app_version_name TEXT NOT NULL,          -- Ví dụ: "2.5.4"

    -- Mã kích hoạt (nếu có)
    activation_code TEXT,                    -- Để trống nếu chưa có

    -- Trạng thái
    is_activated BOOLEAN DEFAULT FALSE,

    -- Timestamp
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,

    -- Metadata bổ sung (JSON linh hoạt)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Index để tìm kiếm nhanh
    CONSTRAINT unique_identifiers UNIQUE NULLS NOT DISTINCT (android_id, imei, serial_number)
);

-- 2. Index cho tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_boxes_android_id ON boxes(android_id) WHERE android_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_imei ON boxes(imei) WHERE imei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_serial ON boxes(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_activation_code ON boxes(activation_code) WHERE activation_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boxes_first_seen ON boxes(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_boxes_last_seen ON boxes(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_boxes_is_activated ON boxes(is_activated);

-- 3. Bật Row Level Security (RLS)
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Cho phép INSERT từ service role key (app Android)
CREATE POLICY "Allow service role to insert" ON boxes
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- 5. Policy: Cho phép SELECT/UPDATE từ service role key
CREATE POLICY "Allow service role to select" ON boxes
    FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "Allow service role to update" ON boxes
    FOR UPDATE
    TO service_role
    USING (true);

-- 6. Policy: Dashboard web có thể đọc mọi row (dùng anon key hoặc authenticated user)
CREATE POLICY "Allow public read access" ON boxes
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 7. Policy: Authenticated users có quyền xem_box có thể update
CREATE POLICY "Allow authenticated update with permission" ON boxes
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN roles r ON r.id = p.role_id
            WHERE p.id = auth.uid()
            AND r.permissions ? 'xem_box'
        )
    );

-- 8. Comment giải thích
COMMENT ON TABLE boxes IS 'Theo dõi các box Lifepro SmartVOICE đã bán - gửi tự động từ app Android lần đầu chạy';
COMMENT ON COLUMN boxes.android_id IS 'Settings.Secure.ANDROID_ID - định danh duy nhất nhất (99% trường hợp)';
COMMENT ON COLUMN boxes.imei IS 'IMEI thiết bị (cần quyền READ_PHONE_STATE, có thể null trên một số box)';
COMMENT ON COLUMN boxes.serial_number IS 'Build.SERIAL - thường có nhưng có thể trùng lặp giữa các box Trung Quốc';
COMMENT ON COLUMN boxes.activation_code IS 'Mã kích hoạt từ phía admin - để trống khi box chưa được kích hoạt';
COMMENT ON COLUMN boxes.metadata IS 'JSON linh hoạt cho thông tin bổ sung (vị trí GPS lần đầu, tên khách hàng, ghi chú...)';

-- 9. Thêm quyền mới vào các role
DO $$
BEGIN
    -- Thêm quyền xem_box vào Kinh doanh
    UPDATE roles
    SET permissions = permissions || 'xem_box'
    WHERE name = 'Kinh doanh'
    AND NOT (permissions ? 'xem_box');

    -- Thêm quyền xem_box vào Giám đốc
    UPDATE roles
    SET permissions = permissions || 'xem_box'
    WHERE name = 'Giám đốc'
    AND NOT (permissions ? 'xem_box');

    -- Thêm quyền xem_box vào Admin
    UPDATE roles
    SET permissions = permissions || 'xem_box'
    WHERE name = 'Admin'
    AND NOT (permissions ? 'xem_box');
END $$;
