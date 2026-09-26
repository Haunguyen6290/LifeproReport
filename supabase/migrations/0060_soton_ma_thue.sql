-- 0060: So ton chi tiet theo ma_thue (de Tab Ton thue hien dung ma_thue) + ton gom theo cap
drop function if exists public.fn_so_ton_4cot(date);
create function public.fn_so_ton_4cot(p_ngay date default current_date)
returns table(ma_thue text, ten_thue text, cap1 text, cap2 text, ton_thue1 numeric, ton_thuc1 numeric, ton_thue2 numeric, ton_thuc2 numeric, thua numeric)
language sql stable security definer set search_path = public as $$
  with thue_by_ma as (select ma_thue, sl_ton from ton_thue_ngay where ngay=p_ngay),
       thuc_by_ma as (select ma_thuc, sl_kha_dung from ton_thuc_ngay where ngay=p_ngay),
       thue_agg1 as (select d.cap1, sum(coalesce(t.sl_ton,0)) as sl from dm_thue d left join thue_by_ma t on t.ma_thue=d.ma_thue where d.cap1<>'' group by d.cap1),
       thuc_agg1 as (select d.cap1, sum(coalesce(t.sl_kha_dung,0)) as sl from dm_thuc d left join thuc_by_ma t on t.ma_thuc=d.ma_thuc where d.cap1<>'' group by d.cap1),
       thue_agg2 as (select d.cap2, sum(coalesce(t.sl_ton,0)) as sl from dm_thue d left join thue_by_ma t on t.ma_thue=d.ma_thue where d.cap2<>'' group by d.cap2),
       thuc_agg2 as (select d.cap2, sum(coalesce(t.sl_kha_dung,0)) as sl from dm_thuc d left join thuc_by_ma t on t.ma_thuc=d.ma_thuc where d.cap2<>'' group by d.cap2)
  select d.ma_thue, d.ten_thue, d.cap1, d.cap2,
    coalesce(t1.sl,0) as ton_thue1,
    coalesce(r1.sl,0) as ton_thuc1,
    case when d.cap2<>'' then coalesce(t2.sl,0) else null end as ton_thue2,
    case when d.cap2<>'' then coalesce(r2.sl,0) else null end as ton_thuc2,
    coalesce(t1.sl,0) - coalesce(r1.sl,0) as thua
  from dm_thue d
  left join thue_agg1 t1 on t1.cap1=d.cap1
  left join thuc_agg1 r1 on r1.cap1=d.cap1
  left join thue_agg2 t2 on t2.cap2=d.cap2
  left join thuc_agg2 r2 on r2.cap2=d.cap2
  order by d.ma_thue;
$$;
grant execute on function public.fn_so_ton_4cot(date) to authenticated, service_role;
