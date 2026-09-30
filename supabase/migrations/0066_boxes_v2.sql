-- ===================================================================
-- Migration 0066: Quản lý Android Box Lifepro SmartVOICE
-- Tạo ngày: 2026-09-30
-- Mục đích: Theo dõi các box đã bán, quản lý kích hoạt
-- ===================================================================

-- 1. Tạo bảng boxes
CREATE TABLE IF NOT EXISTS boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ============ THÔNG TIN ĐỊNH DANH ============
    android_id TEXT,
    imei TEXT,
    serial_number TEXT,

    -- ============ THÔNG TIN THIẾT BỊ CƠ BẢN ============
    box_name TEXT,                           -- Tên đặt cho box (VD: "Box Xe Audi A4 - HN001")
    device_model TEXT NOT NULL,              -- Tên model hiển thị (VD: "Lifepro SmartBOX", "T95 MAX")
    device_manufacturer TEXT NOT NULL,       -- Nhà sản xuất (VD: "QUALCOMM", "Allwinner")
    android_version TEXT NOT NULL,           -- Phiên bản Android (VD: "16", "12")
    android_sdk_int INTEGER,                 -- SDK level (VD: 34, 31)

    -- ============ THÔNG TIN APP ============
    app_version_code INTEGER NOT NULL,       -- Version code (VD: 42)
    app_version_name TEXT NOT NULL,          -- Version name (VD: "2.5.6")

    -- ============ CẤU HÌNH PHẦN CỨNG ============
    -- CPU (thêm trường cpu_name và cpu_max_freq từ app)
    cpu_name TEXT,                           -- Tên CPU (VD: "Qualcomm Snapdragon 680")
    cpu_max_freq TEXT,                       -- Tần số tối đa (VD: "2.40 GHz")
    cpu_abi TEXT,                            -- Kiến trúc CPU (VD: "arm64-v8a, armeabi-v7a")
    cpu_cores INTEGER,                       -- Số lõi CPU (VD: 8)

    -- RAM và Storage (đơn vị GB để khớp với app Android)
    ram_total_gb INTEGER,                    -- Tổng RAM (GB) (VD: 8, 4, 2)
    storage_total_gb INTEGER,                -- Tổng bộ nhớ trong (GB) (VD: 128, 64, 32)

    -- ============ THÔNG TIN HỆ THỐNG ============
    build_fingerprint TEXT,                  -- Build fingerprint đầy đủ
    build_brand TEXT,                        -- Thương hiệu (VD: "Xiaomi", "generic")
    build_product TEXT,                      -- Tên sản phẩm
    locale TEXT,                             -- Ngôn ngữ (VD: "vi_VN")
    timezone TEXT,                           -- Múi giờ (VD: "Asia/Ho_Chi_Minh")

    -- ============ THÔNG TIN MẠNG ============
    network_operator TEXT,                   -- Nhà mạng (VD: "Viettel", "Vinaphone")
    network_country TEXT,                    -- Mã quốc gia (VD: "vn")

    -- ============ THÔNG TIN KHÁCH HÀNG ============
    customer_name TEXT,                      -- Tên khách hàng
    customer_phone TEXT,                     -- SĐT khách hàng
    customer_address TEXT,                   -- Địa chỉ lắp đặt
    vehicle_info TEXT,                       -- Thông tin xe (VD: "Audi A4 2020 - 30A-12345")
    dealer_name TEXT,                        -- Đại lý bán hàng
    installation_date DATE,                  -- Ngày lắp đặt

    -- ============ QUẢN LÝ KÍCH HOẠT ============
    activation_code TEXT,                    -- Mã kích hoạt (null = chưa có)
    is_activated BOOLEAN DEFAULT FALSE,      -- Đã kích hoạt chưa
    activated_at TIMESTAMPTZ,                -- Thời điểm kích hoạt
    activation_expires_at TIMESTAMPTZ,       -- Thời hạn kích hoạt (nếu có)

    -- ============ TRẠNG THÁI VÀ GHI CHÚ ============
    status TEXT DEFAULT 'active',            -- Trạng thái: active, inactive, warranty, returned
    warranty_until DATE,                     -- Bảo hành đến ngày
    notes TEXT,                              -- Ghi chú quản lý

    -- ============ TIMESTAMP ============
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ============ METADATA BỔ SUNG ============
    metadata JSONB DEFAULT '{}'::jsonb,      -- Dữ liệu linh hoạt khác (GPS, build info chi tiết...)

    -- ============ CONSTRAINTS ============
    CONSTRAINT unique_identifiers UNIQUE NULLS NOT DISTINCT (android_id, imei, serial_number),
    CONSTRAINT at_least_one_identifier CHECK (android_id IS NOT NULL OR imei IS NOT NULL OR serial_number IS NOT NULL),
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'warranty', 'returned', 'defective'))
);

-- 2. Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_boxes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_boxes_updated_at
    BEFORE UPDATE ON boxes
    FOR EACH ROW
    EXECUTE FUNCTION update_boxes_updated_at();

-- 3. Index cho tìm kiếm nhanh
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

-- Index cho metadata JSONB (tìm kiếm theo các trường bên trong JSON)
CREATE INDEX IF NOT EXISTS idx_boxes_metadata_gin ON boxes USING gin(metadata);

-- 4. Bật Row Level Security (RLS)
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;

-- 5. Policy: Cho phép INSERT từ service role key (app Android)
CREATE POLICY "Allow service role to insert" ON boxes
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- 6. Policy: Cho phép SELECT/UPDATE từ service role key
CREATE POLICY "Allow service role to select" ON boxes
    FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "Allow service role to update" ON boxes
    FOR UPDATE
    TO service_role
    USING (true);

-- 7. Policy: Dashboard web có thể đọc mọi row (authenticated users có quyền)
CREATE POLICY "Allow authenticated read access" ON boxes
    FOR SELECT
    TO authenticated
    USING (true);
    -- Nếu cần kiểm tra quyền: USING (public.has_permission('xem_box') OR public.has_permission('quan_ly_cai_dat'));

-- 8. Policy: Authenticated users có quyền cập nhật
CREATE POLICY "Allow authenticated update" ON boxes
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
    -- Nếu cần kiểm tra quyền: USING (public.has_permission('quan_ly_box')) WITH CHECK (public.has_permission('quan_ly_box'));

-- 9. Comment giải thích
COMMENT ON TABLE boxes IS 'Theo dõi các box Lifepro SmartVOICE đã bán - dữ liệu tự động từ app Android + thông tin khách hàng nhập tay';

-- Định danh
COMMENT ON COLUMN boxes.android_id IS 'Settings.Secure.ANDROID_ID - định danh duy nhất (99% trường hợp)';
COMMENT ON COLUMN boxes.imei IS 'IMEI thiết bị (cần quyền READ_PHONE_STATE)';
COMMENT ON COLUMN boxes.serial_number IS 'Build.SERIAL - có thể trùng lặp giữa các box Trung Quốc';

-- Thông tin cơ bản
COMMENT ON COLUMN boxes.box_name IS 'Tên tùy chỉnh cho box (VD: "Box Xe Audi - HN001") - nhập tay từ dashboard';
COMMENT ON COLUMN boxes.device_model IS 'Tên model hiển thị (tự động từ app)';
COMMENT ON COLUMN boxes.device_manufacturer IS 'Nhà sản xuất chipset (tự động)';

-- Cấu hình phần cứng
COMMENT ON COLUMN boxes.ram_total_gb IS 'Tổng RAM làm tròn (GB) - app gửi 8, 4, 2... (tự động)';
COMMENT ON COLUMN boxes.storage_total_gb IS 'Tổng bộ nhớ làm tròn (GB) - app gửi 128, 64, 32... (tự động)';
COMMENT ON COLUMN boxes.cpu_name IS 'Tên CPU đầy đủ (VD: "Qualcomm Snapdragon 680") - tự động từ app';
COMMENT ON COLUMN boxes.cpu_max_freq IS 'Tần số CPU tối đa (VD: "2.40 GHz") - tự động từ app';
COMMENT ON COLUMN boxes.cpu_abi IS 'Kiến trúc CPU hỗ trợ (tự động, VD: "arm64-v8a")';
COMMENT ON COLUMN boxes.cpu_cores IS 'Số lõi CPU (tự động)';

-- Khách hàng
COMMENT ON COLUMN boxes.customer_name IS 'Tên khách hàng (nhập tay)';
COMMENT ON COLUMN boxes.customer_phone IS 'SĐT khách hàng (nhập tay)';
COMMENT ON COLUMN boxes.vehicle_info IS 'Thông tin xe lắp đặt (nhập tay, VD: "Audi A4 2020 - 30A-12345")';
COMMENT ON COLUMN boxes.dealer_name IS 'Đại lý bán hàng (nhập tay hoặc auto-fill)';

-- Kích hoạt
COMMENT ON COLUMN boxes.activation_code IS 'Mã kích hoạt từ admin (null = chưa kích hoạt)';
COMMENT ON COLUMN boxes.is_activated IS 'Trạng thái kích hoạt (true/false)';
COMMENT ON COLUMN boxes.activation_expires_at IS 'Thời hạn kích hoạt (null = vĩnh viễn)';

-- Trạng thái
COMMENT ON COLUMN boxes.status IS 'Trạng thái box: active (hoạt động), inactive (ngừng), warranty (bảo hành), returned (trả lại), defective (lỗi)';
COMMENT ON COLUMN boxes.warranty_until IS 'Ngày hết hạn bảo hành';
COMMENT ON COLUMN boxes.notes IS 'Ghi chú quản lý (nhập tay)';

-- Metadata
COMMENT ON COLUMN boxes.metadata IS 'JSON linh hoạt: GPS lần đầu, build info chi tiết, lịch sử sửa chữa...';

-- 10. View thống kê tổng quan
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

-- 11. Function tìm kiếm nâng cao
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
