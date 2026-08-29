-- 0025_bulletin_reactions.sql
-- Reaction 4 mức + bình luận 2 cấp cho Bảng tin (giống Facebook)

-- 4 mức: like, love, haha, angry — mỗi user 1 reaction / bài (bấm lại thì hủy / đổi)
create table if not exists public.bulletin_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.bulletin_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('like','love','haha','angry')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists idx_bulletin_reactions_post on public.bulletin_reactions (post_id);
create index if not exists idx_bulletin_reactions_user on public.bulletin_reactions (user_id);

-- Bình luận 2 cấp: parent_id (null = bình luận gốc, != null = trả lời)
alter table public.bulletin_comments add column if not exists parent_id uuid references public.bulletin_comments(id) on delete cascade;
create index if not exists idx_bulletin_comments_parent on public.bulletin_comments (parent_id);

alter table public.bulletin_reactions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bulletin_reactions' and policyname='breaction_read') then
    create policy breaction_read on public.bulletin_reactions for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bulletin_reactions' and policyname='breaction_write') then
    create policy breaction_write on public.bulletin_reactions for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
