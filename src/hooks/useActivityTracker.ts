import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tracks last_active_at on mount and periodically (every 5 min)
 * to provide accurate user activity data.
 */
export function useActivityTracker(userId?: string) {
  const lastUpdate = useRef(0);

  useEffect(() => {
    if (!userId) return;

    const update = () => {
      const now = Date.now();
      // Debounce: at most once per 60 seconds
      if (now - lastUpdate.current < 60_000) return;
      lastUpdate.current = now;
      void (supabase.rpc as any)('update_last_active', { p_user_id: userId });
    };

    // Track immediately on mount
    update();

    // Track every 5 minutes while active
    const interval = setInterval(update, 5 * 60 * 1000);

    // Track on visibility change (user returns to tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') update();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId]);
}
