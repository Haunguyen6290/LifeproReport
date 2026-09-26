-- C-01: chan xoa DM lam mat ton — doi FK sang RESTRICT
alter table public.ton_thue_ngay drop constraint if exists ton_thue_ngay_ma_thue_fkey;
alter table public.ton_thue_ngay
  add constraint ton_thue_ngay_ma_thue_fkey foreign key (ma_thue) references public.dm_thue(ma_thue) on delete restrict;

alter table public.ton_thuc_ngay drop constraint if exists ton_thuc_ngay_ma_thuc_fkey;
alter table public.ton_thuc_ngay
  add constraint ton_thuc_ngay_ma_thuc_fkey foreign key (ma_thuc) references public.dm_thuc(ma_thuc) on delete restrict;

-- C-04: So ton gom theo Cap1 cho dung spec (1 dong / Cap), ke ca Cap2
drop function if exists public.fn_so_ton_4cot(date);
create function public.fn_so_ton_4cot(p_ngay date default current_date)
returns table(cap1 text, cap2 text, ten_thue text, ton_thue1 numeric, ton_thuc1 numeric, ton_thue2 numeric, ton_thuc2 numeric, thua numeric)
language sql stable security definer set search_path = public as $$
  with thue_by_ma as (select ma_thue, sl_ton from ton_thue_ngay where ngay=p_ngay),
       thuc_by_ma as (select ma_thuc, sl_kha_dung from ton_thuc_ngay where ngay=p_ngay),
       thue_agg1 as (select d.cap1, sum(coalesce(t.sl_ton,0)) as sl from dm_thue d left join thue_by_ma t on t.ma_thue=d.ma_thue where d.cap1<>'' group by d.cap1),
       thuc_agg1 as (select d.cap1, sum(coalesce(t.sl_kha_dung,0)) as sl from dm_thuc d left join thuc_by_ma t on t.ma_thuc=d.ma_thuc where d.cap1<>'' group by d.cap1),
       thue_agg2 as (select d.cap2, sum(coalesce(t.sl_ton,0)) as sl from dm_thue d left join thue_by_ma t on t.ma_thue=d.ma_thue where d.cap2<>'' group by d.cap2),
       thuc_agg2 as (select d.cap2, sum(coalesce(t.sl_kha_dung,0)) as sl from dm_thuc d left join thuc_by_ma t on t.ma_thuc=d.ma_thuc where d.cap2<>'' group by d.cap2),
       caps as (select distinct cap1, cap2, min(ten_thue) as ten from dm_thue where cap1<>'' group by cap1, cap2)
  select c.cap1, c.cap2, c.ten,
    coalesce(t1.sl,0) as ton_thue1, coalesce(r1.sl,0) as ton_thuc1,
    case when c.cap2<>'' then coalesce(t2.sl,0) else null end as ton_thue2,
    case when c.cap2<>'' then coalesce(r2.sl,0) else null end as ton_thuc2,
    coalesce(t1.sl,0) - coalesce(r1.sl,0) as thua
  from caps c
  left join thue_agg1 t1 on t1.cap1=c.cap1
  left join thuc_agg1 r1 on r1.cap1=c.cap1
  left join thue_agg2 t2 on t2.cap2=c.cap2
  left join thuc_agg2 r2 on r2.cap2=c.cap2
  order by c.cap1;
$$;
grant execute on function public.fn_so_ton_4cot(date) to authenticated, service_role;
