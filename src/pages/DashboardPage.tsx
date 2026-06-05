import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, CheckCircle2, Clock, IndianRupee, Salad, 
  Droplet, Sparkles, BookOpen, AlertCircle, Info, ChevronRight, Target
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores/authStore';
import { useXPStore } from '@/stores/xpStore';
import { useToastStore } from '@/stores/toastStore';
import { getToday, getDaysAgo, formatCurrency } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { callClaude } from '@/lib/claude';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
};

interface BriefData {
  greeting: string;
  focus: string;
  habit_reminder: string;
  insight: string;
  motivation: string;
}

export function DashboardPage() {
  const { profile } = useAuthStore();
  const { xp } = useXPStore();
  const navigate = useNavigate();
  const { showToast } = useToastStore();

  const [loadingBrief, setLoadingBrief] = useState(true);
  const [brief, setBrief] = useState<BriefData | null>(null);
  
  // Weekly XP state
  const [weeklyXPData, setWeeklyXPData] = useState<{ day: string; xp: number }[]>([]);

  // Diet today states
  const [dietProgress, setDietProgress] = useState({ current: 0, target: 120 });

  // Core metrics
  const [streak, setStreak] = useState(0);
  const [tasksDone, setTasksDone] = useState(0);
  const [studyH, setStudyH] = useState(0);
  const [income, setIncome] = useState(0);

  // Goal progress cards
  const [goals, setGoals] = useState<any[]>([]);

  // Onboarding States
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingName, setOnboardingName] = useState('');
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [onboardingApiKey, setOnboardingApiKey] = useState('');

  useEffect(() => {
    checkProfileAndLoad();
  }, []);

  async function checkProfileAndLoad() {
    if (!isSupabaseConfigured) {
      loadDashboardData();
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileRow) {
        setShowOnboarding(true);
      } else {
        loadDashboardData();
      }
    } catch (e) {
      console.error(e);
      loadDashboardData();
    }
  };

  const calculateStreak = (dateLogs: { date: string }[]) => {
    if (!dateLogs || dateLogs.length === 0) return 0;
    
    // Get unique dates sorted descending
    const dates = Array.from(new Set(dateLogs.map(l => l.date)))
      .map(d => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());
      
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const firstLogDate = new Date(dates[0]);
    firstLogDate.setHours(0, 0, 0, 0);
    
    if (firstLogDate.getTime() !== today.getTime() && firstLogDate.getTime() !== yesterday.getTime()) {
      return 0;
    }
    
    let streakVal = 1;
    let currentRef = firstLogDate;
    
    for (let i = 1; i < dates.length; i++) {
      const nextDate = new Date(dates[i]);
      nextDate.setHours(0, 0, 0, 0);
      
      const diffTime = Math.abs(currentRef.getTime() - nextDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streakVal++;
        currentRef = nextDate;
      } else if (diffDays > 1) {
        break;
      }
    }
    return streakVal;
  };

  const getStartOfWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start.toISOString().split('T')[0];
  };

  const getStartOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const loadDashboardData = async () => {
    const todayStr = getToday();

    if (!isSupabaseConfigured) {
      setGoals([]);
      setStreak(0);
      setTasksDone(0);
      setStudyH(0);
      setIncome(0);
      setLoadingBrief(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch diet progress
      let targetProtein = 120;
      const { data: profileData } = await supabase
        .from('nutrition_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileData) {
        targetProtein = profileData.protein_target || 120;
      }
      
      const { data: foodLog } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle();
      const currentProtein = foodLog ? foodLog.total_protein : 0;
      setDietProgress({ current: currentProtein, target: targetProtein });

      // 2. Fetch goals
      const { data: goalsData } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id);
      if (goalsData && goalsData.length > 0) {
        setGoals(goalsData.map((g) => ({
          name: g.name,
          current: g.current_amount || 0,
          target: g.target_amount || 1000,
          color: g.color || '#6366f1',
          icon: g.category === 'Money' ? '📷' : '✈️',
        })));
      } else {
        setGoals([]);
      }

      // 3. Fetch streak
      const { data: logsData } = await supabase
        .from('daily_logs')
        .select('date')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      setStreak(calculateStreak(logsData || []));

      // 4. Tasks done today
      const { count: tasksDoneCount } = await supabase
        .from('habit_completions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', todayStr);
      setTasksDone(tasksDoneCount || 0);

      // 5. Study hours this week
      const startOfWeekStr = getStartOfWeek();
      const { data: weekLogs } = await supabase
        .from('daily_logs')
        .select('study_minutes')
        .eq('user_id', user.id)
        .gte('date', startOfWeekStr);
      const totalStudyMin = weekLogs?.reduce((sum, l) => sum + (l.study_minutes || 0), 0) || 0;
      setStudyH(Math.round(totalStudyMin / 60));

      // 6. Income this month
      const startOfMonthStr = getStartOfMonth();
      const { data: incomeData } = await supabase
        .from('income_entries')
        .select('amount')
        .eq('user_id', user.id)
        .gte('date', startOfMonthStr);
      const totalIncome = incomeData?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;
      setIncome(totalIncome);

      // 7. Load AI Brief
      const cachedBrief = localStorage.getItem('KIRA_MORNING_BRIEF_DATA');
      const cachedBriefDate = localStorage.getItem('KIRA_MORNING_BRIEF_DATE');

      if (cachedBrief && cachedBriefDate === todayStr) {
        try {
          setBrief(JSON.parse(cachedBrief));
          setLoadingBrief(false);
        } catch {
          generateAIBrief();
        }
      } else {
        generateAIBrief();
      }

      // 8. Generate Weekly XP Data
      generateWeeklyXPChart();
    } catch (e) {
      console.error(e);
    }
  };

  const generateWeeklyXPChart = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sevenDaysAgoStr = getDaysAgo(7);
      const { data: xpLogs } = await supabase
        .from('xp_log')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', sevenDaysAgoStr);
      
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const chartPoints = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          day: days[d.getDay()],
          dateStr: d.toISOString().split('T')[0],
          xp: 0,
        };
      });

      xpLogs?.forEach((log) => {
        if (log.created_at) {
          const logDateStr = log.created_at.split('T')[0];
          const point = chartPoints.find((cp) => cp.dateStr === logDateStr);
          if (point) {
            point.xp += log.xp;
          }
        }
      });

      setWeeklyXPData(chartPoints.map((cp) => ({ day: cp.day, xp: cp.xp })));
    } catch (e) {
      console.error(e);
      setWeeklyXPData([]);
    }
  };

  const generateAIBrief = async () => {
    setLoadingBrief(true);
    const todayStr = getToday();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sevenDaysAgoStr = getDaysAgo(7);
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', sevenDaysAgoStr);
      
      const avgMood = logs && logs.length > 0
        ? logs.filter((l) => l.mood).reduce((sum, l) => sum + l.mood!, 0) / (logs.filter((l) => l.mood).length || 1)
        : 3;
      
      const { data: habitsList } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id);
      const streaks = habitsList?.map((h) => `${h.name}: ${h.streak || 0}d`).join(', ') || 'No active habits';

      const { data: goalsList } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id);
      const goalsSummary = goalsList?.map((g) => `${g.name}: ${g.current_amount || 0}/${g.target_amount || 100}`).join(', ') || 'None';

      const { data: clientLeads } = await supabase
        .from('leads')
        .select('status')
        .eq('user_id', user.id);
      const pendingCount = clientLeads?.filter((c) => c.status !== 'Completed').length || 0;

      const systemPrompt = `You are Kira, a personal life coach. Give a morning brief in exactly this JSON format (no markdown, no other text):
{
  "greeting": "personalized greeting based on time",
  "focus": "one sentence — most important thing to do today",
  "habit_reminder": "which habit needs attention based on streaks",
  "insight": "one data-driven insight from recent logs",
  "motivation": "one short punchy line"
}`;

      const userPrompt = `User context: Last 7 days mood average: ${avgMood.toFixed(1)}/5, Current streaks: ${streaks}, Study hours this week: ${studyH}h, Goals progress: ${goalsSummary}, Pending leads: ${pendingCount}`;

      const response = await callClaude(systemPrompt, [{ role: 'user', content: userPrompt }]);
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.greeting && parsed.focus) {
        setBrief(parsed);
        localStorage.setItem('KIRA_MORNING_BRIEF_DATA', JSON.stringify(parsed));
        localStorage.setItem('KIRA_MORNING_BRIEF_DATE', todayStr);
      }
    } catch (err) {
      console.error('Failed to generate AI morning brief:', err);
      setBrief({
        greeting: `Welcome back, ${profile?.display_name || 'there'}!`,
        focus: 'Focus on keeping your streak alive by reviewing your daily tracker goals.',
        habit_reminder: 'Remember to track your water and diet completion status.',
        insight: 'Your consistency is improving. Aim to keep up this pace.',
        motivation: 'Small steps every single day lead to massive results.',
      });
    } finally {
      setLoadingBrief(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!onboardingName.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Save profile to Supabase
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        display_name: onboardingName,
        theme: 'system',
      });
      if (profileError) throw profileError;

      // Update auth store profile state
      useAuthStore.setState({
        profile: {
          display_name: onboardingName,
          avatar_url: '',
          theme: 'system',
        },
      });

      // 2. Save goals if selected
      if (selectedPresets.includes('camera')) {
        await supabase.from('goals').insert({
          user_id: user.id,
          name: 'Camera Fund',
          target_amount: 15000,
          current_amount: 0,
          category: 'Money',
          color: '#6366f1',
        });
      }
      if (selectedPresets.includes('travel')) {
        await supabase.from('goals').insert({
          user_id: user.id,
          name: 'Travel Fund',
          target_amount: 30000,
          current_amount: 0,
          category: 'Travel',
          color: '#8b5cf6',
        });
      }

      // 3. Save API key if provided
      if (onboardingApiKey.trim()) {
        localStorage.setItem('KIRA_GEMINI_KEY', onboardingApiKey.trim());
        localStorage.setItem('KIRA_CLAUDE_KEY', onboardingApiKey.trim());
      }

      // 4. Trigger XP log for onboarding
      await supabase.from('xp_log').insert({
        user_id: user.id,
        action: 'onboarding_completed',
        xp: 50,
      });

      // Re-init XP
      await useXPStore.getState().initXP();

      showToast('Welcome to Kira! Onboarding complete.', 'success');
      setShowOnboarding(false);
      loadDashboardData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to complete onboarding', 'error');
    }
  };

  const displayName = profile?.display_name || 'there';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 max-w-7xl mx-auto space-y-6"
    >
      {/* Onboarding Overlay */}
      <AnimatePresence>
        {showOnboarding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-6 shadow-2xl text-left"
            >
              {onboardingStep === 1 && (
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <Sparkles className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Welcome to Kira!</h3>
                    <p className="text-xs text-zinc-400 mt-1">Let's get your profile set up. What is your name?</p>
                  </div>
                  <input
                    type="text"
                    value={onboardingName}
                    onChange={(e) => setOnboardingName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-zinc-950 border border-zinc-805 text-white focus:outline-none focus:border-primary"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
                  />
                  <button
                    onClick={() => {
                      if (onboardingName.trim()) setOnboardingStep(2);
                    }}
                    disabled={!onboardingName.trim()}
                    className="w-full py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-semibold text-xs rounded-xl disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <Target className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Set Your First Goal</h3>
                    <p className="text-xs text-zinc-400 mt-1">Select one or both preset goals to jumpstart your tracking, or skip to define your own later.</p>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setSelectedPresets(prev =>
                          prev.includes('camera') ? prev.filter(p => p !== 'camera') : [...prev, 'camera']
                        );
                      }}
                      className="w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-colors"
                      style={{
                        borderColor: selectedPresets.includes('camera') ? 'var(--color-primary)' : 'var(--border)',
                        background: selectedPresets.includes('camera') ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      }}
                    >
                      <div>
                        <p className="text-xs font-semibold text-white">📷 Camera Fund</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Target: ₹15,000</p>
                      </div>
                      <div className="w-4 h-4 rounded border flex items-center justify-center border-zinc-700">
                        {selectedPresets.includes('camera') && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" />}
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedPresets(prev =>
                          prev.includes('travel') ? prev.filter(p => p !== 'travel') : [...prev, 'travel']
                        );
                      }}
                      className="w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-colors"
                      style={{
                        borderColor: selectedPresets.includes('travel') ? 'var(--color-primary)' : 'var(--border)',
                        background: selectedPresets.includes('travel') ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      }}
                    >
                      <div>
                        <p className="text-xs font-semibold text-white">✈️ Travel Fund</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Target: ₹30,000</p>
                      </div>
                      <div className="w-4 h-4 rounded border flex items-center justify-center border-zinc-700">
                        {selectedPresets.includes('travel') && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" />}
                      </div>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOnboardingStep(3)}
                      className="flex-1 py-2.5 border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-semibold rounded-xl"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => setOnboardingStep(3)}
                      className="flex-1 py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-semibold text-xs rounded-xl"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <Info className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Unlock AI Coach Features</h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Kira uses Gemini for coaching, planning, and journal reflections. Add your Gemini API key (optional). You can get one from{' '}
                      <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold">
                        Google AI Studio
                      </a>.
                    </p>
                  </div>
                  <input
                    type="password"
                    value={onboardingApiKey}
                    onChange={(e) => setOnboardingApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-primary"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
                  />
                  <button
                    onClick={handleCompleteOnboarding}
                    className="w-full py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-semibold text-xs rounded-xl"
                  >
                    Finish Onboarding
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hero Greeting Panel */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl p-6 md:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
          border: '1px solid rgba(99,102,241,0.15)',
        }}
      >
        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--text)' }}>
            Welcome back, {displayName} 👋
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Quick stats metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {[
            { icon: Flame, label: 'Streak', value: `${streak} days`, color: '#f59e0b' },
            { icon: CheckCircle2, label: 'Tasks done', value: String(tasksDone), color: '#10b981' },
            { icon: Clock, label: 'Study hours', value: `${studyH}h this week`, color: '#6366f1' },
            { icon: IndianRupee, label: 'Income', value: formatCurrency(income), color: '#06b6d4' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              whileHover={{ scale: 1.02 }}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${stat.color}18`, color: stat.color }}
              >
                <stat.icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* AI Morning Brief & Diet Summary Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Upgraded AI Brief Card (Col size: 2) */}
        <motion.div variants={itemVariants} className="md:col-span-2">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
            <Sparkles size={16} className="text-primary" /> AI Coach Briefing
          </h3>
          <div
            className="rounded-2xl p-5 md:p-6 min-h-[200px] flex flex-col justify-between"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {loadingBrief ? (
              <div className="space-y-4 py-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : brief ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-primary">{brief.greeting}</p>
                  <p className="text-sm font-semibold text-white mt-1">{brief.focus}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-800/40 pt-4 text-xs text-zinc-400">
                  <div className="space-y-0.5">
                    <p className="text-[9px] uppercase font-bold text-zinc-500">Streak Reminder</p>
                    <p>{brief.habit_reminder}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] uppercase font-bold text-zinc-500">Data Insight</p>
                    <p>{brief.insight}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-800/40 pt-3 text-[10px] text-zinc-500 italic">
                  <span>"{brief.motivation}"</span>
                  <button onClick={generateAIBrief} className="text-primary hover:underline font-semibold not-italic">Refresh</button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Failed to construct brief.</p>
            )}
          </div>
        </motion.div>

        {/* Diet Summary Card (Col size: 1) */}
        <motion.div variants={itemVariants}>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
            <Salad size={16} className="text-success" /> Today's Nutrition
          </h3>
          <Link
            to="/diet"
            className="group block rounded-2xl p-5 md:p-6 space-y-4 hover:border-zinc-700 transition-colors"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Protein Target</p>
              <h2 className="text-3xl font-black text-white mt-1">
                {dietProgress.current} <span className="text-sm font-medium text-zinc-500">/ {dietProgress.target}g</span>
              </h2>
            </div>

            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (dietProgress.current / dietProgress.target) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-500 flex justify-between">
                <span>{Math.round((dietProgress.current / dietProgress.target) * 100)}% met</span>
                <span className="group-hover:text-primary transition-colors flex items-center gap-0.5">
                  Update Log <ChevronRight size={10} />
                </span>
              </p>
            </div>
          </Link>
        </motion.div>

      </div>

      {/* Goals Progress */}
      <motion.div variants={itemVariants}>
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>Goal Progress</h3>
        {goals.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible">
            {goals.map((goal) => {
              const progress = (goal.current / goal.target) * 100;
              return (
                <motion.div
                  key={goal.name}
                  whileHover={{ scale: 1.02 }}
                  className="min-w-[260px] md:min-w-0 rounded-2xl p-5 flex items-center gap-5"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <ProgressRing progress={progress} size={80} strokeWidth={6} color={goal.color}>
                    <span className="text-xl">{goal.icon}</span>
                  </ProgressRing>
                  <div>
                    <p className="text-sm font-semibold text-zinc-300">{goal.name}</p>
                    <p className="text-lg font-black" style={{ color: 'var(--text)' }}>
                      {formatCurrency(goal.current)}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      of {formatCurrency(goal.target)} ({Math.round(progress)}%)
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl p-6 text-center border border-dashed border-zinc-800 bg-zinc-900/20 text-xs text-zinc-500">
            No goals yet — add your first goal in Life Tracker
          </div>
        )}
      </motion.div>

      {/* Gamification Chart (Weekly XP Graph) */}
      <motion.div variants={itemVariants}>
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h4 className="text-sm font-bold mb-4" style={{ color: 'var(--text)' }}>
            <Flame size={14} className="inline mr-1.5 text-warning" />
            Weekly XP Growth
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyXPData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="xp" fill="var(--color-primary)" radius={[4, 4, 0, 0]} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
