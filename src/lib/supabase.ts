import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const getInitialConfig = () => {
  const localUrl = localStorage.getItem('KIRA_SUPABASE_URL');
  const localKey = localStorage.getItem('KIRA_SUPABASE_ANON_KEY');
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const url = localUrl || envUrl || '';
  const key = localKey || envKey || '';
  const configured = Boolean(
    url && 
    key && 
    url.startsWith('http') && 
    !url.includes('your_supabase_url') &&
    key !== 'placeholder-key'
  );

  return { url, key, configured };
};

let config = getInitialConfig();
export let isSupabaseConfigured = config.configured;

const createNewClient = (url: string, key: string, isConfigured: boolean): SupabaseClient => {
  return isConfigured
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: { persistSession: false },
      });
};

export let supabase: SupabaseClient = createNewClient(config.url, config.key, config.configured);

export function reinitSupabaseClient(url: string, anonKey: string) {
  if (url) localStorage.setItem('KIRA_SUPABASE_URL', url);
  else localStorage.removeItem('KIRA_SUPABASE_URL');

  if (anonKey) localStorage.setItem('KIRA_SUPABASE_ANON_KEY', anonKey);
  else localStorage.removeItem('KIRA_SUPABASE_ANON_KEY');

  const newConfig = getInitialConfig();
  isSupabaseConfigured = newConfig.configured;
  supabase = createNewClient(newConfig.url, newConfig.key, newConfig.configured);
}
