-- 0070_import_131_atomic.sql — xóa + chèn sổ 131 trong 1 transaction
-- Dùng cho POST /api/finance/import-131 thay vì delete rồi insert từng chunk ngoài transaction

create or replace function public.replace_receivable_range(
  p_rows jsonb,
  p_min date,
  p_max date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_min is null or p_max is null then
    raise exception 'Thiếu khoảng ngày [p_min, p_max]';
  end if;
  if p_min > p_max then
    raise exception 'Khoảng ngày không hợp lệ: % > %', p_min, p_max;
  end if;
  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    raise exception 'Danh sách dòng rỗng';
  end if;

  -- Bảo vệ bởi has_permission, nhưng vẫn check trong hàm để không bị gọi trực tiếp qua RPC
  if not public.has_permission(auth.uid(), 'import_tai_chinh')
     and not public.has_permission(auth.uid(), 'quan_ly_cai_dat') then
    raise exception 'Không có quyền import_tai_chinh';
  end if;

  -- Xóa vùng cũ + chèn vùng mới trong cùng 1 transaction (plpgsql function tự transaction)
  delete from public.receivable_rows
  where ngay between p_min and p_max;

  insert into public.receivable_rows (ngay, so_ct, ma_kh, ten_kh, dien_giai, tk_doi_ung, so_no, so_co, du_dong, import_batch)
  select
    (x->>'ngay')::date,
    coalesce((x->>'so_ct')::text, ''),
    coalesce((x->>'ma_kh')::text, ''),
    coalesce((x->>'ten_kh')::text, ''),
    coalesce((x->>'dien_giai')::text, ''),
    coalesce((x->>'tk_doi_ung')::text, ''),
    coalesce((x->>'so_no')::numeric, 0),
    coalesce((x->>'so_co')::numeric, 0),
    nullif((x->>'du_dong')::text, '')::numeric,
    coalesce((x->>'import_batch')::text, '')
  from jsonb_array_elements(p_rows) as x;

  get diagnostics v_count = row_count;

  return jsonb_build_object('inserted', v_count, 'p_min', p_min::text, 'p_max', p_max::text);
end;
$$;

revoke all on function public.replace_receivable_range(jsonb, date, date) from public;
grant execute on function public.replace_receivable_range(jsonb, date, date) to authenticated, service_role;

comment on function public.replace_receivable_range is 'Xóa receivable_rows trong [p_min,p_max] rồi chèn p_rows trong 1 transaction. Dùng cho import-131.';
