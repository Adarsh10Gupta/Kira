import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, type ToastMessage } from '@/stores/toastStore';

const iconMap = {
  success: <CheckCircle2 size={16} className="text-success" />,
  error: <AlertCircle size={16} className="text-danger" />,
  info: <Info size={16} className="text-accent" />,
  warning: <AlertTriangle size={16} className="text-warning" />,
};

const borderMap = {
  success: 'rgba(16, 185, 129, 0.2)',
  error: 'rgba(239, 68, 68, 0.2)',
  info: 'rgba(6, 182, 212, 0.2)',
  warning: 'rgba(245, 158, 11, 0.2)',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="pointer-events-auto rounded-xl p-3.5 flex items-start gap-3 shadow-lg border backdrop-blur-md"
            style={{
              background: 'var(--bg-card)',
              borderColor: borderMap[toast.type],
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div className="flex-shrink-0 mt-0.5">{iconMap[toast.type]}</div>
            <div className="flex-1 text-xs font-medium" style={{ color: 'var(--text)' }}>
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-0.5 rounded-lg hover:bg-[var(--bg-input)] transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
