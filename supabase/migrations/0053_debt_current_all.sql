-- 0053: fn_debt_current_all — "Công nợ hiện tại" cho MỌI khách (1 lần gọi, không lặp 1-khách).
-- Công thức như fn_customer_debt (0052): dư đầu kỳ (ngay_moc, mặc định 01/01/2026)
--   + LŨY KẾ (Nợ − Có) TK131 từ moc, sàn 0.

create or replace function public.fn_debt_current_all()
returns table (ma_norm text, con_thieu numeric, as_of date)
language sql stable as $$
  with keys as (
    select public.fn_norm_ma(cb.ma_kh) as mn from public.customer_base_balance cb
      where coalesce(public.fn_norm_ma(cb.ma_kh),'') <> ''
    union
    select public.fn_norm_ma(r.ma_kh) from public.receivable_rows r
      where coalesce(public.fn_norm_ma(r.ma_kh),'') <> ''
  ),
  base as (
    select k.mn,
           coalesce(sum(cb.du_no), 0) as du_no,
           coalesce(min(cb.ngay_moc), date '2026-01-01') as moc
    from keys k
    left join public.customer_base_balance cb on public.fn_norm_ma(cb.ma_kh) = k.mn
    group by k.mn
  ),
  net as (
    select b.mn, sum(r.so_no - r.so_co) as net, max(r.ngay) as last_date
    from base b
    join public.receivable_rows r
      on public.fn_norm_ma(r.ma_kh) = b.mn and r.ngay >= b.moc
    group by b.mn
  )
  select b.mn,
         greatest(b.du_no + coalesce(n.net, 0), 0),
         coalesce(n.last_date, b.moc)
  from base b
  left join net n on n.mn = b.mn;
$$;

grant execute on function public.fn_debt_current_all() to service_role, authenticated;
