-- 0031_tai_chinh_collections_fix.sql
-- Sửa RPC báo cáo Bán hàng thu tiền:
--   + Thu tiền tính ĐỘC LẬP theo khách (Σ Có − Σ Nợ, nhóm 'Thu tiền'), đúng tháng.
--   + Không join thu tiền vào doanh số theo hóa đơn (lỗi cũ gây NHÂN ĐÚP thu tiền
--     khi 1 khách có nhiều hóa đơn, và RƠI thu tiền khi khách trả nợ cũ mà không mua trong kỳ).
--   + Hợp nhất doanh số & thu tiền theo NVKD bằng FULL OUTER JOIN → không mất dòng nào.

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

  with ds as (
    -- Doanh số bán hàng theo NVKD (từ sổ chi tiết bán hàng), quy về KD quản lý khách hàng
    select coalesce(nullif(p.full_name, ''), nullif(s.kinh_doanh, ''), 'Khác') as nvkd,
           sum(s.thanh_tien) as doanh_so
    from public.sales_rows s
    left join public.customers c on c.ma_kh = s.ma_kh
    left join public.profiles p on p.id = c.assigned_to
    where s.ngay between v_tu and v_den
    group by 1
  ),
  thu as (
    -- Thu tiền theo NVKD (từ sổ TK131): Σ Có − Σ Nợ của các dòng nhóm 'Thu tiền'
    select coalesce(nullif(p.full_name, ''), 'Khác') as nvkd,
           sum(r.so_co - r.so_no) as thu_tien
    from public.receivable_rows r
    left join public.customers c on c.ma_kh = r.ma_kh
    left join public.profiles p on p.id = c.assigned_to
    where r.ngay between v_tu and v_den
      and public.fn_tk_nhom(r.tk_doi_ung, v_map) = 'Thu tiền'
    group by 1
  ),
  khuvu as (
    select coalesce(ds.nvkd, thu.nvkd) as nvkd,
           coalesce(ds.doanh_so, 0) as doanh_so,
           coalesce(thu.thu_tien, 0) as thu_tien
    from ds full outer join thu on ds.nvkd = thu.nvkd
  )
  select json_agg(t) into v_rows
  from (select json_build_object('nvkd', nvkd, 'doanh_so', doanh_so, 'thu_tien', thu_tien) as t from khuvu) t;

  return json_build_object('thang', p_thang, 'plan', v_plan, 'rows', coalesce(v_rows,'[]'::json));
end;
$$;
