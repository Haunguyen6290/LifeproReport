// Test API box/stats và box/list
// Chạy: node test_box_api.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Thiếu env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. Login với tài khoản test
console.log('1. Đang đăng nhập...');
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'test@example.com', // Thay email/password thực tế
  password: 'test123'
});

if (authError) {
  console.error('Lỗi đăng nhập:', authError.message);
  console.log('Vui lòng sửa email/password trong test_box_api.mjs');
  process.exit(1);
}

const token = authData.session?.access_token;
console.log('✓ Đăng nhập OK, có token');

// 2. Test API stats
console.log('\n2. Test API /api/box/stats...');
const statsRes = await fetch(`${SUPABASE_URL.replace('supabase.co', 'vercel.app')}/api/box/stats`, {
  headers: { Authorization: `Bearer ${token}` }
});
const statsJson = await statsRes.json();
console.log('Status:', statsRes.status);
console.log('Response:', statsJson);

// 3. Test API list
console.log('\n3. Test API /api/box/list...');
const listRes = await fetch(`${SUPABASE_URL.replace('supabase.co', 'vercel.app')}/api/box/list?page=1&limit=10`, {
  headers: { Authorization: `Bearer ${token}` }
});
const listJson = await listRes.json();
console.log('Status:', listRes.status);
console.log('Response:', listJson);

// 4. Check quyền
console.log('\n4. Kiểm tra quyền trong DB...');
const { data: profile } = await supabase
  .from('profiles')
  .select('id, full_name, roles(name, permissions)')
  .eq('id', authData.user.id)
  .single();
console.log('Profile:', profile);
