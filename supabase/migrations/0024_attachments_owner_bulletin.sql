-- 0024_attachments_owner_bulletin.sql
-- Mở rộng ràng buộc owner_type của bảng attachments để cho phép 'bulletin' (ảnh bài đăng bảng tin)

-- Tên ràng buộc hiện tại trong migration 0001 là attachments_owner_type_check; vòng for không cần — xóa trực tiếp.
alter table public.attachments drop constraint if exists attachments_owner_type_check;
alter table public.attachments add constraint attachments_owner_type_check
  check (owner_type in ('news','campaign_update','comment','bulletin'));
