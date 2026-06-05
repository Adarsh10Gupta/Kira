import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolved: 'light' | 'dark';
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  initTheme: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: (localStorage.getItem('kira-theme') as Theme) || 'system',
  resolved: resolveTheme((localStorage.getItem('kira-theme') as Theme) || 'system'),
  sidebarCollapsed: localStorage.getItem('kira-sidebar') === 'true',

  setTheme: (theme) => {
    const resolved = resolveTheme(theme);
    localStorage.setItem('kira-theme', theme);
    applyTheme(resolved);
    set({ theme, resolved });
  },

  toggleSidebar: () => {
    const collapsed = !get().sidebarCollapsed;
    localStorage.setItem('kira-sidebar', String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem('kira-sidebar', String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  initTheme: () => {
    const { theme } = get();
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    set({ resolved });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const currentTheme = get().theme;
      if (currentTheme === 'system') {
        const newResolved = getSystemTheme();
        applyTheme(newResolved);
        set({ resolved: newResolved });
      }
    });
  },
}));
