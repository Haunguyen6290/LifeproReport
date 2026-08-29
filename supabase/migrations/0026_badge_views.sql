-- 0026_badge_views.sql
-- Lưu lần cuối mỗi user xem Bảng tin / Chiến dịch để tính badge (...) như Facebook
create table if not exists public.badge_views (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('bulletin','campaign')),
  last_viewed_at timestamptz not null default '2000-01-01',
  primary key (user_id, kind)
);

alter table public.badge_views enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='badge_views' and policyname='badge_self') then
    create policy badge_self on public.badge_views for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
