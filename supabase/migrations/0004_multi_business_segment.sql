-- 0004_multi_business_segment.sql
-- Mô hình KD và Phân khúc xe cho phép chọn NHIỀU (khách lớn kinh doanh đủ loại).
-- Chuyển từ FK đơn (uuid) sang text lưu tên phân cách ", ".
-- An toàn trên cả DB cũ (còn business_model_id/segment_id) lẫn DB mới (0001 đã tạo sẵn dạng text).

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='customers' and column_name='business_model_id') then
    alter table public.customers drop constraint if exists customers_business_model_id_fkey;
    alter table public.customers add column if not exists business_model text not null default '';
    update public.customers c set business_model = coalesce((select ci.name from public.category_items ci where ci.id = c.business_model_id), '') where c.business_model = '';
    alter table public.customers drop column if exists business_model_id;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='customers' and column_name='segment_id') then
    alter table public.customers drop constraint if exists customers_segment_id_fkey;
    alter table public.customers add column if not exists segment text not null default '';
    update public.customers c set segment = coalesce((select ci.name from public.category_items ci where ci.id = c.segment_id), '') where c.segment = '';
    alter table public.customers drop column if exists segment_id;
  end if;
end $$;
