import { createClient } from '@supabase/supabase-js';

export const REMEMBER_KEY = 'crm_remember';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

const isBrowser = typeof window !== 'undefined';

function storageArea(): Storage | null {
  if (!isBrowser) return null;
  try {
    return localStorage.getItem(REMEMBER_KEY) === '1' ? localStorage : sessionStorage;
  } catch {
    return localStorage;
  }
}

const storage = {
  getItem: (k: string) => {
    const s = storageArea();
    return s ? s.getItem(k) : null;
  },
  setItem: (k: string, v: string) => {
    const s = storageArea();
    if (s) s.setItem(k, v);
  },
  removeItem: (k: string) => {
    if (!isBrowser) return;
    try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* bỏ qua */ }
  },
};

/** Client cho trình duyệt — chỉ dùng publishable key, mọi quyền bị RLS kiểm soát. */
export const supabase = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder');
