// scripts/create-admin.mjs
// Tạo tài khoản admin đầu tiên (admin / 123456, bắt buộc đổi khi đăng nhập lần đầu).
// Chạy SAU khi migration 0001_init.sql đã chạy:  node scripts/create-admin.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = 'admin@congty.local';
const PASSWORD = '123456';

const { data, error } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { username: 'admin', full_name: 'Quản trị viên' },
});
if (error) {
  if (String(error.message).includes('already')) {
    console.log('Admin đã tồn tại — bỏ qua tạo user.');
  } else {
    console.error('LỖI tạo user:', error.message);
    process.exit(1);
  }
}
const userId = data?.user?.id;

// Lấy id user nếu vừa bỏ qua bước tạo
let id = userId;
if (!id) {
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
  id = list?.users?.find((u) => u.email === EMAIL)?.id;
}
if (!id) {
  console.error('Không tìm thấy user admin.');
  process.exit(1);
}

const { data: role, error: roleErr } = await supabase.from('roles').select('id').eq('name', 'ADMIN').single();
if (roleErr || !role) {
  console.error('Chưa có vai trò ADMIN — migration chưa chạy? Lỗi:', roleErr?.message);
  process.exit(1);
}

const { error: profErr } = await supabase.from('profiles').upsert(
  { id, username: 'admin', full_name: 'Quản trị viên', role_id: role.id, must_change_password: true },
  { onConflict: 'id' },
);
if (profErr) {
  console.error('LỖI tạo profile:', profErr.message);
  process.exit(1);
}

console.log('✅ Admin sẵn sàng: đăng nhập admin / 123456 (email ' + EMAIL + ') — bắt buộc đổi mật khẩu lần đầu.');
