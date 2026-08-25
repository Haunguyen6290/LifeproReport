-- 0013_dashboard_perms.sql — Task 7: perms for dashboard 3 tabs
-- quan_ly_okr, xem_okr, bao_cao_tuan, bao_cao_kho
-- ADMIN gets all 4; SALES gets xem_okr + bao_cao_tuan; upsert role KHO with bao_cao_kho

-- ADMIN: ensure all 4 new perms
update public.roles set permissions = (
  select jsonb_agg(distinct elem order by elem)
  from jsonb_array_elements_text(permissions || '["quan_ly_okr","xem_okr","bao_cao_tuan","bao_cao_kho"]'::jsonb) as elem
) where name = 'ADMIN';

-- SALES: ensure xem_okr + bao_cao_tuan (keep existing perms, e.g. xem_log from 0009)
update public.roles set permissions = (
  select jsonb_agg(distinct elem order by elem)
  from jsonb_array_elements_text(permissions || '["xem_okr","bao_cao_tuan"]'::jsonb) as elem
) where name = 'SALES' and not (permissions ? 'xem_okr' and permissions ? 'bao_cao_tuan');

-- SALES may have one of the two but not both (partial) — ensure both
update public.roles set permissions = (
  select jsonb_agg(distinct elem order by elem)
  from jsonb_array_elements_text(permissions || '["xem_okr"]'::jsonb) as elem
) where name = 'SALES' and not (permissions ? 'xem_okr');

update public.roles set permissions = (
  select jsonb_agg(distinct elem order by elem)
  from jsonb_array_elements_text(permissions || '["bao_cao_tuan"]'::jsonb) as elem
) where name = 'SALES' and not (permissions ? 'bao_cao_tuan');

-- Kho role — merge (idempotent, preserves custom perms) like ADMIN/SALES
update public.roles set permissions = (
  select jsonb_agg(distinct elem order by elem)
  from jsonb_array_elements_text(permissions || '["bao_cao_kho"]'::jsonb) as elem
) where name = 'KHO';

insert into public.roles (name, description, permissions, is_system)
select 'KHO', 'Kho — báo cáo kho', '["bao_cao_kho"]'::jsonb, false
where not exists (select 1 from public.roles where name = 'KHO');
