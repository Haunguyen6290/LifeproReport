-- 0050_sales_customer_norm_spmonth.sql
-- 1) Chuẩn hóa lọc khách theo mã (fn_norm_ma như Tài chính 0033), tránh lệch do tên
--    Thêm p_ma_kh_norm text[] cho sales_report + sales_detail — lọc theo ma_kh đã chuẩn hóa.
-- 2) Thêm pivot spMonth (sản phẩm × tháng) để vẽ stacked bar Top-5 SP × 6 tháng gần nhất.
-- Kế thừa 0046 (nhomMonth + khachMonth + sp_disp không NULL). Giữ nguyên số liệu.

drop function if exists public.sales_report(date, date, text[], text[], text[], text[], text[]);
create or replace function public.sales_report(
  p_from date, p_to date,
  p_kd text[] default null, p_vung text[] default null,
  p_nhom text[] default null, p_kh text[] default null, p_sp text[] default null,
  p_ma_kh_norm text[] default null
) returns json language plpgsql volatile set search_path = public as $$
declare
  v_total numeric; v_qty numeric; v_rows int; v_hd int; v_kh int;
  result json;
  v_has_sp boolean;
  v_has_norm boolean;
begin
  v_has_sp := p_sp is not null and p_sp <> '{}';
  v_has_norm := p_ma_kh_norm is not null and p_ma_kh_norm <> '{}';
  drop table if exists _all; drop table if exists _sr;

  create temp table _all on commit drop as
    select s.ngay, s.sale_month, s.so_ct, s.ma_vt, s.ma_kh, s.ten_kh, s.kinh_doanh, s.ten_vt, s.so_luong, s.thanh_tien,
           coalesce(nullif(c.tinh_thanh, ''), s.vung) as vung, s.nhom_hang, s.hang_sx,
           coalesce(
             case
               when nullif(s.ma_vt,'') is not null then
                 case when coalesce(nullif(case when s.ten_vt like '[%' then regexp_replace(coalesce(s.ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(s.ten_vt,'') end, ''), '') = ''
                      then s.ma_vt
                      else '[' || s.ma_vt || '] ' || nullif(case when s.ten_vt like '[%' then regexp_replace(coalesce(s.ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(s.ten_vt,'') end, '')
                 end
               else nullif(case when s.ten_vt like '[%' then regexp_replace(coalesce(s.ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(s.ten_vt,'') end, '')
             end,
             nullif(s.ma_vt,''), nullif(s.ten_vt,''), '(không rõ)'
           ) as sp_disp
    from public.sales_rows s
    left join public.customers c on c.ma_kh = s.ma_kh
    where s.ngay between p_from and p_to;

  create temp table _sr on commit drop as
    select * from _all
    where (p_kd is null or p_kd = '{}' or kinh_doanh = any(p_kd))
      and (p_vung is null or p_vung = '{}' or vung = any(p_vung))
      and (p_nhom is null or p_nhom = '{}' or nhom_hang = any(p_nhom))
      and (p_kh is null or p_kh = '{}' or ten_kh = any(p_kh))
      and (not v_has_norm or public.fn_norm_ma(ma_kh) = any(p_ma_kh_norm))
      and (not v_has_sp or sp_disp = any(p_sp) or ten_vt = any(p_sp) or ma_vt = any(p_sp));

  select coalesce(sum(thanh_tien),0), coalesce(sum(so_luong),0), count(*),
         count(distinct nullif(so_ct,'')), count(distinct nullif(ma_kh,''))
  into v_total, v_qty, v_rows, v_hd, v_kh from _sr;

  select json_build_object(
    'total', v_total, 'totalQty', v_qty, 'count', v_rows,
    'soHoaDon', v_hd, 'soKhachHang', v_kh,
    'avgValue', case when v_hd > 0 then v_total / v_hd else 0 end,
    'byKd',    (select coalesce(json_agg(t),'[]') from (select coalesce(nullif(kinh_doanh,''),'(trống)') as label, sum(thanh_tien) as value from _sr group by 1 order by value desc) t),
    'byVung',  (select coalesce(json_agg(t),'[]') from (select coalesce(nullif(vung,''),'(không rõ)') as label, sum(thanh_tien) as value from _sr group by 1 order by value desc) t),
    'byNhom',  (select coalesce(json_agg(t),'[]') from (select coalesce(nullif(nhom_hang,''),'(không rõ)') as label, sum(thanh_tien) as value from _sr group by 1 order by value desc) t),
    'byHang',  (select coalesce(json_agg(t),'[]') from (select coalesce(nullif(hang_sx,''),'(không rõ)') as label, sum(thanh_tien) as value from _sr group by 1 order by value desc) t),
    'byKh',    (select coalesce(json_agg(t),'[]') from (select coalesce(nullif(ten_kh,''),nullif(ma_kh,''),'(không rõ)') as label, sum(thanh_tien) as value from _sr group by 1 order by value desc) t),
    'byMonth', (select coalesce(json_agg(t),'[]') from (select sale_month as m, sum(thanh_tien) as dt, count(distinct nullif(so_ct,'')) as hd from _sr group by sale_month order by sale_month) t),
    'nhomMonth',(select coalesce(json_agg(t),'[]') from (select coalesce(nullif(nhom_hang,''),'(không rõ)') as nhom, sale_month as m, sum(thanh_tien) as value from _sr group by 1,2) t),
    'khachMonth',(select coalesce(json_agg(t),'[]') from (select ma_kh, coalesce(nullif(ten_kh,''), ma_kh) as ten_kh, coalesce(nullif(kinh_doanh,''),'(trống)') as kd, sale_month as m, sum(thanh_tien) as value from _sr group by 1,2,3,4) t),
    'spMonth', (select coalesce(json_agg(t),'[]') from (select sp_disp as sp, sale_month as m, sum(thanh_tien) as value from _sr group by 1,2) t),
    'topSp',   (select coalesce(json_agg(t),'[]') from (select sp_disp as label, sum(thanh_tien) as total, sum(coalesce(so_luong,0)) as qty, count(*) as count from _sr group by sp_disp order by total desc limit 15) t),
    'topSpQty',(select coalesce(json_agg(t),'[]') from (select sp_disp as label, sum(thanh_tien) as total, sum(coalesce(so_luong,0)) as qty, count(*) as count from _sr group by sp_disp order by qty desc limit 15) t),
    'options', json_build_object(
      'kd',   (select coalesce(json_agg(x order by x),'[]') from (select distinct kinh_doanh as x from _all where kinh_doanh is not null and kinh_doanh <> '') s),
      'vung', (select coalesce(json_agg(x order by x),'[]') from (select distinct vung as x from _all where vung is not null and vung <> '') s),
      'nhom', (select coalesce(json_agg(x order by x),'[]') from (select distinct nhom_hang as x from _all where nhom_hang is not null and nhom_hang <> '') s),
      'kh',   (select coalesce(json_agg(x order by x),'[]') from (select distinct ten_kh as x from _all where ten_kh is not null and ten_kh <> '') s),
      'sp',   (select coalesce(json_agg(x order by x),'[]') from (select distinct sp_disp as x from _all where sp_disp is not null and sp_disp <> '') s)
    )
  ) into result;

  return result;
end $$;

-- sales_detail cũng nhận p_ma_kh_norm để chi tiết 1 khách khớp theo mã chuẩn
drop function if exists public.sales_detail(date, date, text[], text[], text[], text[], text[], text, int, int);
drop function if exists public.sales_detail(date, date, text[], text[], text[], text[], text[], text, int, int, text[]);

create or replace function public.sales_detail(
  p_from date, p_to date,
  p_kd text[] default null, p_vung text[] default null,
  p_nhom text[] default null, p_kh text[] default null, p_sp text[] default null,
  p_search text default null, p_page int default 1, p_limit int default 20,
  p_ma_kh_norm text[] default null
) returns json language plpgsql volatile set search_path = public as $$
declare
  v_total int;
  result json;
  v_has_sp boolean;
  v_has_norm boolean;
begin
  v_has_sp := p_sp is not null and p_sp <> '{}';
  v_has_norm := p_ma_kh_norm is not null and p_ma_kh_norm <> '{}';
  drop table if exists _sr;

  create temp table _sr on commit drop as
    select s.ngay, s.so_ct, s.ma_vt,
           coalesce(
             case
               when nullif(s.ma_vt,'') is not null then
                 case when coalesce(nullif(case when s.ten_vt like '[%' then regexp_replace(coalesce(s.ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(s.ten_vt,'') end, ''), '') = ''
                      then s.ma_vt
                      else '[' || s.ma_vt || '] ' || nullif(case when s.ten_vt like '[%' then regexp_replace(coalesce(s.ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(s.ten_vt,'') end, '')
                 end
               else nullif(case when s.ten_vt like '[%' then regexp_replace(coalesce(s.ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(s.ten_vt,'') end, '')
             end,
             nullif(s.ma_vt,''), nullif(s.ten_vt,''), '(không rõ)'
           ) as ten_vt,
           s.ma_kh, s.ten_kh, s.kinh_doanh, s.so_luong, s.thanh_tien,
           coalesce(nullif(c.tinh_thanh, ''), s.vung) as vung, s.nhom_hang, s.hang_sx
    from public.sales_rows s
    left join public.customers c on c.ma_kh = s.ma_kh
    where s.ngay between p_from and p_to
      and (p_kd is null or p_kd = '{}' or s.kinh_doanh = any(p_kd))
      and (p_vung is null or p_vung = '{}' or coalesce(nullif(c.tinh_thanh,''), s.vung) = any(p_vung))
      and (p_nhom is null or p_nhom = '{}' or s.nhom_hang = any(p_nhom))
      and (p_kh is null or p_kh = '{}' or s.ten_kh = any(p_kh))
      and (not v_has_norm or public.fn_norm_ma(s.ma_kh) = any(p_ma_kh_norm))
      and (not v_has_sp
           or s.ten_vt = any(p_sp) or s.ma_vt = any(p_sp)
           or coalesce(
                case
                  when nullif(s.ma_vt,'') is not null then
                    case when coalesce(nullif(case when s.ten_vt like '[%' then regexp_replace(coalesce(s.ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(s.ten_vt,'') end, ''), '') = ''
                         then s.ma_vt
                         else '[' || s.ma_vt || '] ' || nullif(case when s.ten_vt like '[%' then regexp_replace(coalesce(s.ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(s.ten_vt,'') end, '')
                    end
                  else nullif(case when s.ten_vt like '[%' then regexp_replace(coalesce(s.ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(s.ten_vt,'') end, '')
                end,
                nullif(s.ma_vt,''), nullif(s.ten_vt,''), '(không rõ)') = any(p_sp))
      and (p_search is null or p_search = ''
           or s.ten_vt ilike '%' || p_search || '%'
           or s.ten_kh ilike '%' || p_search || '%'
           or s.ma_kh  ilike '%' || p_search || '%'
           or s.so_ct  ilike '%' || p_search || '%'
           or s.ma_vt  ilike '%' || p_search || '%');

  select count(*) into v_total from _sr;

  select json_build_object(
    'total', v_total,
    'hasMore', (p_page * p_limit) < v_total,
    'rows', (select coalesce(json_agg(t),'[]') from (
        select ngay, so_ct, ma_vt, ten_vt, ma_kh, ten_kh, kinh_doanh, so_luong, thanh_tien, vung, nhom_hang, hang_sx
        from _sr order by ngay desc, so_ct
        limit p_limit offset (p_page - 1) * p_limit
      ) t)
  ) into result;

  return result;
end $$;
