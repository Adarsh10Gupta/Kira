export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateId(): string {
  return crypto.randomUUID();
}

const motivationalQuotes = [
  "Small steps every day lead to big results.",
  "Your only limit is your mind.",
  "Discipline is choosing between what you want now and what you want most.",
  "The secret of getting ahead is getting started.",
  "Don't watch the clock; do what it does — keep going.",
  "Success is the sum of small efforts, repeated day in and day out.",
  "You don't have to be great to start, but you have to start to be great.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "It's not about perfect. It's about effort.",
  "Believe you can and you're halfway there.",
  "Your future is created by what you do today, not tomorrow.",
  "Work hard in silence, let your success be the noise.",
  "Stay focused, stay humble, stay hungry.",
];

export function getRandomQuote(): string {
  const today = new Date().toDateString();
  const seed = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return motivationalQuotes[seed % motivationalQuotes.length];
}

export function getMoodEmoji(mood: number): string {
  const emojis: Record<number, string> = {
    1: '😞',
    2: '😔',
    3: '😐',
    4: '😊',
    5: '😄',
  };
  return emojis[mood] || '😐';
}

export function getMoodLabel(mood: number): string {
  const labels: Record<number, string> = {
    1: 'Awful',
    2: 'Bad',
    3: 'Okay',
    4: 'Good',
    5: 'Great',
  };
  return labels[mood] || 'Okay';
}

export function getMoodColor(mood: number): string {
  const colors: Record<number, string> = {
    1: '#ef4444',
    2: '#f97316',
    3: '#f59e0b',
    4: '#10b981',
    5: '#22c55e',
  };
  return colors[mood] || '#f59e0b';
}
