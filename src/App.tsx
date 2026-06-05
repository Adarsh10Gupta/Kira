import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useXPStore } from '@/stores/xpStore';
import { useDynamicSectionsStore } from '@/stores/dynamicSectionsStore';
import { Layout } from '@/components/layout/Layout';
import { AuthPage } from '@/pages/AuthPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CoachPage } from '@/pages/CoachPage';
import { PitchPage } from '@/pages/PitchPage';
import { LearnPage } from '@/pages/LearnPage';
import { TrackerPage } from '@/pages/TrackerPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { DietPage } from '@/pages/DietPage';
import { JournalPage } from '@/pages/JournalPage';
import { DynamicSectionPage } from '@/pages/DynamicSectionPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { FocusOverlay } from '@/components/layout/FocusOverlay';
import { ToastContainer } from '@/components/ui/Toast';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  // In demo mode (no Supabase), allow access
  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-xl">K</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading Kira...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { setUser, setSession, setLoading, fetchProfile } = useAuthStore();
  const { initTheme } = useThemeStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initTheme();
    
    // Initialize Gamification and Dynamic Sections
    useXPStore.getState().initXP();
    useDynamicSectionsStore.getState().initSections();

    if (!isSupabaseConfigured) {
      // Demo mode — skip auth, set default profile
      setLoading(false);
      setInitialized(true);
      useAuthStore.setState({
        profile: {
          display_name: 'Demo User',
          avatar_url: '',
          theme: 'system',
        },
      });
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      setInitialized(true);

      if (session?.user) {
        fetchProfile();
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        fetchProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-xl">K</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/coach" element={<CoachPage />} />
          <Route path="/diet" element={<DietPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/tracker" element={<TrackerPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/pitch" element={<PitchPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/section/:id" element={<DynamicSectionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <FocusOverlay />
      <ToastContainer />
    </BrowserRouter>
  );
}
