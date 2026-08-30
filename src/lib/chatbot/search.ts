import { normalizeQuery } from './normalize';

/** Ngưỡng coi là khớp. Câu có score < ngưỡng → xem như không có dữ liệu (không tự đoán). */
export const SCORE_THRESHOLD = 0.2;

export interface QA {
  id: string;
  phan_he: string;
  nhom_chu_de: string;
  cau_hoi: string;
  tra_loi_chuan: string;
  vi_du: string;
  cau_hoi_tiep_theo: string;
  hanh_dong: string;
  phan_he_lien_quan: string[];
  vai_tro: string;
  muc_do: string;
  uu_tien: string;
  du_lieu_can_co?: string;
  khong_tu_doan?: string;
  [k: string]: unknown;
}

export interface RankedQA {
  qa: QA;
  score: number;
}

/**
 * Chấm điểm QA theo query: token-overlap (0..1) + context boost (+0.15).
 * Trả matches (score >= SCORE_THRESHOLD, top limit) + suggestions (3 câu gần nhất để gợi ý).
 * Pure function, không đụng DB — GĐ2 có thể bọc thêm AI phía sau mà không đổi chữ ký.
 */
export function rankQA(rows: QA[], q: string, context: string | null, limit = 3): { matches: RankedQA[]; suggestions: string[] } {
  const qTokens = normalizeQuery(q).split(' ').filter(Boolean);
  if (!qTokens.length) {
    return { matches: [], suggestions: rows.slice(0, limit).map((r) => r.cau_hoi) };
  }
  const qSet = new Set(qTokens);
  const scored: RankedQA[] = rows.map((r) => {
    const hay = normalizeQuery(`${r.cau_hoi} ${r.tra_loi_chuan} ${r.nhom_chu_de}`).split(' ').filter(Boolean);
    let hit = 0;
    for (const t of qTokens) if (hay.includes(t)) hit++;
    let score = hit / qTokens.length;
    if (context && r.phan_he === context) score += 0.15;
    return { qa: r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const matches = scored.filter((s) => s.score >= SCORE_THRESHOLD).slice(0, limit);
  const suggestions = scored.slice(0, 3).map((s) => s.qa.cau_hoi);
  return { matches, suggestions };
}
