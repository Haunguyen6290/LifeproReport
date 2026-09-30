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
  console.log(`=== KIỂM TRA RECEIVABLE_ROWS (Sổ TK131): ${maKh} ===\n`);

  // Lấy TẤT CẢ các dòng của khách này trong receivable_rows
  const { data: rows, error } = await db
    .from('receivable_rows')
    .select('*')
    .eq('ma_kh', maKh)
    .order('ngay', { ascending: false });

  if (error) {
    console.error('❌ Lỗi query:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('❌ KHÔNG TÌM THẤY dữ liệu cho khách hàng này trong receivable_rows');
    console.log('\n📌 NGUYÊN NHÂN: Ông chưa import file "Sổ chi tiết 1 tài khoản (TK131)" cho khách này!');
    console.log('   Module Tài chính đọc từ bảng receivable_rows, KHÔNG PHẢI sales_rows');
    process.exit(0);
  }

  console.log(`✓ Tìm thấy ${rows.length} dòng\n`);

  // Phân tích dữ liệu
  let nullNgay = 0;
  let nullSoNo = 0;
  let nullSoCo = 0;
  let validRows = 0;

  console.log('=== MẪU 10 DÒNG ĐẦU TIÊN ===');
  rows.slice(0, 10).forEach((r, i) => {
    console.log(`\n[${i + 1}] Ngày: ${r.ngay || '❌ NULL'}`);
    console.log(`    Số CT: ${r.so_ct || 'N/A'}`);
    console.log(`    Tên KH: ${r.ten_kh || 'N/A'}`);
    console.log(`    TK đối ứng: ${r.tk_doi_ung || 'N/A'}`);
    console.log(`    Số Nợ: ${r.so_no !== null && r.so_no !== undefined ? r.so_no.toLocaleString() : '❌ NULL'}`);
    console.log(`    Số Có: ${r.so_co !== null && r.so_co !== undefined ? r.so_co.toLocaleString() : '❌ NULL'}`);
  });

  // Thống kê
  rows.forEach(r => {
    if (!r.ngay) nullNgay++;
    if (r.so_no === null || r.so_no === undefined) nullSoNo++;
    if (r.so_co === null || r.so_co === undefined) nullSoCo++;
    if (r.ngay && r.so_no !== null && r.so_co !== null) validRows++;
  });

  console.log('\n=== THỐNG KÊ ===');
  console.log(`Tổng số dòng: ${rows.length}`);
  console.log(`Dòng hợp lệ (ngày + số nợ + số có): ${validRows}`);
  console.log(`Dòng thiếu ngày: ${nullNgay}`);
  console.log(`Dòng thiếu số nợ: ${nullSoNo}`);
  console.log(`Dòng thiếu số có: ${nullSoCo}`);

  // Check khoảng ngày
  const dates = rows.filter(r => r.ngay).map(r => r.ngay).sort();
  if (dates.length > 0) {
    console.log(`\nKhoảng ngày: ${dates[0]} → ${dates[dates.length - 1]}`);
  }

  // Tổng nợ - có
  const tongNo = rows.reduce((sum, r) => sum + (r.so_no || 0), 0);
  const tongCo = rows.reduce((sum, r) => sum + (r.so_co || 0), 0);
  console.log(`\nTổng số Nợ: ${tongNo.toLocaleString()}`);
  console.log(`Tổng số Có: ${tongCo.toLocaleString()}`);
  console.log(`Chênh lệch: ${(tongNo - tongCo).toLocaleString()}`);

  console.log('\n=== KẾT LUẬN ===');
  if (rows.length === 0) {
    console.log('❌ Chưa có dữ liệu receivable_rows cho khách này');
    console.log('   → Cần import file "Sổ chi tiết 1 tài khoản (TK131)"');
  } else if (validRows === rows.length) {
    console.log('✓ Dữ liệu đầy đủ, module Tài chính PHẢI HIỂN THỊ được khách này');
    console.log('   → Nếu vẫn không thấy, check filter ngày trong UI');
  } else {
    console.log(`⚠ ${rows.length - validRows} dòng thiếu dữ liệu`);
    console.log('   → File import có vấn đề hoặc logic parse bị lỗi');
  }
})();
