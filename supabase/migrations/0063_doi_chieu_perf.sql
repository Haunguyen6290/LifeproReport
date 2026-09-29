-- 0063: doi chieu cong no - index cho so_ct (chi tiet phieu) va ma_kh+so_ct (gom phieu)
create index if not exists idx_sales_so_ct on public.sales_rows (so_ct);
create index if not exists idx_rcv_ma_soct on public.receivable_rows (ma_kh, so_ct);
