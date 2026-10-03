-- 0069_replace_base_balances.sql — ghi đè số dư đầu kỳ một cách nguyên tử (transaction)
-- Gọi từ API opening-balance qua rpc('replace_customer_base_balances')
-- Tránh trường hợp xóa xong mà insert lỗi thì bảng trống.

create or replace function public.replace_customer_base_balances(
  p_rows jsonb,
  p_ngay_moc date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    raise exception 'Danh sách số dư rỗng';
  end if;

  delete from public.customer_base_balance;

  insert into public.customer_base_balance (ma_kh, ten_kh, du_no, ngay_moc, updated_at)
  select
    (x->>'ma_kh')::text,
    coalesce((x->>'ten_kh')::text, ''),
    coalesce((x->>'du_no')::numeric, 0),
    p_ngay_moc,
    now()
  from jsonb_array_elements(p_rows) as x;

  get diagnostics v_count = row_count;

  -- cập nhật ngày mốc
  insert into public.settings(key, value) values ('DEBT_BASE_DATE', p_ngay_moc::text)
  on conflict (key) do update set value = excluded.value;

  return jsonb_build_object('inserted', v_count, 'ngay_moc', p_ngay_moc::text);
end;
$$;

revoke all on function public.replace_customer_base_balances(jsonb, date) from public;
grant execute on function public.replace_customer_base_balances(jsonb, date) to authenticated, service_role;

comment on function public.replace_customer_base_balances is 'Ghi đè toàn bộ customer_base_balance + DEBT_BASE_DATE trong 1 transaction. Dùng cho import số dư đầu kỳ.';
