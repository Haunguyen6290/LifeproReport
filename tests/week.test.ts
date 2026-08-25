import { describe, test, expect } from 'vitest';
import { weekBounds, isLate, deadlineKH, deadlineBC, deadlinePlan, deadlineReport, deadline } from '@/lib/week';

describe('weekBounds', () => {
  test('T2 2026-08-24 -> tu 24 den T7 29', () => {
    const b = weekBounds(new Date('2026-08-24T00:00:00Z'));
    expect(b.tu).toBe('2026-08-24');
    expect(b.den).toBe('2026-08-29');
  });
  test('T2 2026-08-17 -> tu 17 den T7 22', () => {
    const b = weekBounds(new Date('2026-08-17T00:00:00Z'));
    expect(b.tu).toBe('2026-08-17');
    expect(b.den).toBe('2026-08-22');
  });
  test('T4 2026-08-19 -> tu 17 den T7 22', () => {
    const b = weekBounds(new Date('2026-08-19T00:00:00Z'));
    expect(b.tu).toBe('2026-08-17');
    expect(b.den).toBe('2026-08-22');
  });
  test('T7 2026-08-22 -> cung tuan 17-22', () => {
    const b = weekBounds(new Date('2026-08-22T00:00:00Z'));
    expect(b.tu).toBe('2026-08-17');
    expect(b.den).toBe('2026-08-22');
  });
});

describe('deadline & isLate', () => {
  // tuan 17/08 (T2) -> deadlineKH = 17h30 VN T7 15/08 = 10:30Z
  test('deadlineKH tuan 2026-08-17 la 17h30 T7 2026-08-15 VN = 10:30Z', () => {
    const dl = deadlineKH('2026-08-17');
    expect(dl.toISOString()).toBe('2026-08-15T10:30:00.000Z');
  });
  // tuan 17/08 (T2) -> deadlineBC = 17h30 VN T2 24/08 = 10:30Z
  test('deadlineBC tuan 2026-08-17 la 17h30 T2 2026-08-24 VN = 10:30Z', () => {
    const dl = deadlineBC('2026-08-17');
    expect(dl.toISOString()).toBe('2026-08-24T10:30:00.000Z');
  });
  test('alias deadlinePlan / deadlineReport / deadline(kind)', () => {
    expect(deadlinePlan('2026-08-17').toISOString()).toBe(deadlineKH('2026-08-17').toISOString());
    expect(deadlineReport('2026-08-17').toISOString()).toBe(deadlineBC('2026-08-17').toISOString());
    expect(deadline('2026-08-17', 'plan').toISOString()).toBe(deadlineKH('2026-08-17').toISOString());
    expect(deadline('2026-08-17', 'report').toISOString()).toBe(deadlineBC('2026-08-17').toISOString());
  });
  test('dung han tinh theo created_at (truoc deadline)', () => {
    expect(isLate('2026-08-15T09:00:00Z', deadlineKH('2026-08-17'))).toBe(false);
  });
  test('tre han tinh theo created_at (sau deadline)', () => {
    expect(isLate('2026-08-15T11:00:00Z', deadlineKH('2026-08-17'))).toBe(true);
  });
  test('dung bang deadline thi khong tre', () => {
    expect(isLate('2026-08-15T10:30:00Z', deadlineKH('2026-08-17'))).toBe(false);
  });
});
