-- 0032_tai_chinh_collections_tk131.sql
-- Báo cáo Bán hàng thu tiền: bỏ phụ thuộc Sổ chi tiết bán hàng.
-- Doanh số = Nợ-Có của TK 511 trừ (Có-Nợ TK 521) = doanh số thuần, tính thẳng từ sổ 131.
-- Thu tiền = Có-Nợ nhóm 'Thu tiền' (111,112,131,1368,3413,3414... theo RECEIVABLE_TK_MAP).
-- NVKD vẫn lấy từ Danh mục khách hàng (customers.assigned_to → profiles.full_name).

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

  with s as (
    select coalesce(nullif(p.full_name,''), 'Khác') as nvkd,
           public.fn_tk_nhom(r.tk_doi_ung, v_map) as nhom,
           r.so_no, r.so_co
    from public.receivable_rows r
    left join public.customers c on c.ma_kh = r.ma_kh
    left join public.profiles p on p.id = c.assigned_to
    where r.ngay between v_tu and v_den
  ),
  agg as (
    select nvkd,
           (coalesce(sum(case when nhom = 'Doanh thu' then so_no - so_co else 0 end),0)
            - coalesce(sum(case when nhom = 'Trả lại'  then so_co - so_no else 0 end),0)) as doanh_so,
           coalesce(sum(case when nhom = 'Thu tiền' then so_co - so_no else 0 end),0) as thu_tien
    from s
    group by nvkd
  )
  select json_agg(t) into v_rows
  from (select json_build_object('nvkd', nvkd, 'doanh_so', doanh_so, 'thu_tien', thu_tien) as t from agg) t;

  return json_build_object('thang', p_thang, 'plan', v_plan, 'rows', coalesce(v_rows,'[]'::json));
end;
$$;
