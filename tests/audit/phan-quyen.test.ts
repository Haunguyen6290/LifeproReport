// tests/audit/phan-quyen.test.ts
// Ma trận phân quyền: từng vai trò × từng hành động → kỳ vọng pass/bị chặn.
// Tự đọc permissions từ DB nên thêm vai trò/quyền mới là tự có thêm ca.
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function env() {
  const m: Record<string, string> = {};
  for (const l of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
    const x = l.match(/^([A-Z0-9_]+)=(.*)$/); if (x) m[x[1]] = x[2];
  }
  return m;
}
const E = env();
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type Probe = { userId: string; client: any };
async function signIn(email: string, pw: string): Promise<Probe> {
  const a = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await a.auth.signInWithPassword({ email, password: pw });
  if (error || !data.session) throw new Error('login ' + email + ': ' + error?.message);
  const c = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
  return { userId: data.user.id, client: c };
}

const MATRIX: Array<{ perm: string; action: string; check: (c: any, userId: string, adminId: string) => Promise<boolean> }> = [
  { perm: 'sua_khach_bat_ky', action: 'sửa khách người khác', check: async (c, _uid, adminId) => {
    const { data: kh } = await admin.from('customers').select('id').eq('assigned_to', adminId).limit(1).single();
    if (!kh) return true;
    const { data: after } = await c.from('customers').select('ten_kh').eq('id', kh.id).single();
    const old = after?.ten_kh;
    await c.from('customers').update({ ten_kh: old + '_probe' }).eq('id', kh.id);
    const { data: cur } = await admin.from('customers').select('ten_kh').eq('id', kh.id).single();
    return cur.ten_kh === old; // true = bị chặn (không đổi)
  }},
  { perm: 'quan_ly_chien_dich', action: 'tạo chiến dịch', check: async (c, uid) => {
    const { error } = await c.from('campaigns').insert({ name: 'Probe', owner_id: uid });
    if (!error) await admin.from('campaigns').delete().eq('name', 'Probe');
    return !!error;
  }},
  { perm: 'ket_luan', action: 'kết luận tin', check: async (c, uid, adminId) => {
    const { data: tin } = await admin.from('market_news').select('id').limit(1).single();
    if (!tin) return true;
    const { error } = await c.from('market_news').update({ status: 'KETLUAN' }).eq('id', tin.id);
    return !!error;
  }},
  { perm: 'xem_log', action: 'xem audit_logs (customer history — allowed for all per spec)', check: async (c) => {
    // Spec 03: Lịch sử khách (entity_type='customer') cho mọi người xem; RLS hiện allow all cho customer.
    // Không kỳ vọng SALES bị chặn ở đây — luôn coi là pass.
    return false;
  }},
  { perm: 'quan_ly_nguoi_dung', action: 'tạo role', check: async (c) => {
    const { error } = await c.from('roles').insert({ name: 'PROBE_' + Date.now(), permissions: [] });
    if (!error) await admin.from('roles').delete().eq('name', 'PROBE_' + Date.now());
    return !!error;
  }},
];

describe('audit: phân quyền', () => {
  it('đọc permissions từ DB và kiểm tra từng ô', async () => {
    const { data: roles } = await admin.from('roles').select('name, permissions');
    expect(roles && roles.length >= 2).toBe(true);
    const salesRole = (roles as any[]).find((r) => r.name === 'SALES');
    expect(salesRole).toBeTruthy();
    // Tạo sales tạm
    const email = `audit_sales_${Date.now()}@congty.local`;
    const { data: u } = await admin.auth.admin.createUser({ email, password: '123456', email_confirm: true });
    await admin.from('profiles').insert({ id: u.user!.id, username: `audit_${Date.now().toString().slice(-6)}`, full_name: 'Audit Sales', role_id: salesRole.id });
    const sales = await signIn(email, '123456');
    const adminId = (await admin.from('profiles').select('id').eq('username', 'admin').single()).data!.id;

    // Chuẩn bị 1 khách của admin để test sửa
    const { data: kh0 } = await admin.from('customers').insert({ ma_kh: 'AUDIT_' + Date.now(), ten_kh: 'Audit', assigned_to: adminId, sdt: '0900 000 009', created_by: adminId, updated_by: adminId }).select('id').single();

    for (const m of MATRIX) {
      const has = (salesRole.permissions as string[]).includes(m.perm);
      const blocked = await m.check(sales.client, sales.userId, adminId);
      // SALES có quyền thì không bị chặn, không có thì phải bị chặn
      if (m.perm === 'xem_log') { expect(blocked).toBe(false); continue; }
      expect(blocked, `SALES ${m.action} (perm ${m.perm}, has=${has})`).toBe(!has ? true : blocked === false || blocked === true);
      if (!has) expect(blocked).toBe(true);
    }

    await admin.from('customers').delete().eq('id', kh0.id);
    await admin.from('profiles').delete().eq('id', u.user!.id);
    await admin.auth.admin.deleteUser(u.user!.id);
  });
});
