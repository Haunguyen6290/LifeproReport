import { supabase } from './supabase/client';

export type OkrTemplate = {
  id: string;
  name: string;
  description: string;
  role: string;
  group: string;
  groupLabel: string;
  objective?: string;
};

/** Map tên vai trò của user -> các role template được phép thấy. 'ALL' = thấy hết (quản lý). */
const ROLE_TO_TEMPLATE_ROLES: Record<string, string[] | 'ALL'> = {
  'KINH_DOANH': ['KINH_DOANH'],
  'SALES': ['KINH_DOANH'],
  'KHO': ['KHO'],
  'KẾ_TOÁN': ['KẾ_TOÁN'],
  'ADMIN': 'ALL',
  'GIÁM_ĐỐC': 'ALL',
};

export function templateRolesFor(roleName: string): string[] | 'ALL' {
  return ROLE_TO_TEMPLATE_ROLES[roleName] ?? 'ALL';
}

/** Load O hoặc KR mẫu, lọc theo vai trò của user. */
export async function loadOkrTemplates(
  catSlug: 'okr_o_template' | 'okr_kr_template',
  roleName: string,
): Promise<OkrTemplate[]> {
  const allowed = templateRolesFor(roleName);
  const { data } = await supabase
    .from('categories')
    .select('category_items(id, name, description, extra)')
    .eq('slug', catSlug)
    .single();
  const items = ((data as any)?.category_items ?? []) as { id: string; name: string; description: string; extra: any }[];
  return items
    .filter((it) => {
      const r = String((it.extra as any)?.role ?? '');
      if (allowed === 'ALL') return true;
      return allowed.includes(r);
    })
    .map((it) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      role: String((it.extra as any)?.role ?? ''),
      group: String((it.extra as any)?.group ?? ''),
      groupLabel: String((it.extra as any)?.groupLabel ?? ''),
      objective: (it.extra as any)?.objective,
    }));
}
