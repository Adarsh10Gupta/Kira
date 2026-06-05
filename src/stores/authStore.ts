import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: {
    display_name: string;
    avatar_url: string;
    theme: string;
  } | null;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setProfile: (profile: AuthState['profile']) => void;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  profile: null,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      set({
        profile: {
          display_name: data.display_name || user.email?.split('@')[0] || 'User',
          avatar_url: data.avatar_url || '',
          theme: data.theme || 'system',
        },
      });
    } else {
      // Create profile if it doesn't exist
      const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
      await supabase.from('profiles').upsert({
        id: user.id,
        display_name: displayName,
        theme: 'system',
      });
      set({
        profile: {
          display_name: displayName,
          avatar_url: '',
          theme: 'system',
        },
      });
    }
  },
}));
