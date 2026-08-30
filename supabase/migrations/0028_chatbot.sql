-- 0028_chatbot.sql — Chatbot Trợ lý công việc: kho QA (91 bản ghi) + log câu hỏi hụt
-- Spec: docs/superpowers/specs/2026-08-30-chatbot-design.md

create table if not exists public.chatbot_qa (
  id text primary key,
  phan_he text not null default '',
  nhom_chu_de text not null default '',
  cau_hoi text not null default '',
  tra_loi_chuan text not null default '',
  vi_du text not null default '',
  cau_hoi_tiep_theo text not null default '',
  hanh_dong text not null default '',
  phan_he_lien_quan text[] not null default '{}',
  vai_tro text not null default '',
  muc_do text not null default '',
  uu_tien text not null default '',
  du_lieu_can_co text not null default '',
  khong_tu_doan text not null default '',
  search_text tsvector generated always as (
    to_tsvector('simple', coalesce(cau_hoi,'') || ' ' || coalesce(tra_loi_chuan,'') || ' ' || coalesce(nhom_chu_de,''))
  ) stored
);

create index if not exists idx_chatbot_qa_phan_he on public.chatbot_qa (phan_he);
create index if not exists idx_chatbot_qa_search on public.chatbot_qa using gin (search_text);

create table if not exists public.chatbot_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  query text not null default '',
  context text not null default '',
  created_at timestamptz not null default now()
);

alter table public.chatbot_qa enable row level security;
alter table public.chatbot_queries enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chatbot_qa' and policyname='chatbot_qa_read') then
    create policy chatbot_qa_read on public.chatbot_qa for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chatbot_queries' and policyname='chatbot_queries_insert') then
    create policy chatbot_queries_insert on public.chatbot_queries for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chatbot_queries' and policyname='chatbot_queries_read') then
    create policy chatbot_queries_read on public.chatbot_queries for select to authenticated using (public.has_permission('quan_ly_cai_dat') or public.has_permission('quan_ly_nguoi_dung'));
  end if;
end $$;
