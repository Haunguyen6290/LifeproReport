export type Link = { owner_id: string; target_type: string; target_id: string };

/** Đếm số link thuộc về 1 owner (tin/cập nhật). */
export function countLinks(links: Link[], ownerId: string): number {
  return links.filter((l) => l.owner_id === ownerId).length;
}

/** Danh sách id không trùng của 1 loại gắn (KH/SP) cho 1 owner. */
export function uniqueLinked(links: Link[], ownerId: string, targetType: string): string[] {
  const set = new Set<string>();
  for (const l of links) if (l.owner_id === ownerId && l.target_type === targetType) set.add(l.target_id);
  return [...set];
}
