import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST (before getSession) per Supabase best practices
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      // Prevent crash on stale/corrupt session (e.g. expired token from closed tab)
      console.error('getSession failed:', err);
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // Safety timeout: if auth takes too long (network issues, stale state), stop loading
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('Auth loading timeout – forcing unauthenticated state');
          return false;
        }
        return prev;
      });
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { user, session, loading, signOut };
}
