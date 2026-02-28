import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tracks last_active_at on mount and periodically (every 5 min).
 * Also creates session records to measure time-in-app per login.
 */
export function useActivityTracker(userId?: string) {
  const lastUpdate = useRef(0);
  const sessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const update = () => {
      const now = Date.now();
      if (now - lastUpdate.current < 60_000) return;
      lastUpdate.current = now;
      void (supabase.rpc as any)('update_last_active', { p_user_id: userId });
    };

    // Start a session on mount
    const startSession = async () => {
      const { data } = await (supabase as any)
        .from('user_sessions')
        .insert({ user_id: userId })
        .select('id')
        .single();
      if (data) sessionId.current = data.id;
    };

    // End session (set session_end)
    const endSession = () => {
      if (!sessionId.current) return;
      void (supabase as any)
        .from('user_sessions')
        .update({ session_end: new Date().toISOString() })
        .eq('id', sessionId.current);
      sessionId.current = null;
    };

    update();
    startSession();

    const interval = setInterval(update, 5 * 60 * 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        update();
        // Start new session if returning after close
        if (!sessionId.current) startSession();
      } else {
        endSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // End session on page unload
    const handleUnload = () => endSession();
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      endSession();
    };
  }, [userId]);
}
