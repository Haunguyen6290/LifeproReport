-- 0033_norm_ma_kh.sql
-- Chuẩn hóa mã KH (bỏ khoảng trắng/ký tự không chữ số, bỏ hoa/thường) để
-- mã trong sổ TK131 như "LP - ĐÔNGTÍN" / "LP-BẢO LONG" khớp được với
-- mã danh mục "LP_-_ĐÔNGTÍN" / "LP-BẢO_LONG" dù tệp Odoo ghi khác đi.
-- KHÔNG tự sửa danh mục (trong danh mục có 36 cặp trùng sau chuẩn hóa,
-- nhưng đó là do hoa/thường, không ảnh hưởng).

-- 1) Hàm chuẩn hóa mã KH: giữ lại chữ/số (kể cả có dấu tiếng Việt), bỏ mọi ký tự
-- khác (khoảng trắng, gạch, gạch dưới) rồi về chữ thường. locale UTF-8 → [:alnum:]
-- bao trọn bộ ký tự Việt. "LP_-_ĐÔNGTÍN" và "LP - ĐÔNGTÍN" cùng ra "lpđôngtín".
create or replace function public.fn_norm_ma(t text) returns text
language sql immutable as $$
  select lower(regexp_replace(coalesce(t,''), '[^[:alnum:]]', '', 'g'))
$$;

-- 2) Quy mã trong receivable_rows về mã danh mục khi chuẩn hóa trùng và tên khớp.
-- Mỗi norm chỉ gộp khi nó trỏ tới đúng 1 mã danh mục (tránh xung đột giữa 2 khách
-- khác nhau mà norm lại trùng). Điều kiện tên khớp (không phân hoa/thường, khoảng
-- trắng) để chắc cùng một khách — tránh gộp nhầm hai khách khác tên mà mã chuẩn hóa
-- tình cờ trùng.
update public.receivable_rows r
set ma_kh = c.ma_kh
from (
  select fn_norm_ma(ma_kh) as norm, min(ma_kh) as ma_kh,
         lower(regexp_replace(min(ten_kh), '\s+', '', 'g')) as ten_norm
  from public.customers
  group by fn_norm_ma(ma_kh)
  having count(*) = 1
) c
where fn_norm_ma(r.ma_kh) = c.norm
  and r.ma_kh <> c.ma_kh
  and lower(regexp_replace(coalesce(r.ten_kh,''), '\s+', '', 'g')) = c.ten_norm;

-- 3) RPC báo cáo công nợ quá hạn: join theo mã chuẩn hóa để chịu được
-- tệp Odoo ghi mã khác đi (space vs _, hoa vs thường, dấu thừa).
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
  with kh as (
    -- Danh mục gom về 1 dòng/mã chuẩn hoá để join không nhân đôi khi có 2 khách trùng norm
    select public.fn_norm_ma(c.ma_kh) as ma_norm,
           (array_agg(p.full_name order by c.ma_kh))[1] as assigned,
           (array_agg(c.tinh_thanh order by c.ma_kh))[1] as tinh
    from public.customers c left join public.profiles p on p.id = c.assigned_to
    group by 1
  ),
  base as (
    select cb.ma_kh, cb.ten_kh, cb.du_no,
           coalesce(kh.assigned, '') as nvkd, coalesce(kh.tinh, '') as tinh
    from public.customer_base_balance cb
    left join kh on kh.ma_norm = public.fn_norm_ma(cb.ma_kh)
  ),
  ps as (
    select public.fn_norm_ma(ma_kh) as ma_norm,
      sum(case when ngay < v_D then so_no - so_co else 0 end) as ps_truoc_D,
      sum(case when ngay >= v_D and ngay <= v_E and public.fn_tk_nhom(tk_doi_ung, v_map)='Doanh thu' then so_no - so_co else 0 end) as doanh_thu,
      sum(case when ngay >= v_D and ngay <= v_E and public.fn_tk_nhom(tk_doi_ung, v_map)='Trả lại' then so_co - so_no else 0 end) as tra_lai,
      sum(case when ngay >= v_D and ngay <= v_E and public.fn_tk_nhom(tk_doi_ung, v_map)='Thu tiền' then so_co - so_no else 0 end) as thu_tien
    from public.receivable_rows group by 1
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
    from base b left join ps p on p.ma_norm = public.fn_norm_ma(b.ma_kh)
  ) t;
  return json_build_object('D', v_D, 'E', v_E, 'base', v_base, 'rows', coalesce(v_rows,'[]'::json));
end;
$$;

-- 4) RPC báo cáo bán hàng thu tiền: cũng chịu mã khác đi
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
           (coalesce(sum(case when nhom = 'Doanh thu' then so_no - so_co else 0 end),0)
            - coalesce(sum(case when nhom = 'Trả lại'  then so_co - so_no else 0 end),0)) as doanh_so,
           coalesce(sum(case when nhom = 'Thu tiền' then so_co - so_no else 0 end),0) as thu_tien
    from s group by nvkd
  )
  select json_agg(t) into v_rows
  from (select json_build_object('nvkd', nvkd, 'doanh_so', doanh_so, 'thu_tien', thu_tien) as t from agg) t;
  return json_build_object('thang', p_thang, 'plan', v_plan, 'rows', coalesce(v_rows,'[]'::json));
end;
$$;

-- 5) RPC phục vụ màn hình "Cần rà soát": mã trong sổ không khớp danh mục (dù đã chuẩn hóa)
-- Dùng cho bảng "Khách chưa khớp" ở tab Tài chính.
drop function if exists public.finance_unmatched_customers(text);
create or replace function public.finance_unmatched_customers(p_thang text default null)
returns json language plpgsql stable as $$
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
    where c.assigned_to is null or p.id is not null  -- bỏ bản ghi trỏ vào tài khoản đã bị xoá
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
  select json_agg(t order by coalesce(thu_tien,0) desc) into v_rows
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
