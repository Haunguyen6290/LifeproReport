-- Bảng lưu lần xem cuối của từng user với từng chiến dịch
create table if not exists campaign_views (
  user_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  primary key (user_id, campaign_id)
);

-- Index để query nhanh
create index if not exists campaign_views_user_id_idx on campaign_views(user_id);
create index if not exists campaign_views_campaign_id_idx on campaign_views(campaign_id);
