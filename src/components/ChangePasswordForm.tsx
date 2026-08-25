'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (pw.length < 6) return setError('Mật khẩu mới phải từ 6 ký tự.');
    if (pw === '123456') return setError('Không được đặt lại đúng mật khẩu mặc định.');
    if (pw !== pw2) return setError('Hai lần nhập mật khẩu không khớp.');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    if (err) { setLoading(false); return setError(err.message); }
    const { data: me } = await supabase.auth.getUser();
    if (me.user) {
      const { error: pe } = await supabase.from('profiles').update({ must_change_password: false }).eq('id', me.user.id);
      if (pe) {
        // Nếu RLS chặn (hiếm), thử qua API admin hoặc báo lỗi rõ
        setLoading(false);
        return setError('Đổi mật khẩu thành công nhưng không cập nhật được trạng thái (RLS): ' + pe.message + '. Hãy đăng xuất và đăng nhập lại.');
      }
      // Đánh dấu phiên không còn phải đổi nữa (tránh RequireAuth cache cũ)
      try { localStorage.setItem('crm_pwd_changed', '1'); } catch {}
    }
    setLoading(false);
    onDone();
  }

  const inputCls = "w-full rounded-[var(--radius-sm)] border-[1.5px] border-[var(--color-muted)] bg-white px-3.5 py-3 text-base outline-none transition focus:border-[var(--color-ring)] focus:ring-[3px] focus:ring-[color:rgba(37,99,235,0.18)]";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        Đây là lần đầu bạn đăng nhập. Hãy đặt mật khẩu riêng để tiếp tục.
      </p>
      {error && (
        <div role="alert" className="rounded-[var(--radius-sm)] border border-[color:rgba(220,38,38,0.25)] bg-[color:rgba(220,38,38,0.08)] px-4 py-2 text-sm text-[var(--color-destructive)]">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="newpw" className="mb-1 block text-sm font-semibold">Mật khẩu mới</label>
        <input id="newpw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label htmlFor="newpw2" className="mb-1 block text-sm font-semibold">Nhập lại mật khẩu mới</label>
        <input id="newpw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} />
      </div>
      <button type="submit" disabled={loading}
        className="w-full rounded-[var(--radius-sm)] bg-[var(--color-primary)] py-3.5 text-base font-semibold text-[var(--color-on-primary)] transition hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-70">
        {loading ? 'Đang lưu…' : 'Đổi mật khẩu và vào hệ thống'}
      </button>
    </form>
  );
}
