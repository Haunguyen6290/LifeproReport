-- 0061: Công nợ lũy kế đến 1 ngày chọn (dùng cho Hỗ trợ xuất hóa đơn).
-- = Dư nợ đầu kỳ (mốc) + Σ(Nợ − Có) sổ 131 từ ngày mốc đến hết p_den.
-- Không đụng fn_customer_debt (Tài chính vẫn xem công nợ hiện tại).
create or replace function public.fn_customer_debt_as_of(p_ma_norm text, p_den date)
returns json language sql stable as $$
  with b as (
    select coalesce(sum(cb.du_no),0) as du_no,
           coalesce(min(cb.ngay_moc), date '2026-01-01') as moc
    from public.customer_base_balance cb
    where public.fn_norm_ma(cb.ma_kh) = p_ma_norm
  ), p as (
    select coalesce(sum(r.so_no - r.so_co),0) as net, max(r.ngay) as last_date
    from public.receivable_rows r, b
    where public.fn_norm_ma(r.ma_kh) = p_ma_norm
      and r.ngay >= b.moc and r.ngay <= p_den
  )
  select json_build_object(
    'con_thieu', case when p_den < b.moc then null else coalesce(b.du_no,0) + coalesce(p.net,0) end,
    'moc', to_char(b.moc, 'YYYY-MM-DD'),
    'den', to_char(p_den, 'YYYY-MM-DD'),
    'du_lieu_den', to_char(p.last_date, 'YYYY-MM-DD'),
    'so_131_moi_nhat', (select to_char(max(ngay), 'YYYY-MM-DD') from public.receivable_rows)
  )
  from b cross join p;
$$;

grant execute on function public.fn_customer_debt_as_of(text, date) to service_role, authenticated;
