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
  const search = process.argv[2] || 'LP1419';
  console.log(`=== TÌM: "${search}" ===\n`);

  // 1. Customers - thử cả ma_kh và ten_kh
  console.log('1. CUSTOMERS:');
  const { data: c1 } = await db.from('customers').select('*').eq('ma_kh', search);
  const { data: c2 } = await db.from('customers').select('*').ilike('ma_kh', `%${search}%`);
  const { data: c3 } = await db.from('customers').select('*').ilike('ten_kh', `%${search}%`);
  const cust = [...(c1||[]), ...(c2||[]), ...(c3||[])].filter((v,i,a)=>a.findIndex(t=>t.id===v.id)===i);

  if (cust.length) cust.forEach(c => console.log(`   ✓ ${c.ma_kh} | ${c.ten_kh} | ${c.dien_thoai||'N/A'}`));
  else console.log('   ✗ Không có');

  // 2. Sales rows (131)
  console.log('\n2. SALES_ROWS (Sổ 131):');
  const { data: s1 } = await db.from('sales_rows').select('*').eq('ma_kh', search).limit(10);
  const { data: s2 } = await db.from('sales_rows').select('*').ilike('ma_kh', `%${search}%`).limit(10);
  const { data: s3 } = await db.from('sales_rows').select('*').ilike('ten_kh', `%${search}%`).limit(10);
  const sales = [...(s1||[]), ...(s2||[]), ...(s3||[])];

  if (sales.length) {
    console.log(`   Có ${sales.length} dòng, mẫu 5 dòng:`);
    sales.slice(0,5).forEach(s => console.log(`   - ${s.ngay_ct} | ${s.ma_kh} | ${s.ten_kh} | ${s.so_ct} | ${(s.tien||0).toLocaleString()}đ`));
  } else console.log('   ✗ Không có');

  // 3. AMIS
  console.log('\n3. AMIS_SALES_ROWS:');
  const { data: a1 } = await db.from('amis_sales_rows').select('*').eq('ma_kh', search).limit(10);
  const { data: a2 } = await db.from('amis_sales_rows').select('*').ilike('ma_kh', `%${search}%`).limit(10);
  const { data: a3 } = await db.from('amis_sales_rows').select('*').ilike('ten_khach_hang', `%${search}%`).limit(10);
  const amis = [...(a1||[]), ...(a2||[]), ...(a3||[])];

  if (amis.length) {
    console.log(`   Có ${amis.length} dòng, mẫu 5 dòng:`);
    amis.slice(0,5).forEach(a => console.log(`   - ${a.ngay_hach_toan} | ${a.ma_kh} | ${a.ten_khach_hang} | ${a.so_ct} | ${(a.thanh_tien||0).toLocaleString()}đ`));
  } else console.log('   ✗ Không có');
})();
