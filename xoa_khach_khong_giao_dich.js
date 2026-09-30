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
  console.log('=== XÓA KHÁCH KHÔNG CÓ GIAO DỊCH ===\n');

  // Đọc file SQL để lấy danh sách
  const sqlFile = path.join(__dirname, 'xoa_khach_khong_giao_dich.sql');
  if (!fs.existsSync(sqlFile)) {
    console.error('❌ Không tìm thấy file xoa_khach_khong_giao_dich.sql');
    console.log('   Chạy lại: node phan_tich_228_khach.js');
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFile, 'utf8');
  const matches = sqlContent.match(/'([^']+)'/g);
  const toDelete = matches ? matches.map(m => m.replace(/'/g, '')) : [];

  if (toDelete.length === 0) {
    console.log('✓ Không có khách nào cần xóa!');
    process.exit(0);
  }

  console.log(`Sẽ xóa ${toDelete.length} khách khỏi customer_base_balance\n`);
  console.log('⚠️  CẢNH BÁO: Hành động này KHÔNG THỂ HOÀN TÁC!\n');

  // Xóa từng batch 50 khách
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < toDelete.length; i += 50) {
    const batch = toDelete.slice(i, i + 50);

    const { error, count } = await db
      .from('customer_base_balance')
      .delete({ count: 'exact' })
      .in('ma_kh', batch);

    if (error) {
      console.log(`❌ Batch ${Math.floor(i/50) + 1}: ${error.message}`);
      failed += batch.length;
    } else {
      deleted += (count || 0);
      console.log(`✓ Batch ${Math.floor(i/50) + 1}: đã xóa ${count || 0} khách`);
    }
  }

  console.log(`\n=== KẾT QUẢ ===`);
  console.log(`✓ Đã xóa: ${deleted}`);
  if (failed > 0) console.log(`❌ Thất bại: ${failed}`);
  console.log('\n💯 XONG! Đã dọn sạch customer_base_balance.');
})();
