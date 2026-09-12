-- 0052: Sửa "Công nợ hiện tại" = Dư đầu kỳ 01/01/2026 + LŨY KẾ (Nợ − Có) toàn bộ
--       Bản 0051 đang dùng cửa sổ 90 ngày mượn từ trang Tài chính (bỏ sót phát sinh sau D -> sai).
--       Kèm: fn_customer_debt (1 khách, cho UI fallback) + vá fn_refresh + xóa snapshot nợ cũ.

-- ===== 1) Hàm 1 khách — UI gọi khi chưa có snapshot =====
create or replace function public.fn_customer_debt(p_ma_norm text)
returns json language sql stable as $$
  select json_build_object(
    'con_thieu', greatest(coalesce(b.du_no,0) + coalesce(p.net,0), 0),
    'as_of', to_char(coalesce(p.last_date, b.moc, current_date), 'YYYY-MM-DD')
  )
  from (select coalesce(sum(cb.du_no),0) as du_no,
               coalesce(min(cb.ngay_moc), date '2026-01-01') as moc
        from public.customer_base_balance cb
        where public.fn_norm_ma(cb.ma_kh) = p_ma_norm) b
  cross join
       (select coalesce(sum(r.so_no - r.so_co),0) as net, max(r.ngay) as last_date
        from public.receivable_rows r
        where public.fn_norm_ma(r.ma_kh) = p_ma_norm
          and r.ngay >= coalesce(
                (select min(cb2.ngay_moc) from public.customer_base_balance cb2
                 where public.fn_norm_ma(cb2.ma_kh) = p_ma_norm),
                date '2026-01-01')) p;
$$;

-- ===== 2) Vá fn_refresh_sales_snapshots: đoạn nợ đổi sang lũy kế =====
create or replace function public.fn_refresh_sales_snapshots(p_as_of date default current_date)
returns json language plpgsql volatile as $$
declare
  v_ms date; v_qs date; v_ys date;
  v_mky text; v_qky text; v_yky text;
  v_n int := 0; v_nd int := 0;
begin
  v_ms := date_trunc('month', p_as_of)::date;
  v_qs := date_trunc('quarter', p_as_of)::date;
  v_ys := make_date(extract(year from p_as_of)::int, 1, 1);
  v_mky := to_char(p_as_of,'YYYY-MM');
  v_qky := extract(year from p_as_of)::int || 'Q' || extract(quarter from p_as_of)::int;
  v_yky := extract(year from p_as_of)::int::text;

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

  -- Công nợ hiện tại: dư đầu kỳ (ngay_moc, mặc định 01/01/2026) + lũy kế Nợ − Có TK131
  with base as (
    select public.fn_norm_ma(cb.ma_kh) as mn,
           sum(cb.du_no) as du_no,
           min(cb.ngay_moc) as moc
    from public.customer_base_balance cb
    where coalesce(public.fn_norm_ma(cb.ma_kh),'') <> ''
    group by 1
  ),
  net as (
    select b.mn, sum(r.so_no - r.so_co) as net, max(r.ngay) as last_date
    from base b
    join public.receivable_rows r
      on public.fn_norm_ma(r.ma_kh) = b.mn and r.ngay >= b.moc
    group by 1
  ),
  u2 as (
    insert into public.sales_cust_snapshots (ma_norm, loai, ky, data, refreshed_at)
    select b.mn, 'debt', 'debt',
      jsonb_build_object(
        'con_thieu', greatest(b.du_no + coalesce(n.net,0), 0),
        'as_of', coalesce(to_char(n.last_date,'YYYY-MM-DD'), to_char(p_as_of,'YYYY-MM-DD'))
      ), now()
    from base b left join net n on n.mn = b.mn
    on conflict (ma_norm, loai, ky) do update set data = excluded.data, refreshed_at = excluded.refreshed_at
    returning 1
  ) select count(*) into v_nd from u2;

  return json_build_object('sales', v_n, 'debt', v_nd, 'as_of', p_as_of,
    'ky', json_build_object('month', v_mky, 'quarter', v_qky, 'year', v_yky));
exception when others then
  return json_build_object('error', sqlerrm, 'code', sqlstate);
end;
$$;

-- ===== 3) Xóa snapshot nợ cũ (tính sai) để UI fallback về tính trực tiếp =====
delete from public.sales_cust_snapshots where loai = 'debt';

grant execute on function public.fn_customer_debt(text) to service_role, authenticated;
grant execute on function public.fn_refresh_sales_snapshots(date) to service_role;
