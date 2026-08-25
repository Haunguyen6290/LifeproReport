import { LINKS } from '@/components/AppSidebar';
import { test, expect } from 'vitest';

test('nav has Bao cao Tong hop KD', () => {
  expect(LINKS.some(l => l.label === 'Báo cáo Tổng hợp KD')).toBe(true);
});
