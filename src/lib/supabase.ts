import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const getInitialConfig = () => {
  const url = localStorage.getItem('KIRA_SUPABASE_URL') || 
    import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('KIRA_SUPABASE_ANON_KEY') || 
    import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return { url, key };
};

const config = getInitialConfig();

// To prevent throwing an error on empty URL/key during initialization,
// we use a placeholder when not configured.
const activeUrl = config.url && config.url.startsWith('http') && !config.url.includes('your_supabase_url')
  ? config.url
  : 'https://placeholder.supabase.co';

const activeKey = config.key && config.key !== 'placeholder-key' && config.key !== 'your_supabase_anon_key'
  ? config.key
  : 'placeholder-key';

export let isSupabaseConfigured = Boolean(
  config.url &&
  config.key &&
  config.url.startsWith('http') &&
  !config.url.includes('your_supabase_url') &&
  config.key !== 'placeholder-key'
);

let _supabase: SupabaseClient | null = null;

export let supabase: SupabaseClient = (() => {
  if (_supabase) return _supabase;
  _supabase = createClient(activeUrl, activeKey, {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    }
  });
  return _supabase;
})();

export function reinitSupabaseClient(url: string, anonKey: string) {
  if (url) localStorage.setItem('KIRA_SUPABASE_URL', url);
  else localStorage.removeItem('KIRA_SUPABASE_URL');

  if (anonKey) localStorage.setItem('KIRA_SUPABASE_ANON_KEY', anonKey);
  else localStorage.removeItem('KIRA_SUPABASE_ANON_KEY');

  isSupabaseConfigured = Boolean(
    url &&
    anonKey &&
    url.startsWith('http') &&
    !url.includes('your_supabase_url') &&
    anonKey !== 'placeholder-key'
  );

  const finalUrl = isSupabaseConfigured ? url : 'https://placeholder.supabase.co';
  const finalKey = isSupabaseConfigured ? anonKey : 'placeholder-key';

  _supabase = createClient(finalUrl, finalKey, {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    }
  });
  supabase = _supabase;
}
