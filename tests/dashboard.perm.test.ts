import { describe, test, expect } from 'vitest';
import { visibleTabs, visibleTabIds, DASHBOARD_TABS } from '@/lib/dashboard';
import { LINKS } from '@/components/AppSidebar';
import { PERMS } from '@/app/quan-tri/phan-quyen/page';

describe('dashboard perms', () => {
  test('Kho + OKR hien cho ca cong ty (perms rong)', () => {
    const tabs = visibleTabs(['bao_cao_kho']);
    expect(tabs).toEqual(['OKR', 'Kho']);
  });

  test('SALES (xem_okr+bao_cao_tuan) thay OKR + Tong hop + Kho', () => {
    const tabs = visibleTabs(['xem_okr', 'bao_cao_tuan']);
    expect(tabs).toEqual(['OKR', 'Báo cáo Tổng hợp KD', 'Kho']);
  });

  test('Tong hop KD chi kinh doanh + admin (khong co bao_cao_tuan/quan_ly_okr thi an)', () => {
    // nguoi chi co xem_okr (khong kinh doanh) -> khong thay Tong hop
    expect(visibleTabs(['xem_okr'])).toEqual(['OKR', 'Kho']);
  });

  test('Admin (quan_ly_okr) thay ca 3 tab', () => {
    const tabs = visibleTabs(['quan_ly_okr', 'bao_cao_tuan', 'bao_cao_kho', 'xem_okr']);
    expect(tabs).toEqual(['OKR', 'Báo cáo Tổng hợp KD', 'Kho']);
  });

  test('quan_ly_okr-only thay ca 3 tab (superset)', () => {
    expect(visibleTabs(['quan_ly_okr'])).toEqual(['OKR', 'Báo cáo Tổng hợp KD', 'Kho']);
    expect(visibleTabIds(['quan_ly_okr'])).toEqual(['okr', 'tonghop', 'kho']);
  });

  test('visibleTabIds mirrors visibleTabs', () => {
    expect(visibleTabIds(['bao_cao_kho'])).toEqual(['okr', 'kho']);
    expect(visibleTabIds([])).toEqual(['okr', 'kho']);
  });

  test('PERMS contains 4 new perms', () => {
    const keys = PERMS.map((p) => p.key);
    expect(keys).toContain('quan_ly_okr');
    expect(keys).toContain('xem_okr');
    expect(keys).toContain('bao_cao_tuan');
    expect(keys).toContain('bao_cao_kho');
  });

  test('LINKS has /okr, /bao-cao-tuan, /bao-cao-kho with needs', () => {
    const okr = LINKS.find((l) => l.href === '/okr');
    const tuan = LINKS.find((l) => l.href === '/bao-cao-tuan');
    const kho = LINKS.find((l) => l.href === '/bao-cao-kho');
    expect(okr).toBeTruthy();
    expect(tuan).toBeTruthy();
    expect(kho).toBeTruthy();
    expect(okr!.needs).toEqual(expect.arrayContaining(['quan_ly_okr']));
    expect(kho!.needs).toEqual(expect.arrayContaining(['bao_cao_kho']));
    // Kho-only must not see OKR link (needs check): kho perms do not satisfy okr needs
    const khoCanSeeOkr = (okr!.needs ?? []).some((p) => ['bao_cao_kho'].includes(p));
    expect(khoCanSeeOkr).toBe(false);
  });

  test('DASHBOARD_TABS shape', () => {
    expect(DASHBOARD_TABS.map((t) => t.id)).toEqual(['okr', 'tonghop', 'kho']);
  });
});
