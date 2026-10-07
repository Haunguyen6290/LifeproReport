// src/lib/co-van/evaluate.ts — gọi Claude chấm 1 bài Kế hoạch / Báo cáo tuần
import Anthropic from '@anthropic-ai/sdk';
import type { AIConfig } from '@/lib/chatbot/ai';
import { buildCoVanSystem } from './prompt';

export type KetQua = 'Dat' | 'Can sua' | 'Khong dat';
export type DanhGia = {
  ket_qua: KetQua;
  ly_do: string;
  dau_hieu_doi_pho: string;
  gop_y_soan_san: string;
};

export type CoVanInput = {
  loai: 'ke_hoach' | 'bao_cao' | 'chien_dich' | 'tin_thi_truong';
  tieuDe: string;
  mucTieu?: string; // riêng cho ke_hoach: muc_tieu_tuan
  noiDungTongQuan: string;
  items: { cong_viec?: string; viec_da_lam?: string; kq_can_dat?: string; phan_tram?: number | null; tu_danh_gia?: string }[];
  tuanTruoc?: { noiDung: string; items: string[] } | null;
  okrDangChay?: string;
  lichSuNgan?: string;
};

function toUserMessage(input: CoVanInput): string {
  const loaiLabel: Record<string, string> = { ke_hoach: 'Kế hoạch tuần', bao_cao: 'Báo cáo tuần', chien_dich: 'Chiến dịch', tin_thi_truong: 'Tin thị trường' };
  const parts: string[] = [];
  parts.push(`LOẠI: ${loaiLabel[input.loai] ?? input.loai} — ${input.tieuDe}`);
  if (input.okrDangChay) parts.push(`OKR ĐANG CHẠY:\n${input.okrDangChay.slice(0, 800)}`);
  if (input.loai === 'ke_hoach') {
    parts.push(`MỤC TIÊU TUẦN:\n${(input.mucTieu || '(trống)').slice(0, 1000)}`);
    parts.push(`KẾ HOẠCH TUẦN (nội dung chung):\n${(input.noiDungTongQuan || '(trống)').slice(0, 1000)}`);
  } else {
    parts.push(`NỘI DUNG TỔNG QUAN:\n${(input.noiDungTongQuan || '(trống)').slice(0, 2000)}`);
  }
  if (input.items.length) {
    const lines = input.items.map((it, i) => {
      const cv = it.cong_viec ?? it.viec_da_lam ?? '';
      const kq = it.kq_can_dat ? ` → KQ: ${it.kq_can_dat}` : '';
      const pt = it.phan_tram != null ? ` (${it.phan_tram}%)` : '';
      const dg = it.tu_danh_gia ? ` [${it.tu_danh_gia}]` : '';
      return `${i + 1}. ${cv}${kq}${pt}${dg}`;
    });
    parts.push(`CÁC DÒNG CÔNG VIỆC (${input.items.length}):\n${lines.join('\n').slice(0, 3000)}`);
  } else {
    parts.push('(Không có dòng công việc nào)');
  }
  if (input.tuanTruoc) {
    parts.push(`TUẦN TRƯỚC (để soi copy/đối chiếu):\n${input.tuanTruoc.noiDung.slice(0, 1000)}\nCác việc tuần trước: ${input.tuanTruoc.items.join(' | ').slice(0, 1000)}`);
  }
  if (input.lichSuNgan) parts.push(`LỊCH SỬ 3 TUẦN GẦN NHẤT (tóm tắt):\n${input.lichSuNgan.slice(0, 1500)}`);
  return parts.join('\n\n');
}

export async function danhGiaCoVan(cfg: AIConfig, input: CoVanInput): Promise<DanhGia | null> {
  if (!cfg.key) return null;
  try {
    const client = new Anthropic({
      apiKey: cfg.key,
      ...(cfg.endpoint ? { baseURL: cfg.endpoint.replace(/\/+$/, '').replace(/\/v1\/messages$/i, '') } : {}),
      timeout: 30_000,
      maxRetries: 0,
    });
    const system = buildCoVanSystem(cfg.brief, '', input.loai);
    const res = await client.messages.create({
      model: cfg.model,
      max_tokens: 1500,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: toUserMessage(input) }],
    });
    const text = res.content.find((b) => b.type === 'text')?.text ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as Partial<DanhGia> & { ket_qua?: string };
    const kq = String(parsed.ket_qua ?? '').trim();
    const norm: KetQua | null =
      kq === 'Dat' ? 'Dat' : kq === 'Can sua' ? 'Can sua' : kq === 'Khong dat' ? 'Khong dat' : null;
    if (!norm) return null;
    return {
      ket_qua: norm,
      ly_do: String(parsed.ly_do ?? '').slice(0, 1000),
      dau_hieu_doi_pho: String(parsed.dau_hieu_doi_pho ?? '').slice(0, 1000),
      gop_y_soan_san: String(parsed.gop_y_soan_san ?? '').slice(0, 3000),
    };
  } catch {
    return null;
  }
}
