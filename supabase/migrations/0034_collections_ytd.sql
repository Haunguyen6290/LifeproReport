-- 0034_collections_ytd.sql
-- Báo cáo lũy kế năm cho tab Bán hàng thu tiền: tổng dồn từ 01/01 đến hết tháng p_thang.
-- Tái dùng RECEIVABLE_TK_MAP và FINANCE_PLAN như finance_collections_report.
drop function if exists public.finance_collections_ytd(text);
create or replace function public.finance_collections_ytd(p_thang text)
returns json language plpgsql stable as $$
declare
  v_tu date; v_den date; v_map jsonb; v_plan jsonb; v_rows json;
begin
  v_tu := (left(p_thang,4) || '-01-01')::date;
  v_den := (date_trunc('month', (p_thang || '-01')::date) + interval '1 month' - interval '1 day')::date;
  select coalesce(value::jsonb,'[]'::jsonb) into v_map  from public.settings where key='RECEIVABLE_TK_MAP';
  select coalesce(value::jsonb,'[]'::jsonb) into v_plan from public.settings where key='FINANCE_PLAN';
  with cust as (
    select public.fn_norm_ma(c.ma_kh) as ma_norm, p.full_name as nvkd
    from public.customers c left join public.profiles p on p.id = c.assigned_to
    group by 1, 2
  ),
  s as (
    select coalesce(nullif(cust.nvkd,''), 'Khác') as nvkd,
           public.fn_tk_nhom(r.tk_doi_ung, v_map) as nhom,
           r.so_no, r.so_co
    from public.receivable_rows r
    left join cust on cust.ma_norm = public.fn_norm_ma(r.ma_kh)
    where r.ngay between v_tu and v_den
  ),
  agg as (
    select nvkd,
           (coalesce(sum(case when nhom='Doanh thu' then so_no - so_co else 0 end),0)
            - coalesce(sum(case when nhom='Trả lại'  then so_co - so_no else 0 end),0)) as doanh_so,
           coalesce(sum(case when nhom='Thu tiền' then so_co - so_no else 0 end),0) as thu_tien
    from s group by nvkd
  )
  select json_agg(t) into v_rows
  from (select json_build_object('nvkd', nvkd, 'doanh_so', doanh_so, 'thu_tien', thu_tien) as t from agg) t;
  return json_build_object('thang', p_thang, 'tu', v_tu, 'den', v_den, 'plan', v_plan, 'rows', coalesce(v_rows,'[]'::json));
end;
$$;
