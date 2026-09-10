import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';

const file = process.argv[2];
const maxRows = Number(process.argv[3] || 12);
const wb = XLSX.read(readFileSync(file), { cellDates: true });
for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  console.log(`\n===== Sheet: "${sn}" | ref=${ws['!ref']} =====`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  for (let i = 0; i < Math.min(maxRows, rows.length); i++) {
    const r = rows[i].map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c));
    console.log(i + ':', JSON.stringify(r));
  }
  if (rows.length > maxRows) console.log(`... còn ${rows.length - maxRows} dòng (tổng ${rows.length})`);
}
