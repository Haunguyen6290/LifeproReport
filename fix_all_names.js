const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) env[key.trim()] = valueParts.join('=').trim();
});

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log('=== TỰ ĐỘNG SỬA TÊN KHÁCH HÀNG ===\n');

  // Lấy tất cả từ customers (bảng chính)
  const { data: customers } = await db.from('customers').select('ma_kh, ten_kh');

  // Lấy tất cả từ customer_base_balance
  const { data: baseBalance } = await db.from('customer_base_balance').select('ma_kh, ten_kh');

  if (!customers || !baseBalance) {
    console.error('❌ Lỗi query dữ liệu');
    process.exit(1);
  }

  // Map customers
  const custMap = new Map();
  customers.forEach(c => {
    if (c.ma_kh) custMap.set(c.ma_kh, c.ten_kh || '');
  });

  // Tìm tên không khớp
  const toFix = [];
  baseBalance.forEach(b => {
    if (!b.ma_kh) return;
    const tenDung = custMap.get(b.ma_kh);
    if (tenDung && tenDung !== (b.ten_kh || '')) {
      toFix.push({ ma_kh: b.ma_kh, ten_dung: tenDung, ten_sai: b.ten_kh || '' });
    }
  });

  if (toFix.length === 0) {
    console.log('✓ Không có gì cần sửa!');
    process.exit(0);
  }

  console.log(`Tìm thấy ${toFix.length} khách cần sửa tên:\n`);
  toFix.forEach((k, i) => {
    console.log(`${i + 1}. ${k.ma_kh}: "${k.ten_sai}" → "${k.ten_dung}"`);
  });

  console.log('\n⏳ Đang sửa...\n');

  let success = 0;
  let failed = 0;

  for (const k of toFix) {
    const { error } = await db
      .from('customer_base_balance')
      .update({ ten_kh: k.ten_dung })
      .eq('ma_kh', k.ma_kh);

    if (error) {
      console.log(`❌ ${k.ma_kh}: ${error.message}`);
      failed++;
    } else {
      console.log(`✓ ${k.ma_kh}: đã sửa`);
      success++;
    }
  }

  console.log(`\n=== KẾT QUẢ ===`);
  console.log(`✓ Thành công: ${success}`);
  if (failed > 0) console.log(`❌ Thất bại: ${failed}`);
  console.log('\n💯 XONG! Bây giờ module Tài chính sẽ hiển thị đúng tên.');
})();
