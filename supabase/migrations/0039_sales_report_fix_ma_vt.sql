-- 0039_sales_report_fix_ma_vt.sql
-- (1) Sửa sales_report: temp table _all thiếu cột ma_vt nhưng topSp/topSpQty có tham chiếu ma_vt
--     → hàm báo lỗi "column ma_vt does not exist", khiến API rơi vào đường vòng Node kéo cả bảng về tính (chậm).
--     Thêm đúng s.ma_vt vào _all. Nghiệp vụ/số liệu giữ nguyên 100%.
-- (2) Thêm sales_months(): hàm nhẹ trả danh sách tháng + năm (khoảng vài chục giá trị),
--     thay cho việc /api/sales/meta quét hết bảng mỗi lần mở trang.

drop function if exists public.sales_report(date, date, text[], text[], text[], text[], text[]);
create or replace function public.sales_report(
  p_from date, p_to date,
  p_kd text[] default null, p_vung text[] default null,
  p_nhom text[] default null, p_kh text[] default null, p_sp text[] default null
) returns json language plpgsql volatile set search_path = public as $$
declare
  v_total numeric; v_qty numeric; v_rows int; v_hd int; v_kh int;
  result json;
begin
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
      and (p_sp is null or p_sp = '{}' or ten_vt = any(p_sp));

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
    'topSp',   (select coalesce(json_agg(t),'[]') from (select coalesce(nullif(ten_vt,''),ma_vt,'(không rõ)') as label, sum(thanh_tien) as total, sum(coalesce(so_luong,0)) as qty, count(*) as count from _sr group by 1 order by total desc limit 15) t),
    'topSpQty',(select coalesce(json_agg(t),'[]') from (select coalesce(nullif(ten_vt,''),ma_vt,'(không rõ)') as label, sum(thanh_tien) as total, sum(coalesce(so_luong,0)) as qty, count(*) as count from _sr group by 1 order by qty desc limit 15) t),
    'options', json_build_object(
      'kd',   (select coalesce(json_agg(x order by x),'[]') from (select distinct kinh_doanh as x from _all where kinh_doanh is not null and kinh_doanh <> '') s),
      'vung', (select coalesce(json_agg(x order by x),'[]') from (select distinct vung as x from _all where vung is not null and vung <> '') s),
      'nhom', (select coalesce(json_agg(x order by x),'[]') from (select distinct nhom_hang as x from _all where nhom_hang is not null and nhom_hang <> '') s),
      'kh',   (select coalesce(json_agg(x order by x),'[]') from (select distinct ten_kh as x from _all where ten_kh is not null and ten_kh <> '') s),
      'sp',   (select coalesce(json_agg(x order by x),'[]') from (select distinct ten_vt as x from _all where ten_vt is not null and ten_vt <> '') s)
    )
  ) into result;

  return result;
end $$;

-- (2) Danh sách tháng + năm có trong dữ liệu — chạy trên index sale_month, trả vài chục giá trị.
create or replace function public.sales_months() returns json language sql stable set search_path = public as $$
  select json_build_object(
    'months', (select coalesce(json_agg(m order by m desc), '[]') from (select distinct sale_month as m from public.sales_rows where sale_month is not null and sale_month <> '') x),
    'years',  (select coalesce(json_agg(y order by y desc), '[]') from (select distinct left(sale_month, 4) as y from public.sales_rows where sale_month is not null and length(sale_month) >= 4) yy)
  );
$$;
