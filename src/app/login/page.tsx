'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { LoginForm } from '@/components/LoginForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

type Stage = 'login' | 'change-password' | 'done';

export default function LoginPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('login');

  // Nếu đã đăng nhập sẵn nhưng vẫn must_change_password thì không auto-redirect
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { data: prof } = await supabase.from('profiles').select('must_change_password').eq('id', data.session.user.id).single();
      if ((prof as any)?.must_change_password) setStage('change-password');
      else router.push('/');
    })();
  }, [router]);

  // Đăng nhập xong → về trang chủ
  useEffect(() => {
    if (stage === 'done') router.push('/');
  }, [stage, router]);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-[420px] animate-[fadeUp_450ms_cubic-bezier(0.22,1,0.36,1)_both] rounded-[var(--radius-lg)] border border-slate-200 bg-white p-8 shadow-[0_8px_32px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-[18px] sm:p-10"
        style={{ ['--tw' as string]: '' }}>
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[#3b82f6] text-white" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
        </div>

        {stage === 'login' && (
          <>
            <h1 className="mb-1 text-center text-2xl font-bold tracking-tight">Chào mừng bạn</h1>
            <p className="mb-6 text-center text-[0.9375rem] text-slate-600">Vui lòng đăng nhập để sử dụng hệ thống</p>
            <LoginForm onAuthed={(mustChange) => setStage(mustChange ? 'change-password' : 'done')} />
          </>
        )}

        {stage === 'change-password' && (
          <>
            <h1 className="mb-1 text-center text-2xl font-bold tracking-tight">Đổi mật khẩu lần đầu</h1>
            <p className="mb-6 text-center text-[0.9375rem] text-slate-600">Tài khoản đang dùng mật khẩu mặc định</p>
            <ChangePasswordForm onDone={() => setStage('done')} />
          </>
        )}
      </section>

      <style jsx global>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </main>
  );
}
