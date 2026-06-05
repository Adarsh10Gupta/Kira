import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useXPStore, getXPLevelInfo } from '@/stores/xpStore';
import { useDynamicSectionsStore } from '@/stores/dynamicSectionsStore';
import { TokenCounter } from '@/components/ui/TokenCounter';

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useThemeStore();
  const { profile, signOut } = useAuthStore();
  const { xp, level } = useXPStore();
  const { sections } = useDynamicSectionsStore();
  const location = useLocation();

  const levelInfo = getXPLevelInfo(xp);

  // Static nav configuration
  const staticNavItems = [
    { path: '/', label: 'Dashboard', icon: Icons.LayoutDashboard },
    { path: '/coach', label: 'AI Coach', icon: Icons.MessageCircle },
    { path: '/diet', label: 'Protein & Diet', icon: Icons.Salad },
    { path: '/journal', label: 'Journal', icon: Icons.BookOpen },
    { path: '/tracker', label: 'Life Tracker', icon: Icons.Activity },
    { path: '/learn', label: 'ML Roadmap', icon: Icons.Brain },
    { path: '/pitch', label: 'Pitch Generator', icon: Icons.Sparkles },
    { path: '/clients', label: 'Client CRM', icon: Icons.Users },
  ];

  const renderNavButton = (path: string, label: string, Icon: any, color?: string) => {
    const isActive = location.pathname === path;
    return (
      <NavLink
        key={path}
        to={path}
        className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 group"
        style={{
          color: isActive ? (color || 'var(--color-primary)') : 'var(--text-muted)',
        }}
      >
        {isActive && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-xl"
            style={{ background: color ? `${color}15` : 'rgba(99, 102, 241, 0.1)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <Icon size={20} className="relative z-10 flex-shrink-0" style={{ color: isActive ? color : undefined }} />
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 whitespace-nowrap"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </NavLink>
    );
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-30 border-r"
      style={{
        background: 'var(--bg-sidebar)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg">K</span>
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="ml-3 text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
            >
              Kira
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Static links */}
        {staticNavItems.map((item) => renderNavButton(item.path, item.label, item.icon))}

        {/* Dynamic Section links */}
        {sections.length > 0 && (
          <>
            <div className="h-px bg-zinc-800 my-4 opacity-50" />
            {!sidebarCollapsed && (
              <p className="text-[10px] uppercase font-bold text-zinc-500 px-3 mb-2 tracking-wider">Custom Sections</p>
            )}
            {sections.map((sec) => {
              const DynamicIcon = (Icons as any)[sec.icon] || Icons.FolderClosed;
              return renderNavButton(`/section/${sec.id}`, sec.title, DynamicIcon, sec.color);
            })}
          </>
        )}
      </nav>

      {/* Gamification Tracker Overlay */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-primary tracking-wide">
              {level}
            </span>
            {!sidebarCollapsed && (
              <span className="text-[10px] text-zinc-500 font-semibold">
                {xp} XP
              </span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-primary to-secondary"
              style={{ width: `${levelInfo.progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Daily API Usage Tracker (Compact) */}
      {!sidebarCollapsed && (
        <div className="px-4 py-2.5 border-t animate-fade-in" style={{ borderColor: 'var(--border)' }}>
          <TokenCounter variant="compact" />
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="mx-3 mb-2 p-2 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-input)]"
        style={{ color: 'var(--text-muted)' }}
      >
        {sidebarCollapsed ? <Icons.ChevronRight size={18} /> : <Icons.ChevronLeft size={18} />}
      </button>

      {/* User section */}
      <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border)' }}>
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors hover:bg-[var(--bg-input)]"
        >
          <div className="relative">
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0"
            >
              <span className="text-white text-xs font-semibold">
                {(profile?.display_name || 'U')[0].toUpperCase()}
              </span>
            </div>
            {/* XP Level badge overlay */}
            <span className="absolute -bottom-1.5 -right-1.5 w-4.5 h-4.5 rounded-full border border-black flex items-center justify-center text-[8px] font-bold text-white bg-zinc-800">
              {level === 'Beginner' && '1'}
              {level === 'Explorer' && '2'}
              {level === 'Builder' && '3'}
              {level === 'Achiever' && '4'}
              {level === 'Elite' && '5'}
            </span>
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0 ml-1"
              >
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {profile?.display_name || 'User'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  Settings
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </NavLink>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-[var(--bg-input)] mt-1"
              style={{ color: 'var(--text-muted)' }}
            >
              <Icons.LogOut size={18} />
              <span>Sign out</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
