-- 0071_rebase_atomic.sql — dồn số dư gốc sang mốc mới trong 1 transaction
-- Dùng cho POST /api/finance/rebase thay vì tính ở Node rồi upsert từng chunk

create or replace function public.rebase_debt(p_new_base date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old date;
  v_count int;
begin
  if p_new_base is null then
    raise exception 'Thiếu ngày mốc mới';
  end if;

  if not public.has_permission('quan_ly_cai_dat') then
    raise exception 'Không có quyền quan_ly_cai_dat';
  end if;

  select nullif(value,'')::date into v_old from public.settings where key='DEBT_BASE_DATE';
  if v_old is null then v_old := '2026-01-01'; end if;
  if p_new_base <= v_old then
    raise exception 'Ngày mốc mới (%) phải sau mốc hiện tại (%)', p_new_base, v_old;
  end if;

  -- Khóa để chống 2 lần rebase chạy song song
  perform pg_advisory_xact_lock(hashtext('rebase_debt'));

  -- Tính phát sinh trong [v_old, p_new_base) theo từng mã KH
  -- và cộng dồn vào customer_base_balance, đồng thời tạo dòng cho khách mới xuất hiện sau mốc cũ
  with ps as (
    select ma_kh,
           string_agg(distinct ten_kh, ' | ' order by ten_kh) as ten_agg,
           sum(so_no - so_co) as delta
    from public.receivable_rows
    where ngay >= v_old and ngay < p_new_base
      and ma_kh is not null and ma_kh <> ''
    group by ma_kh
  ),
  up as (
    insert into public.customer_base_balance (ma_kh, ten_kh, du_no, ngay_moc, updated_at)
    select
      coalesce(b.ma_kh, p.ma_kh) as ma_kh,
      coalesce(b.ten_kh, p.ten_agg, '') as ten_kh,
      coalesce(b.du_no, 0) + coalesce(p.delta, 0) as du_no,
      p_new_base as ngay_moc,
      now() as updated_at
    from public.customer_base_balance b
    full join ps p on p.ma_kh = b.ma_kh
    on conflict (ma_kh) do update
      set ten_kh = excluded.ten_kh,
          du_no = excluded.du_no,
          ngay_moc = excluded.ngay_moc,
          updated_at = excluded.updated_at
    returning 1
  )
  select count(*) into v_count from up;

  -- Cập nhật mốc sau khi đã cộng dồn xong
  insert into public.settings(key, value) values ('DEBT_BASE_DATE', p_new_base::text)
  on conflict (key) do update set value = excluded.value;

  return jsonb_build_object('old_base', v_old::text, 'new_base', p_new_base::text, 'so_khach', v_count);
end;
$$;

revoke all on function public.rebase_debt(date) from public;
grant execute on function public.rebase_debt(date) to authenticated, service_role;

comment on function public.rebase_debt is 'Dồn customer_base_balance từ DEBT_BASE_DATE cũ sang p_new_base trong 1 transaction. Khóa advisory để chống chạy song song.';
