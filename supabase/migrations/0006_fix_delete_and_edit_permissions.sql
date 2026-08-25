-- 0006_fix_delete_and_edit_permissions.sql
-- Thêm quyền xóa cho market_news và campaigns (trước đó thiếu nên Admin bấm Xóa không có tác dụng)
-- và cho phép reporter/owner sửa tin của mình.

-- market_news: cho phép xóa khi là người ghi hoặc có quyền quan_ly_nguoi_dung (Admin)
create policy news_delete on public.market_news for delete to authenticated
  using (reporter_id = auth.uid() or has_permission('quan_ly_nguoi_dung'));

-- campaigns: cho phép xóa khi có quyền quan_ly_chien_dich (Admin/QL); app sẽ ẩn nút khi chưa Đã kết thúc
create policy camp_delete on public.campaigns for delete to authenticated
  using (has_permission('quan_ly_chien_dich'));

-- campaign_updates: cho phép xóa khi là người ghi hoặc Admin
create policy cupd_delete on public.campaign_updates for delete to authenticated
  using (reporter_id = auth.uid() or has_permission('quan_ly_chien_dich'));

-- market_news: cho phép người ghi sửa tin của mình (trước đó chỉ ket_luan được sửa)
drop policy if exists news_update on public.market_news;
create policy news_update on public.market_news for update to authenticated
  using (reporter_id = auth.uid() or has_permission('ket_luan'))
  with check (reporter_id = auth.uid() or has_permission('ket_luan'));
