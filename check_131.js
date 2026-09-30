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
  const maKh = process.argv[2] || 'LP1419';
  console.log(`=== KIỂM TRA SỔ 131: ${maKh} ===\n`);

  // Lấy TẤT CẢ các dòng của khách này
  const { data: rows, error } = await db
    .from('sales_rows')
    .select('*')
    .eq('ma_kh', maKh)
    .order('id', { ascending: false });

  if (error) {
    console.error('❌ Lỗi query:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('❌ KHÔNG TÌM THẤY dữ liệu cho khách hàng này trong sales_rows');
    process.exit(0);
  }

  console.log(`✓ Tìm thấy ${rows.length} dòng\n`);

  // Phân tích dữ liệu
  let nullNgay = 0;
  let nullTien = 0;
  let validRows = 0;

  console.log('=== MẪU 10 DÒNG ĐẦU TIÊN ===');
  rows.slice(0, 10).forEach((r, i) => {
    console.log(`\n[${i + 1}] Số CT: ${r.so_ct || 'NULL'}`);
    console.log(`    Ngày CT: ${r.ngay_ct || '❌ NULL'}`);
    console.log(`    Tiền: ${r.tien !== null && r.tien !== undefined ? r.tien.toLocaleString() + 'đ' : '❌ NULL'}`);
    console.log(`    Tên KH: ${r.ten_kh || 'N/A'}`);
    console.log(`    Mã hàng: ${r.ma_hang || 'N/A'}`);
    console.log(`    ID: ${r.id || 'N/A'}`);
  });

  // Thống kê
  rows.forEach(r => {
    if (!r.ngay_ct) nullNgay++;
    if (r.tien === null || r.tien === undefined) nullTien++;
    if (r.ngay_ct && r.tien !== null && r.tien !== undefined) validRows++;
  });

  console.log('\n=== THỐNG KÊ ===');
  console.log(`Tổng số dòng: ${rows.length}`);
  console.log(`Dòng có đầy đủ (ngày + tiền): ${validRows}`);
  console.log(`Dòng thiếu ngày_ct: ${nullNgay} (${(nullNgay/rows.length*100).toFixed(1)}%)`);
  console.log(`Dòng thiếu tien: ${nullTien} (${(nullTien/rows.length*100).toFixed(1)}%)`);

  // Check các số CT unique
  const uniqueSoCt = [...new Set(rows.map(r => r.so_ct))];
  console.log(`\nSố chứng từ unique: ${uniqueSoCt.length}`);
  console.log('Danh sách số CT:', uniqueSoCt.slice(0, 10).join(', '), uniqueSoCt.length > 10 ? '...' : '');

  // Check các cột quan trọng khác
  const hasCreatedAt = rows.some(r => r.created_at);
  if (hasCreatedAt) {
    const firstCreated = rows[rows.length - 1]?.created_at;
    const lastCreated = rows[0]?.created_at;
    console.log(`\nLần tạo đầu tiên: ${firstCreated ? new Date(firstCreated).toLocaleString('vi-VN') : 'N/A'}`);
    console.log(`Lần tạo gần nhất: ${lastCreated ? new Date(lastCreated).toLocaleString('vi-VN') : 'N/A'}`);
  }

  console.log('\n=== KẾT LUẬN ===');
  if (nullNgay === rows.length || nullTien === rows.length) {
    console.log('❌ TẤT CẢ các dòng đều thiếu dữ liệu quan trọng!');
    console.log('   → File 131 import BỊ LỖI hoặc thiếu cột ngay_ct/tien');
    console.log('   → Cần RE-IMPORT file 131 cho khách hàng này');
  } else if (validRows > 0) {
    console.log(`✓ Có ${validRows} dòng hợp lệ, nhưng ${nullNgay} dòng thiếu ngày`);
    console.log('   → Dữ liệu BỊ HỖN HỢP - cần kiểm tra file import');
  }
})();
