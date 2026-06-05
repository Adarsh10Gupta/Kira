import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sun, Moon, Bell, Search } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/coach': 'AI Coach',
  '/pitch': 'Pitch Generator',
  '/learn': 'ML/AI Roadmap',
  '/tracker': 'Life Tracker',
  '/clients': 'Client CRM',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const { resolved, setTheme, theme } = useThemeStore();
  const title = pageTitles[location.pathname] || 'Kira';

  const toggleTheme = () => {
    if (resolved === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  return (
    <header
      className="sticky top-0 z-20 h-16 flex items-center justify-between px-4 md:px-6 border-b backdrop-blur-xl"
      style={{
        background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Page title (mobile: show Kira logo) */}
      <div className="flex items-center gap-3">
        <div className="md:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <span className="text-white font-bold text-sm">K</span>
        </div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          className="p-2 rounded-xl transition-colors hover:bg-[var(--bg-input)]"
          style={{ color: 'var(--text-muted)' }}
          title="Search (Cmd+K)"
        >
          <Search size={18} />
        </button>

        {/* Notifications */}
        <button
          className="p-2 rounded-xl transition-colors hover:bg-[var(--bg-input)] relative"
          style={{ color: 'var(--text-muted)' }}
          title="Notifications"
        >
          <Bell size={18} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl transition-colors hover:bg-[var(--bg-input)]"
          style={{ color: 'var(--text-muted)' }}
          title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
        >
          <motion.div
            key={resolved}
            initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </motion.div>
        </button>
      </div>
    </header>
  );
}
