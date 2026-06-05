import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, X, Clock, Settings2 } from 'lucide-react';
import { useFocusStore } from '@/stores/focusStore';

export function FocusOverlay() {
  const {
    overlayOpen,
    timerActive,
    timeLeft,
    isBreak,
    sessionCount,
    taskName,
    workDuration,
    breakDuration,
    openOverlay,
    closeOverlay,
    startTimer,
    pauseTimer,
    resetTimer,
    setTaskName,
    setDurations,
  } = useFocusStore();

  const [showConfig, setShowConfig] = useState(false);
  const [localWork, setLocalWork] = useState(String(workDuration));
  const [localBreak, setLocalBreak] = useState(String(breakDuration));

  // Sync inputs with store values
  useEffect(() => {
    setLocalWork(String(workDuration));
    setLocalBreak(String(breakDuration));
  }, [workDuration, breakDuration]);

  const totalSeconds = isBreak ? breakDuration * 60 : workDuration * 60;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = timeLeft / totalSeconds;

  // SVG parameters for progress ring
  const radius = 120;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  const handleSaveConfig = () => {
    const w = Math.max(1, Number(localWork) || 25);
    const b = Math.max(1, Number(localBreak) || 5);
    setDurations(w, b);
    setShowConfig(false);
  };

  return (
    <>
      {/* Floating Focus trigger button */}
      {!overlayOpen && (
        <motion.button
          onClick={openOverlay}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg text-white bg-gradient-to-br from-primary to-secondary"
          style={{ boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)' }}
        >
          {timerActive ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
            >
              <Clock size={20} />
            </motion.div>
          ) : (
            <Clock size={20} />
          )}
          {timerActive && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger rounded-full flex items-center justify-center text-[10px] font-bold">
              {minutes}
            </span>
          )}
        </motion.button>
      )}

      {/* Fullscreen Overlay */}
      <AnimatePresence>
        {overlayOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-xl"
            style={{ background: 'rgba(15, 17, 23, 0.96)' }}
          >
            {/* Close button */}
            <button
              onClick={closeOverlay}
              className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Circular Timer Display */}
            <div className="relative flex items-center justify-center w-72 h-72 mb-8">
              {/* Outer Glow Ring */}
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle
                  className="text-zinc-800"
                  strokeWidth={stroke}
                  stroke="currentColor"
                  fill="transparent"
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                  style={{ transform: 'scale(1.2)', transformOrigin: 'center' }}
                />
                <motion.circle
                  stroke={isBreak ? '#10b981' : '#6366f1'}
                  fill="transparent"
                  strokeWidth={stroke}
                  strokeDasharray={circumference + ' ' + circumference}
                  style={{
                    strokeDashoffset,
                    transform: 'scale(1.2)',
                    transformOrigin: 'center',
                    transition: 'stroke-dashoffset 0.35s',
                  }}
                  strokeLinecap="round"
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
              </svg>

              {/* Time display text */}
              <div className="text-center z-10">
                <p className="text-xs uppercase tracking-widest font-semibold text-zinc-400 mb-1">
                  {isBreak ? 'Break Session ☕' : 'Focus Time ⚡'}
                </p>
                <h1 className="text-6xl font-bold font-mono tracking-tight text-white mb-2">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </h1>
                <p className="text-xs text-zinc-400">
                  Session {sessionCount} of 4
                </p>
              </div>
            </div>

            {/* Config Form OR Task input */}
            <div className="w-full max-w-sm text-center mb-8">
              {showConfig ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-left space-y-4">
                  <h3 className="text-sm font-semibold text-white">Timer Settings</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Focus (min)</label>
                      <input
                        type="number"
                        value={localWork}
                        onChange={(e) => setLocalWork(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Break (min)</label>
                      <input
                        type="number"
                        value={localBreak}
                        onChange={(e) => setLocalBreak(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveConfig}
                      className="flex-1 py-2 bg-primary text-white text-xs font-semibold rounded-xl"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowConfig(false)}
                      className="px-4 py-2 border border-zinc-700 text-zinc-400 text-xs rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {!isBreak && (
                    <input
                      type="text"
                      placeholder="What are you focusing on?"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      className="w-full text-center px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
                    />
                  )}
                  {isBreak && (
                    <p className="text-sm text-zinc-300">Take a deep breath and stretch.</p>
                  )}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => setShowConfig(!showConfig)}
                disabled={timerActive}
                className="p-3 bg-zinc-900 text-zinc-400 hover:text-white disabled:opacity-30 rounded-full transition-all"
              >
                <Settings2 size={18} />
              </button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={timerActive ? pauseTimer : startTimer}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white ${
                  timerActive ? 'bg-zinc-850 hover:bg-zinc-800 border border-zinc-700' : 'bg-primary hover:opacity-90'
                }`}
              >
                {timerActive ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </motion.button>

              <button
                onClick={resetTimer}
                className="p-3 bg-zinc-900 text-zinc-400 hover:text-white rounded-full transition-all"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
