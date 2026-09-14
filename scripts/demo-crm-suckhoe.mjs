// Sinh file HTML demo "Mua hàng & Công nợ" + "Sức khỏe" với số THẬT từ Supabase.
// Chạy: node scripts/demo-crm-suckhoe.mjs   →  mở crm-demo-suckhoe.html
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const NOW = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
// Chuẩn hóa mã KH giống fn_norm_ma trong Supabase: bỏ mọi ký tự không phải chữ/số, về chữ thường.
const normMa = (t) => (t || '').toLowerCase().replace(/[^\\p{L}\\p{N}]/gu, '');

// 1) Danh mục khách + phân hạng + trạng thái + kinh doanh phụ trách
const { data: custs, error: e1 } = await db.from('customers')
  .select('id, ma_kh, ten_kh, tinh_thanh, tier:category_items!customers_tier_id_fkey(code,name), status:category_items!customers_status_id_fkey(name), assigned:profiles!customers_assigned_to_fkey(full_name)')
  .order('ten_kh');
if (e1) throw e1;

// 2) Doanh số theo khách x tháng (12 tháng gần nhất để có cơ sở tính 6 tháng + trend)
const months = [];
for (let i = 11; i >= 0; i--) {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
  months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
}
const fromM = months[0] + '-01';
async function fetchAllSaleRows() {
  const all = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db.from('sales_rows')
      .select('ma_kh, sale_month, thanh_tien, ngay, ma_vt, ten_vt')
      .gte('ngay', fromM)
      .order('ngay', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return all;
}
const revRows = await fetchAllSaleRows();

// gom theo khách — dùng norm để chịu được lệch định dạng (space vs _, hoa vs thường)
const byKh = new Map(); // norm_ma -> { months:{m:sum}, lastDate, products:Map, rev30, rawMa }
// thêm map rawMa -> norm để tra ngược nếu cần
for (const r of revRows || []) {
  if (!r.ma_kh) continue;
  const norm = normMa(r.ma_kh);
  if (!norm) continue;
  let o = byKh.get(norm);
  if (!o) { o = { months: {}, lastDate: null, products: new Map(), rev30: 0, rawMa: r.ma_kh }; byKh.set(norm, o); }
  o.months[r.sale_month] = (o.months[r.sale_month] || 0) + Number(r.thanh_tien || 0);
  const d = new Date(r.ngay);
  if (!o.lastDate || d > o.lastDate) o.lastDate = d;
  const key = (r.ma_vt && r.ten_vt) ? `${r.ma_vt} ${r.ten_vt}` : (r.ten_vt || r.ma_vt || '(khác)');
  o.products.set(key, (o.products.get(key) || 0) + Number(r.thanh_tien || 0));
  if (daysBetween(d, NOW) <= 30) o.rev30 += Number(r.thanh_tien || 0);
}

// 3) Công nợ quá hạn mới nhất (gọi RPC finance_debt_report theo tháng gần nhất có dữ liệu bán)
const lastSaleMonth = [...byKh.values()].map(o => Object.keys(o.months)).flat().sort().slice(-1)[0]
  || months[months.length - 1];
let debtMap = new Map(); // norm_ma -> row
const { data: debtJson, error: e3 } = await db.rpc('finance_debt_report', { p_thang: lastSaleMonth });
if (!e3 && debtJson?.rows) {
  for (const r of debtJson.rows) debtMap.set(normMa(r.ma_kh), r);
} else {
  console.warn('Không gọi được finance_debt_report (bỏ qua công nợ):', e3?.message);
}

// 4) Ghép + tính đèn sức khỏe
const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const healthOf = (o, debt) => {
  const arr = months.map(m => o?.months?.[m] || 0);
  const cur = arr[arr.length - 1], prev = arr[arr.length - 2] || 0;
  const days = o?.lastDate ? daysBetween(o.lastDate, NOW) : 9999;
  const drop = prev > 0 ? (prev - cur) / prev : 0;      // % tụt so tháng trước
  const overdue = !!debt?.qua_han;
  let level = 'green';
  const reasons = [];
  if (days >= 30) { level = 'red'; reasons.push(`${days >= 9999 ? 'chưa có đơn' : days + ' ngày không đơn'}`); }
  else if (days >= 21) { level = 'yellow'; reasons.push(`${days} ngày không đơn`); }
  if (overdue) { level = 'red'; reasons.push('nợ quá hạn'); }
  if (drop >= 0.4 && prev > 0) { level = 'red'; reasons.push(`tụt ${Math.round(drop * 100)}%`); }
  else if (drop >= 0.3 && prev > 0 && level !== 'red') { level = 'yellow'; reasons.push(`tụt ${Math.round(drop * 100)}%`); }
  if (level === 'green') reasons.push('khỏe');
  // điểm 0-100 (nháp): recency + trend + nợ
  let score = 100;
  if (days >= 9999) score -= 60; else score -= Math.min(60, Math.max(0, (days - 10) * 1.6));
  score -= Math.min(30, Math.max(0, drop * 60));
  if (overdue) score -= 25;
  score = Math.max(5, Math.min(100, Math.round(score)));
  return { level, reasons, score, days: days >= 9999 ? null : days, drop: prev > 0 ? Math.round(drop * 100) : null,
    rev: arr, rev30: o?.rev30 || 0, lastDate: o?.lastDate ? iso(o.lastDate) : null,
    debt: debt ? { con_thieu: debt.con_thieu, qua_han: !!debt.qua_han } : null };
};

const list = (custs || []).map(c => {
  const norm = normMa(c.ma_kh);
  const o = byKh.get(norm);
  const debt = debtMap.get(norm);
  const top = [...(o?.products || new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, v]) => ({ name: k, value: v }));
  return {
    id: c.id, ma: c.ma_kh, ten: c.ten_kh,
    kd: c.assigned?.full_name || '', tinh: c.tinh_thanh || '',
    hang: c.tier?.code || '—', trangthai: c.status?.name || '',
    health: healthOf(o, debt), top,
    tong6thang: (o ? Object.values(o.months).reduce((a, b) => a + b, 0) : 0),
  };
}).filter(x => x.health.score != null);

// sắp: đỏ trước, rồi vàng, rồi xanh; trong mỗi nhóm theo doanh số giảm dần
const rank = { red: 0, yellow: 1, green: 2 };
list.sort((a, b) => (rank[a.health.level] - rank[b.health.level]) || (b.tong6thang - a.tong6thang));

console.log(`Khách: ${list.length} · Tháng nợ: ${lastSaleMonth} · Đỏ ${list.filter(x=>x.health.level==='red').length} · Vàng ${list.filter(x=>x.health.level==='yellow').length} · Xanh ${list.filter(x=>x.health.level==='green').length}`);

// 5) Xuất HTML (nhúng thẳng số → mở offline, không cần đăng nhập)
const DATA = JSON.stringify({ months, generated: iso(NOW), debtMonth: lastSaleMonth, list });
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LifePro CRM — Demo Mua hàng & Sức khỏe</title>
<style>
:root{--navy:#1e3a8a;--ink:#0f2a4a;--bg:#f0f4f8;--card:#fff;--line:#e2e8f0;--mut:#64748b;--red:#dc2626;--yellow:#d97706;--green:#0e9f6e}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:#111;line-height:1.5;padding:16px 20px 60px}
h1{font-size:20px;color:var(--ink)}
.sub{font-size:12px;color:var(--mut);margin:2px 0 16px}
.wrap{display:grid;grid-template-columns:360px 1fr;gap:16px;align-items:start;max-width:1280px;margin:0 auto}
@media(max-width:900px){.wrap{grid-template-columns:1fr}}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.ph{padding:12px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:8px}
.ph b{font-size:13px;color:var(--ink)}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 auto 14px;max-width:1280px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.kpi label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);font-weight:700}
.kpi strong{font-size:20px;display:block;margin-top:2px}
.kpi.red{border-left:4px solid var(--red)}.kpi.yellow{border-left:4px solid var(--yellow)}.kpi.green{border-left:4px solid var(--green)}
input.s{width:100%;border:none;outline:none;font-size:13px;padding:8px 12px;background:#f1f5f9;border-radius:10px;margin:10px 12px 0}
.chips{display:flex;gap:6px;padding:10px 12px;flex-wrap:wrap;border-bottom:1px solid var(--line)}
.chip{font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px;border:1px solid var(--line);background:#fff;cursor:pointer}
.chip.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.lst{max-height:600px;overflow:auto}
.it{padding:11px 14px;border-bottom:1px solid #f1f5f9;display:flex;gap:10px;cursor:pointer;align-items:flex-start}
.it:hover{background:#f8fafc}.it.on{background:#eff6ff;border-left:3px solid var(--navy)}
.dot{width:10px;height:10px;border-radius:50%;margin-top:5px;flex-shrink:0}
.d-red{background:var(--red)}.d-yellow{background:var(--yellow)}.d-green{background:var(--green)}
.it .m{flex:1;min-width:0}
.nm{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sm{font-size:11px;color:var(--mut);margin-top:2px}
.bdg{font-size:10px;font-weight:800;color:#fff;border-radius:6px;padding:1px 6px}
.det{padding:16px}
.dh{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.dh .av{width:46px;height:46px;border-radius:12px;background:var(--navy);color:#fff;display:grid;place-items:center;font-weight:800}
.tabs{display:flex;gap:6px;margin:14px 0;flex-wrap:wrap}
.tab{font-size:13px;font-weight:600;padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:#fff;cursor:pointer;color:var(--mut)}
.tab.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.stat{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
@media(max-width:700px){.stat{grid-template-columns:repeat(2,1fr)}}
.box{background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.box label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);font-weight:700}
.box strong{display:block;font-size:16px;margin-top:3px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:700px){.grid2{grid-template-columns:1fr}}
.bars{display:flex;align-items:flex-end;gap:8px;height:130px;margin-top:10px}
.bwrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px}
.bar{width:100%;border-radius:7px 7px 0 0;background:#c7d2fe;display:flex;align-items:flex-end;justify-content:center;font-size:10px;font-weight:700;color:#3730a3;min-height:2px;padding-bottom:3px}
.bar.cur{background:var(--navy);color:#fff}
.bar.warn{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
.blab{font-size:10px;color:var(--mut)}
.prod{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #f1f5f9}
.ring{width:110px;height:110px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:26px;flex-shrink:0}
.ring small{display:block;font-size:10px;font-weight:600;color:var(--mut)}
.hcard{display:grid;grid-template-columns:110px 1fr;gap:16px;align-items:center;background:linear-gradient(135deg,#eff6ff,#fff);border:1px solid var(--line);border-radius:12px;padding:16px}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.tag{font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid var(--line)}
.formula{font-size:12px;color:#334155;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:12px;display:grid;gap:3px}
.note{font-size:11px;color:var(--mut);margin-top:8px}
.foot{text-align:center;color:var(--mut);font-size:12px;margin-top:24px}
</style></head><body>
<div style="max-width:1280px;margin:0 auto 14px"><h1>LifePro CRM — Demo Mua hàng &amp; Công nợ + Sức khỏe</h1>
<p class="sub">Toàn bộ số liệu lấy <b>THẬT</b> từ Supabase (sổ bán hàng + báo cáo công nợ TK131). Tháng công nợ: <b id="dm"></b> · xuất lúc <b id="gen"></b>.</p></div>
<div class="wrap">
  <div class="panel">
    <div class="ph"><b>Danh sách khách hàng</b><span id="cnt" style="font-size:11px;color:var(--mut)"></span></div>
    <input class="s" id="q" placeholder="Tìm tên, mã, tỉnh, kinh doanh…">
    <div class="chips" id="chips">
      <span class="chip on" data-f="all">Tất cả</span>
      <span class="chip" data-f="red">🔴 Nguy cơ</span>
      <span class="chip" data-f="yellow">🟡 Cần chăm</span>
      <span class="chip" data-f="green">🟢 Khỏe</span>
    </div>
    <div class="lst" id="lst"></div>
  </div>
  <div class="panel"><div class="det" id="det"></div></div>
</div>
<p class="foot">Bấm 2 tab trong hồ sơ: <b>Mua hàng &amp; Công nợ</b> · <b>Sức khỏe</b>. Đây là bản demo — chưa phải trang chính thức.</p>
<script>
const DATA=${DATA};
const fmt=n=>Number(n||0).toLocaleString('vi-VN');
const tr=n=>n>=1e9?(n/1e9).toFixed(1)+' tỷ':(n/1e6).toFixed(1).replace(/\\.0$/,'')+' tr';
const LVL={red:'🔴 Nguy cơ',yellow:'🟡 Cần chăm',green:'🟢 Khỏe'};
const COL={red:'var(--red)',yellow:'var(--yellow)',green:'var(--green)'};
const BG={red:'#fee2e2',yellow:'#fef3c7',green:'#d1fae5'};
const hangBd={'A':'#059669','A+':'#047857','B+':'#1e3a8a','B':'#d97706','C':'#ea580c','D':'#dc2626'};
document.getElementById('dm').textContent=DATA.debtMonth;
document.getElementById('gen').textContent=DATA.generated;
let act=DATA.list[0]?.id, filt='all';
function money(n){return fmt(Math.round(n))+'đ';}

function renderList(){
  const q=(document.getElementById('q').value||'').toLowerCase();
  let r=DATA.list.filter(x=>{
    if(q&&!(x.ten.toLowerCase().includes(q)||x.ma.toLowerCase().includes(q)||(x.tinh||'').toLowerCase().includes(q)||(x.kd||'').toLowerCase().includes(q)))return false;
    if(filt==='all')return true;return x.health.level===filt;
  });
  document.getElementById('cnt').textContent=r.length+' khách';
  document.getElementById('lst').innerHTML=r.map(x=>
    '<div class="it '+(x.id===act?'on':'')+'" data-id="'+x.id+'"><div class="dot d-'+x.health.level+'"></div><div class="m">'
    +'<div class="nm">'+x.ten+'</div>'
    +'<div class="sm">'+x.ma+' · '+(x.kd||'—')+' · '+(x.tinh||'—')+'</div>'
    +'<div class="sm">6 tháng: <b>'+tr(x.tong6thang)+'</b>'+(x.health.days!=null?' · '+x.health.days+' ngày chưa đơn':' · chưa có đơn')+'</div>'
    +'</div><span class="bdg" style="background:'+(hangBd[x.hang]||'#94a3b8')+'">'+x.hang+'</span></div>'
  ).join('')||'<div style="padding:24px;text-align:center;color:var(--mut)">Không có khách.</div>';
}
function barChart(rev){
  const max=Math.max(...rev,1);
  return rev.map((v,i)=>{
    const cur=i===rev.length-1;
    const prev=i>0?rev[i-1]:0;
    const warn=prev>0&&v<prev*0.7&&v>0;
    const h=v<=0?2:Math.max(4,Math.round(v/max*120));
    return '<div class="bwrap"><div class="bar '+(cur?'cur':warn?'warn':'')+'" style="height:'+h+'px">'+(v>0?tr(v):'')+'</div><div class="blab">T'+DATA.months[i].slice(5)+'</div></div>';
  }).join('');
}
function renderDetail(){
  const x=DATA.list.find(c=>c.id===act); if(!x)return;
  const hh=x.health;
  const ring='conic-gradient('+COL[hh.level]+' 0 '+hh.score+'%, #e2e8f0 '+hh.score+'% 100%)';
  const mh=tabMH(x), sh=tabSK(x,ring);
  document.getElementById('det').innerHTML=
   '<div class="dh"><div class="av">🚗</div><div style="flex:1;min-width:0"><h1 style="font-size:17px">'+x.ten+'</h1>'
   +'<div class="sm">'+x.ma+' · Kinh doanh: <b>'+(x.kd||'—')+'</b> · '+(x.tinh||'—')+' · <span class="bdg" style="background:'+(hangBd[x.hang]||'#94a3b8')+'">'+x.hang+'</span> · '+LVL[hh.level]+'</div></div></div>'
   +'<div class="tabs"><span class="tab on" data-t="mh">Mua hàng &amp; Công nợ</span><span class="tab" data-t="sk">Sức khỏe</span></div>'
   +'<div id="panel">'+mh+'</div>';
  document.querySelectorAll('#det .tab').forEach(t=>t.onclick=()=>{
    document.querySelectorAll('#det .tab').forEach(e=>e.classList.remove('on'));t.classList.add('on');
    document.getElementById('panel').innerHTML=t.dataset.t==='mh'?tabMH(x):tabSK(x,ring);
  });
}
function tabMH(x){
  const hh=x.health;
  const d=hh.debt;
  return '<div class="stat">'
   +'<div class="box"><label>Doanh số 30 ngày</label><strong>'+tr(hh.rev30)+'</strong></div>'
   +'<div class="box"><label>Doanh số 6 tháng</label><strong>'+tr(x.tong6thang)+'</strong></div>'
   +'<div class="box"><label>Đơn cuối</label><strong>'+(hh.lastDate?hh.lastDate.split('-').reverse().join('/'):'chưa có')+'</strong></div>'
   +'<div class="box"><label>Công nợ còn thiếu</label><strong style="color:'+(d&&d.qua_han?'var(--red)':d?'#111':'var(--mut)')+'">'+(d?tr(d.con_thieu)+(d.qua_han?' ⚠':''):'—')+'</strong></div>'
   +'</div>'
   +'<div class="grid2">'
   +'<div class="box"><label>Doanh số 6 tháng gần nhất (đơn vị: tr đồng)</label><div class="bars">'+barChart(hh.rev)+'</div></div>'
   +'<div class="box"><label>Top mã hay lấy (6 tháng)</label>'
     +(x.top.length?x.top.map(p=>'<div class="prod"><span>'+p.name+'</span><b>'+tr(p.value)+'</b></div>').join(''):'<div class="note">Chưa có dữ liệu bán trong 6 tháng.</div>')
   +'</div></div>'
   +'<div class="formula">💡 Số liệu bán lấy từ <b>sổ chi tiết bán hàng</b> (sales_rows). Công nợ lấy từ <b>báo cáo Công nợ TK131</b> cùng kỳ ('+DATA.debtMonth+'), khớp theo mã khách.</div>';
}
function tabSK(x,ring){
  const hh=x.health;
  return '<div class="hcard"><div class="ring" style="background:'+ring+';color:'+COL[hh.level]+';border:6px solid '+BG[hh.level]+'">'+hh.score+'<small><span>Điểm SK</span></small></div>'
   +'<div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="dot d-'+hh.level+'" style="margin:0"></span><b style="font-size:15px">'+LVL[hh.level]+'</b><span class="bdg" style="background:'+(hangBd[x.hang]||'#94a3b8')+'">'+x.hang+'</span></div>'
   +'<div class="tags">'+hh.reasons.map(r=>'<span class="tag">'+r+'</span>').join('')+'</div>'
   +(hh.debt&&hh.debt.con_thieu>0?'<p class="note">Số còn thiếu: <b style="color:'+(hh.debt.qua_han?'var(--red)':'#111')+'">'+money(hh.debt.con_thieu)+'</b>'+(hh.debt.qua_han?' — đang QUÁ HẠN':'')+'</p>':'')
   +'</div></div>'
   +'<div class="formula"><b>Công thức đèn (nháp, chỉnh trong Cài đặt sau):</b>'
   +'<div>🔴 Đỏ: ≥30 ngày không đơn <b>hoặc</b> nợ quá hạn <b>hoặc</b> tụt ≥40% so tháng trước</div>'
   +'<div>🟡 Vàng: 21–29 ngày không đơn <b>hoặc</b> tụt 30–40%</div>'
   +'<div>🟢 Xanh: còn lại</div>'
   +'<div>Điểm = 100 − phạt(ngày không đơn) − phạt(% tụt) − 25(nếu quá hạn)</div></div>'
   +'<p class="note">Chưa có: hạn mức tín dụng, số lần tương tác (thuộc tab Tương tác — làm đợt sau).</p>';
}
document.getElementById('lst').addEventListener('click',e=>{const d=e.target.closest('[data-id]');if(d){act=d.dataset.id;renderList();renderDetail();}});
document.getElementById('chips').addEventListener('click',e=>{const c=e.target.closest('.chip');if(c){document.querySelectorAll('#chips .chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');filt=c.dataset.f;renderList();}});
document.getElementById('q').addEventListener('input',renderList);
renderList();renderDetail();
</script></body></html>`;
writeFileSync(new URL('../crm-demo-suckhoe.html', import.meta.url), html, 'utf8');
console.log('Đã ghi crm-demo-suckhoe.html');
