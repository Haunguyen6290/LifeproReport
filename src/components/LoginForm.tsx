'use client';

import { useState } from 'react';
import { supabase, REMEMBER_KEY } from '@/lib/supabase/client';

export function LoginForm({ onAuthed }: { onAuthed: (mustChangePassword: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const identifier = email.trim();
    if (!identifier) return setError('Vui lòng nhập tên đăng nhập hoặc email');
    if (!password) return setError('Vui lòng nhập mật khẩu');
    setLoading(true);

    // Gõ tên đăng nhập (không chứa @) → quy đổi ra email qua RPC
    let loginEmail = identifier;
    if (!identifier.includes('@')) {
      const { data: resolved } = await supabase.rpc('email_for_username', { uname: identifier });
      if (!resolved) {
        setLoading(false);
        return setError('Không tìm thấy tài khoản "' + identifier + '".');
      }
      loginEmail = resolved;
    }

    // Đặt cờ "ghi nhớ" TRƯỚC khi signIn để session rơi vào đúng nơi lưu
    try { localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'); } catch { /* bỏ qua */ }

    const { data, error: err } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (err || !data.user) { setLoading(false); return setError(err?.message === 'Invalid login credentials' ? 'Email hoặc mật khẩu không đúng.' : (err?.message ?? 'Đăng nhập thất bại.')); }
    // Ghi nhật ký đăng nhập (không chặn luồng nếu lỗi RLS)
    try {
      const { data: me } = await supabase.from('profiles').select('username, full_name').eq('id', data.user.id).single();
      await supabase.from('audit_logs').insert({ actor_id: data.user.id, action: 'Đăng nhập', entity_type: 'auth', details: { username: (me as any)?.username ?? identifier, full_name: (me as any)?.full_name ?? '' } });
    } catch {}
    setLoading(false);
    // Đọc profile để biết có bắt buộc đổi mật khẩu không
    const { data: prof } = await supabase.from('profiles').select('must_change_password').eq('id', data.user.id).single();
    onAuthed(Boolean(prof?.must_change_password));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="rounded-[var(--radius-sm)] border border-[color:rgba(220,38,38,0.25)] bg-[color:rgba(220,38,38,0.08)] px-4 py-2 text-sm text-[var(--color-destructive)]">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-semibold">Tên đăng nhập hoặc email</label>
        <input id="email" type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder=""
          className="w-full rounded-[var(--radius-sm)] border-[1.5px] border-[var(--color-muted)] bg-white px-3.5 py-3 text-base outline-none transition focus:border-[var(--color-ring)] focus:ring-[3px] focus:ring-[color:rgba(37,99,235,0.18)]" />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold">Mật khẩu</label>
        <div className="relative">
          <input id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Tối thiểu 6 ký tự"
            className="w-full rounded-[var(--radius-sm)] border-[1.5px] border-[var(--color-muted)] bg-white px-3.5 py-3 pr-11 text-base outline-none transition focus:border-[var(--color-ring)] focus:ring-[3px] focus:ring-[color:rgba(37,99,235,0.18)]" />
          <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="absolute right-2.5 top-1/2 grid -translate-y-1/2 place-items-center rounded-[var(--radius-sm)] p-1.5 text-slate-600 hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-[var(--color-ring)]">
            {showPw ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" /> Ghi nhớ đăng nhập
      </label>

      <button type="submit" disabled={loading}
        className="relative w-full rounded-[var(--radius-sm)] bg-[var(--color-primary)] py-3.5 text-base font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-70">
        {loading && <span className="mr-2 inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/30 border-t-white align-middle" aria-hidden />}
        <span className="align-middle">{loading ? 'Đang đăng nhập…' : 'Đăng nhập'}</span>
      </button>
    </form>
  );
}
