import { createClient } from '@supabase/supabase-js';

/** Client server-side với service_role key — bỏ qua RLS. CHỈ dùng trong API route / script, không bao giờ lộ ra trình duyệt. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
