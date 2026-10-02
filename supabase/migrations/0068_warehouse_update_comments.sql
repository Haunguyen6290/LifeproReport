-- 0068_warehouse_update_comments.sql
-- Báo cáo kho: cho phép bình luận riêng dưới từng bản cập nhật (giống Chiến dịch).
-- Chỉ mở rộng danh sách target_type, không đụng dữ liệu cũ. Chạy lại nhiều lần không lỗi.

alter table public.comments drop constraint if exists comments_target_type_check;
alter table public.comments add constraint comments_target_type_check
  check (target_type in ('news', 'campaign_update', 'warehouse_report', 'warehouse_report_update'));
