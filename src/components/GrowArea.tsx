'use client';
import { useEffect, useRef } from 'react';

/** Ô nhập văn bản tự xuống dòng, tự giãn theo nội dung, tối đa 3 dòng rồi cuộn. */
export function GrowArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineH = 20;
    const rawRows = (props as any).rows;
    const maxRows = rawRows != null ? Math.max(1, Number(rawRows)) : 3;
    const max = maxRows * lineH + 24;
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }
  useEffect(resize, [props.value, (props as any).rows]);
  return <textarea ref={ref} rows={1} {...props} onInput={resize} />;
}
