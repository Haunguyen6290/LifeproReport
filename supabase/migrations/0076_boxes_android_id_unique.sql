-- ===================================================================
-- Migration 0076: 1 android_id = 1 box — gop trung + chan tai dien
-- Bo sung unique rieng cho android_id (truoc chi unique bo 3
-- android_id+imei+serial nen cung android_id nhung serial khac nhau
-- van lot thanh nhieu dong).
-- Phan gop du lieu cu da lam 1 lan bang script (2026-10-15): giu dong
-- last_seen moi nhat, gom first_seen som nhat + activation + thong tin
-- khach, xoa dong thua.
-- ===================================================================

-- Xoa unique cu tren bo 3 (thay bang 2 unique rieng ben duoi)
ALTER TABLE public.boxes DROP CONSTRAINT IF EXISTS unique_identifiers;

-- android_id la khoa chuan: 1 box = 1 dong
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'boxes_android_id_unique') THEN
    ALTER TABLE public.boxes ADD CONSTRAINT boxes_android_id_unique UNIQUE (android_id);
  END IF;
END $$;

-- serial co the trong/trung (box TQ) nen chi unique khi co gia tri that
CREATE UNIQUE INDEX IF NOT EXISTS boxes_serial_unique
  ON public.boxes(serial_number) WHERE serial_number IS NOT NULL AND serial_number <> '';

-- Ghi chu cho ben app: upsert theo android_id thay vi INSERT tran
COMMENT ON CONSTRAINT boxes_android_id_unique ON public.boxes IS
  'Khoa chuan 1 box = 1 dong. App upsert onConflict=android_id (co roi thi UPDATE version/serial/last_seen, chua co moi INSERT). Khong gui activation_* tu app.';
