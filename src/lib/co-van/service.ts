// src/lib/co-van/service.ts — orchestration: chấm, lưu, gửi, bỏ qua
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCoVanConfig } from './config';
import { danhGiaCoVan, type CoVanInput } from './evaluate';
import { sendToDirector } from './telegram-private';

type Loai = 'ke_hoach' | 'bao_cao';

async function loadInput(loai: Loai, targetId: string, admin: ReturnType<typeof createAdminClient>): Promise<CoVanInput | null> {
  if (loai === 'ke_hoach') {
    const { data: plan } = await admin.from('weekly_plans').select('id, user_id, tuan_tu, tuan_den, muc_tieu_tuan, noi_dung, updated_at').eq('id', targetId).single();
    if (!plan) return null;
    const { data: items } = await admin.from('weekly_plan_items').select('cong_viec, kq_can_dat').eq('plan_id', targetId).order('sort_order');
    const { data: prof } = await admin.from('profiles').select('full_name').eq('id', (plan as any).user_id).single();
    const tieuDe = `Kế hoạch tuần ${(plan as any).tuan_tu}–${(plan as any).tuan_den} — ${(prof as any)?.full_name ?? ''}`;
    // Tuần trước + lịch sử 3 tuần gần nhất (để soi copy)
    const prevTu = new Date((plan as any).tuan_tu); prevTu.setDate(prevTu.getDate() - 7);
    const prevTuStr = prevTu.toISOString().slice(0, 10);
    let tuanTruoc: CoVanInput['tuanTruoc'] = null;
    let lichSuNgan = '';
    try {
      const { data: prev } = await admin.from('weekly_plans').select('muc_tieu_tuan, noi_dung').eq('user_id', (plan as any).user_id).eq('tuan_tu', prevTuStr).single();
      if (prev) {
        const { data: prevItems } = await admin.from('weekly_plan_items').select('cong_viec').eq('plan_id', (prev as any).id ?? '');
        tuanTruoc = { noiDung: `${(prev as any).muc_tieu_tuan ?? ''}\n${(prev as any).noi_dung ?? ''}`.trim(), items: ((prevItems ?? []) as any[]).map((r) => r.cong_viec) };
      }
      const { data: recent } = await admin.from('weekly_plans').select('tuan_tu, muc_tieu_tuan, noi_dung').eq('user_id', (plan as any).user_id).order('tuan_tu', { ascending: false }).limit(4);
      const others = ((recent ?? []) as any[]).filter((r) => r.tuan_tu !== (plan as any).tuan_tu).slice(0, 3);
      lichSuNgan = others.map((r) => `${r.tuan_tu}: ${(r.muc_tieu_tuan ?? '').slice(0, 120)} | ${(r.noi_dung ?? '').slice(0, 200)}`).join('\n');
    } catch {}
    // OKR đang chạy của user
    let okrDangChay = '';
    try {
      const { data: okrs } = await admin.from('okrs').select('objective, tu_ngay, den_ngay').eq('user_id', (plan as any).user_id).eq('trang_thai', 'Đang làm').limit(3);
      if (okrs?.length) okrDangChay = (okrs as any[]).map((o) => `${o.objective} (${o.tu_ngay}→${o.den_ngay})`).join('\n');
    } catch {}
    return {
      loai, tieuDe,
      noiDungTongQuan: `${(plan as any).muc_tieu_tuan ?? ''}\n${(plan as any).noi_dung ?? ''}`.trim(),
      items: ((items ?? []) as any[]).map((r) => ({ cong_viec: r.cong_viec, kq_can_dat: r.kq_can_dat })),
      tuanTruoc, okrDangChay, lichSuNgan,
    };
  } else {
    const { data: rep } = await admin.from('weekly_reports').select('id, user_id, tuan_tu, tuan_den, tu_danh_gia, ty_le_ht, diem_noi_bat, kho_khan, de_xuat, noi_dung, updated_at').eq('id', targetId).single();
    if (!rep) return null;
    const { data: items } = await admin.from('weekly_report_items').select('viec_da_lam, phan_tram, tu_danh_gia').eq('report_id', targetId).order('sort_order');
    const { data: prof } = await admin.from('profiles').select('full_name').eq('id', (rep as any).user_id).single();
    const tieuDe = `Báo cáo tuần ${(rep as any).tuan_tu}–${(rep as any).tuan_den} — ${(prof as any)?.full_name ?? ''}`;
    // Soi kế hoạch tuần tương ứng
    let tuanTruoc: CoVanInput['tuanTruoc'] = null;
    try {
      const { data: plan } = await admin.from('weekly_plans').select('muc_tieu_tuan, noi_dung').eq('user_id', (rep as any).user_id).eq('tuan_tu', (rep as any).tuan_tu).single();
      if (plan) {
        const { data: pItems } = await admin.from('weekly_plan_items').select('cong_viec').eq('plan_id', (plan as any).id ?? '');
        tuanTruoc = { noiDung: `${(plan as any).muc_tieu_tuan ?? ''}\n${(plan as any).noi_dung ?? ''}`.trim(), items: ((pItems ?? []) as any[]).map((r) => r.cong_viec) };
      }
    } catch {}
    let lichSuNgan = '';
    try {
      const { data: recent } = await admin.from('weekly_reports').select('tuan_tu, tu_danh_gia, ty_le_ht').eq('user_id', (rep as any).user_id).order('tuan_tu', { ascending: false }).limit(4);
      const others = ((recent ?? []) as any[]).filter((r) => r.tuan_tu !== (rep as any).tuan_tu).slice(0, 3);
      lichSuNgan = others.map((r) => `${r.tuan_tu}: ${r.tu_danh_gia ?? ''} ${r.ty_le_ht ?? ''}%`).join('\n');
    } catch {}
    const noiDungTongQuan = [
      (rep as any).tu_danh_gia ? `Tự đánh giá: ${(rep as any).tu_danh_gia} (${(rep as any).ty_le_ht ?? ''}%)` : '',
      (rep as any).diem_noi_bat ? `Điểm nổi bật: ${(rep as any).diem_noi_bat}` : '',
      (rep as any).kho_khan ? `Khó khăn: ${(rep as any).kho_khan}` : '',
      (rep as any).de_xuat ? `Đề xuất: ${(rep as any).de_xuat}` : '',
      (rep as any).noi_dung ?? '',
    ].filter(Boolean).join('\n');
    return {
      loai, tieuDe, noiDungTongQuan,
      items: ((items ?? []) as any[]).map((r) => ({ viec_da_lam: r.viec_da_lam, phan_tram: r.phan_tram, tu_danh_gia: r.tu_danh_gia })),
      tuanTruoc, lichSuNgan,
    };
  }
}

export async function chamMotBai(loai: Loai, targetId: string, force = false): Promise<{ ok: boolean; ket_qua?: string; reason?: string }> {
  const admin = createAdminClient() as any;
  const cfg = await loadCoVanConfig(admin);

  // Lấy updated_at để làm phien_ban_luc (idempotent)
  const table = loai === 'ke_hoach' ? 'weekly_plans' : 'weekly_reports';
  const { data: row } = await admin.from(table).select('id, user_id, tuan_tu, tuan_den, updated_at').eq('id', targetId).single();
  if (!row) return { ok: false, reason: 'Không tìm thấy bài' };
  const phienBanLuc = (row as any).updated_at as string;

  // Nếu đã chấm đúng phiên bản thì bỏ qua (trừ khi force)
  const { data: existed } = await admin.from('co_van_danh_gia').select('id, phien_ban_luc').eq('loai', loai).eq('target_id', targetId).maybeSingle();
  if (!force && existed && String((existed as any).phien_ban_luc) === String(phienBanLuc)) {
    return { ok: true, reason: 'Đã chấm phiên bản này' };
  }

  const input = await loadInput(loai, targetId, admin);
  if (!input) return { ok: false, reason: 'Không tải được nội dung' };

  // Lấy extraInstructions cho prompt
  const { data: extraRow } = await admin.from('settings').select('value').eq('key', 'CO_VAN_EXTRA_INSTRUCTIONS').maybeSingle();
  const extra = String((extraRow as any)?.value ?? '').trim();
  // Tạm ghi đè brief nếu có extra
  const aiCfg = { ...cfg.ai, brief: cfg.ai.brief + (extra ? `\n\nGHI CHÚ BỔ SUNG:\n${extra}` : '') };

  const dg = await danhGiaCoVan(aiCfg, input);
  if (!dg) return { ok: false, reason: 'AI không trả về (thiếu key / lỗi mạng / hết hạn)' };

  const payload = {
    loai, target_id: targetId,
    user_id: (row as any).user_id,
    tuan_tu: (row as any).tuan_tu,
    tuan_den: (row as any).tuan_den,
    ket_qua: dg.ket_qua,
    ly_do: dg.ly_do,
    dau_hieu_doi_pho: dg.dau_hieu_doi_pho,
    gop_y_soan_san: dg.gop_y_soan_san,
    trang_thai: 'Cho duyet' as const,
    phien_ban_luc: phienBanLuc,
  };

  const { error } = await admin.from('co_van_danh_gia').upsert(payload, { onConflict: 'loai,target_id' });
  if (error) return { ok: false, reason: error.message };

  // Báo Telegram riêng nếu Can sua / Khong dat và chưa bật tự gửi
  if ((dg.ket_qua === 'Can sua' || dg.ket_qua === 'Khong dat') && !cfg.autoSend) {
    try {
      const { data: prof } = await admin.from('profiles').select('full_name').eq('id', (row as any).user_id).single();
      const ten = (prof as any)?.full_name ?? '';
      const loaiLabel = loai === 'ke_hoach' ? 'Kế hoạch' : 'Báo cáo';
      const text = `⚠️ <b>${loaiLabel} ${dg.ket_qua}</b> — ${ten} (tuần ${(row as any).tuan_tu}→${(row as any).tuan_den})\nLý do: ${dg.ly_do.slice(0, 300)}${dg.dau_hieu_doi_pho ? `\nDấu hiệu: ${dg.dau_hieu_doi_pho.slice(0, 200)}` : ''}\n\nGợi ý soạn sẵn:\n${dg.gop_y_soan_san.slice(0, 800)}`;
      // Lấy id vừa upsert để gắn nút
      const { data: saved } = await admin.from('co_van_danh_gia').select('id').eq('loai', loai).eq('target_id', targetId).single();
      const kb = saved ? [[{ text: 'Gửi cho nhân viên', callback_data: `cv:gui:${(saved as any).id}` }, { text: 'Bỏ qua', callback_data: `cv:boqua:${(saved as any).id}` }]] : undefined;
      await sendToDirector(text, kb);
    } catch {}
  }

  // Nếu bật tự gửi và Can sua/Khong dat thì gửi luôn (ghi vào chỗ nhân viên xem)
  if ((dg.ket_qua === 'Can sua' || dg.ket_qua === 'Khong dat') && cfg.autoSend) {
    try { await guiGopYByTarget(loai, targetId); } catch {}
  }

  return { ok: true, ket_qua: dg.ket_qua };
}

async function findDirectorId(admin: any): Promise<string | null> {
  // Ưu tiên người có quan_ly_cai_dat đầu tiên
  const { data: roles } = await admin.from('roles').select('id').eq('name', 'ADMIN').limit(1).maybeSingle();
  // Fallback: lấy profile đầu tiên có role ADMIN
  const { data: profs } = await admin.from('profiles').select('id, roles!inner(name)').limit(5);
  const list = (profs ?? []) as any[];
  const found = list.find((p) => {
    const r = p.roles;
    const name = Array.isArray(r) ? r[0]?.name : r?.name;
    return name === 'ADMIN' || name === 'GIÁM_ĐỐC';
  });
  if (found) return found.id;
  return list[0]?.id ?? null;
}

export async function guiGopY(danhGiaId: string, actorId?: string): Promise<{ ok: boolean; reason?: string }> {
  const admin = createAdminClient() as any;
  const { data: dg } = await admin.from('co_van_danh_gia').select('*').eq('id', danhGiaId).single();
  if (!dg) return { ok: false, reason: 'Không tìm thấy đánh giá' };
  if ((dg as any).trang_thai === 'Da gui' || (dg as any).trang_thai === 'Tu gui') return { ok: false, reason: 'Đã gửi rồi' };

  const directorId = actorId ?? await findDirectorId(admin);
  if (!directorId) return { ok: false, reason: 'Không tìm thấy tài khoản Giám đốc' };

  const content = String((dg as any).gop_y_soan_san ?? '').trim();
  if (!content) return { ok: false, reason: 'Góp ý trống' };

  if ((dg as any).loai === 'bao_cao') {
    const { error } = await admin.from('weekly_report_comments').insert({
      report_id: (dg as any).target_id,
      author_id: directorId,
      content,
      is_chot: false,
    });
    if (error) return { ok: false, reason: error.message };
  } else {
    const { data: plan } = await admin.from('weekly_plans').select('y_kien_quan_ly').eq('id', (dg as any).target_id).single();
    const old = String((plan as any)?.y_kien_quan_ly ?? '').trim();
    const next = old ? `${old}\n\n---\n${content}` : content;
    const { error } = await admin.from('weekly_plans').update({
      y_kien_quan_ly: next,
      duyet_boi: directorId,
      duyet_luc: new Date().toISOString(),
    }).eq('id', (dg as any).target_id);
    if (error) return { ok: false, reason: error.message };
  }

  await admin.from('co_van_danh_gia').update({ trang_thai: 'Da gui', gui_luc: new Date().toISOString(), gui_boi: directorId }).eq('id', danhGiaId);
  return { ok: true };
}

async function guiGopYByTarget(loai: Loai, targetId: string): Promise<void> {
  const admin = createAdminClient() as any;
  const { data: dg } = await admin.from('co_van_danh_gia').select('id').eq('loai', loai).eq('target_id', targetId).single();
  if (dg) await guiGopY((dg as any).id);
}

export async function boQua(danhGiaId: string, actorId?: string): Promise<{ ok: boolean; reason?: string }> {
  const admin = createAdminClient() as any;
  const { error } = await admin.from('co_van_danh_gia').update({ trang_thai: 'Bo qua', gui_luc: new Date().toISOString(), gui_boi: actorId ?? null }).eq('id', danhGiaId);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
