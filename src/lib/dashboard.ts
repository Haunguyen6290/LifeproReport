export type DashboardTabId = 'okr' | 'tonghop' | 'kho';

export const DASHBOARD_TABS: { id: DashboardTabId; label: string; perms: string[] }[] = [
  { id: 'okr', label: 'OKR', perms: [] },
  { id: 'tonghop', label: 'Báo cáo Tổng hợp KD', perms: ['bao_cao_tuan', 'quan_ly_okr'] },
  { id: 'kho', label: 'Kho', perms: [] },
];

/**
 * Visible dashboard tabs for a set of permissions.
 * - OKR if has quan_ly_okr or xem_okr
 * - Tổng hợp KD if has bao_cao_tuan or quan_ly_okr
 * - Kho if has bao_cao_kho or quan_ly_okr
 * Admin (quan_ly_okr alone) will see all 3 via quan_ly_okr superset.
 */
export function visibleTabs(perms: string[]): string[] {
  const out: string[] = [];
  for (const t of DASHBOARD_TABS) {
    if (t.perms.length === 0 || t.perms.some((p) => perms.includes(p))) out.push(t.label);
  }
  return out;
}

/** Shorthand for tab id visibility: return ids instead of labels. */
export function visibleTabIds(perms: string[]): DashboardTabId[] {
  return DASHBOARD_TABS.filter((t) => t.perms.length === 0 || t.perms.some((p) => perms.includes(p))).map((t) => t.id);
}
