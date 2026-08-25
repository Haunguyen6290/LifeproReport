// tests/okr.validator.test.ts — schema sanity (Task 1) + validator unit (Task 3)
import { describe, test, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasNumber, validateKRs, warnObjective, validateObjective, periodLabel } from '@/lib/okr';

function loadEnv(): Record<string, string> {
  const m: Record<string, string> = { ...process.env as Record<string, string> };
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const x = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!x) continue;
      const key = x[1];
      if (m[key] !== undefined && m[key] !== '') continue;
      let v = x[2].trim();
      if (v.startsWith('"') || v.startsWith("'")) {
        const q = v[0];
        const end = v.indexOf(q, 1);
        if (end !== -1) v = v.slice(1, end);
        else {
          v = v.slice(1);
          const hash = v.indexOf('#');
          if (hash !== -1) v = v.slice(0, hash).trim();
          if (v.endsWith(q)) v = v.slice(0, -1);
        }
      } else {
        const commentIdx = v.search(/\s+#.*$/);
        if (commentIdx !== -1) v = v.slice(0, commentIdx).trim();
        else if (v.startsWith('#')) v = '';
        if (v.length >= 2 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
          v = v.slice(1, -1);
        }
      }
      m[key] = v;
    }
  } catch {}
  return m;
}

const E = loadEnv();

function getDb() {
  return createClient(E.NEXT_PUBLIC_SUPABASE_URL!, E.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

// ── Task 3 validator unit tests (brief snippet + extended) ──
describe('okr validator — hasNumber / validateKRs / warnObjective', () => {
  test('KR phai co so', () => expect(validateKRs(['Chốt 5 khách','Đạt 2 tỷ'], 1).ok).toBe(true));
  test('KR phai co so — 2 KR co so (2-5 KR hard block)', () => expect(validateKRs(['Chốt 5 khách','Đạt 2 tỷ'], 2).ok).toBe(true));
  test('KR khong so bi chan', () => expect(validateKRs(['Chăm sóc khách','Hỗ trợ KH'], 1).ok).toBe(false));
  test('KR khong so bi chan — single', () => expect(validateKRs(['Chăm sóc khách'], 1).ok).toBe(false));
  test('1-3 O, 2-5 KR — vuot 5 KR bi chan', () => expect(validateKRs(['1','2','3','4','5','6'], 1).ok).toBe(false));
  test('hasNumber nhan so, %, đ', () => {
    expect(hasNumber('Chốt 5 khách')).toBe(true);
    expect(hasNumber('Tăng 20%')).toBe(true);
    expect(hasNumber('10đ thưởng')).toBe(true);
    expect(hasNumber('Chăm sóc khách')).toBe(false);
  });
  test('validateKRs chan khi oCount ngoai 1-3', () => {
    expect(validateKRs(['a1','b2'], 0).ok).toBe(false);
    expect(validateKRs(['a1','b2'], 4).ok).toBe(false);
    expect(validateKRs(['a1','b2'], 1).ok).toBe(true);
    expect(validateKRs(['a1','b2'], 3).ok).toBe(true);
  });
  test('validateKRs chan khi so KR <2 hoac >5', () => {
    expect(validateKRs(['1'], 1).ok).toBe(false); // 1 KR bi chan — duoi 2
    expect(validateKRs(['1','2','3','4','5','6'], 1).ok).toBe(false);
    expect(validateKRs(['a1','b2'], 1).ok).toBe(true);
    expect(validateKRs(['1','2','3','4','5'], 1).ok).toBe(true);
  });
  test('warnObjective / validateObjective — O co so thi warn', () => {
    expect(warnObjective('Tăng 20% doanh số')).toBeTruthy();
    expect(warnObjective('Bứt phá doanh số')).toBe('');
    expect(validateObjective('').ok).toBe(false);
    expect(validateObjective('Bứt phá doanh số').ok).toBe(true);
    expect(validateObjective('Tăng 20% doanh số').warn).toBeTruthy();
  });
  test('periodLabel format dd/mm/yyyy - dd/mm/yyyy', () => {
    expect(periodLabel('2026-09-01', '2026-12-31')).toBe('01/09/2026 - 31/12/2026');
  });
});

// ── Task 1 schema sanity (kept, network-dependent — skip gracefully if DB not migrated in this env) ──
// Warn+skip is allowed locally when migrations not applied (DB env may not have okrs/weekly tables),
// but must FAIL in CI (process.env.CI truthy) so breakage is not hidden. Gates use !process.env.CI.
describe('okr validator — schema sanity', () => {
  test('okrs tables exist', async () => {
    const db = getDb();
    const { error: e1 } = await db.from('okrs').select('id').limit(1);
    const { error: e2 } = await db.from('okr_key_results').select('id').limit(1);
    if (e1 && (e1 as any).code === 'PGRST205' && !process.env.CI) { console.warn('[skip] okrs table not in schema cache — migration not applied in this env'); return; }
    if (e2 && (e2 as any).code === 'PGRST205' && !process.env.CI) { console.warn('[skip] okr_key_results not in schema cache'); return; }
    expect(e1).toBeNull();
    expect(e2).toBeNull();
  });
  test('weekly tables exist', async () => {
    const db = getDb();
    const { error: e1 } = await db.from('weekly_plans').select('id').limit(1);
    const { error: e2 } = await db.from('weekly_reports').select('id').limit(1);
    if (e1 && (e1 as any).code === 'PGRST205' && !process.env.CI) { console.warn('[skip] weekly_plans not in schema cache'); return; }
    if (e2 && (e2 as any).code === 'PGRST205' && !process.env.CI) { console.warn('[skip] weekly_reports not in schema cache'); return; }
    expect(e1).toBeNull();
    expect(e2).toBeNull();
  });
  test('warehouse_reports table exists', async () => {
    const db = getDb();
    const { error } = await db.from('warehouse_reports').select('id').limit(1);
    if (error && (error as any).code === 'PGRST205' && !process.env.CI) { console.warn('[skip] warehouse_reports not in schema cache'); return; }
    expect(error).toBeNull();
  });
  test('category nhom_van_de_kho seeded with 6 items', async () => {
    const db = getDb();
    const { data: cat, error: e1 } = await db.from('categories').select('id').eq('slug', 'nhom_van_de_kho').single();
    if (e1 && (e1 as any).code === 'PGRST116' && !process.env.CI) { console.warn('[skip] nhom_van_de_kho not seeded in this env'); return; }
    if (e1 && (e1 as any).code === 'PGRST205' && !process.env.CI) { console.warn('[skip] categories not in schema cache'); return; }
    expect(e1).toBeNull();
    expect(cat).toBeTruthy();
    const { data: items, error: e2 } = await db.from('category_items').select('id, name').eq('category_id', (cat as any).id);
    if (e2 && (e2 as any).code === 'PGRST205' && !process.env.CI) { console.warn('[skip] category_items not in schema cache'); return; }
    expect(e2).toBeNull();
    expect((items as any[]).length).toBe(6);
    const names = (items as any[]).map((r) => r.name).sort();
    expect(names).toEqual(['Hàng đề xuất thanh lý', 'Hàng lâu ngày', 'Hàng trả lại', 'Hộp xấu', 'Thiếu linh kiện', 'Thiếu vỏ hộp'].sort());
  });
});
