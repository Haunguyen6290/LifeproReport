const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const db = createClient(URL, KEY);

(async () => {
  const searchTerm = process.argv[2] || 'tú mơ';
  console.log(`=== TÌM KIẾM: "${searchTerm}" ===\n`);

  // Search in customers table
  const { data: customers } = await db
    .from('customers')
    .select('id, ma_kh, ten_kh, dien_thoai, dia_chi, created_at')
    .ilike('ten_kh', `%${searchTerm}%`);

  console.log('1. Bảng CUSTOMERS (Khách hàng):');
  if (customers && customers.length > 0) {
    customers.forEach(c => {
      console.log(`   ✓ Mã: ${c.ma_kh} | Tên: ${c.ten_kh}`);
      console.log(`     SĐT: ${c.dien_thoai || 'N/A'} | Địa chỉ: ${c.dia_chi || 'N/A'}`);
    });
  } else {
    console.log('   ✗ Không tìm thấy');
  }

  // Search in sales_rows (131 data)
  console.log('\n2. Bảng SALES_ROWS (Sổ 131):');
  const { data: sales131 } = await db
    .from('sales_rows')
    .select('ma_kh, ten_kh, so_ct, ngay_ct, tien')
    .ilike('ten_kh', `%${searchTerm}%`)
    .order('ngay_ct', { ascending: false })
    .limit(5);

  if (sales131 && sales131.length > 0) {
    console.log(`   Tìm thấy ${sales131.length} dòng (5 mới nhất):`);
    sales131.forEach(s => {
      console.log(`   - ${s.ngay_ct} | ${s.ma_kh} | ${s.so_ct} | ${(s.tien || 0).toLocaleString('vi-VN')}đ`);
    });
  } else {
    console.log('   ✗ Không tìm thấy');
  }

  // Search in amis_sales_rows
  console.log('\n3. Bảng AMIS_SALES_ROWS (AMIS - Import từ Odoo):');
  const { data: amis } = await db
    .from('amis_sales_rows')
    .select('ma_kh, ten_khach_hang, so_ct, ngay_hach_toan, thanh_tien')
    .ilike('ten_khach_hang', `%${searchTerm}%`)
    .order('ngay_hach_toan', { ascending: false })
    .limit(5);

  if (amis && amis.length > 0) {
    console.log(`   Tìm thấy ${amis.length} dòng (5 mới nhất):`);
    amis.forEach(a => {
      console.log(`   - ${a.ngay_hach_toan} | ${a.ma_kh} | ${a.so_ct} | ${(a.thanh_tien || 0).toLocaleString('vi-VN')}đ`);
    });
  } else {
    console.log('   ✗ Không tìm thấy');
  }
})();
