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

const getSupabaseInstance = (url: string, key: string, isConfigured: boolean): SupabaseClient => {
  const globalRef = globalThis as any;
  const instanceKey = '__supabase_client_instance';
  const urlKey = '__supabase_client_url';

  if (globalRef[instanceKey] && globalRef[urlKey] === url) {
    return globalRef[instanceKey];
  }

  const client = isConfigured
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

  globalRef[instanceKey] = client;
  globalRef[urlKey] = url;
  return client;
};

export let supabase: SupabaseClient = getSupabaseInstance(config.url, config.key, config.configured);

export function reinitSupabaseClient(url: string, anonKey: string) {
  if (url) localStorage.setItem('KIRA_SUPABASE_URL', url);
  else localStorage.removeItem('KIRA_SUPABASE_URL');

  if (anonKey) localStorage.setItem('KIRA_SUPABASE_ANON_KEY', anonKey);
  else localStorage.removeItem('KIRA_SUPABASE_ANON_KEY');

  const newConfig = getInitialConfig();
  isSupabaseConfigured = newConfig.configured;

  const globalRef = globalThis as any;
  delete globalRef['__supabase_client_instance'];
  delete globalRef['__supabase_client_url'];

  supabase = getSupabaseInstance(newConfig.url, newConfig.key, newConfig.configured);
}
