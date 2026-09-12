-- 0055: siết RLS customer_interactions — chỉ KD phụ trách khách đó hoặc admin
-- (quyền 'sua_khach_bat_ky') mới được ghi/sửa/xóa. Xem thì ai đăng nhập cũng được.

drop policy if exists ci_insert on public.customer_interactions;
create policy ci_insert on public.customer_interactions
  for insert to authenticated with check (
    exists (
      select 1 from public.customers c
      where c.id = customer_interactions.customer_id
        and (c.assigned_to = auth.uid() or public.has_permission('sua_khach_bat_ky'))
    )
  );

drop policy if exists ci_update on public.customer_interactions;
create policy ci_update on public.customer_interactions
  for update to authenticated
  using (
    customer_interactions.nguoi_tao = auth.uid()
    or exists (
      select 1 from public.customers c
      where c.id = customer_interactions.customer_id
        and (c.assigned_to = auth.uid() or public.has_permission('sua_khach_bat_ky'))
    )
  )
  with check (
    customer_interactions.nguoi_tao = auth.uid()
    or exists (
      select 1 from public.customers c
      where c.id = customer_interactions.customer_id
        and (c.assigned_to = auth.uid() or public.has_permission('sua_khach_bat_ky'))
    )
  );

drop policy if exists ci_delete on public.customer_interactions;
create policy ci_delete on public.customer_interactions
  for delete to authenticated
  using (
    customer_interactions.nguoi_tao = auth.uid()
    or exists (
      select 1 from public.customers c
      where c.id = customer_interactions.customer_id
        and (c.assigned_to = auth.uid() or public.has_permission('sua_khach_bat_ky'))
    )
  );
