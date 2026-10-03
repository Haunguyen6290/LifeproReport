-- 0072_sales_rls_tighten.sql — siết RLS cho sales_rows: read phải có quyền xem báo cáo
-- Trước: authenticated đọc được hết. Nay: phải có bao_cao_ban_hang / xem_tai_chinh / quan_ly_cai_dat
-- service_role (dùng trong API/cron/RPC) không bị RLS nên vẫn chạy bình thường.

do $$ begin
  -- Xóa policy cũ nếu có (sales_read mở)
  drop policy if exists sales_read on public.sales_rows;
exception when others then null;
end $$;

create policy sales_read on public.sales_rows
for select to authenticated
using (
  public.has_permission('bao_cao_ban_hang')
  or public.has_permission('xem_tai_chinh')
  or public.has_permission('quan_ly_cai_dat')
);

comment on policy sales_read on public.sales_rows is 'Chỉ cho đọc sales_rows khi có bao_cao_ban_hang / xem_tai_chinh / quan_ly_cai_dat. service_role bypass RLS nên API dùng service_role vẫn chạy sau khi đã checkPerm.';
