-- 0017_okr_parent_okr_archive.sql
-- OKR cá nhân nối THẲNG vào OKR công ty (parent_okr_id), bỏ nối qua KR.
-- Admin đóng & lưu trữ OKR (is_archived) để ẩn khỏi tab.
-- Check-in thêm cột ket_qua; OKR thêm 2 cột tổng kết.

-- 1) Cột mới trên okrs
alter table public.okrs add column if not exists parent_okr_id uuid references public.okrs(id) on delete set null;
alter table public.okrs add column if not exists is_archived boolean not null default false;
alter table public.okrs add column if not exists tongket_tudanhgia text not null default '';
alter table public.okrs add column if not exists tongket_phanhoi text not null default '';

-- 2) Check-in thêm "kết quả công việc"
alter table public.okr_check_ins add column if not exists ket_qua text not null default '';

-- 3) Migrate dữ liệu cũ: OKR cá nhân nối theo KR -> nối theo OKR công ty chứa KR đó
update public.okrs o
set parent_okr_id = kr.okr_id
from public.okr_key_results kr
where o.parent_kr_id is not null
  and o.parent_okr_id is null
  and kr.id = o.parent_kr_id
  and o.is_company = false;

-- Sau migrate, bỏ nối KR (giữ cột nhưng không dùng nữa)
-- (không drop column để an toàn; app chỉ đọc parent_okr_id)
