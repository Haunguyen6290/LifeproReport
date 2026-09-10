import { createClient } from '@supabase/supabase-js';
const DST=['https://ddeoednaxmzsjdxjnqmm.supabase.co','sb_secret_g55Zayxa-ek45krun4R-Tw_igm5iHLQ'];
const dst=createClient(DST[0],DST[1],{auth:{persistSession:false}});
const {count:c1}=await dst.from('customers').select('id',{count:'exact',head:true});
console.log('Tong khach ben dich:', c1);
const {count:c2}=await dst.from('category_items').select('id',{count:'exact',head:true});
console.log('Tong muc danh muc:', c2);
const {count:cPhanHang}=await dst.from('category_items').select('id',{count:'exact',head:true}).eq('category_id','(select id from categories where slug=\'phan_hang_kh\')');
const {data:dstCats}=await dst.from('categories').select('id,slug');
const phanHangId=dstCats.find(c=>c.slug==='phan_hang_kh')?.id;
if(phanHangId){
  const {data:phanHang}=await dst.from('category_items').select('name').eq('category_id',phanHangId);
  console.log('Phan hang (A+,A,B...):', phanHang?.map(x=>x.name).join(', '));
}
const {data:sample}=await dst.from('customers').select('ma_kh,ten_kh').limit(3);
console.log('3 khach mau:', sample);
