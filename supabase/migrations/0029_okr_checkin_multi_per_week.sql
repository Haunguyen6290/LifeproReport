-- 0029: Cho phép check-in OKR nhiều lần trong cùng một tuần.
-- Trước đây unique(okr_id, tuan_tu) khiến check-in sau ghi đè check-in trước.
-- Bỏ ràng buộc này; mỗi lần bấm "Lưu check-in" là thêm một bản ghi mới.

do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'okr_check_ins'
      and con.contype = 'u'
  loop
    execute format('alter table public.okr_check_ins drop constraint %I', r.conname);
  end loop;
end $$;

-- Sắp xếp lịch sử theo thời gian tạo (mới nhất trước).
create index if not exists idx_oci_okr_created
  on public.okr_check_ins (okr_id, created_at desc);
