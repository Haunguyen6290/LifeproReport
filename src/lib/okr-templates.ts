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

/**
 * Map tên vai trò của user -> các role template được phép thấy.
 * - ADMIN / GIÁM_ĐỐC: thấy hết ('ALL').
 * - Các vai trò khác: khớp 1-1 theo đúng tên vai trò (mỗi phòng ban chỉ thấy mẫu của mình).
 *   (extra.role của template phải trùng tên role trong bảng `roles`.)
 */
export function templateRolesFor(roleName: string): string[] | 'ALL' {
  if (!roleName) return 'ALL';
  if (roleName === 'ADMIN' || roleName === 'GIÁM_ĐỐC') return 'ALL';
  return [roleName];
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
