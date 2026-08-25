-- 0016_fix_rls_checkin.sql
-- Sửa RLS còn hở từ 0011 + guard check-in; idempotent cho DB đã chạy 0011
-- Chỉ chạy phần DROP/CREATE nếu policy cũ tồn tại

-- okr_key_results: siết lại — chỉ chủ sở hữu O hoặc quan_ly_okr
drop policy if exists okrkr_write on public.okr_key_results;
create policy okrkr_write on public.okr_key_results for all to authenticated
  using (exists (select 1 from public.okrs o where o.id = okr_id and (o.user_id = auth.uid() or public.has_permission('quan_ly_okr'))))
  with check (exists (select 1 from public.okrs o where o.id = okr_id and (o.user_id = auth.uid() or public.has_permission('quan_ly_okr'))));

-- weekly_plans/reports: cho phép quan_ly_okr duyệt (ApprovalBox)
drop policy if exists wp_write on public.weekly_plans;
create policy wp_write on public.weekly_plans for all to authenticated
  using (user_id = auth.uid() or public.has_permission('quan_ly_okr'))
  with check (user_id = auth.uid() or public.has_permission('quan_ly_okr'));

drop policy if exists wr_write on public.weekly_reports;
create policy wr_write on public.weekly_reports for all to authenticated
  using (user_id = auth.uid() or public.has_permission('quan_ly_okr'))
  with check (user_id = auth.uid() or public.has_permission('quan_ly_okr'));
