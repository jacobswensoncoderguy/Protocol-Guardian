import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Track sign-in intel on the profiles table
    const trackSignIn = async (userId: string, provider: string) => {
      try {
        await (supabase as any).from('profiles').upsert({
          user_id: userId,
          last_sign_in_at: new Date().toISOString(),
          sign_in_count: 1, // will be incremented by the raw SQL below
          signup_source: provider,
          last_active_at: new Date().toISOString(),
        }, { onConflict: 'user_id', ignoreDuplicates: false });
        // Increment sign_in_count atomically
        await supabase.rpc('increment_sign_in_count' as any, { p_user_id: userId });
      } catch (e) {
        console.error('Failed to track sign-in:', e);
      }
    };

    // Set up listener FIRST (before getSession) per Supabase best practices
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === 'SIGNED_IN' && session?.user) {
        const provider = session.user.app_metadata?.provider || 'email';
        trackSignIn(session.user.id, provider);
      }
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
