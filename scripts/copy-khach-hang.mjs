import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

const SRC_URL = 'https://kibxnlhgdprkevqnbtfy.supabase.co';
const DST_URL = process.env.DST_URL ?? 'https://ddeoednaxmzsjdxjnqmm.supabase.co';
const DST_KEY = process.env.DST_KEY ?? '';
const SRC_KEY = 'sb_secret_SB2Nzf4GaMZCYxAnfIp53w_RYEnvA8k';

function ensureKey() {
  if (!DST_KEY) { console.error('Thieu DST_KEY (service_role / sb_secret... va sb_publishable... deu duoc)'); process.exit(1); }
  if (DST_KEY === SRC_KEY) { console.error('DST_KEY giong SRC_KEY — lam on xac nhan lai'); }
}

ensureKey();
const src = createClient(SRC_URL, SRC_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const dst = createClient(DST_URL, DST_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Nen cac tu tieng Viet thanh key on dinh de mau hoa (dua theo ten_kh chinh xac tu DB)
// Vi database cu/hien da mac dinh equals exact theo ten_kh + dia chi -> o day chi copy nguyen ban
async function hasColumn(table, col) {
  const { data, error } = await src.from(table).select(col).limit(1);
  // Neu cot khong ton tai, Supabase tra error "column does not exist"
  if (error?.message?.includes(col)) return false;
  return true;
}

async function run() {
  console.log(`Nguon: ${SRC_URL}`);
  console.log(`Dich : ${DST_URL}`);

  // Kiem tra bang dich co thieu cot sp_* (tu migration saless 0020/0030) chua
  const { data: dstProbe, error: dstErr } = await dst.from('customers').select('id').limit(1);
  if (dstErr?.message) {
    console.warn('Canh bao khi tham do bang customers ben dich:', dstErr.message);
  }

  const { data: srcRows, error: srcErr } = await src.from('customers').select('*').order('created_at');
  if (srcErr) throw new Error('Doc khach hang nguon that bai: ' + srcErr.message);
  console.log(`Ben nguon: ${srcRows.length} khach hang`);

  if (srcRows.length === 0) { console.log('Khong co gi de copy.'); return; }

  // Lay dang ky cot ben dich: lay 1 dong mau (neu co) de biet extra/tier_id co ton tai khong
  // Thu upsert tung lo: su dung column set theo mau srcRows[0], bo nhung cot dich khong co
  // Cach an toan nhat: tinh toan tap cot hien co ben dich bang cach thu insert dry-run
  const dstColumns = Object.keys(srcRows[0] ?? {});

  // Neu ben dich thieu cac cot sp_* / tier thuo, bo qua
  // Cach chinh xac: thu upsert 1 dong roi xem loi thi loai cot do
  let columns = [...dstColumns];
  // Thu loai trong truoc khi xac dinh chinh xac
  if (dstProbe !== null) {
    // Khong co cach list columns tot qua REST ngoai viec thu that
    // Do do ta dang thu upsert lo dau tien, neu bao thieu cot thi tu dong loai
    const tryColumns = async (rows) => {
      const payload = rows.map((r) => {
        const o = {};
        for (const k of columns) if (r[k] !== undefined) o[k] = r[k];
        return o;
      });
      const { error } = await dst.from('customers').upsert(payload, { onConflict: 'id' });
      if (error && /column .* does not exist/i.test(error.message)) {
        const m = error.message.match(/column \"([^\"]+)\"/i);
        const missing = m ? m[1] : null;
        if (missing && columns.includes(missing)) {
          console.warn(`Cot "${missing}" chua ton tai ben dich — bo qua cot nay`);
          columns = columns.filter((c) => c !== missing);
          return tryColumns(rows);
        }
      }
      return error;
    };
    const chunk = srcRows.slice(0, 5);
    // Thu loai truoc tren 5 dong dau
    await tryColumns(chunk);
    console.log('Danh sach cot se upsert:', columns.join(', '));
  }

  const CHUNK = 200;
  let ok = 0, fail = 0, errMsg = '';
  for (let i = 0; i < srcRows.length; i += CHUNK) {
    const slice = srcRows.slice(i, i + CHUNK);
    const payload = slice.map((r) => {
      const o = {};
      for (const k of columns) o[k] = r[k];
      return o;
    });
    const { error } = await dst.from('customers').upsert(payload, { onConflict: 'id' });
    if (error) {
      fail += payload.length;
      errMsg = error.message;
      console.error(`Chunk ${i}-${i + payload.length - 1} that bai:`, error.message);
    } else {
      ok += payload.length;
      console.log(`  Da copy ${ok}/${srcRows.length}`);
    }
  }
  console.log(`\nXong: thong cong ${srcRows.length}, thanh cong ${ok}, loi ${fail}`);
  if (errMsg) console.log('Loi lenh cuoi:', errMsg);
  console.log('Giu nguyen tai khoan/roles/settings: chi cham toi bang customers');
}

run().catch((e) => { console.error('LOI:', e.stack ?? e.message); process.exit(1); });
