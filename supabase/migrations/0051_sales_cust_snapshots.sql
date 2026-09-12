-- 0051: Chốt ngày 22:00 VN — snapshot tổng hợp theo khách cho tab "Bán hàng & Công nợ"
-- + fn_build_cust_sales_snap (tính gộp 1 kỳ cho MỌI khách), fn_refresh_sales_snapshots (cron ghi),
--   fn_sales_customer_snapshot (đọc nhanh theo khóa chính).
-- Nguyên tắc an toàn: job chạy mỗi đêm upsert theo khóa (ma_norm, loai, ky);
--   job chưa chạy / lỗi -> trang tự tính trực tiếp bằng sales_report (fallback).

-- ===== 1) Bảng snapshot =====
create table if not exists public.sales_cust_snapshots (
  ma_norm text not null,
  loai text not null,           -- 'month' | 'quarter' | 'year' | 'debt'
  ky text not null,             -- '2026-09' | '2026Q3' | '2026' | 'debt'
  data jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now(),
  primary key (ma_norm, loai, ky)
);
alter table public.sales_cust_snapshots enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sales_cust_snapshots' and policyname='scs_read') then
    create policy scs_read on public.sales_cust_snapshots for select to authenticated using (true);
  end if;
end $$;

-- ===== 2) Tính gộp theo khách cho MỘT kỳ [p_from, p_to] =====
-- Trả về (ma_norm, data) với data cùng hình dạng kết quả /api/sales/query cho 1 khách.
create or replace function public.fn_build_cust_sales_snap(p_from date, p_to date)
returns table (ma_norm text, data jsonb)
language sql stable as $$
  with b as (
    select public.fn_norm_ma(s.ma_kh) as mn,
           to_char(s.ngay,'YYYY-MM')  as m,
           coalesce(nullif(trim(s.so_ct),''), 'R' || s.id::text) as hd,
           coalesce(s.thanh_tien,0)   as tt,
           coalesce(s.so_luong,0)     as sl,
           coalesce(nullif(trim(s.nhom_hang),''),'(khong ro)') as nhom,
           case when coalesce(trim(s.ma_vt),'') <> ''
                then case when coalesce(trim(regexp_replace(s.ten_vt, '^\s*\[[^\]]*\]\s*','')),'') <> ''
                          then '[' || trim(s.ma_vt) || '] ' || trim(regexp_replace(s.ten_vt, '^\s*\[[^\]]*\]\s*',''))
                          else trim(s.ma_vt) end
                else coalesce(nullif(trim(regexp_replace(s.ten_vt, '^\s*\[[^\]]*\]\s*','')),''),'(khong ro)')
           end as sp_disp
    from public.sales_rows s
    where s.ngay between p_from and p_to
      and coalesce(public.fn_norm_ma(s.ma_kh),'') <> ''
  ),
  per as (
    select mn, sum(tt) total, count(*) cnt, sum(sl) qty, count(distinct hd) hd
    from b group by mn
  ),
  mrows as (
    select mn, jsonb_agg(jsonb_build_object('m',m,'dt',dt) order by m) j
    from (select mn, m, sum(tt) dt from b group by 1,2) g group by mn
  ),
  nh as (
    select mn, jsonb_agg(jsonb_build_object('label',nhom,'value',v) order by v desc) j
    from (select mn, nhom, sum(tt) v from b group by 1,2) g group by mn
  ),
  nm as (
    select mn, jsonb_agg(jsonb_build_object('nhom',nhom,'m',m,'value',v) order by nhom,m) j
    from (select mn, nhom, m, sum(tt) v from b group by 1,2,3) g group by mn
  ),
  sm as (
    select mn, jsonb_agg(jsonb_build_object('sp',sp,'m',m,'value',v) order by sp,m) j
    from (select mn, sp_disp sp, m, sum(tt) v from b group by 1,2,3) g group by mn
  ),
  tsp as (
    select mn, jsonb_agg(jsonb_build_object('label',sp,'total',tt,'qty',q,'count',c)
                         order by tt desc, sp) j
    from (select mn, sp_disp sp, sum(tt) tt, sum(sl) q, count(*) c from b group by 1,2) g group by mn
  )
  select p.mn,
    jsonb_build_object(
      'total', coalesce(p.total,0),
      'count', p.cnt,
      'totalQty', coalesce(p.qty,0),
      'soHoaDon', p.hd,
      'soKhachHang', 1,
      'avgValue', case when p.hd > 0 then p.total / p.hd else 0 end,
      'byMonth',   coalesce(mr.j, '[]'::jsonb),
      'byNhom',    coalesce(nh.j, '[]'::jsonb),
      'nhomMonth', coalesce(nm.j, '[]'::jsonb),
      'spMonth',   coalesce(sm.j, '[]'::jsonb),
      'topSp',     coalesce(ts.j, '[]'::jsonb),
      'topSpQty',  coalesce(ts.j, '[]'::jsonb),
      'from', to_char(p_from,'YYYY-MM-DD'),
      'to',   to_char(p_to,'YYYY-MM-DD'),
      'engine','snapshot'
    ) as data
  from per p
  left join mrows mr on mr.mn = p.mn
  left join nh      on nh.mn  = p.mn
  left join nm      on nm.mn  = p.mn
  left join sm      on sm.mn  = p.mn
  left join tsp ts  on ts.mn  = p.mn;
$$;

-- ===== 3) Hàm ghi snapshot (cron gọi lúc 22:00 VN) =====
create or replace function public.fn_refresh_sales_snapshots(p_as_of date default current_date)
returns json language plpgsql volatile as $$
declare
  v_ms date; v_qs date; v_ys date;
  v_mky text; v_qky text; v_yky text;
  v_grace int; v_base date; v_D date; v_E date; v_map jsonb;
  v_n int := 0; v_d int := 0;
begin
  v_ms := date_trunc('month', p_as_of)::date;
  v_qs := date_trunc('quarter', p_as_of)::date;
  v_ys := make_date(extract(year from p_as_of)::int, 1, 1);
  v_mky := to_char(p_as_of,'YYYY-MM');
  v_qky := extract(year from p_as_of)::int || 'Q' || extract(quarter from p_as_of)::int;
  v_yky := extract(year from p_as_of)::int::text;

  -- Bán hàng: 3 kỳ hiện tại (tháng / quý / năm đến hết p_as_of)
  with u as (
    insert into public.sales_cust_snapshots (ma_norm, loai, ky, data, refreshed_at)
    select ma_norm, 'month',   v_mky, data, now() from public.fn_build_cust_sales_snap(v_ms, p_as_of)
    union all
    select ma_norm, 'quarter', v_qky, data, now() from public.fn_build_cust_sales_snap(v_qs, p_as_of)
    union all
    select ma_norm, 'year',    v_yky, data, now() from public.fn_build_cust_sales_snap(v_ys, p_as_of)
    on conflict (ma_norm, loai, ky) do update set data = excluded.data, refreshed_at = excluded.refreshed_at
    returning 1
  ) select count(*) into v_n from u;

  -- Công nợ (TK131) — cùng công thức với finance_debt_report
  select coalesce(nullif(value,'')::int, 90) into v_grace from public.settings where key='DEBT_GRACE_DAYS';
  select nullif(value,'')::date into v_base from public.settings where key='DEBT_BASE_DATE';
  if v_base is null then v_base := '2026-01-01'; end if;
  v_E := p_as_of + 1;
  v_D := date_trunc('month', (v_E - (v_grace || ' days')::interval))::date;
  select coalesce(value::jsonb,'[]'::jsonb) into v_map from public.settings where key='RECEIVABLE_TK_MAP';

  with base as (
    select public.fn_norm_ma(cb.ma_kh) as mn, cb.du_no
    from public.customer_base_balance cb
    where coalesce(public.fn_norm_ma(cb.ma_kh),'') <> ''
  ),
  ps as (
    select public.fn_norm_ma(r.ma_kh) as mn,
      sum(case when r.ngay <  v_D then r.so_no - r.so_co else 0 end) as ps_truoc_D,
      sum(case when r.ngay >= v_D and r.ngay <= v_E and public.fn_tk_nhom(r.tk_doi_ung, v_map)='Trả lại' then r.so_co - r.so_no else 0 end) as tra_lai,
      sum(case when r.ngay >= v_D and r.ngay <= v_E and public.fn_tk_nhom(r.tk_doi_ung, v_map)='Thu tiền' then r.so_co - r.so_no else 0 end) as thu_tien
    from public.receivable_rows r
    where coalesce(public.fn_norm_ma(r.ma_kh),'') <> ''
    group by 1
  ),
  u2 as (
    insert into public.sales_cust_snapshots (ma_norm, loai, ky, data, refreshed_at)
    select b.mn, 'debt', 'debt',
      jsonb_build_object(
        'con_thieu', greatest(b.du_no + coalesce(p.ps_truoc_D,0) - (coalesce(p.tra_lai,0)+coalesce(p.thu_tien,0)), 0),
        'as_of', v_E::text
      ), now()
    from base b left join ps p on p.mn = b.mn
    on conflict (ma_norm, loai, ky) do update set data = excluded.data, refreshed_at = excluded.refreshed_at
    returning 1
  ) select count(*) into v_d from u2;

  return json_build_object('sales', v_n, 'debt', v_d, 'as_of', p_as_of,
    'ky', json_build_object('month', v_mky, 'quarter', v_qky, 'year', v_yky));
exception when others then
  return json_build_object('error', sqlerrm, 'code', sqlstate);
end;
$$;

-- ===== 4) Hàm đọc snapshot theo khách =====
create or replace function public.fn_sales_customer_snapshot(p_ma_norm text, p_loai text, p_ky text)
returns json language sql stable as $$
  select case when data is null then null
              else jsonb_build_object('data', data, 'refreshed_at', refreshed_at) end
  from public.sales_cust_snapshots
  where ma_norm = p_ma_norm and loai = p_loai and ky = p_ky;
$$;

grant execute on function public.fn_build_cust_sales_snap(date,date) to service_role;
grant execute on function public.fn_refresh_sales_snapshots(date) to service_role;
grant execute on function public.fn_sales_customer_snapshot(text,text,text) to service_role, authenticated;
