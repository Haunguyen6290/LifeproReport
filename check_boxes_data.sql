-- Kiểm tra dữ liệu boxes hiện có
SELECT
    id,
    android_id,
    imei,
    serial_number,
    device_model,
    device_manufacturer,
    android_version,
    app_version_code,
    app_version_name,
    activation_code,
    is_activated,
    first_seen_at,
    last_seen_at,
    activated_at,
    metadata
FROM boxes
ORDER BY first_seen_at DESC
LIMIT 5;

-- Kiểm tra cấu trúc bảng
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'boxes'
ORDER BY ordinal_position;
