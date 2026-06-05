import { create } from 'zustand';
import { db } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface TabItem {
  id: string;
  label: string;
  type: 'checklist' | 'resource_list' | 'progress_tracker' | 'notes' | 'schedule' | 'flashcards' | 'countdown';
  title: string;
  description: string;
  items: any[];
}

export interface DynamicSectionConfig {
  id: string; // unique_slug
  title: string;
  icon: string;
  description: string;
  color: string;
  tabs: TabItem[];
  goals: { id: string; label: string; target: number | null; unit: string }[];
  quickStats: string[];
}

interface DynamicSectionsState {
  sections: DynamicSectionConfig[];
  sectionData: Record<string, Record<string, any>>; // sectionId -> tabId -> data
  loading: boolean;
  initSections: () => Promise<void>;
  createSection: (config: DynamicSectionConfig) => Promise<void>;
  updateTabData: (sectionId: string, tabId: string, data: any) => Promise<void>;
  getTabData: (sectionId: string, tabId: string) => any;
}

export const useDynamicSectionsStore = create<DynamicSectionsState>((set, get) => ({
  sections: [],
  sectionData: {},
  loading: true,

  initSections: async () => {
    set({ loading: true });
    let fetchedSections: DynamicSectionConfig[] = [];
    const fetchedData: Record<string, Record<string, any>> = {};

    if (isSupabaseConfigured) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('dynamic_sections')
            .select('config');
          
          if (!error && data) {
            fetchedSections = data.map((item) => item.config as DynamicSectionConfig);
          }

          const { data: dataEntries, error: dataError } = await supabase
            .from('dynamic_section_data')
            .select('section_id, tab_id, data');
          
          if (!dataError && dataEntries) {
            dataEntries.forEach((item) => {
              if (!fetchedData[item.section_id]) fetchedData[item.section_id] = {};
              fetchedData[item.section_id][item.tab_id] = item.data;
            });
          }
        }
      } catch (err) {
        console.error('Failed to load dynamic sections from Supabase:', err);
      }
    }

    // Load from Dexie if Supabase fails or is not configured
    try {
      const localSections = await db.dynamic_sections.toArray();
      if (fetchedSections.length === 0 && localSections.length > 0) {
        fetchedSections = localSections.map((s) => s.config);
      }
      
      const localData = await db.dynamic_section_data.toArray();
      localData.forEach((item) => {
        if (!fetchedData[item.section_id]) fetchedData[item.section_id] = {};
        if (!fetchedData[item.section_id][item.tab_id]) {
          fetchedData[item.section_id][item.tab_id] = item.data;
        }
      });

      // Mirror Supabase config back to local Dexie if local is empty
      if (fetchedSections.length > 0 && localSections.length === 0) {
        for (const sec of fetchedSections) {
          await db.dynamic_sections.put({
            section_id: sec.id,
            user_id: 'user',
            config: sec,
            synced: true,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load local dynamic sections:', err);
    }

    set({ sections: fetchedSections, sectionData: fetchedData, loading: false });
  },

  createSection: async (config) => {
    // Add to state
    set((state) => ({
      sections: [...state.sections, config],
    }));

    let userId = 'demo-user';
    if (isSupabaseConfigured) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          await supabase.from('dynamic_sections').upsert({
            user_id: userId,
            section_id: config.id,
            config,
          });
        }
      } catch (err) {
        console.error('Failed to save dynamic section to Supabase:', err);
      }
    }

    try {
      await db.dynamic_sections.put({
        user_id: userId,
        section_id: config.id,
        config,
        created_at: new Date().toISOString(),
        synced: isSupabaseConfigured,
      });
    } catch (err) {
      console.error('Failed to save local dynamic section:', err);
    }
  },

  updateTabData: async (sectionId, tabId, data) => {
    // Update local state
    set((state) => {
      const updatedData = { ...state.sectionData };
      if (!updatedData[sectionId]) updatedData[sectionId] = {};
      updatedData[sectionId][tabId] = data;
      return { sectionData: updatedData };
    });

    let userId = 'demo-user';
    if (isSupabaseConfigured) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          await supabase.from('dynamic_section_data').upsert({
            user_id: userId,
            section_id: sectionId,
            tab_id: tabId,
            data,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to save tab data to Supabase:', err);
      }
    }

    try {
      await db.dynamic_section_data.put({
        user_id: userId,
        section_id: sectionId,
        tab_id: tabId,
        data,
        updated_at: new Date().toISOString(),
        synced: isSupabaseConfigured,
      });
    } catch (err) {
      console.error('Failed to save local tab data:', err);
    }
  },

  getTabData: (sectionId, tabId) => {
    return get().sectionData[sectionId]?.[tabId] || null;
  },
}));
