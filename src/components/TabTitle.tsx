'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

const FALLBACK = 'Lifepro Report';

export function TabTitle() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('settings').select('value').eq('key', 'APP_TAB_TITLE').single();
        const v = String((data as any)?.value ?? '').trim();
        if (!cancelled) document.title = v || FALLBACK;
      } catch {
        if (!cancelled) document.title = FALLBACK;
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}
