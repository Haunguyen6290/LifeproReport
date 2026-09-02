'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { QA } from '@/lib/chatbot/search';
import { loadBotConfig, phanHeChoDuongDan, locCauHoiTheoCauHinh, taoBangTenNhom, type BotPhanHe, type BotNhom, type BotRow } from '@/lib/troly-config';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type RankedQA = QA & { score?: number };

type Msg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'bot-qa'; qa: RankedQA }
  | { id: number; role: 'bot-ai'; text: string }
  | { id: number; role: 'bot-limit' }
  | { id: number; role: 'bot-miss'; q: string };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

let msgId = 0;
const nextId = () => ++msgId;

const QUEUE_SIZE = 8;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ChatbotWidget() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loggedMiss, setLoggedMiss] = useState(false);
  const [aiUsed, setAiUsed] = useState(0);

  // Luồng mới: phân hệ → nhóm → câu hỏi (hàng đợi xoay vòng)
  const [phanHe, setPhanHe] = useState('Bộ não chung công ty');
  const [groups, setGroups] = useState<string[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [groupAll, setGroupAll] = useState<string[]>([]);      // mọi cau_hoi của nhóm (gốc để xoay vòng)
  const [queue, setQueue] = useState<string[]>([]);            // hàng đợi hiện tại (tối đa QUEUE_SIZE)
  const [seen, setSeen] = useState<Set<string>>(new Set());    // câu đã bấm, chống lặp khi chưa hết

  const botConfigRef = useRef<{ phanHe: BotPhanHe[]; nhom: BotNhom[] }>({ phanHe: [], nhom: [] });
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // ref từng tin nhắn để cuộn đúng vị trí câu hỏi
  const msgRefs = useRef(new Map<number, HTMLDivElement>());

  // Theo dõi mobile/desktop
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Khi chuyển chức năng (đổi route): tự đóng widget và làm mới theo phân hệ mới.
  // (Bấm link menu khi widget đang mở → vẫn chuyển trang bình thường, widget load lại.)
  useEffect(() => {
    setOpen(false);
    setMessages([]);
    setInput('');
    setLoggedMiss(false);
    setAiUsed(0);
    setActiveGroup(null);
    setGroupAll([]);
    setQueue([]);
    setSeen(new Set());
    msgRefs.current.clear();
  }, [pathname]);

  // Nạp cấu hình trợ lý (bộ nhớ đệm trong phiên) — trả về để effect câu hỏi chờ xong trước khi query
  const loadConfig = useCallback(async () => {
    const c = await loadBotConfig();
    botConfigRef.current = c;
    return c;
  }, []);

  const send = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    setBusy(true);
    const userMsg: Msg = { id: nextId(), role: 'user', text: q };
    // Lịch sử gửi lên Haiku: 6 tin gần nhất + câu hỏi hiện tại
    const prevHistory = messages.map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.role === 'user' ? m.text : m.role === 'bot-qa' ? m.qa.tra_loi_chuan : m.role === 'bot-ai' ? m.text : '',
    })).filter((m) => m.content);
    const history = [...prevHistory, { role: 'user' as const, content: q }].slice(-7);
    setMessages((m) => [...m, userMsg]);
    setInput('');
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, context: pathname, messages: history, aiUsed }),
      });
      if (!res.ok) {
        setMessages((m) => [...m, { id: nextId(), role: 'bot-miss', q }]);
        setBusy(false);
        return;
      }
      const j = await res.json();
      if (j.kind === 'qa' && j.qa) {
        setMessages((m) => [...m, { id: nextId(), role: 'bot-qa', qa: j.qa as RankedQA }]);
      } else if (j.kind === 'ai' && j.text) {
        setAiUsed((n) => n + 1);
        setMessages((m) => [...m, { id: nextId(), role: 'bot-ai', text: String(j.text) }]);
      } else if (j.kind === 'limit') {
        setMessages((m) => [...m, { id: nextId(), role: 'bot-limit' }]);
      } else {
        setMessages((m) => [...m, { id: nextId(), role: 'bot-miss', q }]);
      }
    } catch {
      setMessages((m) => [...m, { id: nextId(), role: 'bot-miss', q }]);
    } finally {
      setBusy(false);
    }
  }, [busy, pathname, messages, aiUsed]);

  // Lấy câu hỏi của (nhiều) phân hệ hiện tại để dựng nhóm + hàng đợi (RLS: authenticated được đọc)
  const allRowsRef = useRef<{ cau_hoi: string; nhom_chu_de: string; phan_he: string }[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const cfg = await loadConfig();
      const actives = phanHeChoDuongDan(pathname, cfg.phanHe);
      setPhanHe(actives.join(' · '));
      // Lấy câu hỏi của (nhiều) phân hệ đang kích hoạt trên trang này
      const { data } = await supabase
        .from('chatbot_qa')
        .select('cau_hoi, nhom_chu_de, phan_he')
        .in('phan_he', actives.length ? actives : ['__khong-co__'])
        .order('nhom_chu_de')
        .order('cau_hoi');
      if (cancelled) return;
      const raw = ((data ?? []) as any[]).filter((x) => x.cau_hoi);
      const { groups: _g, rows: kept } = locCauHoiTheoCauHinh(raw as BotRow[], actives, taoBangTenNhom(cfg.nhom));
      allRowsRef.current = kept as typeof allRowsRef.current;
      const gs: string[] = (_g.length ? _g : [...new Set(kept.map((r) => (r as any).nhom_chu_de as string).filter(Boolean))] as string[]);
      setGroups(gs);
      setActiveGroup(null);
      setGroupAll([]);
      setQueue([]);
      setSeen(new Set());
    })();
    return () => { cancelled = true; };
  }, [open, pathname, loadConfig]);

  // Bấm một nhóm → dựng hàng đợi tối đa 8 câu hỏi của nhóm đó
  const openGroup = useCallback((g: string) => {
    const list = allRowsRef.current.filter((r) => r.nhom_chu_de === g).map((r) => r.cau_hoi);
    setActiveGroup(g);
    setGroupAll(list);
    setQueue(list.slice(0, QUEUE_SIZE));
    setSeen(new Set());
  }, []);

  // Bấm một câu hỏi → trả lời (qua send) rồi xoay vòng hàng đợi:
  // luôn hiện tối đa 8 câu CHƯA xem; câu vừa xem rời hàng, câu kế đẩy lên;
  // khi đã xem hết mọi câu trong nhóm thì quay vòng lại từ đầu.
  const pickQuestion = useCallback((q: string) => {
    if (busy) return;
    send(q);
    const newSeen = new Set(seen);
    newSeen.add(q);
    if (newSeen.size >= groupAll.length) {
      setSeen(new Set());
      setQueue(groupAll.slice(0, QUEUE_SIZE));
    } else {
      setSeen(newSeen);
      setQueue(groupAll.filter((c) => !newSeen.has(c)).slice(0, QUEUE_SIZE));
    }
  }, [send, seen, groupAll, busy]);

  // Đưa cặp câu hỏi–trả lời vào tầm nhìn: cuộn tới câu hỏi gần nhất để
  // dữ liệu hiển thị ngay dưới câu hỏi, thanh cuộn giữ ở đó (không cuộn xuống đáy).
  useEffect(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      const el = msgRefs.current.get(lastUser.id);
      if (el) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    }
    if (busy && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, busy]);

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
      <div className="mb-1.5 rounded-lg bg-[#0d6efd]/5 px-2.5 py-1.5 text-[13px] font-semibold text-[#0d6efd]">{qa.cau_hoi}</div>
      <p className="font-medium text-slate-800">{qa.tra_loi_chuan}</p>
      {qa.vi_du && (
        <p className="mt-2 rounded-md border-l-2 border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">
          <span className="font-semibold">Ví dụ: </span>{qa.vi_du}
        </p>
      )}
      <div className="mt-1.5 text-right text-[10px] text-slate-300">{qa.id}</div>
    </div>
  );

  const renderAI = (text: string) => (
    <div className="rounded-xl border border-violet-200 bg-[#f5f0ff] p-3 text-[13px] leading-relaxed">
      <p className="text-slate-800">{text}</p>
      <p className="mt-1.5 text-[11px] italic text-violet-600">Gợi ý từ AI — không phải quy chuẩn công ty</p>
    </div>
  );

  const renderLimit = () => (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed">
      <p className="font-medium text-amber-800">Đã hết lượt hỗ trợ nâng cao trong phiên này.</p>
      <p className="mt-1 text-amber-700">Mời hỏi theo câu chuẩn hoặc mở phiên mới (đóng/mở lại widget) để tiếp tục.</p>
    </div>
  );

  const renderMiss = (m: Extract<Msg, { role: 'bot-miss' }>) => (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed">
      <p className="font-medium text-amber-800">Chưa có dữ liệu để trả lời — mình không tự đoán.</p>
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
    <div role="presentation" className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop (mobile) — đóng khi bấm ngoài sheet */}
      {isMobile && <button aria-label="Đóng trợ lý" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="pointer-events-auto absolute inset-0 bg-black/35" />}
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-label="Trợ lý công việc"
        className={
          isMobile
            ? 'pointer-events-auto absolute bottom-0 left-0 right-0 flex flex-col bg-white shadow-2xl rounded-t-2xl'
            : 'pointer-events-auto absolute right-5 bottom-20 flex flex-col bg-white shadow-2xl rounded-2xl border border-slate-200'
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
              Xin chào! Tôi là trợ lý công việc của <b>{phanHe}</b>. Chọn một <b>nhóm</b> bên dưới để xem câu hỏi trong nhóm, hoặc gõ câu hỏi tự do ở dưới.
            </div>
          )}
          {/* Khi chưa chọn nhóm: hiện các nhóm */}
          {activeGroup === null ? (
            groups.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nhóm trong phân hệ</div>
                {groups.map((g) => (
                  <button key={g} onClick={() => openGroup(g)} className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[13px] font-medium text-slate-700 hover:border-[#0d6efd]/40 hover:bg-slate-50">
                    {g}
                  </button>
                ))}
              </div>
            ) : (
              <div className="pt-1 text-[12px] text-slate-400">Chưa có nhóm nào trong phân hệ này. Bạn có thể gõ câu hỏi tự do ở dưới.</div>
            )
          ) : (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nhóm: {activeGroup}</span>
              <button onClick={() => { setActiveGroup(null); setGroupAll([]); setQueue([]); setSeen(new Set()); }} className="text-[12px] font-semibold text-[#0d6efd] hover:underline">← Chọn nhóm khác</button>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              ref={(el) => { if (el) msgRefs.current.set(m.id, el); }}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              {m.role === 'user'
                ? <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#0d6efd] px-3 py-2 text-[13px] text-white">{m.text}</div>
                : m.role === 'bot-qa' ? renderQA(m.qa)
                : m.role === 'bot-ai' ? renderAI(m.text)
                : m.role === 'bot-limit' ? renderLimit()
                : renderMiss(m)}
            </div>
          ))}
          {busy && <div className="text-[12px] text-slate-400">Đang tìm câu trả lời…</div>}
          {/* Hàng đợi 8 câu hỏi của nhóm — luôn dưới hội thoại để bấm tiếp; gõ tự do ở ô dưới */}
          {activeGroup !== null && queue.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
              {queue.map((c) => (
                <button key={c} onClick={() => pickQuestion(c)} className="rounded-full border border-[#0d6efd]/30 bg-[#0d6efd]/5 px-2.5 py-1 text-[12px] text-[#0d6efd] hover:bg-[#0d6efd]/10">
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
