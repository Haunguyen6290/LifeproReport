-- 0035_chatbot_qa_write.sql
-- Cho phép người có quyền quan_ly_cai_dat thêm / sửa / xóa câu hỏi chatbot (nhóm = nhom_chu_de).
-- Đọc vẫn mở cho mọi authenticated (đã có ở 0028).

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chatbot_qa' and policyname = 'chatbot_qa_write'
  ) then
    create policy chatbot_qa_write on public.chatbot_qa for all
      to authenticated
      using (public.has_permission('quan_ly_cai_dat'))
      with check (public.has_permission('quan_ly_cai_dat'));
  end if;
end $$;

