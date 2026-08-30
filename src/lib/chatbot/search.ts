import { normalizeQuery } from './normalize';

/** Ngưỡng coi là khớp. Câu có score < ngưỡng → xem như không có dữ liệu (không tự đoán). */
export const SCORE_THRESHOLD = 0.2;

/** Từ dừng tiếng Việt (đã bỏ dấu) — lọc khỏi query để không làm loãng điểm từ khóa chính. */
const STOPWORDS = new Set([
  'la', 'gi', 'va', 'de', 'duoc', 'khi', 'co', 'nhu', 'the', 'nao', 'thi', 'moi', 'mot', 'nhung',
  'trong', 'voi', 'cua', 'den', 'di', 've', 'cho', 'bang', 'can', 'phai', 'khong', 'da', 'dang',
  'se', 'hay', 'neu', 'rat', 'qua', 'sao', 'lam', 'cach', 'luc', 'ay', 'do', 'ma', 'roi', 'nua',
]);

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

/** Cụm 2 từ hay đi kèm nhau → gộp thành 1 keyword để tăng sức phân biệt. */
const PHRASES: [string, string][] = [
  ['bao', 'cao'], ['ke', 'hoach'], ['hang', 'ton'], ['muc', 'tieu'], ['ket', 'qua'],
  ['nha', 'cung'], ['phat', 'hien'], ['doi', 'thu'], ['khach', 'hang'], ['chi', 'nhanh'],
  ['cong', 'no'], ['dong', 'tien'], ['nguyen', 'nhan'], ['de', 'xuat'],
];

/** Tách từ khóa: bỏ dấu, lọc stopword, gộp 1 số cụm 2 từ phổ biến. */
function extractKeywords(raw: string): string[] {
  const s = normalizeQuery(raw);
  const words = s.split(' ').filter(Boolean).filter((w) => !STOPWORDS.has(w));
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const pair: [string, string] = [words[i], words[i + 1]];
    if (PHRASES.some((p) => p[0] === pair[0] && p[1] === pair[1])) {
      out.push(`${pair[0]}_${pair[1]}`);
      i++;
    } else out.push(pair[0]);
  }
  return out;
}

/** Khớp từ khóa: exact, số nhiều 's' 2 chiều (okr ↔ okrs), hoặc cụm 2 từ. (Không prefix tự do: 'kho' từng khớp nhầm 'khong'.) */
function matchKeyword(t: string, hayTokens: string[], hayStr: string): boolean {
  if (t.includes('_')) {
    const phrase = t.replace(/_/g, ' ');
    if (hayStr.includes(phrase)) return true;
    const parts = t.split('_');
    return parts.every((p) => hayTokens.includes(p));
  }
  if (hayTokens.includes(t)) return true;
  for (const h of hayTokens) {
    if (h.length >= 3 && (h === t + 's' || t === h + 's')) return true;
  }
  return false;
}

/**
 * Chấm điểm QA theo query, có trọng số IDF (từ hiếm được tính điểm cao hơn từ phổ biến).
 * + context boost (+0.2). Ví dụ "báo cáo kho": "kho" (hiếm) thắng "báo cáo" (phổ biến),
 * nên không bị rơi vào QA Báo cáo tuần.
 * Trả matches (score >= SCORE_THRESHOLD, top limit) + suggestions (3 câu gần nhất để gợi ý).
 * Pure function, không đụng DB — GĐ2 có thể bọc thêm AI phía sau mà không đổi chữ ký.
 */
export function rankQA(rows: QA[], q: string, context: string | null, limit = 3): { matches: RankedQA[]; suggestions: string[] } {
  const qKeywords = extractKeywords(q);
  if (!qKeywords.length) {
    return { matches: [], suggestions: rows.slice(0, limit).map((r) => r.cau_hoi) };
  }
  // Tiền xử lý haystack mỗi dòng 1 lần
  const hayStrs = rows.map((r) => normalizeQuery(`${r.cau_hoi} ${r.tra_loi_chuan} ${r.nhom_chu_de}`));
  const hayTok = hayStrs.map((s) => s.split(' ').filter(Boolean));
  const N = rows.length || 1;

  // Document frequency của từng từ khóa trong query → trọng số IDF
  const weight: Record<string, number> = {};
  let totalW = 0;
  for (const t of qKeywords) {
    let df = 0;
    for (let i = 0; i < rows.length; i++) if (matchKeyword(t, hayTok[i], hayStrs[i])) df++;
    const w = Math.log((N + 1) / (df + 1)) + 1; // luôn > 0, từ càng hiếm càng lớn
    weight[t] = w;
    totalW += w;
  }

  const scored: RankedQA[] = rows.map((r, i) => {
    let hitW = 0;
    for (const t of qKeywords) if (matchKeyword(t, hayTok[i], hayStrs[i])) hitW += weight[t];
    let score = totalW ? hitW / totalW : 0;
    if (context && r.phan_he === context) score += 0.2;
    return { qa: r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const matches = scored.filter((s) => s.score >= SCORE_THRESHOLD).slice(0, limit);
  const suggestions = scored.slice(0, 3).map((s) => s.qa.cau_hoi);
  return { matches, suggestions };
}
