-- 0030_tai_chinh.sql — Trang Tài chính: Công nợ quá hạn + Bán hàng thu tiền

-- ===== 1) Chứng từ sổ chi tiết TK131 =====
create table if not exists public.receivable_rows (
  id uuid primary key default gen_random_uuid(),
  ngay date not null,
  so_ct text not null default '',
  ma_kh text not null default '',
  ten_kh text not null default '',
  dien_giai text not null default '',
  tk_doi_ung text not null default '',
  so_no numeric not null default 0,
  so_co numeric not null default 0,
  du_dong numeric,
  import_batch text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_rcv_ngay on public.receivable_rows (ngay);
create index if not exists idx_rcv_ma_ngay on public.receivable_rows (ma_kh, ngay);

-- ===== 2) Số dư gốc từng khách =====
create table if not exists public.customer_base_balance (
  ma_kh text primary key,
  ten_kh text not null default '',
  du_no numeric not null default 0,
  ngay_moc date not null default '2026-01-01',
  updated_at timestamptz not null default now()
);

-- ===== 3) RLS =====
alter table public.receivable_rows enable row level security;
alter table public.customer_base_balance enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='receivable_rows' and policyname='rcv_read') then
    create policy rcv_read on public.receivable_rows for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='receivable_rows' and policyname='rcv_write') then
    create policy rcv_write on public.receivable_rows for all to authenticated
      using (public.has_permission('quan_ly_cai_dat')) with check (public.has_permission('quan_ly_cai_dat'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='customer_base_balance' and policyname='cbb_read') then
    create policy cbb_read on public.customer_base_balance for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='customer_base_balance' and policyname='cbb_write') then
    create policy cbb_write on public.customer_base_balance for all to authenticated
      using (public.has_permission('quan_ly_cai_dat')) with check (public.has_permission('quan_ly_cai_dat'));
  end if;
end $$;

-- ===== 4) Permission + gán ADMIN =====
do $$ begin
  if not exists (select 1 from jsonb_array_elements_text((select permissions from public.roles where name='ADMIN')) e where e = 'xem_tai_chinh') then
    update public.roles set permissions = (permissions || '["xem_tai_chinh"]'::jsonb) where name = 'ADMIN';
  end if;
end $$;

-- ===== 5) Settings seed =====
insert into public.settings (key, value) values
  ('DEBT_GRACE_DAYS', '90'),
  ('DEBT_BASE_DATE', '2026-01-01'),
  ('RECEIVABLE_TK_MAP', '[{"ma":"5111","nhom":"Doanh thu"},{"ma":"511","nhom":"Doanh thu"},{"ma":"521","nhom":"Trả lại"},{"ma":"111","nhom":"Thu tiền"},{"ma":"112","nhom":"Thu tiền"},{"ma":"131","nhom":"Thu tiền"},{"ma":"1368","nhom":"Thu tiền"},{"ma":"3361","nhom":"Thu tiền"},{"ma":"3413","nhom":"Thu tiền"},{"ma":"3414","nhom":"Thu tiền"},{"ma":"6426","nhom":"Thu tiền"}]'),
  ('FINANCE_PLAN', '[]')
on conflict (key) do nothing;

-- ===== 6) Helper: phân loại TK trong SQL (tiền tố dài nhất thắng) =====
create or replace function public.fn_tk_nhom(tk text, map jsonb) returns text language sql immutable as $$
  select elem->>'nhom' from jsonb_array_elements(map) elem
  where tk like (elem->>'ma') || '%'
  order by length(elem->>'ma') desc limit 1
$$;

-- ===== 7) RPC: báo cáo công nợ quá hạn =====
-- p_thang dạng YYYY-MM. p_den: ngày lập/chốt tùy chọn (null = lấy ngày chứng từ mới nhất).
-- Trả về { D, E, base, rows[] }
drop function if exists public.finance_debt_report(text, int, date);
drop function if exists public.finance_debt_report(text, int);
create or replace function public.finance_debt_report(p_thang text, p_han int default 90, p_den date default null)
returns json language plpgsql stable as $$
declare
  v_base date; v_D date; v_E date; v_map jsonb; v_rows json;
begin
  select nullif(value,'')::date into v_base from public.settings where key='DEBT_BASE_DATE';
  if v_base is null then v_base := '2026-01-01'; end if;
  v_D := date_trunc('month', ((date_trunc('month', (p_thang || '-01')::date) + interval '1 month' - interval '1 day') - (p_han || ' days')::interval))::date;
  if p_den is null then
    select coalesce(max(ngay), (date_trunc('month',(p_thang||'-01')::date)+interval '1 month'-interval '1 day')::date) into v_E from public.receivable_rows;
  else
    v_E := p_den;
  end if;
  select coalesce(value::jsonb,'[]'::jsonb) into v_map from public.settings where key='RECEIVABLE_TK_MAP';

  with base as (
    select cb.ma_kh, cb.ten_kh, cb.du_no,
           coalesce(c.assigned, '') as nvkd,
           coalesce(c.tinh_thanh, '') as tinh
    from public.customer_base_balance cb
    left join (
      select c2.ma_kh, p.full_name as assigned, c2.tinh_thanh
      from public.customers c2 left join public.profiles p on p.id = c2.assigned_to
    ) c on c.ma_kh = cb.ma_kh
  ),
  ps as (
    select ma_kh,
      sum(case when ngay < v_D then so_no - so_co else 0 end) as ps_truoc_D,
      sum(case when ngay >= v_D and ngay <= v_E and public.fn_tk_nhom(tk_doi_ung, v_map)='Doanh thu' then so_no - so_co else 0 end) as doanh_thu,
      sum(case when ngay >= v_D and ngay <= v_E and public.fn_tk_nhom(tk_doi_ung, v_map)='Trả lại' then so_co - so_no else 0 end) as tra_lai,
      sum(case when ngay >= v_D and ngay <= v_E and public.fn_tk_nhom(tk_doi_ung, v_map)='Thu tiền' then so_co - so_no else 0 end) as thu_tien
    from public.receivable_rows group by ma_kh
  )
  select json_agg(t order by (t->>'con_thieu')::numeric desc, (t->>'ma_kh')::text) into v_rows
  from (
    select json_build_object(
      'ma_kh', b.ma_kh, 'ten_kh', b.ten_kh, 'nvkd', b.nvkd, 'tinh', b.tinh,
      'cong_no_dau_ky', greatest(b.du_no + coalesce(p.ps_truoc_D,0), 0),
      'doanh_thu', coalesce(p.doanh_thu,0),
      'tra_lai', coalesce(p.tra_lai,0),
      'thu_tien', coalesce(p.thu_tien,0),
      'tong_giam_tru', coalesce(p.tra_lai,0) + coalesce(p.thu_tien,0),
      'con_thieu', greatest(b.du_no + coalesce(p.ps_truoc_D,0) - (coalesce(p.tra_lai,0)+coalesce(p.thu_tien,0)), 0),
      'qua_han', (coalesce(p.tra_lai,0)+coalesce(p.thu_tien,0)) < greatest(b.du_no + coalesce(p.ps_truoc_D,0), 0) and (b.du_no + coalesce(p.ps_truoc_D,0)) > 0
    ) as t
    from base b left join ps p on p.ma_kh = b.ma_kh
  ) t;

  return json_build_object('D', v_D, 'E', v_E, 'base', v_base, 'rows', coalesce(v_rows,'[]'::json));
end;
$$;

-- ===== 8) RPC: báo cáo bán hàng thu tiền =====
drop function if exists public.finance_collections_report(text);
create or replace function public.finance_collections_report(p_thang text)
returns json language plpgsql stable as $$
declare
  v_tu date; v_den date; v_map jsonb; v_plan jsonb; v_rows json;
begin
  v_tu := (p_thang || '-01')::date;
  v_den := (date_trunc('month', v_tu) + interval '1 month' - interval '1 day')::date;
  select coalesce(value::jsonb,'[]'::jsonb) into v_map from public.settings where key='RECEIVABLE_TK_MAP';
  select coalesce(value::jsonb,'[]'::jsonb) into v_plan from public.settings where key='FINANCE_PLAN';

  with kh_nv as (
    select s.ma_kh, s.thanh_tien, s.ngay,
           coalesce(p.full_name, nullif(s.kinh_doanh,'')) as nvkd
    from public.sales_rows s
    left join public.customers c on c.ma_kh = s.ma_kh
    left join public.profiles p on p.id = c.assigned_to
    where s.ngay between v_tu and v_den
  ),
  thu as (
    select r.ma_kh, sum(r.so_co - r.so_no) as so_thu
    from public.receivable_rows r
    where r.ngay between v_tu and v_den and public.fn_tk_nhom(r.tk_doi_ung, v_map) = 'Thu tiền'
    group by r.ma_kh
  ),
  khuvu as (
    select coalesce(k.nvkd, 'Khác') as nvkd,
           coalesce(sum(k.thanh_tien),0) as doanh_so,
           coalesce(sum(t.so_thu),0) as thu_tien
    from kh_nv k left join thu t on t.ma_kh = k.ma_kh
    group by 1
  )
  select json_agg(t) into v_rows from (select json_build_object('nvkd', nvkd, 'doanh_so', doanh_so, 'thu_tien', thu_tien) as t from khuvu) t;

  return json_build_object('thang', p_thang, 'plan', v_plan, 'rows', coalesce(v_rows,'[]'::json));
end;
$$;
