import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Palette, Bell, Target, Database,
  Shield, Sun, Moon, Monitor, LogOut, Trash2,
  Download, Check, Key, Eye, EyeOff, Loader2, AlertTriangle, Zap
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useToastStore } from '@/stores/toastStore';
import { reinitSupabaseClient, isSupabaseConfigured, supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import { TokenCounter } from '@/components/ui/TokenCounter';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export function SettingsPage() {
  const { profile, signOut } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { showToast } = useToastStore();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [notifications, setNotifications] = useState(false);
  const [saved, setSaved] = useState(false);

  // API Keys States
  const [claudeKey, setClaudeKey] = useState(
    localStorage.getItem('KIRA_GEMINI_KEY') ||
    ''
  );
  const [sbUrl, setSbUrl] = useState(localStorage.getItem('KIRA_SUPABASE_URL') || '');
  const [sbKey, setSbKey] = useState(localStorage.getItem('KIRA_SUPABASE_ANON_KEY') || '');
  
  const [showClaude, setShowClaude] = useState(false);
  const [showSbKey, setShowSbKey] = useState(false);

  // Clearing / Reset States
  const [clearing, setClearing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    desc: string;
    action: () => Promise<void>;
  } | null>(null);

  const handleSaveSettings = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    showToast('Preferences updated!', 'success');
  };

  const handleSaveKeys = () => {
    localStorage.setItem('KIRA_GEMINI_KEY', claudeKey);
    localStorage.setItem('KIRA_SUPABASE_URL', sbUrl);
    localStorage.setItem('KIRA_SUPABASE_ANON_KEY', sbKey);

    // Reinit client bindings
    reinitSupabaseClient(sbUrl, sbKey);

    showToast('Credentials saved! Re-initializing services...', 'success');
  };

  // Clear Chat History
  const clearChatHistory = async () => {
    setClearing(true);
    try {
      await db.chat_messages.clear();
      if (isSupabaseConfigured) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('chat_messages').delete().eq('user_id', user.id);
        }
      }
      showToast('Chat history cleared!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to clear chat.', 'error');
    } finally {
      setClearing(false);
      setConfirmModal(null);
    }
  };

  // Clear Daily Tracker logs
  const clearDailyLogs = async () => {
    setClearing(true);
    try {
      await db.daily_logs.clear();
      if (isSupabaseConfigured) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('daily_logs').delete().eq('user_id', user.id);
        }
      }
      showToast('Daily logs deleted!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to delete daily logs.', 'error');
    } finally {
      setClearing(false);
      setConfirmModal(null);
    }
  };

  // Clear Food Logs
  const clearFoodLogs = async () => {
    setClearing(true);
    try {
      await db.food_logs.clear();
      if (isSupabaseConfigured) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('food_logs').delete().eq('user_id', user.id);
        }
      }
      showToast('Food logs deleted!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to delete food logs.', 'error');
    } finally {
      setClearing(false);
      setConfirmModal(null);
    }
  };

  // Clear all IndexedDB contents
  const clearAllOfflineData = async () => {
    setClearing(true);
    try {
      await db.delete();
      showToast('Offline database dropped. Reloading client...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      console.error(e);
      showToast('Failed to wipe offline database.', 'error');
      setClearing(false);
      setConfirmModal(null);
    }
  };

  // Reset entire Application
  const resetEntireApp = async () => {
    setClearing(true);
    try {
      // Clear Dexie
      await db.daily_logs.clear();
      await db.habits.clear();
      await db.habit_completions.clear();
      await db.goals.clear();
      await db.income.clear();
      await db.chat_messages.clear();
      await db.nutrition_profiles.clear();
      await db.food_logs.clear();
      await db.dynamic_sections.clear();
      await db.dynamic_section_data.clear();
      await db.xp_log.clear();
      await db.journal_entries.clear();

      // Clear localStorage configs
      localStorage.removeItem('kira-theme');
      localStorage.removeItem('kira-sidebar');
      localStorage.removeItem('KIRA_MORNING_BRIEF_DATA');
      localStorage.removeItem('KIRA_MORNING_BRIEF_DATE');
      localStorage.removeItem('KIRA_CLAUDE_KEY');
      localStorage.removeItem('KIRA_GEMINI_KEY');
      localStorage.removeItem('KIRA_SUPABASE_URL');
      localStorage.removeItem('KIRA_SUPABASE_ANON_KEY');

      if (isSupabaseConfigured) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('daily_logs').delete().eq('user_id', user.id);
          await supabase.from('habits').delete().eq('user_id', user.id);
          await supabase.from('habit_completions').delete().eq('user_id', user.id);
          await supabase.from('goals').delete().eq('user_id', user.id);
          await supabase.from('income').delete().eq('user_id', user.id);
          await supabase.from('chat_messages').delete().eq('user_id', user.id);
          await supabase.from('nutrition_profiles').delete().eq('user_id', user.id);
          await supabase.from('food_logs').delete().eq('user_id', user.id);
          await supabase.from('dynamic_sections').delete().eq('user_id', user.id);
          await supabase.from('dynamic_section_data').delete().eq('user_id', user.id);
          await supabase.from('xp_log').delete().eq('user_id', user.id);
          await supabase.from('journal_entries').delete().eq('user_id', user.id);
        }
      }

      showToast('App reset complete. Reloading...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      console.error(e);
      showToast('Reset failed.', 'error');
      setClearing(false);
      setConfirmModal(null);
    }
  };

  const exportData = () => {
    const data = {
      exported_at: new Date().toISOString(),
      profile: profile,
      settings: { theme },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kira-data-export.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Configuration exported!', 'info');
  };

  const inputStyle = {
    background: 'var(--bg-input)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  };

  const sectionCard = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-sm)',
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 max-w-2xl mx-auto space-y-6"
    >
      {/* Confirmation Modal overlay */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl"
            >
              <div className="flex items-center gap-3 text-warning">
                <AlertTriangle size={24} />
                <h3 className="text-sm font-bold text-white">{confirmModal.title}</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{confirmModal.desc}</p>
              
              <div className="flex gap-2">
                <button
                  disabled={clearing}
                  onClick={confirmModal.action}
                  className="flex-1 py-2 bg-danger text-white text-xs font-semibold rounded-xl flex items-center justify-center"
                >
                  {clearing ? <Loader2 className="animate-spin" size={14} /> : 'Yes, Confirm'}
                </button>
                <button
                  disabled={clearing}
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile */}
      <motion.div variants={itemVariants} className="rounded-2xl p-6" style={sectionCard}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <User size={16} className="text-primary" />
          Profile
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
              <span className="text-white text-2xl font-bold">
                {(displayName || 'U')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Theme */}
      <motion.div variants={itemVariants} className="rounded-2xl p-6" style={sectionCard}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Palette size={16} className="text-secondary" />
          Appearance
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {([
            { key: 'light' as const, label: 'Light', icon: Sun },
            { key: 'dark' as const, label: 'Dark', icon: Moon },
            { key: 'system' as const, label: 'System', icon: Monitor },
          ]).map((option) => (
            <button
              key={option.key}
              onClick={() => setTheme(option.key)}
              className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all"
              style={{
                background: theme === option.key ? 'var(--color-primary)' : 'var(--bg-input)',
                color: theme === option.key ? 'white' : 'var(--text-muted)',
                border: `2px solid ${theme === option.key ? 'var(--color-primary)' : 'var(--border)'}`,
              }}
            >
              <option.icon size={20} />
              <span className="text-xs font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* API Keys Settings Section */}
      <motion.div variants={itemVariants} className="rounded-2xl p-6" style={sectionCard}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Key size={16} className="text-primary" />
          API Credentials
        </h3>
        
        <div className="space-y-4">
          {/* Claude Key */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Gemini API Key</label>
            <div className="relative">
              <input
                type={showClaude ? 'text' : 'password'}
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-3 pr-10 py-2 rounded-xl text-sm"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowClaude(!showClaude)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                {showClaude ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Supabase URL */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Supabase Endpoint URL</label>
            <input
              type="text"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              placeholder="https://xyz.supabase.co"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>

          {/* Supabase Key */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Supabase Anon Key</label>
            <div className="relative">
              <input
                type={showSbKey ? 'text' : 'password'}
                value={sbKey}
                onChange={(e) => setSbKey(e.target.value)}
                placeholder="eyJhbGci..."
                className="w-full pl-3 pr-10 py-2 rounded-xl text-sm"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowSbKey(!showSbKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                {showSbKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleSaveKeys}
            className="w-full py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5"
          >
            Save API Keys
          </button>
          
          <p className="text-[10px] text-zinc-500 italic text-center">
            Credentials are saved locally in your browser cache. Never share them publicly.
          </p>
        </div>
      </motion.div>

      {/* AI Usage Tracker Section */}
      <motion.div variants={itemVariants}>
        <TokenCounter variant="full" />
      </motion.div>

      {/* Developer Settings Section (Clear / Reset Data) */}
      <motion.div variants={itemVariants} className="rounded-2xl p-6" style={sectionCard}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Database size={16} className="text-warning" />
          Developer Settings
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setConfirmModal({
              title: 'Clear Chat History',
              desc: 'Are you sure you want to delete all offline and online chat messages? This cannot be undone.',
              action: clearChatHistory,
            })}
            className="flex items-center gap-2.5 px-4 py-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
          >
            <Trash2 size={15} /> Clear Chat history
          </button>

          <button
            onClick={() => setConfirmModal({
              title: 'Clear Daily Logs',
              desc: 'Are you sure you want to delete all daily study, water, and mood logs? This cannot be undone.',
              action: clearDailyLogs,
            })}
            className="flex items-center gap-2.5 px-4 py-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
          >
            <Trash2 size={15} /> Clear Daily Logs
          </button>

          <button
            onClick={() => setConfirmModal({
              title: 'Clear Food Logs',
              desc: 'Are you sure you want to delete all daily calorie and protein food logs? This cannot be undone.',
              action: clearFoodLogs,
            })}
            className="flex items-center gap-2.5 px-4 py-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
          >
            <Trash2 size={15} /> Clear Food Logs
          </button>

          <button
            onClick={() => setConfirmModal({
              title: 'Reset Offline Storage',
              desc: 'Are you sure you want to delete the local IndexedDB database? The app will reinitialize on reload.',
              action: clearAllOfflineData,
            })}
            className="flex items-center gap-2.5 px-4 py-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
          >
            <Database size={15} /> Clear all offline data
          </button>

          <button
            onClick={() => setConfirmModal({
              title: 'Reset Entire Application',
              desc: 'CAUTION: This will delete all client leads, habits, income entries, food logs, and local settings. The app will be completely wiped.',
              action: resetEntireApp,
            })}
            className="flex items-center gap-2.5 px-4 py-3 border border-danger/20 bg-danger/5 hover:bg-danger/10 rounded-xl text-xs font-semibold text-danger"
          >
            <AlertTriangle size={15} /> Reset Application
          </button>
        </div>
      </motion.div>

      {/* Exporter Data options */}
      <motion.div variants={itemVariants} className="rounded-2xl p-6" style={sectionCard}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Database size={16} className="text-success" />
          Data Portability
        </h3>
        <div className="space-y-3">
          <button
            onClick={exportData}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--bg-input)]"
            style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <Download size={16} style={{ color: 'var(--text-muted)' }} />
            Export all data as JSON
          </button>
        </div>
      </motion.div>

      {/* Account */}
      <motion.div variants={itemVariants} className="rounded-2xl p-6" style={sectionCard}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Shield size={16} className="text-danger" />
          Account Actions
        </h3>
        <div className="space-y-3">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--bg-input)]"
            style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <LogOut size={16} style={{ color: 'var(--text-muted)' }} />
            Sign out
          </button>
        </div>
      </motion.div>

      {/* Save Settings button */}
      <motion.button
        variants={itemVariants}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={handleSaveSettings}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        {saved ? <><Check size={16} /> Saved!</> : 'Save settings'}
      </motion.button>
    </motion.div>
  );
}
