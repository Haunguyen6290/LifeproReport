import { createClient } from '@supabase/supabase-js';
const SRC_URL='https://kibxnlhgdprkevqnbtfy.supabase.co';
const SRC_KEY='sb_secret_SB2Nzf4GaMZCYxAnfIp53w_RYEnvA8k';
const DST_URL='https://ddeoednaxmzsjdxjnqmm.supabase.co';
const DST_KEY=process.env.DST_KEY ?? 'sb_secret_g55Zayxa-ek45krun4R-Tw_igm5iHLQ';
const src=createClient(SRC_URL,SRC_KEY,{auth:{persistSession:false}});
const dst=createClient(DST_URL,DST_KEY,{auth:{persistSession:false}});

// 1) Đồng bộ categories theo slug
console.log('1) Sync categories...');
let {data:srcCats}=await src.from('categories').select('id,slug,name,description');
let {data:dstCats}=await dst.from('categories').select('id,slug,name');
let dstCatBySlug=new Map(dstCats.map(c=>[c.slug,c]));
let insertedCats=0;
for(const c of srcCats){
  if(!dstCatBySlug.has(c.slug)){
    const {data,error}=await dst.from('categories').insert({slug:c.slug,name:c.name,description:c.description??''}).select('id,slug').single();
    if(error){ console.error('  insert cat',c.slug,error.message); continue; }
    dstCatBySlug.set(c.slug,data);
    dstCats.push(data);
    insertedCats++;
    console.log('  +',c.slug);
  }
}
console.log(`  categories: src ${srcCats.length}, dst truoc ${dstCats.length-insertedCats}, them ${insertedCats}`);
dstCatBySlug=new Map(dstCats.map(c=>[c.slug,c.id]));
const srcCatById=new Map(srcCats.map(c=>[c.id,c.slug]));

// 2) Đồng bộ category_items — thêm mục thiếu, giữ id gốc để khách tham chiếu đúng
console.log('2) Sync category_items...');
let {data:srcItems}=await src.from('category_items').select('id,category_id,code,name,description,sort_order,active,extra');
let {data:dstItems}=await dst.from('category_items').select('id,category_id,code,name');
let dstBySlugName=new Map();
let dstCatIdByItemId=new Map();
for(const it of dstItems){
  // can tim slug tu dstCats theo category_id
  const slug=[...dstCatBySlug.entries()].find(([,id])=>id===it.category_id)?.[0];
  if(slug) { dstBySlugName.set(`${slug}::${it.name}`,it); dstCatIdByItemId.set(it.id,it.category_id); }
}
let need=[];
let skippedExists=0;
for(const it of srcItems){
  const slug=srcCatById.get(it.category_id);
  const key=`${slug}::${it.name}`;
  if(dstBySlugName.has(key)) continue;
  need.push(it);
}
console.log(`  can them ${need.length} / ${srcItems.length} muc (dst da co ${srcItems.length-need.length})`);
let okItems=0, failItems=0;
for(let i=0;i<need.length;i+=100){
  const chunk=need.slice(i,i+100).map(it=>({
    id:it.id,
    category_id: dstCatBySlug.get(srcCatById.get(it.category_id)),
    code: it.code ?? '',
    name: it.name,
    description: it.description ?? '',
    sort_order: it.sort_order ?? 0,
    active: it.active ?? true,
    extra: it.extra ?? {},
  }));
  const {error}=await dst.from('category_items').insert(chunk);
  if(error){ failItems+=chunk.length; console.error('  insert chunk',i,error.message.slice(0,300)); }
  else okItems+=chunk.length;
}
console.log(`  category_items them: ok ${okItems}, fail ${failItems}`);

// refresh dst items de map id
({data:dstItems}=await dst.from('category_items').select('id,category_id,name'));
const dstBySlugName2=new Map();
for(const it of dstItems){
  const slug=[...dstCatBySlug.entries()].find(([,id])=>id===it.category_id)?.[0];
  if(slug) dstBySlugName2.set(`${slug}::${it.name}`,it.id);
}
const srcIdToDstId=new Map();
for(const it of srcItems){
  const slug=srcCatById.get(it.category_id);
  const dstId=dstBySlugName2.get(`${slug}::${it.name}`);
  if(dstId) srcIdToDstId.set(it.id,dstId);
}
// map profile theo username de phong id khac nhau
console.log('3) Map profiles theo username...');
let {data:srcProf}=await src.from('profiles').select('id,username');
let {data:dstProf}=await dst.from('profiles').select('id,username');
const dstProfByUsername=new Map(dstProf.map(p=>[p.username,p.id]));
const srcProfIdToDstId=new Map(srcProf.map(p=>[p.id, dstProfByUsername.get(p.username) ?? null]));

// 4) Copy customers — remap tier_id/status_id/scale_id qua ten danh muc
console.log('4) Copy customers (689)...');
let {data:srcCusts,error:srcErr}=await src.from('customers').select('*').order('created_at');
if(srcErr) throw new Error(srcErr.message);
console.log(`  nguon ${srcCusts.length} khach`);

function remap(id){ return id ? (srcIdToDstId.get(id) ?? id) : id; }

let ok=0,fail=0,lastErr='';
for(let i=0;i<srcCusts.length;i+=100){
  const slice=srcCusts.slice(i,i+100);
  const payload=slice.map(r=>({
    ...r,
    tier_id: remap(r.tier_id),
    status_id: remap(r.status_id),
    scale_id: remap(r.scale_id),
    assigned_to: srcProfIdToDstId.get(r.assigned_to) ?? r.assigned_to,
    created_by: r.created_by ? (srcProfIdToDstId.get(r.created_by) ?? null) : null,
    updated_by: r.updated_by ? (srcProfIdToDstId.get(r.updated_by) ?? null) : null,
  }));
  // loai bo khoa ngoai null cho assigned_to neu map fail -> giu nguyen id cu neu thuoc dst
  const {error}=await dst.from('customers').upsert(payload,{onConflict:'id'});
  if(error){
    // thu tach: bo qua tier/status/scale neu van loi FK
    const payload2=payload.map(p=>({ ...p, tier_id:null, status_id:null, scale_id:null }));
    const {error:e2}=await dst.from('customers').upsert(payload2,{onConflict:'id'});
    if(e2){ fail+=payload.length; lastErr=e2.message; console.error(`  chunk ${i} fail:`,e2.message.slice(0,500)); }
    else { ok+=payload.length; console.log(`  chunk ${i}-${i+payload.length-1} ok (bo tier/status/scale)`); }
  } else ok+=payload.length;
  if(i%200===0) console.log(`  progress ${Math.min(i+100,srcCusts.length)}/${srcCusts.length}`);
}
console.log(`\nXong customers: ok ${ok}/${srcCusts.length}, fail ${fail}`);
if(lastErr) console.log('Loi cuoi:',lastErr);
console.log('Giu nguyen tai khoan/roles/settings ben dich.');
