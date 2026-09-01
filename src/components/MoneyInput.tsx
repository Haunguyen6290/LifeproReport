'use client';
import { useEffect, useRef, useState } from 'react';

// Ô nhập tiền: hiển thị phân tách hàng nghìn bằng dấu chấm (1.000.000)
// trong lúc gõ; trả ra số nguyên qua onChange.
export function MoneyInput({ value, onChange, disabled, className, placeholder }: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => (value ? value.toLocaleString('vi-VN') : ''));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value ? value.toLocaleString('vi-VN') : '');
  }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(value ? value.toLocaleString('vi-VN') : ''); }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        const n = digits ? parseInt(digits, 10) : 0;
        onChange(n);
        setText(digits ? n.toLocaleString('vi-VN') : '');
      }}
      className={className}
    />
  );
}
