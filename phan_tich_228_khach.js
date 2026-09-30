const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
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
  console.log('=== PHÂN TÍCH 228 KHÁCH THIẾU ===\n');

  // Lấy danh sách customers
  const { data: customers } = await db.from('customers').select('ma_kh');
  const custSet = new Set((customers || []).map(c => c.ma_kh));

  // Lấy tất cả từ customer_base_balance
  const { data: baseBalance } = await db.from('customer_base_balance').select('ma_kh, ten_kh, du_no');

  // Tìm khách thiếu
  const missing = (baseBalance || []).filter(b => b.ma_kh && !custSet.has(b.ma_kh));

  console.log(`Tìm thấy ${missing.length} khách trong base_balance nhưng không có trong customers\n`);
  console.log('⏳ Đang check giao dịch...\n');

  const results = [];
  let processed = 0;

  for (const m of missing) {
    processed++;
    if (processed % 50 === 0) console.log(`Đã xử lý ${processed}/${missing.length}...`);

    // Check receivable_rows (Sổ 131)
    const { data: rcv, count: rcvCount } = await db
      .from('receivable_rows')
      .select('ngay', { count: 'exact', head: false })
      .eq('ma_kh', m.ma_kh)
      .order('ngay', { ascending: false })
      .limit(1);

    // Check sales_rows (Báo cáo bán hàng)
    const { data: sales, count: salesCount } = await db
      .from('sales_rows')
      .select('ngay', { count: 'exact', head: false })
      .eq('ma_kh', m.ma_kh)
      .order('ngay', { ascending: false })
      .limit(1);

    const coGiaoDich131 = (rcvCount || 0) > 0;
    const coGiaoDichSales = (salesCount || 0) > 0;
    const ngayGD131 = rcv && rcv.length > 0 ? rcv[0].ngay : '';
    const ngayGDSales = sales && sales.length > 0 ? sales[0].ngay : '';

    results.push({
      'Mã KH': m.ma_kh,
      'Tên KH': m.ten_kh || '',
      'Số dư đầu kỳ': m.du_no || 0,
      'Có giao dịch 131?': coGiaoDich131 ? 'CÓ' : 'KHÔNG',
      'Số dòng 131': rcvCount || 0,
      'GD 131 gần nhất': ngayGD131,
      'Có giao dịch Sales?': coGiaoDichSales ? 'CÓ' : 'KHÔNG',
      'Số dòng Sales': salesCount || 0,
      'GD Sales gần nhất': ngayGDSales,
      'Đề xuất': (!coGiaoDich131 && !coGiaoDichSales && (!m.du_no || m.du_no === 0)) ? 'XÓA' : 'GIỮ LẠI',
    });
  }

  console.log('\n✓ Hoàn thành phân tích!\n');

  // Thống kê
  const coGD = results.filter(r => r['Có giao dịch 131?'] === 'CÓ' || r['Có giao dịch Sales?'] === 'CÓ').length;
  const khongGD = results.filter(r => r['Có giao dịch 131?'] === 'KHÔNG' && r['Có giao dịch Sales?'] === 'KHÔNG').length;
  const deXuatXoa = results.filter(r => r['Đề xuất'] === 'XÓA').length;

  console.log('=== THỐNG KÊ ===');
  console.log(`Tổng số: ${results.length}`);
  console.log(`Có giao dịch (131 hoặc Sales): ${coGD}`);
  console.log(`Không có giao dịch: ${khongGD}`);
  console.log(`Đề xuất xóa (không GD + số dư = 0): ${deXuatXoa}\n`);

  // Tạo Excel
  const ws = XLSX.utils.json_to_sheet(results);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // Mã KH
    { wch: 40 }, // Tên KH
    { wch: 15 }, // Số dư
    { wch: 18 }, // Có GD 131
    { wch: 12 }, // Số dòng 131
    { wch: 15 }, // GD 131 gần nhất
    { wch: 18 }, // Có GD Sales
    { wch: 15 }, // Số dòng Sales
    { wch: 15 }, // GD Sales gần nhất
    { wch: 12 }, // Đề xuất
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Khách hàng thiếu');

  const fileName = path.join(__dirname, '228_khach_hang_thieu.xlsx');
  XLSX.writeFile(wb, fileName);

  console.log(`📊 Đã tạo file Excel: ${fileName}\n`);

  // Tạo script xóa khách không có giao dịch
  if (deXuatXoa > 0) {
    const toDelete = results.filter(r => r['Đề xuất'] === 'XÓA').map(r => r['Mã KH']);

    const deleteScript = [
      '-- Script xóa khách không có giao dịch khỏi customer_base_balance',
      `-- Xóa ${toDelete.length} khách`,
      '',
      "DELETE FROM customer_base_balance WHERE ma_kh IN (",
      toDelete.map(ma => `  '${ma}'`).join(',\n'),
      ');',
    ].join('\n');

    const sqlFile = path.join(__dirname, 'xoa_khach_khong_giao_dich.sql');
    fs.writeFileSync(sqlFile, deleteScript, 'utf8');
    console.log(`📝 Đã tạo script SQL: ${sqlFile}`);
    console.log(`   Xóa ${toDelete.length} khách không có giao dịch và số dư = 0\n`);
  }

  console.log('=== HƯỚNG DẪN ===');
  console.log('1. Mở file Excel để xem chi tiết');
  console.log('2. Nếu đồng ý xóa khách đề xuất, chạy: node xoa_khach_khong_giao_dich.js');
  console.log('3. Hoặc chạy file SQL trong Supabase SQL Editor');
})();
