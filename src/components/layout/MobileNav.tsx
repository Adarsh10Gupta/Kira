import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  MessageCircle,
  Sparkles,
  Activity,
  Users,
} from 'lucide-react';

const tabs = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/coach', label: 'Coach', icon: MessageCircle },
  { path: '/pitch', label: 'Pitch', icon: Sparkles },
  { path: '/tracker', label: 'Track', icon: Activity },
  { path: '/clients', label: 'CRM', icon: Users },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl"
      style={{
        background: 'color-mix(in srgb, var(--bg-sidebar) 85%, transparent)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 py-1"
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-active"
                  className="absolute -top-1 w-8 h-1 rounded-full bg-gradient-to-r from-primary to-secondary"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <tab.icon
                size={20}
                style={{ color: isActive ? 'var(--color-primary)' : 'var(--text-muted)' }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? 'var(--color-primary)' : 'var(--text-muted)' }}
              >
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
      {/* Safe area padding for phones with notch */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
