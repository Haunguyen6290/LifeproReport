-- 0076_norm_ma_kh_upper.sql — Chuẩn hóa ma_kh về chữ HOA (LP-Cotu → LP-COTU).
-- NGUYÊN TẮC: chỉ UPDATE mã (viết hoa + khoảng trắng → gạch dưới), TUYỆT ĐỐI KHÔNG gộp/xóa dòng.
-- Mỗi dòng receivable_rows/sales_rows là 1 nghiệp vụ riêng — gộp dòng làm sai công nợ.
-- Code chặn cửa import đã chuẩn hóa ở tầng parse (normMaKH), migration này chỉ dọn dữ liệu cũ.

-- receivable_rows: chỉ viết hoa mã, giữ nguyên từng dòng
update public.receivable_rows
set ma_kh = upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')))
where ma_kh <> upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')));

-- sales_rows: chỉ viết hoa mã, giữ nguyên từng dòng
update public.sales_rows
set ma_kh = upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')))
where ma_kh <> upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')));

-- customer_base_balance: chỉ viết hoa mã (không gộp — trùng mã ông xử lý tay trước khi chạy)
do $$
declare
  v_trung text;
begin
  select string_agg(norm, ', ') into v_trung from (
    select upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g'))) as norm
    from public.customer_base_balance group by 1 having count(*) > 1
  ) t;
  if v_trung is not null then
    raise exception 'customer_base_balance có mã trùng sau chuẩn hóa: %. Xử lý tay trước rồi chạy lại.', v_trung;
  end if;
  update public.customer_base_balance
  set ma_kh = upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')))
  where ma_kh <> upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')));
end $$;

-- amis_sales_rows: chỉ viết hoa mã
update public.amis_sales_rows
set ma_kh = upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')))
where ma_kh <> upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')));

-- customers: chỉ viết hoa mã chưa trùng. Mã trùng thì DỪNG để ông quyết định (đã xử lý LP-Tuan/LP-TUAN).
do $$
declare
  v_trung text;
begin
  select string_agg(norm, ', ') into v_trung from (
    select upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g'))) as norm
    from public.customers group by 1 having count(*) > 1
  ) t;
  if v_trung is not null then
    raise exception 'customers có mã trùng sau chuẩn hóa: %. Ông quyết định gộp/xóa trước rồi chạy lại.', v_trung;
  end if;
  update public.customers
  set ma_kh = upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')))
  where ma_kh <> upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')));
end $$;
