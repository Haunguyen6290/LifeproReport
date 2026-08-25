'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';

type Ctx = {
  userId: string; username: string; fullName: string; avatarUrl: string; role: string; permissions: string[];
  can: (p: string) => boolean; signOut: () => Promise<void>; refresh: () => Promise<void>;
} | null;

const AuthCtx = createContext<Ctx>(null);
export const useAuth = () => useContext(AuthCtx)!;

let cachedCtx: Ctx | null = null;
let cachedReady = false;

export function RequireAuth({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<Ctx | null>(cachedCtx);
  const [ready, setReady] = useState(cachedReady);

  useEffect(() => {
    if (cachedReady && cachedCtx) { setReady(true); return; }
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { window.location.href = '/login'; return; }
      const { data: prof } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_url, roles(name, permissions)')
        .eq('id', data.session.user.id)
        .single();
      const p = prof as { username: string; full_name: string; avatar_url?: string | null; roles: { name: string; permissions: string[] } | { name: string; permissions: string[] }[] | null } | null;
      // Fallback khi DB chưa có cột avatar_url (migration chưa chạy)
      const avatarUrl = (p as any)?.avatar_url ?? '';
      const roleObj = Array.isArray(p?.roles) ? p!.roles[0] : (p?.roles ?? null);
      const perms: string[] = roleObj?.permissions ?? [];
      async function doSignOut() {
        try {
          const uid = data.session!.user.id;
          const nm = p?.full_name ?? p?.username ?? '';
          await supabase.from('audit_logs').insert({ actor_id: uid, action: 'Đăng xuất', entity_type: 'auth', details: { username: p?.username ?? '', full_name: nm } });
        } catch { /* không chặn đăng xuất */ }
        await supabase.auth.signOut(); cachedCtx = null; cachedReady = false; window.location.href = '/login';
      }
      async function refresh() {
        const { data: r } = await supabase.from('profiles').select('username, full_name, avatar_url').eq('id', data.session!.user.id).single();
        if ((r as any)?.error && String((r as any).error.message).includes('avatar_url')) {
          const { data: r2 } = await supabase.from('profiles').select('username, full_name').eq('id', data.session!.user.id).single();
          const nxt2 = r2 as any;
          if (!nxt2) return;
          const updated2: Ctx = { ...(cachedCtx as NonNullable<Ctx>), username: nxt2.username ?? (cachedCtx as any).username, fullName: nxt2.full_name ?? (cachedCtx as any).fullName, avatarUrl: '' };
          cachedCtx = updated2; setCtx(updated2); return;
        }
        const nxt = r as any;
        if (!nxt) return;
        const updated: Ctx = { ...(cachedCtx as NonNullable<Ctx>), username: nxt.username ?? (cachedCtx as any).username, fullName: nxt.full_name ?? (cachedCtx as any).fullName, avatarUrl: nxt.avatar_url ?? '' };
        cachedCtx = updated; setCtx(updated);
      }
      const next: Ctx = {
        userId: data.session.user.id,
        username: p?.username ?? '',
        fullName: p?.full_name ?? '',
        avatarUrl,
        role: roleObj?.name ?? '',
        permissions: perms,
        can: (perm) => perms.includes(perm),
        signOut: doSignOut,
        refresh,
      };
      cachedCtx = next; cachedReady = true;
      setCtx(next);
      setReady(true);
    })();
  }, []);

  if (!ready) return <div className="min-h-screen bg-[#f0f4f8]" aria-hidden />;
  return <AuthCtx.Provider value={ctx}>{children}</AuthCtx.Provider>;
}
