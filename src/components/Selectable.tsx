'use client';
import { useRef } from 'react';

type Props = {
  /** Thẻ HTML muốn render: 'div', 'button', 'li', ... Giữ đúng thẻ cũ để không vỡ style. */
  as?: any;
  /** Hành động khi BẤM THẬT (không phải kéo chọn chữ). */
  onOpen: () => void;
  children?: React.ReactNode;
  [key: string]: any;
};

/**
 * Bọc một phần tử vốn có onClick để mở chi tiết, cho phép kéo chuột bôi đen / copy chữ
 * mà không vô tình mở dialog. Nguyên tắc: đo quãng đường di chuột giữa lúc NHẤN và lúc NHẢ;
 * nếu kéo quá ngưỡng (đang chọn chữ) hoặc đang có đoạn chữ bôi đen thì KHÔNG mở.
 * Trên điện thoại: chạm nhanh vẫn mở như thường (touch không tạo selection khi tap).
 */
export function Selectable({ as: Tag = 'div', onOpen, children, ...rest }: Props) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <Tag
      {...rest}
      onMouseDown={(e: React.MouseEvent) => { start.current = { x: e.clientX, y: e.clientY }; }}
      onTouchStart={(e: React.TouchEvent) => { const t = e.touches[0]; if (t) start.current = { x: t.clientX, y: t.clientY }; }}
      onClick={(e: React.MouseEvent) => {
        const s = start.current;
        start.current = null;
        // Đang có đoạn chữ được bôi đen → người dùng đang copy, không mở.
        const sel = typeof window !== 'undefined' ? window.getSelection() : null;
        if (sel && !sel.isCollapsed && sel.toString().length > 0) return;
        // Kéo chuột quá ngưỡng giữa lúc nhấn và nhả → đang chọn chữ, không mở.
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 6) return;
        onOpen();
      }}
    >
      {children}
    </Tag>
  );
}
