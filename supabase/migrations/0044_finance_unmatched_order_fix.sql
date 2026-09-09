-- 0044_finance_unmatched_order_fix.sql
-- Sửa lỗi bảng "Khách chưa khớp": finance_unmatched_customers luôn lỗi 42703 column thu_tien does not exist
-- Nguyên nhân: ORDER BY thu_tien đặt ngoài phạm vi — t lúc đó là json, không còn cột thu_tien.
-- Sửa: sắp xếp theo giá trị trong json (t->>'thu_tien')::numeric. Nghiệp vụ/số liệu giữ nguyên 100%.

create or replace function public.finance_unmatched_customers(p_thang text default null)
returns json language plpgsql stable set search_path = public as $$
declare v_tu date; v_den date; v_map jsonb; v_rows json;
begin
  if p_thang is null or p_thang = '' then
    v_tu := '2026-01-01'::date; v_den := current_date;
  else
    v_tu := (p_thang || '-01')::date;
    v_den := (date_trunc('month', v_tu) + interval '1 month' - interval '1 day')::date;
  end if;
  select coalesce(value::jsonb,'[]'::jsonb) into v_map from public.settings where key='RECEIVABLE_TK_MAP';
  with dm1 as (
    select c.ma_kh as ma_chuan, c.ten_kh, c.assigned_to
    from public.customers c
    left join public.profiles p on p.id = c.assigned_to
    where c.assigned_to is null or p.id is not null
  ),
  dm as (
    select public.fn_norm_ma(ma_chuan) as ma_norm,
           min(ma_chuan) as ma_chuan,
           (array_agg(ten_kh order by ma_chuan))[1] as ten_kh,
           (array_agg(assigned_to order by ma_chuan))[1] as assigned_to
    from dm1 group by 1
  ),
  s as (
    select r.ma_kh as ma_so, r.ten_kh as ten_so,
           public.fn_norm_ma(r.ma_kh) as norm,
           public.fn_tk_nhom(r.tk_doi_ung, v_map) as nhom,
           r.so_no, r.so_co, dm.ma_chuan, dm.ten_kh as ten_chuan, dm.assigned_to
    from public.receivable_rows r
    left join dm on dm.ma_norm = public.fn_norm_ma(r.ma_kh)
    where r.ngay between v_tu and v_den
  ),
  g as (
    select ma_so, ten_so, norm, ma_chuan, ten_chuan, assigned_to,
           sum(case when nhom = 'Doanh thu' then so_no - so_co else 0 end) as doanh_thu,
           sum(case when nhom = 'Trả lại'  then so_co - so_no else 0 end) as tra_lai,
           sum(case when nhom = 'Thu tiền' then so_co - so_no else 0 end) as thu_tien,
           count(*) as so_dong
    from s group by ma_so, ten_so, norm, ma_chuan, ten_chuan, assigned_to
  )
  select json_agg(t order by coalesce((t->>'thu_tien')::numeric, 0) desc) into v_rows
  from (
    select json_build_object(
      'ma_so', ma_so, 'ten_so', ten_so, 'ma_chuan', ma_chuan, 'ten_chuan', ten_chuan,
      'doanh_thu', coalesce(doanh_thu,0), 'tra_lai', coalesce(tra_lai,0), 'thu_tien', coalesce(thu_tien,0),
      'so_dong', so_dong,
      'chua_gan_kd', ma_chuan is not null and assigned_to is null
    ) as t from g where ma_chuan is null or assigned_to is null
  ) t;
  return json_build_object('thang', coalesce(p_thang,''), 'tu', v_tu, 'den', v_den, 'rows', coalesce(v_rows,'[]'::json));
end;
$$;
