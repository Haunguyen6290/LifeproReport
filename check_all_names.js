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
  console.log('=== RÀ SOÁT TÊN KHÁCH HÀNG KHÔNG KHỚP ===\n');

  // Lấy tất cả từ customers (bảng chính - nguồn chân lý)
  const { data: customers } = await db.from('customers').select('ma_kh, ten_kh');

  // Lấy tất cả từ customer_base_balance
  const { data: baseBalance } = await db.from('customer_base_balance').select('ma_kh, ten_kh');

  if (!customers || !baseBalance) {
    console.error('❌ Lỗi query dữ liệu');
    process.exit(1);
  }

  console.log(`Tổng số khách trong customers: ${customers.length}`);
  console.log(`Tổng số khách trong customer_base_balance: ${baseBalance.length}\n`);

  // Map customers
  const custMap = new Map();
  customers.forEach(c => {
    if (c.ma_kh) custMap.set(c.ma_kh, c.ten_kh || '');
  });

  // So sánh
  const khongKhop = [];
  const khongCo = [];

  baseBalance.forEach(b => {
    if (!b.ma_kh) return;

    const tenDung = custMap.get(b.ma_kh);

    if (!tenDung) {
      // Có trong base_balance nhưng không có trong customers
      khongCo.push({
        ma_kh: b.ma_kh,
        ten_base: b.ten_kh || '',
      });
    } else if (tenDung !== (b.ten_kh || '')) {
      // Tên không khớp
      khongKhop.push({
        ma_kh: b.ma_kh,
        ten_dung: tenDung,
        ten_sai: b.ten_kh || '',
      });
    }
  });

  console.log('=== KẾT QUẢ ===\n');

  if (khongKhop.length === 0) {
    console.log('✓ Không có khách nào bị sai tên');
  } else {
    console.log(`⚠ ${khongKhop.length} KHÁCH BỊ SAI TÊN:\n`);
    khongKhop.forEach((k, i) => {
      console.log(`${i + 1}. ${k.ma_kh}`);
      console.log(`   Tên đúng (customers):     "${k.ten_dung}"`);
      console.log(`   Tên sai (base_balance):   "${k.ten_sai}"`);
      console.log('');
    });
  }

  if (khongCo.length > 0) {
    console.log(`\n⚠ ${khongCo.length} MÃ CÓ TRONG BASE_BALANCE NHƯNG KHÔNG CÓ TRONG CUSTOMERS:\n`);
    khongCo.slice(0, 10).forEach((k, i) => {
      console.log(`${i + 1}. ${k.ma_kh} | ${k.ten_base}`);
    });
    if (khongCo.length > 10) console.log(`   ... và ${khongCo.length - 10} mã khác`);
  }

  // Tạo file SQL để fix
  if (khongKhop.length > 0) {
    const sqlLines = [
      '-- Script sửa tên khách hàng trong customer_base_balance',
      '-- Tạo bởi check_all_names.js',
      '',
    ];

    khongKhop.forEach(k => {
      const tenDung = k.ten_dung.replace(/'/g, "''"); // escape single quote
      sqlLines.push(`UPDATE customer_base_balance SET ten_kh = '${tenDung}' WHERE ma_kh = '${k.ma_kh}';`);
    });

    const sqlFile = path.join(__dirname, 'fix_names.sql');
    fs.writeFileSync(sqlFile, sqlLines.join('\n'), 'utf8');
    console.log(`\n📝 Đã tạo file SQL: ${sqlFile}`);
    console.log('   Chạy file này trong Supabase SQL Editor để sửa hàng loạt');
  }

  console.log('\n=== HƯỚNG DẪN SỬA ===');
  if (khongKhop.length > 0) {
    console.log('1. Chạy script tự động: node fix_all_names.js');
    console.log('2. Hoặc chạy file fix_names.sql trong Supabase SQL Editor');
  } else {
    console.log('Không cần sửa gì!');
  }
})();
