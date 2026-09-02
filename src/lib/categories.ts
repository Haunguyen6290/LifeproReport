import { supabase } from './supabase/client';

export type CategoryItem = { id: string; code: string; name: string; description: string; sort_order: number; active: boolean; extra?: any };

/** Lấy các mục của một danh mục theo slug (chỉ mục đang active, đã sắp xếp). */
export async function categoryItems(slug: string): Promise<CategoryItem[]> {
  const { data } = await supabase
    .from('categories')
    .select('id, category_items(id, code, name, description, sort_order, active, extra)')
    .eq('slug', slug)
    .single();
  const cat = data as { category_items?: CategoryItem[] } | null;
  return (cat?.category_items ?? []).filter((i) => i.active).sort((a, b) => a.sort_order - b.sort_order);
}
