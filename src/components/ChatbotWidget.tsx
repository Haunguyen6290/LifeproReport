'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { QA } from '@/lib/chatbot/search';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type RankedQA = QA & { score?: number };

type Msg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'bot-qa'; qa: RankedQA }
  | { id: number; role: 'bot-miss'; q: string; suggestions: string[]; related: string[] };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let msgId = 0;
const nextId = () => ++msgId;

/** Tên phân hệ trong QA → route trong app (cho link dẫn khi không khớp). */
const PHAN_HE_TO_ROUTE: Record<string, string> = {
  'OKRs': '/okr',
  'Kế hoạch': '/bao-cao-tuan',
  'Báo cáo tuần': '/bao-cao-tuan',
  'Báo cáo kho': '/bao-cao-kho',
  'Tổng hợp kho': '/bao-cao-kho',
  'Bán hàng': '/bao-cao-ban-hang',
  'Kinh doanh': '/bao-cao-ban-hang',
  'Khách hàng': '/khach-hang',
  'Thị trường kinh doanh': '/thi-truong',
  'Thị trường': '/thi-truong',
  'Chiến dịch': '/chien-dich',
  'Báo cáo vấn đề': '/bao-cao-tuan',
  'Check-in hàng tuần': '/okr',
};

function routeForPhanHe(name: string): string | null {
  return PHAN_HE_TO_ROUTE[name] ?? null;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ChatbotWidget() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [chips, setChips] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [loggedMiss, setLoggedMiss] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  // Theo dõi mobile/desktop
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Lấy 4 câu hỏi gợi ý theo phân hệ hiện tại (RLS: authenticated được đọc chatbot_qa)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const contextPhanHe = await guessPhanHe(pathname);
      const { data } = await supabase
        .from('chatbot_qa')
        .select('cau_hoi')
        .eq('phan_he', contextPhanHe)
        .limit(4);
      if (!cancelled && data) setChips((data as any[]).map((r) => r.cau_hoi).filter(Boolean));
    })();
    return () => { cancelled = true; };
  }, [open, pathname]);

  // Auto-scroll xuống cuối khi có tin mới
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, chips, busy]);

  // Esc đóng, focus trap đơn giản
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
      if (e.key === 'Tab' && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>('button, [href], textarea, input, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const guessPhanHe = useCallback(async (path: string): Promise<string> => {
    if (path.startsWith('/okr')) return 'Trợ lý OKRs';
    if (path.startsWith('/bao-cao-tuan')) return 'Trợ lý Báo cáo tuần';
    if (path.startsWith('/bao-cao-kho')) return 'Trợ lý Kho';
    if (path.startsWith('/bao-cao-ban-hang')) return 'Trợ lý Kinh doanh';
    if (path.startsWith('/khach-hang')) return 'Trợ lý Khách hàng';
    if (path.startsWith('/thi-truong')) return 'Trợ lý Thị trường kinh doanh';
    if (path.startsWith('/chien-dich')) return 'Trợ lý Chiến dịch';
    return 'Bộ não chung công ty';
  }, []);

  const send = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    setBusy(true);
    setMessages((m) => [...m, { id: nextId(), role: 'user', text: q }]);
    setInput('');
    try {
      const res = await fetch(`/api/chatbot?q=${encodeURIComponent(q)}&context=${encodeURIComponent(pathname)}&limit=3`);
      if (!res.ok) {
        setMessages((m) => [...m, { id: nextId(), role: 'bot-miss', q, suggestions: [], related: [] }]);
        setBusy(false);
        return;
      }
      const j = await res.json();
      const matches: RankedQA[] = j.matches ?? [];
      if (matches.length === 0) {
        setMessages((m) => [...m, {
          id: nextId(), role: 'bot-miss', q,
          suggestions: j.suggestions ?? [],
          related: [],
        }]);
      } else {
        setMessages((m) => [...m, ...matches.map((qa) => ({ id: nextId(), role: 'bot-qa' as const, qa }))]);
      }
    } catch {
      setMessages((m) => [...m, { id: nextId(), role: 'bot-miss', q, suggestions: [], related: [] }]);
    } finally {
      setBusy(false);
    }
  }, [busy, pathname]);

  const logMiss = useCallback(async (q: string) => {
    if (loggedMiss) return;
    setLoggedMiss(true);
    try {
      const { data } = await supabase.auth.getSession();
      const tok = data.session?.access_token ?? '';
      if (!tok) return;
      await fetch('/api/chatbot/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ query: q, context: pathname }),
      });
    } catch { /* bỏ qua */ }
  }, [loggedMiss, pathname]);

  /* ---------------- Render helpers ---------------- */

  const renderQA = (qa: RankedQA) => (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-[13px] leading-relaxed shadow-sm">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{qa.phan_he} · {qa.nhom_chu_de}</div>
      <p className="font-medium text-slate-800">{qa.tra_loi_chuan}</p>
      {qa.vi_du && (
        <p className="mt-2 rounded-md border-l-2 border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">
          <span className="font-semibold">Ví dụ: </span>{qa.vi_du}
        </p>
      )}
      {qa.hanh_dong && (
        <p className="mt-1.5 text-slate-500"><span className="font-semibold text-slate-600">Hành động: </span>{qa.hanh_dong}</p>
      )}
      {qa.cau_hoi_tiep_theo && (
        <button
          onClick={() => send(qa.cau_hoi_tiep_theo)}
          className="mt-2 rounded-full border border-[#0d6efd]/40 bg-[#0d6efd]/5 px-3 py-1 text-[12px] text-[#0d6efd] hover:bg-[#0d6efd]/10"
        >
          {qa.cau_hoi_tiep_theo}
        </button>
      )}
      <div className="mt-1.5 text-right text-[10px] text-slate-300">{qa.id}</div>
    </div>
  );

  const renderMiss = (m: Extract<Msg, { role: 'bot-miss' }>) => (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed">
      <p className="font-medium text-amber-800">Chưa có dữ liệu để trả lời — mình không tự đoán.</p>
      {m.suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {m.suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[12px] text-amber-700 hover:bg-amber-100">
              {s}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => logMiss(m.q)}
        disabled={loggedMiss}
        className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {loggedMiss ? 'Đã ghi nhận' : 'Ghi lại câu hỏi này'}
      </button>
    </div>
  );

  /* ---------------- Shell ---------------- */

  const sheet = open && (
    <div role="presentation" className="fixed inset-0 z-50">
      {/* Backdrop (mobile) */}
      {isMobile && <button aria-label="Đóng trợ lý" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="absolute inset-0 bg-black/35" />}
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-label="Trợ lý công việc"
        className={
          isMobile
            ? 'absolute bottom-0 left-0 right-0 flex flex-col bg-white shadow-2xl rounded-t-2xl'
            : 'absolute right-5 bottom-20 flex flex-col bg-white shadow-2xl rounded-2xl border border-slate-200'
        }
        style={isMobile ? { height: '92dvh' } : { width: 380, height: 'min(560px, 80dvh)' }}
      >
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <span className="text-sm font-semibold text-slate-800">Trợ lý công việc</span>
          <button aria-label="Đóng" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <div className="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-600">
              Xin chào! Mình là trợ lý công việc. Chọn một câu hỏi gợi ý bên dưới hoặc gõ câu hỏi của bạn.
            </div>
          )}
          {messages.map((m) => {
            if (m.role === 'user') {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#0d6efd] px-3 py-2 text-[13px] text-white">{m.text}</div>
                </div>
              );
            }
            if (m.role === 'bot-qa') {
              return <div key={m.id} className="flex justify-start">{renderQA(m.qa)}</div>;
            }
            return <div key={m.id} className="flex justify-start">{renderMiss(m)}</div>;
          })}
          {busy && <div className="text-[12px] text-slate-400">Đang tìm câu trả lời…</div>}
          {chips.length > 0 && messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {chips.map((c) => (
                <button key={c} onClick={() => send(c)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-600 hover:bg-slate-50">
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <form
          className="shrink-0 border-t border-slate-200 p-3"
          onSubmit={(e) => { e.preventDefault(); send(input); }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder="Gõ câu hỏi… (Enter gửi)"
              className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:border-[#0d6efd] focus:outline-none"
            />
            <button
              type="submit" disabled={busy || !input.trim()}
              aria-label="Gửi"
              className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-[#0d6efd] text-white disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        aria-label="Mở trợ lý"
        title="Trợ lý công việc"
        onClick={() => setOpen((o) => !o)}
        className="fixed z-40 grid h-14 w-14 place-items-center rounded-full bg-[#0d6efd] text-white shadow-lg transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-white md:right-5 md:bottom-5 right-4 bottom-4"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      {sheet}
    </>
  );
}
