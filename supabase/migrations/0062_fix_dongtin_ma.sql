-- 0062: Sửa mã LP_-_ĐÔNGTÍN thành LP - DONGTIN để gộp công nợ đúng
update public.receivable_rows
set ma_kh = 'LP - DONGTIN'
where ma_kh = 'LP_-_ĐÔNGTÍN';

update public.customer_base_balance
set ma_kh = 'LP - DONGTIN'
where ma_kh = 'LP_-_ĐÔNGTÍN';
