-- 0056: Luong "Gop y cua quan ly" cho Bao cao tuan (binh luan cong khai) + khoa bao cao sau Chot duyet
-- Nguyen tac: ca cong ty xem duoc; chi tac gia bao cao + nguoi co quyen quan_ly_okr duoc viet;
-- sau khi Chot (trang_thai_duyet = 'Đã duyệt'): khoa het — tac gia khong sua duoc, luong gop y chi doc.

create table if not exists public.weekly_report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.weekly_reports(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null,
  is_chot boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_wrc_report on public.weekly_report_comments(report_id, created_at);

alter table public.weekly_report_comments enable row level security;

-- Xem: tat ca deu doc duoc (cong khai toan cong ty)
drop policy if exists wrc_read on public.weekly_report_comments;
create policy wrc_read on public.weekly_report_comments
  for select to authenticated using (true);

-- Viet: chi tac gia bao cao hoac nguoi co quyen quan_ly_okr; bao cao chua bi Chot;
-- co is_chot = true chi quan ly duoc phep (di kem nut Chot duyet)
drop policy if exists wrc_insert on public.weekly_report_comments;
create policy wrc_insert on public.weekly_report_comments
  for insert to authenticated with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.weekly_reports r
      where r.id = weekly_report_comments.report_id
        and r.trang_thai_duyet <> 'Đã duyệt'
        and (r.user_id = auth.uid() or public.has_permission('quan_ly_okr'))
    )
    and (is_chot = false or public.has_permission('quan_ly_okr'))
  );

-- Sua/xoa: nguoi viet hoac quan ly, va bao cao chua bi Chot (khoa het sau chot)
drop policy if exists wrc_update on public.weekly_report_comments;
create policy wrc_update on public.weekly_report_comments
  for update to authenticated
  using (
    (author_id = auth.uid() or public.has_permission('quan_ly_okr'))
    and exists (
      select 1 from public.weekly_reports r
      where r.id = weekly_report_comments.report_id
        and r.trang_thai_duyet <> 'Đã duyệt'
    )
  )
  with check (
    (author_id = auth.uid() or public.has_permission('quan_ly_okr'))
    and exists (
      select 1 from public.weekly_reports r
      where r.id = weekly_report_comments.report_id
        and r.trang_thai_duyet <> 'Đã duyệt'
    )
  );

drop policy if exists wrc_delete on public.weekly_report_comments;
create policy wrc_delete on public.weekly_report_comments
  for delete to authenticated
  using (
    (author_id = auth.uid() or public.has_permission('quan_ly_okr'))
    and exists (
      select 1 from public.weekly_reports r
      where r.id = weekly_report_comments.report_id
        and r.trang_thai_duyet <> 'Đã duyệt'
    )
  );

-- Khoa bao cao sau Chot: tac gia khong sua duoc bao cao da 'Đã duyệt'; quan ly van sua duoc (mo khoa khi can)
drop policy if exists wr_write on public.weekly_reports;
create policy wr_write on public.weekly_reports for all to authenticated
  using (user_id = auth.uid() or public.has_permission('quan_ly_okr'))
  with check (
    public.has_permission('quan_ly_okr')
    or (user_id = auth.uid() and trang_thai_duyet <> 'Đã duyệt')
  );

-- Dong chi tiet (weekly_report_items): tac gia khong sua duoc dong cua bao cao da Chot; quan ly van sua duoc
drop policy if exists wri_write on public.weekly_report_items;
create policy wri_write on public.weekly_report_items for all to authenticated
  using (exists (
    select 1 from public.weekly_reports r
    where r.id = report_id
      and (r.user_id = auth.uid() or public.has_permission('quan_ly_okr'))
  ))
  with check (exists (
    select 1 from public.weekly_reports r
    where r.id = report_id
      and (public.has_permission('quan_ly_okr')
        or (r.user_id = auth.uid() and r.trang_thai_duyet <> 'Đã duyệt'))
  ));
