import { create } from 'zustand';
import { db } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type LevelName = 'Beginner' | 'Explorer' | 'Builder' | 'Achiever' | 'Elite';

export interface XPBubble {
  id: string;
  xp: number;
}

interface XPState {
  xp: number;
  level: LevelName;
  bubbles: XPBubble[];
  loading: boolean;
  initXP: () => Promise<void>;
  awardXP: (action: string, points: number) => Promise<void>;
  removeBubble: (id: string) => void;
}

export function getXPLevelInfo(xp: number) {
  if (xp < 100) {
    return { name: 'Beginner' as LevelName, min: 0, max: 100, progress: (xp / 100) * 100 };
  } else if (xp < 300) {
    return { name: 'Explorer' as LevelName, min: 100, max: 300, progress: ((xp - 100) / 200) * 100 };
  } else if (xp < 600) {
    return { name: 'Builder' as LevelName, min: 300, max: 600, progress: ((xp - 300) / 300) * 100 };
  } else if (xp < 1000) {
    return { name: 'Achiever' as LevelName, min: 600, max: 1000, progress: ((xp - 600) / 400) * 100 };
  } else {
    return { name: 'Elite' as LevelName, min: 1000, max: 1000, progress: 100 };
  }
}

export const useXPStore = create<XPState>((set, get) => ({
  xp: 0,
  level: 'Beginner',
  bubbles: [],
  loading: true,

  initXP: async () => {
    set({ loading: true });
    let totalXp = 0;

    if (isSupabaseConfigured) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('xp_log')
            .select('xp');
          
          if (!error && data) {
            totalXp = data.reduce((sum, item) => sum + Number(item.xp), 0);
          }
        }
      } catch (err) {
        console.error('Failed to load XP from Supabase:', err);
      }
    }

    // Fall back or sync with Dexie
    try {
      const localLogs = await db.xp_log.toArray();
      // If we don't have internet or Supabase, use local logs
      if (totalXp === 0 && localLogs.length > 0) {
        totalXp = localLogs.reduce((sum, item) => sum + item.xp, 0);
      } else if (totalXp > 0 && localLogs.length === 0) {
        // Sync back to local if empty
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('xp_log').select('*');
          if (data) {
            for (const item of data) {
              await db.xp_log.put({
                id: item.id,
                user_id: item.user_id,
                action: item.action,
                xp: item.xp,
                created_at: item.created_at,
                synced: true
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load local XP logs:', err);
    }

    const { name } = getXPLevelInfo(totalXp);
    set({ xp: totalXp, level: name, loading: false });
  },

  awardXP: async (action, points) => {
    const newBubble: XPBubble = {
      id: crypto.randomUUID(),
      xp: points,
    };

    set((state) => ({
      xp: state.xp + points,
      level: getXPLevelInfo(state.xp + points).name,
      bubbles: [...state.bubbles, newBubble],
    }));

    // Save log entry
    let userId = 'demo-user';
    if (isSupabaseConfigured) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          await supabase.from('xp_log').insert({
            user_id: userId,
            action,
            xp: points,
          });
        }
      } catch (err) {
        console.error('Failed to save XP log to Supabase:', err);
      }
    }

    try {
      await db.xp_log.put({
        user_id: userId,
        action,
        xp: points,
        created_at: new Date().toISOString(),
        synced: isSupabaseConfigured,
      });
    } catch (err) {
      console.error('Failed to save local XP log:', err);
    }
  },

  removeBubble: (id) => {
    set((state) => ({
      bubbles: state.bubbles.filter((b) => b.id !== id),
    }));
  },
}));
