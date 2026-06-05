import { create } from 'zustand';

export function playBellSound() {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonious chime frequencies
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const gains = [0.4, 0.2, 0.15, 0.1];

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      gainNode.gain.setValueAtTime(gains[i], now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2); // Decay over 1.2s

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.2);
    });
  } catch (e) {
    console.error('Failed to play synthesized audio:', e);
  }
}

interface FocusState {
  overlayOpen: boolean;
  timerActive: boolean;
  timeLeft: number; // in seconds
  isBreak: boolean;
  sessionCount: number;
  taskName: string;
  workDuration: number; // in minutes
  breakDuration: number; // in minutes
  openOverlay: () => void;
  closeOverlay: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  setTaskName: (name: string) => void;
  setDurations: (work: number, breakTime: number) => void;
  tick: () => void;
}

let intervalId: any = null;

export const useFocusStore = create<FocusState>((set, get) => ({
  overlayOpen: false,
  timerActive: false,
  timeLeft: 25 * 60,
  isBreak: false,
  sessionCount: 1,
  taskName: '',
  workDuration: 25,
  breakDuration: 5,

  openOverlay: () => set({ overlayOpen: true }),
  closeOverlay: () => set({ overlayOpen: false }),

  startTimer: () => {
    if (get().timerActive) return;
    set({ timerActive: true });
    
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      get().tick();
    }, 1000);
  },

  pauseTimer: () => {
    set({ timerActive: false });
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },

  resetTimer: () => {
    set({
      timerActive: false,
      timeLeft: get().isBreak ? get().breakDuration * 60 : get().workDuration * 60,
    });
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },

  setTaskName: (taskName) => set({ taskName }),

  setDurations: (workDuration, breakDuration) => {
    const wasActive = get().timerActive;
    if (wasActive && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    set({
      workDuration,
      breakDuration,
      timeLeft: get().isBreak ? breakDuration * 60 : workDuration * 60,
      timerActive: false,
    });
  },

  tick: async () => {
    const { timeLeft, isBreak, workDuration, breakDuration, sessionCount, taskName } = get();

    if (timeLeft <= 1) {
      set({ timerActive: false });
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      // Bell sound Alert
      playBellSound();

      // Confetti burst
      import('canvas-confetti').then((confetti) => {
        confetti.default({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      });

      if (!isBreak) {
        // Log XP
        try {
          const { useXPStore } = await import('./xpStore');
          useXPStore.getState().awardXP(`Pomodoro: ${taskName || 'Focus Session'}`, 15);
        } catch (err) {
          console.error(err);
        }

        // Toggle to break
        set({
          isBreak: true,
          timeLeft: breakDuration * 60,
        });
      } else {
        // Toggle to work
        set({
          isBreak: false,
          timeLeft: workDuration * 60,
          sessionCount: sessionCount < 4 ? sessionCount + 1 : 1,
        });
      }
    } else {
      set({ timeLeft: timeLeft - 1 });
    }
  },
}));
