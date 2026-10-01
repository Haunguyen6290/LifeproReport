#!/usr/bin/env node
/**
 * Script tạo tài khoản admin mặc định
 * Username: admin
 * Password: 123456
 * Chạy: node scripts/create-default-admin.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createDefaultAdmin() {
  console.log('🚀 Bắt đầu tạo tài khoản admin mặc định...');

  // 1. Kiểm tra xem đã có admin chưa
  const { data: existingProfiles, error: checkError } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);

  if (checkError) {
    console.error('❌ Lỗi kiểm tra profiles:', checkError.message);
    process.exit(1);
  }

  if (existingProfiles && existingProfiles.length > 0) {
    console.log('ℹ️  Đã có user trong hệ thống. Bỏ qua việc tạo admin mặc định.');
    return;
  }

  // 2. Tạo user trong auth.users (dùng email nội bộ vì Supabase bắt buộc format email)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'admin@internal.local',
    password: '123456',
    email_confirm: true,
    user_metadata: {
      full_name: 'Administrator'
    }
  });

  if (authError) {
    console.error('❌ Lỗi tạo auth user:', authError.message);
    process.exit(1);
  }

  console.log('✅ Đã tạo auth user:', authData.user.id);

  // 3. Đảm bảo có role Admin với đầy đủ quyền (gộp với quyền đã có, không ghi đè)
  const FULL_ADMIN_PERMS = [
    "ket_luan", "quan_ly_chien_dich", "import_khach", "xoa_khach",
    "sua_khach_bat_ky", "chuyen_khach_hang_loat",
    "quan_ly_nguoi_dung", "quan_ly_danh_muc", "quan_ly_cai_dat", "xem_log",
    "quan_ly_okr", "xem_okr", "bao_cao_tuan", "bao_cao_kho", "bao_cao_ban_hang",
    "xem_tai_chinh", "import_tai_chinh", "ke_toan",
    "xem_hoat_dong_ns", "xem_box", "xem_khach_hang"
  ];
  // Ưu tiên role ADMIN gốc (do migration 0001 seed), fallback sang id cố định cũ
  const { data: existingRole } = await supabase
    .from('roles')
    .select('id, permissions')
    .eq('name', 'ADMIN')
    .maybeSingle();
  const ADMIN_ROLE_ID = existingRole?.id ?? '00000000-0000-0000-0000-000000000001';
  const mergedPerms = [...new Set([...(existingRole?.permissions ?? []), ...FULL_ADMIN_PERMS])];
  const { error: roleError } = await supabase
    .from('roles')
    .upsert({
      id: ADMIN_ROLE_ID,
      name: existingRole ? 'ADMIN' : 'Admin',
      description: 'Quản trị viên hệ thống',
      permissions: mergedPerms
    }, { onConflict: 'id' });

  if (roleError) {
    console.error('❌ Lỗi tạo role Admin:', roleError.message);
  } else {
    console.log('✅ Đã tạo/cập nhật role Admin');
  }

  // 4. Tạo profile với role Admin
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      username: 'admin',
      full_name: 'Administrator',
      role_id: ADMIN_ROLE_ID,
      must_change_password: true,
      status: 'ACTIVE'
    });

  if (profileError) {
    console.error('❌ Lỗi tạo profile:', profileError.message);
    process.exit(1);
  }

  console.log('✅ Đã tạo profile admin');
  console.log('');
  console.log('🎉 HOÀN TẤT! Thông tin đăng nhập:');
  console.log('   Username: admin');
  console.log('   Password: 123456');
  console.log('   ⚠️  Bắt buộc đổi password sau lần đăng nhập đầu tiên');
}

createDefaultAdmin().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
