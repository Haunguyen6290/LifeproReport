-- ===================================================================
-- Migration 0075: Bang app_releases — tu cap nhat phien ban (OTA noi bo)
-- App hoi ngam "co ban moi khong", tai APK tu Storage bucket 'apks'
-- Quyet dinh: app goi Supabase bang service_role key (nhung qua
--   BuildConfig.SUPABASE_KEY tu local.properties, khong hardcode source).
--   Bang chi mo cho service_role — khong mo policy cho anon.
--   (anon INSERT vao boxes tung bi RLS chan 42501 du da tao policy +
--   grant, nen giu service_role cho ca 2 bang cho dong bo)
-- Chuan policy theo du an: using (auth.role() = 'service_role')
--   (tuong duong FOR ALL TO service_role, chay on dinh moi Postgres)
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.app_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- App nao: 'lifepro' hoac 'jido' (dung chung 1 bang cho ca 2)
    app_id TEXT NOT NULL CHECK (app_id IN ('lifepro', 'jido')),

    version_code INTEGER NOT NULL,
    version_name TEXT NOT NULL,
    apk_path TEXT NOT NULL,

    release_notes TEXT NOT NULL DEFAULT '',

    -- true = ep cai (ban va loi nghiem trong)
    force_update BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_app_version UNIQUE (app_id, version_code)
);

CREATE INDEX IF NOT EXISTS idx_releases_app_active
    ON public.app_releases(app_id, is_active) WHERE is_active = true;

-- RLS: chi service_role (app + backend), khong mo cho anon
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_releases service all" ON public.app_releases;
CREATE POLICY "app_releases service all" ON public.app_releases
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.app_releases IS 'Danh sach ban phat hanh de app tu kiem tra cap nhat (OTA noi bo, khong qua CH Play). Chi service_role doc/ghi.';

-- ===================================================================
-- Storage bucket 'apks' (Private) — tao luon trong migration, khong lam tay
-- ===================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('apks', 'apks', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='apks service read') THEN
    CREATE POLICY "apks service read" ON storage.objects
      FOR SELECT TO service_role USING (bucket_id = 'apks');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='apks service write') THEN
    CREATE POLICY "apks service write" ON storage.objects
      FOR ALL TO service_role USING (bucket_id = 'apks') WITH CHECK (bucket_id = 'apks');
  END IF;
END $$;
