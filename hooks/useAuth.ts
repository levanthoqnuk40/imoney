import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase.service';
import * as OfflineDB from '../services/offline.service';
import * as NotificationService from '../services/notification.service';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await OfflineDB.cacheAuthSession(session.user, session);
          setAuthLoading(false);
          await NotificationService.initNotifications();
          return;
        }
      } catch {
        // Ignore network errors and fallback to offline cache
      }

      if (!navigator.onLine) {
        const cached = await OfflineDB.getCachedAuth();
        if (cached) {
          setUser({
            id: cached.userId,
            email: cached.email,
            user_metadata: { full_name: cached.fullName },
          } as User);
          await NotificationService.initNotifications();
        }
      }
      setAuthLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await OfflineDB.cacheAuthSession(session.user, session);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = useCallback(async (clearStatesCallback?: () => void) => {
    await supabase.auth.signOut();
    await OfflineDB.clearCachedAuth();
    setUser(null);
    if (clearStatesCallback) {
      clearStatesCallback();
    }
  }, []);

  return {
    user,
    setUser,
    authLoading,
    handleLogout,
  };
}
