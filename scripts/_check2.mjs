import { createClient } from '@supabase/supabase-js';
const SRC=['https://kibxnlhgdprkevqnbtfy.supabase.co','sb_secret_SB2Nzf4GaMZCYxAnfIp53w_RYEnvA8k'];
const DST=['https://ddeoednaxmzsjdxjnqmm.supabase.co', process.env.DST_KEY];
const src=createClient(SRC[0],SRC[1],{auth:{persistSession:false}});
const dst=createClient(DST[0],DST[1],{auth:{persistSession:false}});

const {data:srcProf}=await src.from('profiles').select('id,username,full_name');
const dstProf=(await dst.from('profiles').select('id,username,full_name')).data;
const srcById=new Map(srcProf.map(p=>[p.id,p.username]));
const {data:custs}=await src.from('customers').select('assigned_to,created_by,updated_by');
const uniqA=[...new Set(custs.map(c=>c.assigned_to).filter(Boolean))];
const uniqC=[...new Set(custs.map(c=>c.created_by).filter(Boolean))];
const uniqU=[...new Set(custs.map(c=>c.updated_by).filter(Boolean))];
console.log('assigned_to usernames:', uniqA.map(id=>srcById.get(id)??id));
console.log('created_by usernames:', uniqC.map(id=>srcById.get(id)??id).slice(0,20));
console.log('updated_by usernames:', uniqU.map(id=>srcById.get(id)??id).slice(0,20));
const dstIds=new Set(dstProf.map(p=>p.id));
console.log('missing assigned_to in DST', uniqA.filter(id=>!dstIds.has(id)).map(id=>srcById.get(id)));
console.log('missing created_by in DST', uniqC.filter(id=>!dstIds.has(id)).map(id=>srcById.get(id)).slice(0,10));
