import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, CheckCircle2, Clock, IndianRupee, Salad, 
  Droplet, Sparkles, BookOpen, AlertCircle, Info, ChevronRight
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, 
  Tooltip, ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores/authStore';
import { useXPStore } from '@/stores/xpStore';
import { getToday, getDaysAgo, formatCurrency } from '@/lib/utils';
import { db } from '@/lib/db';
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

  const [loadingBrief, setLoadingBrief] = useState(true);
  const [brief, setBrief] = useState<BriefData | null>(null);
  
  // Weekly XP state
  const [weeklyXPData, setWeeklyXPData] = useState<{ day: string; xp: number }[]>([]);

  // Diet today states
  const [dietProgress, setDietProgress] = useState({ current: 0, target: 120 });

  // Core metrics
  const [streak, setStreak] = useState(12);
  const [tasksDone, setTasksDone] = useState(5);
  const [studyH, setStudyH] = useState(21);
  const [income, setIncome] = useState(8500);

  // Goal progress cards
  const [goals, setGoals] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const todayStr = getToday();

    // 1. Fetch diet progress
    let targetProtein = 120;
    try {
      const localProfile = await db.nutrition_profiles.toArray();
      if (localProfile.length > 0) {
        targetProtein = localProfile[0].config.protein_target || 120;
      }
      
      const localFoodLog = await db.food_logs.where({ date: todayStr }).first();
      const currentProtein = localFoodLog ? localFoodLog.total_protein : 0;
      setDietProgress({ current: currentProtein, target: targetProtein });
    } catch (e) {
      console.error(e);
    }

    // 2. Fetch goals
    try {
      const localGoals = await db.goals.toArray();
      if (localGoals.length > 0) {
        setGoals(localGoals.map((g) => ({
          name: g.name,
          current: g.current_amount || 0,
          target: g.target_amount || 1000,
          color: g.color || '#6366f1',
          icon: g.category === 'Money' ? '📷' : '✈️',
        })));
      } else {
        setGoals([
          { name: 'Camera Fund', current: 4200, target: 15000, color: '#6366f1', icon: '📷' },
          { name: 'Travel Fund', current: 8900, target: 30000, color: '#8b5cf6', icon: '✈️' },
        ]);
      }
    } catch (e) {
      console.error(e);
    }

    // 3. Fetch static logs summary
    try {
      const habits = await db.habits.toArray();
      const completions = await db.habit_completions.where({ date: todayStr }).toArray();
      setTasksDone(completions.length || 5);
      
      const activeStreak = habits.reduce((max, h) => Math.max(max, h.streak || 0), 0);
      setStreak(activeStreak > 0 ? activeStreak : 12);

      const logsLast7 = await db.daily_logs.where('date').aboveOrEqual(getDaysAgo(7)).toArray();
      const totalStudyMin = logsLast7.reduce((sum, l) => sum + (l.study_minutes || 0), 0);
      setStudyH(Math.round(totalStudyMin / 60) || 21);

      const incomeList = await db.income.toArray();
      const paidIncome = incomeList.filter((i) => i.status === 'Paid').reduce((sum, i) => sum + i.amount, 0);
      setIncome(paidIncome || 8500);
    } catch (e) {
      console.error(e);
    }

    // 4. Load AI Brief (with LocalStorage Caching)
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

    // 5. Generate Weekly XP Data from local xp logs
    generateWeeklyXPChart();
  };

  const generateWeeklyXPChart = async () => {
    try {
      const xpLogs = await db.xp_log.where('created_at').aboveOrEqual(getDaysAgo(7)).toArray();
      
      // Group by day name
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

      xpLogs.forEach((log) => {
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
      // Fallback data
      setWeeklyXPData([
        { day: 'Mon', xp: 20 },
        { day: 'Tue', xp: 45 },
        { day: 'Wed', xp: 30 },
        { day: 'Thu', xp: 60 },
        { day: 'Fri', xp: 25 },
        { day: 'Sat', xp: 90 },
        { day: 'Sun', xp: 40 },
      ]);
    }
  };

  const generateAIBrief = async () => {
    setLoadingBrief(true);
    const todayStr = getToday();

    try {
      // Gather stats context
      const logs = await db.daily_logs.where('date').aboveOrEqual(getDaysAgo(7)).toArray();
      const avgMood = logs.filter((l) => l.mood).reduce((sum, l) => sum + l.mood!, 0) / (logs.filter((l) => l.mood).length || 1);
      
      const habitsList = await db.habits.toArray();
      const streaks = habitsList.map((h) => `${h.name}: ${h.streak || 0}d`).join(', ') || 'No active habits';

      const goalsList = await db.goals.toArray();
      const goalsSummary = goalsList.map((g) => `${g.name}: ${g.current_amount || 0}/${g.target_amount || 100}`).join(', ') || 'None';

      const clientLeads = await db.income.toArray();
      const pendingCount = clientLeads.filter((c) => c.status === 'Pending').length;

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

  const displayName = profile?.display_name || 'there';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 max-w-7xl mx-auto space-y-6"
    >
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
