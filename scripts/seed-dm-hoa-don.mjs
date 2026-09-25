import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
function norm(s) { return String(s ?? '').replace(/^'/, '').trim(); }

function loadOldThueCap() {
  const p = join(root, 'Tailieu_Lifepro/TK 23.9.xlsx');
  try {
    const raw = XLSX.utils.sheet_to_json(XLSX.read(readFileSync(p)).Sheets[XLSX.read(readFileSync(p)).SheetNames[0]], { header: 1, defval: null });
    const map = new Map();
    for (let r = 5; r < raw.length; r++) {
      const row = raw[r]; if (!row) continue;
      const ma = norm(row[2]); const cap1 = norm(row[3]); const cap2 = norm(row[4]);
      if (!ma || (!cap1 && !cap2)) continue;
      map.set(ma, { cap1, cap2 });
      const maN = ma.replace(/\s+/g, ''); if (maN !== ma) map.set(maN, { cap1, cap2 });
    }
    console.log('Old TK cap:', map.size); return map;
  } catch (e) { console.log('TK23.9 skip', e.message); return new Map(); }
}
function loadOldThucCap() {
  const p = join(root, 'Tailieu_Lifepro/Tổng hợp nhật xuất tồn (42).xlsx');
  try {
    const raw = XLSX.utils.sheet_to_json(XLSX.read(readFileSync(p)).Sheets[XLSX.read(readFileSync(p)).SheetNames[0]], { header: 1, defval: null });
    const map = new Map();
    for (let r = 8; r < raw.length; r++) {
      const row = raw[r]; if (!row) continue;
      const ma = norm(row[0]); const cap1 = norm(row[1]); const cap2 = norm(row[2]);
      if (!ma || (!cap1 && !cap2)) continue;
      map.set(ma, { cap1, cap2 });
    }
    console.log('Old TH cap:', map.size); return map;
  } catch { return new Map(); }
}
function loadNewThue() {
  const buf = readFileSync(join(root, 'Tailieu_Lifepro/File_Import/TK 25.9 LP VAT.xlsx'));
  const wb = XLSX.read(buf);
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
  const out = [];
  for (let r = 3; r < raw.length; r++) {
    const row = raw[r]; if (!row) continue;
    const ma = norm(row[1]); if (!ma || ma === 'Mã') continue;
    const ten = norm(row[2]); const sl = Number(row[3] ?? 0); const gia = Number(row[5] ?? 0); const vat = parseInt(norm(row[6]), 10);
    out.push({ ma, ten, sl, gia: isNaN(gia) ? 0 : gia, vat: [0, 5, 8, 10].includes(vat) ? vat : 10 });
  }
  console.log('New TK rows', out.length); return out;
}
function loadAllThuc() {
  const loads = [];
  for (const p of [join(root, 'Tailieu_Lifepro/Tổng hợp nhật xuất tồn (42).xlsx'), join(root, 'Tailieu_Lifepro/File_Import/Tổng hợp nhật xuất tồn.xlsx')]) {
    try {
      const wb = XLSX.read(readFileSync(p));
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
      for (let r = 8; r < raw.length; r++) {
        const row = raw[r]; if (!row) continue;
        const ma = norm(row[0]); const ten = norm(row[1]) || norm(row[3]) || ma;
        if (!ma || ma === '1' || ma === 'Mã số' || ma.includes('LIFE PRO')) continue;
        loads.push({ ma, ten });
      }
    } catch {}
  }
  const map = new Map(); for (const x of loads) if (!map.has(x.ma)) map.set(x.ma, x.ten);
  console.log('DM thuc union', map.size, 'total rows', loads.length); return [...map.entries()].map(([ma, ten]) => ({ ma, ten }));
}

async function chunkUpsert(table, rows, onConflict, chunk = 500) {
  let ok = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await admin.from(table).upsert(slice, { onConflict, ignoreDuplicates: false });
    if (error) { console.log(`upsert ${table} chunk ${i} err:`, error.message.slice(0, 300)); }
    else ok += slice.length;
    if (i % 2000 === 0) console.log(`  ${table} ${ok}/${rows.length}`);
  }
  return ok;
}

async function main() {
  const capThue = loadOldThueCap();
  const capThuc = loadOldThucCap();
  const newThue = loadNewThue();
  const allThuc = loadAllThuc();

  const today = new Date().toISOString().slice(0, 10);

  const thueRows = newThue.map(r => {
    const cap = capThue.get(r.ma) ?? capThue.get(r.ma.replace(/\s+/g, '')) ?? { cap1: '', cap2: '' };
    return { ma_thue: r.ma, ten_thue: r.ten, cap1: cap.cap1, cap2: cap.cap2, gia_chua_vat: r.gia, vat: r.vat };
  });
  const thueTonRows = newThue.map(r => ({ ngay: today, ma_thue: r.ma, sl_ton: r.sl, gia_chua_vat: r.gia, vat: r.vat }));

  // need thue inserted before ton (FK)
  console.log('Upsert dm_thue', thueRows.length);
  await chunkUpsert('dm_thue', thueRows, 'ma_thue');
  console.log('Upsert ton_thue_ngay', thueTonRows.length);
  // delete old for today then insert
  await admin.from('ton_thue_ngay').delete().eq('ngay', today);
  await chunkUpsert('ton_thue_ngay', thueTonRows, 'ngay,ma_thue');

  const thucRows = allThuc.map(r => {
    const cap = capThuc.get(r.ma) ?? { cap1: '', cap2: '' };
    return { ma_thuc: r.ma, ten_thuc: r.ten || r.ma, cap1: cap.cap1, cap2: cap.cap2 };
  });
  console.log('Upsert dm_thuc', thucRows.length);
  await chunkUpsert('dm_thuc', thucRows, 'ma_thuc');

  // ton_thuc: need ma -> sl map from new file only
  const wb2 = XLSX.read(readFileSync(join(root, 'Tailieu_Lifepro/File_Import/Tổng hợp nhật xuất tồn.xlsx')));
  const raw2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1, defval: null });
  const thucSlMap = new Map();
  for (let r = 8; r < raw2.length; r++) {
    const row = raw2[r]; if (!row) continue;
    const ma = norm(row[0]); if (!ma || ma === '1' || ma === 'Mã số' || ma.includes('LIFE PRO')) continue;
    const slRaw = row[11]; const sl = slRaw == null || slRaw === '' ? 0 : Number(String(slRaw).replace(/,/g, ''));
    thucSlMap.set(ma, isNaN(sl) ? 0 : sl);
  }
  const thucTonRows = [...thucSlMap.entries()].map(([ma, sl]) => ({ ngay: today, ma_thuc: ma, sl_kha_dung: sl }));
  console.log('Upsert ton_thuc_ngay', thucTonRows.length);
  await admin.from('ton_thuc_ngay').delete().eq('ngay', today);
  await chunkUpsert('ton_thuc_ngay', thucTonRows, 'ngay,ma_thuc');

  const { count: cThue } = await admin.from('dm_thue').select('ma_thue', { count: 'exact', head: true });
  const { count: cThuc } = await admin.from('dm_thuc').select('ma_thuc', { count: 'exact', head: true });
  console.log(`Done: dm_thue ${cThue}, dm_thuc ${cThuc}`);
  // quick missing check
  const { data: mt } = await admin.from('dm_thue').select('ma_thue').or('cap1.is.null,cap1.eq.');
  const { data: mr } = await admin.from('dm_thuc').select('ma_thuc').or('cap1.is.null,cap1.eq.');
  console.log(`Thieu Cap: thue ${(mt ?? []).length}, thuc ${(mr ?? []).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
