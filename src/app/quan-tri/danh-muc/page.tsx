'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RequireAuth, useAuth } from '@/components/RequireAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { AdminTabs } from '@/components/AdminTabs';
import { CategoryDialog } from '@/components/CategoryDialog';

const DM = [
  { slug: 'mo_hinh_kd', name: 'Mô hình kinh doanh' },
  { slug: 'phan_hang_kh', name: 'Phân hạng khách hàng' },
  { slug: 'trang_thai_kh', name: 'Trạng thái khách hàng' },
  { slug: 'quy_mo', name: 'Quy mô' },
  { slug: 'phan_khuc_xe', name: 'Phân khúc xe' },
  { slug: 'loai_tin_tt', name: 'Loại tin thị trường' },
  { slug: 'san_pham', name: 'Sản phẩm' },
  { slug: 'muc_do', name: 'Mức độ quan trọng' },
  { slug: 'loai_chien_dich', name: 'Loại chiến dịch' },
  { slug: 'loai_cap_nhat', name: 'Loại nội dung cập nhật' },
  { slug: 'tinh_thanh', name: 'Tỉnh/Thành phố' },
  { slug: 'trang_thai_chien_dich', name: 'Trạng thái chiến dịch' },
  { slug: 'nhom_van_de_kho', name: 'Nhóm vấn đề kho' },
  { slug: 'okr_o_template', name: 'O mẫu (OKRs)' },
  { slug: 'okr_kr_template', name: 'KR mẫu (OKRs)' },
  { slug: 'tro_ly_phan_he', name: 'Phân hệ trợ lý' },
  { slug: 'tro_ly_nhom', name: 'Nhóm trợ lý' },
];

const OKR_TEMPLATE_SLUGS = new Set(['okr_o_template', 'okr_kr_template']);
const BOT_PHAN_HE = 'tro_ly_phan_he';

type Item = { id: string; code: string; name: string; description: string; sort_order: number; extra?: any };

function Screen() {
  const { userId, can } = useAuth();
  const [slug, setSlug] = useState(DM[0].slug);
  const [items, setItems] = useState<Item[]>([]);
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [dialog, setDialog] = useState<null | { id?: string; code?: string; name?: string; description?: string; extra?: any }>(null);

  const isOkr = OKR_TEMPLATE_SLUGS.has(slug);
  const isPhanHe = slug === BOT_PHAN_HE;

  async function load() {
    const { data } = await supabase.from('categories').select('id, category_items(id, code, name, description, sort_order, extra)').eq('slug', slug).single();
    const cat = data as any;
    setItems(((cat?.category_items ?? []) as Item[]).sort((a, b) => a.sort_order - b.sort_order));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('roles').select('name').order('name');
      setRoleNames(((data ?? []) as { name: string }[]).map((r) => r.name));
    })();
  }, []);

  async function del(it: Item) {
    if (!confirm(`Xóa “${it.name}” khỏi danh mục?`)) return;
    try { const { data: me2 } = await supabase.from('profiles').select('full_name').eq('id', userId).single(); await supabase.from('audit_logs').insert({ actor_id: userId, action: 'Xóa danh mục', entity_type: 'category', entity_id: null, details: { slug, name: it.name, full_name: me2?.full_name ?? '' } }); } catch {}
    await supabase.from('category_items').delete().eq('id', it.id);
    load();
  }

  if (!can('quan_ly_danh_muc')) return <AppSidebar><main className="px-6 py-10 text-slate-700">Bạn không có quyền quản lý danh mục.</main></AppSidebar>;
  const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

  return (
    <AppSidebar>
      <main className="w-full px-4 py-6 sm:px-6">
        <AdminTabs />
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-[#0f2a4a]">Danh mục</h1>
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <nav className={card}>
            <ul className="space-y-1">
              {DM.map((d) => (
                <li key={d.slug}><button onClick={() => setSlug(d.slug)} className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${slug === d.slug ? 'bg-[#eff6ff] font-semibold text-[#1e3a8a]' : 'hover:bg-slate-100'}`}>{d.name}</button></li>
              ))}
            </ul>
          </nav>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0f2a4a]">“{DM.find((d) => d.slug === slug)?.name}”</h2>
              <button onClick={() => setDialog({})} className="rounded-lg bg-[#1e3a8a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e40af]">+ Thêm mới</button>
            </div>
            <div className={card}>
              {items.length === 0 ? <p className="py-6 text-center text-sm text-slate-600">Chưa có mục nào.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-[#eff6ff] text-left text-xs font-semibold text-[#1e3a8a]">
                      <th className="px-3 py-2">Mã</th><th className="px-3 py-2">Tên</th>
                      {isOkr && <th className="px-3 py-2">Vai trò</th>}
                      {isPhanHe && <th className="px-3 py-2">Đường dẫn trang</th>}
                      <th className="px-3 py-2">Mô tả</th><th className="px-3 py-2 text-right">Thao tác</th>
                    </tr></thead>
                    <tbody>{items.map((it) => (
                      <tr key={it.id} className="border-t border-slate-200">
                        <td className="px-3 py-2 font-mono text-xs">{it.code || '—'}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{it.name}</td>
                        {isOkr && <td className="px-3 py-2 text-xs font-semibold text-[#1e3a8a]">{(it.extra as any)?.role ?? '—'}</td>}
                        {isPhanHe && <td className="px-3 py-2 text-xs font-mono text-slate-700">{((it.extra as any)?.routes as string[] | undefined)?.length ? ((it.extra as any).routes as string[]).join(', ') : ((it.extra as any)?.mac_dinh ? 'Mặc định' : '—')}</td>}
                        <td className="px-3 py-2 text-slate-600">{it.description || '—'}</td>
                        <td className="px-3 py-2 text-right"><button onClick={() => setDialog({ id: it.id, code: it.code, name: it.name, description: it.description, extra: it.extra })} className="text-xs font-semibold text-[#1e3a8a] hover:underline">Sửa</button> <span className="text-slate-300">·</span> <button onClick={() => del(it)} className="text-xs font-semibold text-red-600 hover:underline">Xóa</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        {dialog !== null && <CategoryDialog open={dialog !== null} onClose={() => setDialog(null)} onDone={load} dmName={DM.find((d) => d.slug === slug)?.name ?? ''} slug={slug} userId={userId} roles={isOkr ? roleNames : undefined} initial={dialog ?? undefined} />}
      </main>
    </AppSidebar>
  );
}

export default function Page() { return <RequireAuth><Screen /></RequireAuth>; }
