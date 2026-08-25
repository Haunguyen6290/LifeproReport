-- 0003_simplify_key_results.sql
-- Bỏ target_value/current_value/unit khỏi key_results — KR chỉ còn là tiêu đề kết quả cần đạt.
-- Tiến độ thật nằm trong các bản cập nhật feed, không lưu ở KR.
alter table public.key_results
  drop column if exists target_value,
  drop column if exists current_value,
  drop column if exists unit,
  drop column if exists updated_by,
  drop column if exists updated_at;
