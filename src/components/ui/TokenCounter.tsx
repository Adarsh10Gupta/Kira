import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertTriangle } from 'lucide-react';
import { getTodayUsage } from '@/lib/claude';

const DAILY_LIMITS = {
  requests: 1500,
  totalTokens: 1000000,
};

interface TokenCounterProps {
  variant?: 'compact' | 'full';
}

export function TokenCounter({ variant = 'full' }: TokenCounterProps) {
  const [usage, setUsage] = useState(() => getTodayUsage());

  useEffect(() => {
    const handler = () => setUsage(getTodayUsage());
    window.addEventListener('kira_token_update', handler);
    return () => window.removeEventListener('kira_token_update', handler);
  }, []);

  const reqPercent = Math.min(100, (usage.requests / DAILY_LIMITS.requests) * 100);
  const tokenPercent = Math.min(100, (usage.totalTokens / DAILY_LIMITS.totalTokens) * 100);

  const chatsRemaining = Math.max(0, DAILY_LIMITS.requests - usage.requests);

  const getBarColor = (percent: number) => {
    if (percent <= 60) return '#10b981'; // Green
    if (percent <= 80) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const getWarningMessage = () => {
    if (reqPercent >= 100) {
      return { text: 'Limit reached', color: 'text-red-500' };
    }
    if (reqPercent >= 95) {
      return { text: 'Almost out', color: 'text-red-500' };
    }
    if (reqPercent >= 80) {
      return { text: 'Running low', color: 'text-amber-500' };
    }
    return null;
  };

  const warning = getWarningMessage();

  if (variant === 'compact') {
    return (
      <div className="space-y-2 py-1 px-1">
        {/* Requests Bar */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-[9px]" style={{ color: 'var(--text-muted)' }}>
            <span>Requests</span>
            <span>{usage.requests} / {DAILY_LIMITS.requests}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${reqPercent}%` }}
              style={{ backgroundColor: getBarColor(reqPercent) }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Tokens Bar */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-[9px]" style={{ color: 'var(--text-muted)' }}>
            <span>Tokens</span>
            <span>{usage.totalTokens >= 1000 ? `${(usage.totalTokens / 1000).toFixed(0)}k` : usage.totalTokens} / 1M</span>
          </div>
          <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${tokenPercent}%` }}
              style={{ backgroundColor: getBarColor(tokenPercent) }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Info / Warnings */}
        <div className="flex items-center justify-between mt-1">
          {warning ? (
            <span className={`text-[8px] font-bold ${warning.color} flex items-center gap-0.5`}>
              <AlertTriangle size={8} />
              {warning.text}
            </span>
          ) : (
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              ~{chatsRemaining} chats left today
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full Version for Settings
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-primary" />
        <h4 className="text-sm font-semibold text-white">Daily AI Usage</h4>
      </div>

      {/* Requests */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium">
          <span style={{ color: 'var(--text-muted)' }}>API Requests</span>
          <span style={{ color: 'var(--text)' }}>
            {usage.requests} / {DAILY_LIMITS.requests} used
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${reqPercent}%` }}
            style={{ backgroundColor: getBarColor(reqPercent) }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Tokens */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium">
          <span style={{ color: 'var(--text-muted)' }}>Token Count</span>
          <span style={{ color: 'var(--text)' }}>
            {usage.totalTokens.toLocaleString()} / {DAILY_LIMITS.totalTokens.toLocaleString()}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${tokenPercent}%` }}
            style={{ backgroundColor: getBarColor(tokenPercent) }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-zinc-800/40 flex items-center justify-between text-xs">
        <span style={{ color: 'var(--text-muted)' }}>
          ~{chatsRemaining} chats remaining today
        </span>
        {warning && (
          <span className={`font-bold ${warning.color} flex items-center gap-1`}>
            <AlertTriangle size={12} />
            {warning.text}
          </span>
        )}
      </div>
    </div>
  );
}
