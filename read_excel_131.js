const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node read_excel_131.js <path-to-excel-file>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`❌ File không tồn tại: ${filePath}`);
  process.exit(1);
}

console.log(`=== ĐỌC FILE: ${path.basename(filePath)} ===\n`);

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
console.log(`Sheet đầu tiên: "${sheetName}"\n`);

const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });

console.log(`=== HEADER (dòng 1) ===`);
if (rows.length > 0) {
  const header = rows[0];
  header.forEach((col, i) => {
    console.log(`  [${i}] ${col}`);
  });
}

console.log(`\n=== MẪU 5 DÒNG DỮ LIỆU ===`);
for (let i = 1; i <= Math.min(5, rows.length - 1); i++) {
  console.log(`\nDòng ${i}:`);
  const row = rows[i];
  rows[0].forEach((colName, j) => {
    const val = row[j];
    if (val !== '' && val !== null && val !== undefined) {
      console.log(`  ${colName}: ${val}`);
    }
  });
}

console.log(`\n=== THỐNG KÊ ===`);
console.log(`Tổng số dòng (bao gồm header): ${rows.length}`);
console.log(`Số cột: ${rows[0]?.length || 0}`);

// Tìm khách hàng LP1419
console.log(`\n=== TÌM LP1419 ===`);
const header = rows[0];
const maKhIndex = header.findIndex(col => String(col).toLowerCase().includes('ma') && String(col).toLowerCase().includes('kh'));
const tenKhIndex = header.findIndex(col => String(col).toLowerCase().includes('ten') && String(col).toLowerCase().includes('kh'));

if (maKhIndex >= 0) {
  console.log(`Cột mã KH: [${maKhIndex}] ${header[maKhIndex]}`);
  const lp1419Rows = rows.slice(1).filter(row => String(row[maKhIndex]).trim() === 'LP1419');
  console.log(`Tìm thấy ${lp1419Rows.length} dòng cho LP1419\n`);

  if (lp1419Rows.length > 0) {
    console.log('Mẫu 3 dòng LP1419:');
    lp1419Rows.slice(0, 3).forEach((row, i) => {
      console.log(`\n  Dòng ${i + 1}:`);
      header.forEach((colName, j) => {
        const val = row[j];
        if (val !== '' && val !== null && val !== undefined) {
          console.log(`    ${colName}: ${val}`);
        }
      });
    });
  }
} else {
  console.log('❌ Không tìm thấy cột mã khách hàng');
}
