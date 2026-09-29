-- 0062: Sửa các biến thể có dấu của Đông Tín thành LP - DONGTIN (không dấu) để gộp công nợ đúng
update public.receivable_rows
set ma_kh = 'LP - DONGTIN'
where ma_kh in ('LP_-_ĐÔNGTÍN', 'LP - ĐÔNGTÍN', 'LP-ĐÔNGTÍN', 'LP_ĐÔNGTÍN');

update public.customer_base_balance
set ma_kh = 'LP - DONGTIN'
where ma_kh in ('LP_-_ĐÔNGTÍN', 'LP - ĐÔNGTÍN', 'LP-ĐÔNGTÍN', 'LP_ĐÔNGTÍN');
