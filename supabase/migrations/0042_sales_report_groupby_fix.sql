-- 0042_sales_report_groupby_fix.sql
-- Sửa lỗi 0041: topSp/topSpQty dùng ma_vt trong CASE nhưng GROUP BY thiếu → Postgres báo 42803, khiến API rơi về đường vòng node (25s cho 1 năm).
-- Dùng max(ma_vt)/max(ten_vt) trong SELECT để hết lỗi GROUP BY; số liệu giữ nguyên (nhóm theo ma_vt như 0041).

create or replace function public.sales_report(
  p_from date, p_to date,
  p_kd text[] default null, p_vung text[] default null,
  p_nhom text[] default null, p_kh text[] default null, p_sp text[] default null
) returns json language plpgsql volatile set search_path = public as $$
declare
  v_total numeric; v_qty numeric; v_rows int; v_hd int; v_kh int;
  result json;
  v_has_sp boolean;
begin
  v_has_sp := p_sp is not null and p_sp <> '{}';
  drop table if exists _all; drop table if exists _sr;

  create temp table _all on commit drop as
    select s.ngay, s.sale_month, s.so_ct, s.ma_vt, s.ma_kh, s.ten_kh, s.kinh_doanh, s.ten_vt, s.so_luong, s.thanh_tien,
           coalesce(nullif(c.tinh_thanh, ''), s.vung) as vung, s.nhom_hang, s.hang_sx
    from public.sales_rows s
    left join public.customers c on c.ma_kh = s.ma_kh
    where s.ngay between p_from and p_to;

  create temp table _sr on commit drop as
    select * from _all
    where (p_kd is null or p_kd = '{}' or kinh_doanh = any(p_kd))
      and (p_vung is null or p_vung = '{}' or vung = any(p_vung))
      and (p_nhom is null or p_nhom = '{}' or nhom_hang = any(p_nhom))
      and (p_kh is null or p_kh = '{}' or ten_kh = any(p_kh))
      and (not v_has_sp or ten_vt = any(p_sp) or ma_vt = any(p_sp)
           or ('[' || ma_vt || '] ' || case when ten_vt like '[%' then regexp_replace(coalesce(ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(ten_vt,'') end) = any(p_sp));

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
    'topSp',   (select coalesce(json_agg(t),'[]') from (
                  select case when nullif(max(ma_vt),'') is not null
                              then '[' || max(ma_vt) || '] ' || nullif(case when max(ten_vt) like '[%' then regexp_replace(coalesce(max(ten_vt),''), '^\s*\[.*?\]\s*', '') else coalesce(max(ten_vt),'') end, '')
                              else coalesce(nullif(case when max(ten_vt) like '[%' then regexp_replace(coalesce(max(ten_vt),''), '^\s*\[.*?\]\s*', '') else coalesce(max(ten_vt),'') end, ''), max(ma_vt), '(không rõ)')
                         end as label,
                         sum(thanh_tien) as total, sum(coalesce(so_luong,0)) as qty, count(*) as count
                  from _sr group by coalesce(nullif(ma_vt,''), ten_vt) order by total desc limit 15) t),
    'topSpQty',(select coalesce(json_agg(t),'[]') from (
                  select case when nullif(max(ma_vt),'') is not null
                              then '[' || max(ma_vt) || '] ' || nullif(case when max(ten_vt) like '[%' then regexp_replace(coalesce(max(ten_vt),''), '^\s*\[.*?\]\s*', '') else coalesce(max(ten_vt),'') end, '')
                              else coalesce(nullif(case when max(ten_vt) like '[%' then regexp_replace(coalesce(max(ten_vt),''), '^\s*\[.*?\]\s*', '') else coalesce(max(ten_vt),'') end, ''), max(ma_vt), '(không rõ)')
                         end as label,
                         sum(thanh_tien) as total, sum(coalesce(so_luong,0)) as qty, count(*) as count
                  from _sr group by coalesce(nullif(ma_vt,''), ten_vt) order by qty desc limit 15) t),
    'options', json_build_object(
      'kd',   (select coalesce(json_agg(x order by x),'[]') from (select distinct kinh_doanh as x from _all where kinh_doanh is not null and kinh_doanh <> '') s),
      'vung', (select coalesce(json_agg(x order by x),'[]') from (select distinct vung as x from _all where vung is not null and vung <> '') s),
      'nhom', (select coalesce(json_agg(x order by x),'[]') from (select distinct nhom_hang as x from _all where nhom_hang is not null and nhom_hang <> '') s),
      'kh',   (select coalesce(json_agg(x order by x),'[]') from (select distinct ten_kh as x from _all where ten_kh is not null and ten_kh <> '') s),
      'sp',   (select coalesce(json_agg(x order by x),'[]') from (
                  select distinct
                    case when nullif(ma_vt,'') is not null
                         then '[' || ma_vt || '] ' || nullif(case when ten_vt like '[%' then regexp_replace(coalesce(ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(ten_vt,'') end, '')
                         else coalesce(nullif(case when ten_vt like '[%' then regexp_replace(coalesce(ten_vt,''), '^\s*\[.*?\]\s*', '') else coalesce(ten_vt,'') end, ''), ma_vt)
                    end as x
                  from _all where coalesce(ma_vt, ten_vt) is not null and coalesce(ma_vt, ten_vt) <> '') s)
    )
  ) into result;

  return result;
end $$;
