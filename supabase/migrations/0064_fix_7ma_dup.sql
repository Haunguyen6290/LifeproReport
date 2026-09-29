-- 0064: Gop 7 nhom ma bi tach doi (space vs _, hoa/thuong) ve ma moi nhat
update public.receivable_rows set ma_kh = 'LP-81 Auto' where ma_kh = 'LP-81_AUTO';
update public.receivable_rows set ma_kh = 'LP-AUTO NGHIỆP KIẾNĐỨC' where ma_kh = 'LP-AUTO_NGHIỆP_KIẾNĐỨC';
update public.receivable_rows set ma_kh = 'LP-Trần Sáng' where ma_kh = 'LP-TRẦN_SÁNG';
update public.receivable_rows set ma_kh = 'LP-Chitrinh' where ma_kh = 'LP-CHITRINH';
update public.receivable_rows set ma_kh = 'LP-TRỌNG HIẾU' where ma_kh = 'LP-TRỌNG_HIẾU';
update public.receivable_rows set ma_kh = 'LP-BẢO LONG' where ma_kh = 'LP-BẢO_LONG';
update public.receivable_rows set ma_kh = 'LP- MINH QUÂN' where ma_kh = 'LP-_MINH_QUÂN';
