import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
const path = 'H:/Lifepro_BaoCao/ACC.15 - Sổ chi tiết bán hàng - 2026-08-28T090620.122.xls';
const buf = fs.readFileSync(path);
const wb = XLSX.read(buf, { type: 'buffer' });
console.log('Sheets:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
  console.log(`\n=== Sheet: ${name} (${rows.length} rows x ${rows[0]?.length ?? 0} cols) ===`);
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const r = rows[i].map((v) => String(v).slice(0, 40));
    console.log(`Row ${i}:`, JSON.stringify(r));
  }
  // Count distinct values in "Nhan vien" column if found
  if (rows.length > 2) {
    const header = rows[0].map((v) => String(v).trim());
    const idxName = header.findIndex((h) => h.toLowerCase().includes('nhân viên') || h.toLowerCase().includes('nhan vien'));
    const idxName2 = header.findIndex((h) => h.toLowerCase().includes('nguyễn') || h.toLowerCase().includes('đỗ') || header.some(x => String(x).includes('SG')));
    // Try row 1 as header too
    const header2 = rows[1] ? rows[1].map((v) => String(v).trim()) : [];
    const idxName3 = header2.findIndex((h) => h.toLowerCase().includes('nhân viên') || h.toLowerCase().includes('nhan vien'));
    console.log('  header0:', JSON.stringify(header.slice(0, 20)));
    if (header2.length) console.log('  header1:', JSON.stringify(header2.slice(0, 20)));
    console.log('  idx nv in row0:', idxName, 'idx nv in row1:', idxName3);

    // dump all unique values in any col that looks like employee names
    const sampleCol = idxName3 >= 0 ? idxName3 : (idxName >= 0 ? idxName : -1);
    if (sampleCol >= 0) {
      const uniq = new Set();
      for (let i = 2; i < rows.length; i++) uniq.add(String(rows[i][sampleCol] ?? '').trim());
      console.log('  unique NV values:', [...uniq].slice(0, 30));
    } else {
      // scan all cols for values containing Nguyen/Do
      console.log('  scanning for name-like cols...');
      for (let c = 0; c < (rows[0]?.length ?? 0); c++) {
        const vals = rows.slice(2, 30).map(r => String(r[c] ?? '').trim()).filter(Boolean);
        if (vals.some(v => v.includes('Chính') || v.includes('Công') || v.includes('SG'))) {
          console.log(`  col ${c} looks name-like:`, [...new Set(vals)].slice(0, 10));
        }
      }
    }
  }
}
