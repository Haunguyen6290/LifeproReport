-- 0076_norm_ma_kh_upper.sql — Chuẩn hóa ma_kh về chữ HOA (LP-Cotu → LP-COTU).
-- AN TOÀN: chỉ UPDATE các dòng chưa hoa + gộp dòng trùng bằng cách cộng dồn số liệu.
-- Chạy TRƯỚC khi code chặn cửa import có hiệu lực (code đã chuẩn hóa ở tầng parse).
-- Nếu có nhóm trùng không thể tự gộp (customers khác tên/SĐT) → migration báo lỗi và DỪNG, không xóa gì.

-- ---------- 1) receivable_rows: gộp dòng trùng (cộng dồn Nợ/Có, giữ dư cuối của dòng mới nhất) ----------
do $$
declare
  r record;
  v_keep uuid;
  v_sum_no numeric; v_sum_co numeric; v_last_du numeric;
begin
  for r in
    select upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g'))) as norm, array_agg(id) as ids, count(*) as n
    from public.receivable_rows
    group by 1 having count(*) > 1
  loop
    -- giữ dòng có ngay mới nhất (dư cuối đúng nhất)
    select id into v_keep from public.receivable_rows where id = any(r.ids) order by ngay desc, created_at desc nulls last limit 1;
    select coalesce(sum(so_no),0), coalesce(sum(so_co),0) into v_sum_no, v_sum_co
    from public.receivable_rows where id = any(r.ids);
    select du_dong into v_last_du from public.receivable_rows where id = v_keep;
    update public.receivable_rows
    set ma_kh = r.norm, so_no = v_sum_no, so_co = v_sum_co, du_dong = v_last_du
    where id = v_keep;
    delete from public.receivable_rows where id = any(r.ids) and id <> v_keep;
    raise notice 'Gộp receivable_rows %: % dòng → 1', r.norm, r.n;
  end loop;
  -- viết hoa các mã còn lại
  update public.receivable_rows
  set ma_kh = upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')))
  where ma_kh <> upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')));
end $$;

-- ---------- 2) sales_rows: gộp dòng trùng (cộng dồn số lượng/thành tiền) ----------
do $$
declare
  r record;
  v_keep uuid;
  v_sum_sl numeric; v_sum_tt numeric;
begin
  for r in
    select upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g'))) as norm, array_agg(id) as ids, count(*) as n
    from public.sales_rows
    group by 1 having count(*) > 1
  loop
    select id into v_keep from public.sales_rows where id = any(r.ids) order by ngay desc limit 1;
    select coalesce(sum(so_luong),0), coalesce(sum(thanh_tien),0) into v_sum_sl, v_sum_tt
    from public.sales_rows where id = any(r.ids);
    update public.sales_rows
    set ma_kh = r.norm, so_luong = v_sum_sl, thanh_tien = v_sum_tt
    where id = v_keep;
    delete from public.sales_rows where id = any(r.ids) and id <> v_keep;
    raise notice 'Gộp sales_rows %: % dòng → 1', r.norm, r.n;
  end loop;
  update public.sales_rows
  set ma_kh = upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')))
  where ma_kh <> upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')));
end $$;

-- ---------- 3) customer_base_balance: gộp theo ma_kh (cộng dồn dư nợ) ----------
do $$
declare
  r record;
begin
  for r in
    select upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g'))) as norm, array_agg(ma_kh) as mas, count(*) as n
    from public.customer_base_balance
    group by 1 having count(*) > 1
  loop
    update public.customer_base_balance
    set ma_kh = r.norm,
        du_no = (select coalesce(sum(du_no),0) from public.customer_base_balance where ma_kh = any(r.mas)),
        updated_at = now()
    where ma_kh = r.mas[1];
    delete from public.customer_base_balance where ma_kh = any(r.mas[2:]);
    raise notice 'Gộp customer_base_balance %: % dòng → 1', r.norm, r.n;
  end loop;
  update public.customer_base_balance
  set ma_kh = upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')))
  where ma_kh <> upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')));
end $$;

-- ---------- 4) amis_sales_rows: chỉ viết hoa (không gộp — mỗi dòng là 1 dòng chứng từ) ----------
update public.amis_sales_rows
set ma_kh = upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')))
where ma_kh <> upper(trim(regexp_replace(ma_kh, '\s+', '_', 'g')));

-- ---------- 5) customers: CHỈ viết hoa mã chưa trùng. Mã trùng thì DỪNG để ông quyết định ----------
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
