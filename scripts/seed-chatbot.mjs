import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const md = readFileSync(join(root, 'Bo_du_lieu_chatbot_tro_ly_cong_viec_toan_cong_ty.md'), 'utf8');
const lines = md.split('\n');

// 1) Xác định dòng bắt đầu mỗi QA (#### QA-xxxx) và header phân hệ/nhom gần nhất phía trên
const marks = [];
let lastPhanHe = '';
let lastNhom = '';
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (/^##\s+(Trợ lý |Bộ não)/.test(t)) { lastPhanHe = t.replace(/^##\s+/, '').trim(); lastNhom = ''; }
  else if (/^###\s+/.test(t)) lastNhom = t.replace(/^###\s+/, '').trim();
  else if (/^####\s*QA-/.test(t)) marks.push({ start: i, phanHe: lastPhanHe, nhom: lastNhom });
}

function field(chunk, label) {
  const re = new RegExp('\\*\\*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\*\\*[ \\t]*([^\\n]*)');
  const m = chunk.match(re);
  return m ? m[1].trim() : '';
}

const rows = [];
for (let b = 0; b < marks.length; b++) {
  const s = marks[b].start;
  const e = b + 1 < marks.length ? marks[b + 1].start : lines.length;
  const chunk = lines.slice(s, e).join('\n');

  const idMatch = lines[s].match(/QA-\d+/);
  if (!idMatch) continue;
  const id = idMatch[0];

  // Câu hỏi: phần sau dấu — trên dòng header
  const parts = lines[s].replace(/^####\s*/, '').split('—');
  const cauHoi = (parts.slice(1).join('—') || '').trim();

  const phanHeLienQuanRaw = field(chunk, 'Phân hệ liên quan');
  rows.push({
    id,
    phan_he: marks[b].phanHe,
    nhom_chu_de: marks[b].nhom,
    cau_hoi: cauHoi,
    tra_loi_chuan: field(chunk, 'Trả lời chuẩn'),
    vi_du: field(chunk, 'Ví dụ'),
    cau_hoi_tiep_theo: field(chunk, 'Câu hỏi tiếp theo'),
    hanh_dong: field(chunk, 'Hành động'),
    phan_he_lien_quan: phanHeLienQuanRaw ? phanHeLienQuanRaw.split(',').map((x) => x.trim()).filter(Boolean) : [],
    vai_tro: field(chunk, 'Vai trò'),
    muc_do: field(chunk, 'Mức độ'),
    uu_tien: field(chunk, 'Ưu tiên'),
    du_lieu_can_co: field(chunk, 'Dữ liệu cần có'),
    khong_tu_doan: field(chunk, 'Không tự đoán'),
  });
}

console.log(`Parsed ${rows.length} QA`);
console.log('phan_he:', [...new Set(rows.map((r) => r.phan_he))].join(' | '));
const missing = rows.filter((r) => !r.cau_hoi || !r.tra_loi_chuan);
if (missing.length) console.warn('WARN thiếu field:', missing.map((r) => r.id).join(','));
if (rows.length !== 91) console.warn(`WARN: expected 91 QA, got ${rows.length}`);

// 2) Upsert chia chunk
const chunkSize = 25;
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize);
  const { error } = await supabase.from('chatbot_qa').upsert(chunk, { onConflict: 'id' });
  if (error) { console.error(`upsert chunk @${i} error:`, error.message); process.exit(1); }
  console.log(`upsert ${i}..${i + chunk.length - 1} ok`);
}

const { count, error: cntErr } = await supabase.from('chatbot_qa').select('id', { count: 'exact', head: true });
if (cntErr) console.error('count err:', cntErr.message);
else console.log('total chatbot_qa:', count);
