-- 0022_bulletin_bot.sql
-- Bảng tin (bulletin) + bot 8h30 T2 — 7 việc + 7 ô tích BOT_CHECK_*

create table if not exists public.bulletin_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  title text not null default '',
  content text not null default '',
  mentioned_user_ids uuid[] not null default '{}',
  is_bot boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bulletin_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.bulletin_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null default '',
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_bulletin_posts_created on public.bulletin_posts (created_at desc);
create index if not exists idx_bulletin_comments_post on public.bulletin_comments (post_id, created_at);

alter table public.bulletin_posts enable row level security;
alter table public.bulletin_comments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bulletin_posts' and policyname='bulletin_read') then
    create policy bulletin_read on public.bulletin_posts for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bulletin_posts' and policyname='bulletin_write') then
    create policy bulletin_write on public.bulletin_posts for all to authenticated
      using (public.has_permission('quan_ly_cai_dat') or public.has_permission('quan_ly_nguoi_dung'))
      with check (public.has_permission('quan_ly_cai_dat') or public.has_permission('quan_ly_nguoi_dung'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bulletin_comments' and policyname='bcomment_read') then
    create policy bcomment_read on public.bulletin_comments for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bulletin_comments' and policyname='bcomment_write') then
    create policy bcomment_write on public.bulletin_comments for all to authenticated
      using (true) with check (author_id = auth.uid());
  end if;
end $$;

-- 7 ô tích bot (mặc định bật)
insert into public.settings (key, value) values
  ('BOT_CHECK_OKR','TRUE'),
  ('BOT_CHECK_KE_HOACH_TUAN','TRUE'),
  ('BOT_CHECK_BAO_CAO_TUAN','TRUE'),
  ('BOT_CHECK_BAO_CAO_KHO','TRUE'),
  ('BOT_CHECK_DANG_NHAP','TRUE'),
  ('BOT_CHECK_TIN_THI_TRUONG','TRUE'),
  ('BOT_CHECK_CHIEN_DICH','TRUE')
on conflict (key) do nothing;
