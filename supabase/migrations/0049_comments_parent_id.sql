-- 0049_comments_parent_id.sql — Thêm trả lời bình luận (Facebook) cho comments chung
-- Dùng cho news / campaign_update / warehouse_report (CommentList ở 3 nơi)

alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists idx_comments_parent on public.comments (parent_id);
