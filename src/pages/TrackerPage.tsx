import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Target, IndianRupee, Zap,
  Plus, Trash2, Check, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  formatCurrency, formatDate, getToday, getMoodEmoji, getMoodLabel, getDaysAgo
} from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useXPStore } from '@/stores/xpStore';
import { useToastStore } from '@/stores/toastStore';

type TrackerTab = 'daily' | 'goals' | 'income' | 'habits';

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  category: string;
  color: string;
  deadline: string;
}

interface IncomeEntry {
  id: string;
  client_name: string;
  project_type: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'In Progress';
  date: string;
}

interface Habit {
  id: string;
  name: string;
  frequency: string;
  category: string;
  icon: string;
  streak: number;
}

const tabConfig: { key: TrackerTab; label: string; icon: typeof Calendar }[] = [
  { key: 'daily', label: 'Daily Log', icon: Calendar },
  { key: 'goals', label: 'Goals', icon: Target },
  { key: 'income', label: 'Income', icon: IndianRupee },
  { key: 'habits', label: 'Habits', icon: Zap },
];

export function TrackerPage() {
  const [activeTab, setActiveTab] = useState<TrackerTab>('daily');

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--bg-input)' }}>
        {tabConfig.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1"
            style={{
              background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab.key ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'daily' && <DailyLogTab />}
          {activeTab === 'goals' && <GoalsTab />}
          {activeTab === 'income' && <IncomeTab />}
          {activeTab === 'habits' && <HabitsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ==================== DAILY LOG TAB ==================== */
function DailyLogTab() {
  const [date, setDate] = useState(getToday());
  const [mood, setMood] = useState(0);
  const [energy, setEnergy] = useState(5);
  const [sleepHours, setSleepHours] = useState('');
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [meals, setMeals] = useState({ breakfast: false, lunch: false, dinner: false, snacks: false });
  const [exerciseEnabled, setExerciseEnabled] = useState(false);
  const [exerciseMinutes, setExerciseMinutes] = useState('');
  const [studyMinutes, setStudyMinutes] = useState('');
  const [studyTopic, setStudyTopic] = useState('');
  const [oneWin, setOneWin] = useState('');
  const [oneImprove, setOneImprove] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [saved, setSaved] = useState(false);
  
  const { awardXP } = useXPStore();
  const { showToast } = useToastStore();

  useEffect(() => {
    loadDailyLog();
  }, [date]);

  async function loadDailyLog() {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle();

      if (data) {
        setMood(data.mood || 0);
        setEnergy(data.energy || 5);
        setSleepHours(data.sleep_hours ? String(data.sleep_hours) : '');
        setWaterGlasses(data.water_glasses || 0);
        setMeals(data.meals || { breakfast: false, lunch: false, dinner: false, snacks: false });
        setExerciseEnabled(Boolean(data.exercise_minutes));
        setExerciseMinutes(data.exercise_minutes ? String(data.exercise_minutes) : '');
        setStudyMinutes(data.study_minutes ? String(data.study_minutes) : '');
        setStudyTopic(data.study_topic || '');
        setOneWin(data.one_win || '');
        setOneImprove(data.one_improve || '');
        setGratitude(data.gratitude || '');
      } else {
        setMood(0);
        setEnergy(5);
        setSleepHours('');
        setWaterGlasses(0);
        setMeals({ breakfast: false, lunch: false, dinner: false, snacks: false });
        setExerciseEnabled(false);
        setExerciseMinutes('');
        setStudyMinutes('');
        setStudyTopic('');
        setOneWin('');
        setOneImprove('');
        setGratitude('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('daily_logs').upsert({
        user_id: user.id,
        date,
        mood,
        energy,
        sleep_hours: sleepHours ? Number(sleepHours) : null,
        water_glasses: waterGlasses,
        meals,
        exercise_minutes: exerciseEnabled && exerciseMinutes ? Number(exerciseMinutes) : null,
        study_minutes: studyMinutes ? Number(studyMinutes) : null,
        study_topic: studyTopic,
        one_win: oneWin,
        one_improve: oneImprove,
        gratitude,
      }, { onConflict: 'user_id,date' });

      if (error) throw error;

      await awardXP('daily_log', 20);
      showToast('Daily log saved! +20 XP', 'success');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to save daily log', 'error');
    }
  };

  const inputStyle = {
    background: 'var(--bg-input)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  };

  return (
    <div className="space-y-5">
      {/* Date picker */}
      <div className="flex items-center gap-3">
        <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm"
          style={inputStyle}
        />
      </div>

      <div
        className="rounded-2xl p-5 space-y-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
      >
        {/* Mood */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
            Mood
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((m) => (
              <motion.button
                key={m}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMood(m)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
                style={{
                  background: mood === m ? `${['#ef4444', '#f97316', '#f59e0b', '#10b981', '#22c55e'][m - 1]}18` : 'transparent',
                  border: mood === m ? `2px solid ${['#ef4444', '#f97316', '#f59e0b', '#10b981', '#22c55e'][m - 1]}` : '2px solid transparent',
                }}
              >
                <span className="text-2xl">{getMoodEmoji(m)}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{getMoodLabel(m)}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
            Energy Level: {energy}/10
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={energy}
            onChange={(e) => setEnergy(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        {/* Sleep & Water */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
              Sleep (hours)
            </label>
            <input
              type="number"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="7.5"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>
              Water (glasses)
            </label>
            <div className="flex items-center gap-2">
              <button onClick={() => setWaterGlasses(Math.max(0, waterGlasses - 1))} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>-</button>
              <span className="text-lg font-bold w-8 text-center" style={{ color: 'var(--color-accent)' }}>{waterGlasses}</span>
              <button onClick={() => setWaterGlasses(Math.min(10, waterGlasses + 1))} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>+</button>
            </div>
          </div>
        </div>

        {/* Meals */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Meals</label>
          <div className="flex flex-wrap gap-2">
            {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map((meal) => (
              <button
                key={meal}
                onClick={() => setMeals((prev) => ({ ...prev, [meal]: !prev[meal] }))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                style={{
                  background: meals[meal] ? 'var(--color-primary)' : 'var(--bg-input)',
                  color: meals[meal] ? 'white' : 'var(--text-muted)',
                  border: `1px solid ${meals[meal] ? 'var(--color-primary)' : 'var(--border)'}`,
                }}
              >
                {meal}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Exercise</label>
            <button
              onClick={() => setExerciseEnabled(!exerciseEnabled)}
              className="w-10 h-5 rounded-full transition-colors relative"
              style={{ background: exerciseEnabled ? 'var(--color-primary)' : 'var(--border)' }}
            >
              <motion.div
                className="w-4 h-4 rounded-full bg-white absolute top-0.5"
                animate={{ left: exerciseEnabled ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
          {exerciseEnabled && (
            <input
              type="number"
              value={exerciseMinutes}
              onChange={(e) => setExerciseMinutes(e.target.value)}
              placeholder="Minutes"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={inputStyle}
            />
          )}
        </div>

        {/* Study */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>Study (min)</label>
            <input
              type="number"
              value={studyMinutes}
              onChange={(e) => setStudyMinutes(e.target.value)}
              placeholder="45"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>Topic</label>
            <input
              type="text"
              value={studyTopic}
              onChange={(e) => setStudyTopic(e.target.value)}
              placeholder="e.g. PyTorch basics"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Reflections */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>🏆 One win today</label>
          <input
            type="text"
            value={oneWin}
            onChange={(e) => setOneWin(e.target.value)}
            placeholder="What went well?"
            className="w-full px-3 py-2 rounded-xl text-sm"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>📈 One thing to improve</label>
          <input
            type="text"
            value={oneImprove}
            onChange={(e) => setOneImprove(e.target.value)}
            placeholder="What could be better?"
            className="w-full px-3 py-2 rounded-xl text-sm"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>🙏 Gratitude</label>
          <textarea
            value={gratitude}
            onChange={(e) => setGratitude(e.target.value)}
            placeholder="What are you grateful for today?"
            rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm resize-none"
            style={inputStyle}
          />
        </div>

        {/* Save */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <Check size={16} />
              Saved!
            </>
          ) : (
            'Save daily log'
          )}
        </motion.button>
      </div>
    </div>
  );
}

/* ==================== GOALS TAB ==================== */
function GoalsTab() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: '', target_amount: '', current_amount: '', category: 'Money', color: '#6366f1', deadline: '' });
  const { showToast } = useToastStore();

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id);
      setGoals(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const addGoal = async () => {
    if (!newGoal.name || !newGoal.target_amount) return;
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: insertedGoal, error } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          name: newGoal.name,
          target_amount: Number(newGoal.target_amount),
          current_amount: Number(newGoal.current_amount) || 0,
          category: newGoal.category,
          color: newGoal.color,
          deadline: newGoal.deadline || null,
        })
        .select()
        .single();

      if (error) throw error;
      if (insertedGoal) {
        setGoals((prev) => [...prev, insertedGoal]);
        showToast('Goal added successfully!', 'success');
      }

      setNewGoal({ name: '', target_amount: '', current_amount: '', category: 'Money', color: '#6366f1', deadline: '' });
      setShowAddForm(false);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to add goal', 'error');
    }
  };

  const deleteGoal = async (id: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setGoals((prev) => prev.filter((g) => g.id !== id));
      showToast('Goal deleted', 'info');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to delete goal', 'error');
    }
  };

  const updateGoalProgress = async (id: string, newAmount: number) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('goals')
        .update({ current_amount: newAmount })
        .eq('id', id);

      if (error) throw error;
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, current_amount: newAmount } : g)));
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to update goal progress', 'error');
    }
  };

  const inputStyle = { background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Your Goals</h3>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-primary to-secondary"
        >
          <Plus size={14} />
          Add Goal
        </motion.button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <input type="text" placeholder="Goal name" value={newGoal.name} onChange={(e) => setNewGoal((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-xl text-sm" style={inputStyle} />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Target (₹)" value={newGoal.target_amount} onChange={(e) => setNewGoal((p) => ({ ...p, target_amount: e.target.value }))} className="w-full px-3 py-2 rounded-xl text-sm" style={inputStyle} />
              <input type="number" placeholder="Current (₹)" value={newGoal.current_amount} onChange={(e) => setNewGoal((p) => ({ ...p, current_amount: e.target.value }))} className="w-full px-3 py-2 rounded-xl text-sm" style={inputStyle} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select value={newGoal.category} onChange={(e) => setNewGoal((p) => ({ ...p, category: e.target.value }))} className="px-3 py-2 rounded-xl text-sm" style={inputStyle}>
                {['Money', 'Health', 'Learning', 'Travel', 'Other'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="color" value={newGoal.color} onChange={(e) => setNewGoal((p) => ({ ...p, color: e.target.value }))} className="w-full h-9 rounded-xl cursor-pointer" />
              <input type="date" value={newGoal.deadline} onChange={(e) => setNewGoal((p) => ({ ...p, deadline: e.target.value }))} className="px-3 py-2 rounded-xl text-sm" style={inputStyle} />
            </div>
            <div className="flex gap-2">
              <button onClick={addGoal} className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary">Add</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-xl text-sm" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goal cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {goals.map((goal) => {
          const progress = (goal.current_amount / goal.target_amount) * 100;
          return (
            <motion.div
              key={goal.id}
              whileHover={{ scale: 1.02 }}
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <ProgressRing progress={progress} size={70} strokeWidth={5} color={goal.color}>
                <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{Math.round(progress)}%</span>
              </ProgressRing>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{goal.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => updateGoalProgress(goal.id, Math.max(0, goal.current_amount - 1000))}
                    className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-750 flex items-center justify-center text-[10px] text-zinc-400 font-bold"
                  >
                    -
                  </button>
                  <p className="text-lg font-bold" style={{ color: goal.color }}>{formatCurrency(goal.current_amount)}</p>
                  <button
                    onClick={() => updateGoalProgress(goal.id, Math.min(goal.target_amount, goal.current_amount + 1000))}
                    className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-750 flex items-center justify-center text-[10px] text-zinc-400 font-bold"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>of {formatCurrency(goal.target_amount)}</p>
                {goal.deadline && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Due: {formatDate(goal.deadline)}</p>}
              </div>
              <button onClick={() => deleteGoal(goal.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: 'var(--text-muted)' }}>
                <Trash2 size={14} />
              </button>
            </motion.div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <EmptyState icon={<Target size={28} />} title="No goals yet" description="No goals yet — add your first goal in Life Tracker" />
      )}
    </div>
  );
}

/* ==================== INCOME TAB ==================== */
function IncomeTab() {
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState<{
    client_name: string;
    project_type: string;
    amount: string;
    status: IncomeEntry['status'];
    date: string;
  }>({ client_name: '', project_type: 'Landing page', amount: '', status: 'Paid', date: getToday() });
  
  const { awardXP } = useXPStore();
  const { showToast } = useToastStore();

  useEffect(() => {
    loadIncome();
  }, []);

  async function loadIncome() {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('income_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      setEntries(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const totalPaid = entries.filter((e) => e.status === 'Paid').reduce((s, e) => s + e.amount, 0);
  const totalPending = entries.filter((e) => e.status === 'Pending').reduce((s, e) => s + e.amount, 0);

  const monthlyData = entries.reduce((acc, entry) => {
    const month = new Date(entry.date).toLocaleString('en-IN', { month: 'short' });
    const existing = acc.find((a) => a.month === month);
    if (existing) existing.amount += entry.amount;
    else acc.push({ month, amount: entry.amount });
    return acc;
  }, [] as { month: string; amount: number }[]);

  const addEntry = async () => {
    if (!newEntry.client_name || !newEntry.amount) return;
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: insertedEntry, error } = await supabase
        .from('income_entries')
        .insert({
          user_id: user.id,
          client_name: newEntry.client_name,
          project_type: newEntry.project_type,
          amount: Number(newEntry.amount),
          status: newEntry.status,
          date: newEntry.date,
        })
        .select()
        .single();

      if (error) throw error;
      if (insertedEntry) {
        setEntries((prev) => [insertedEntry, ...prev]);
        await awardXP('income_logged', 10);
        showToast('Income logged! +10 XP', 'success');
      }

      setNewEntry({ client_name: '', project_type: 'Landing page', amount: '', status: 'Paid', date: getToday() });
      setShowAddForm(false);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to log income', 'error');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('income_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEntries((prev) => prev.filter((e) => e.id !== id));
      showToast('Income entry deleted', 'info');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to delete income entry', 'error');
    }
  };

  const inputStyle = { background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' };

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total earned</p>
          <p className="text-xl font-bold text-success">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Pending</p>
          <p className="text-xl font-bold text-warning">{formatCurrency(totalPending)}</p>
        </div>
      </div>

      {/* Chart */}
      {monthlyData.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Monthly Income</h4>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} animationDuration={1200} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Add entry */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Entries</h3>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-primary to-secondary">
          <Plus size={14} /> Add
        </motion.button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Client name" value={newEntry.client_name} onChange={(e) => setNewEntry((p) => ({ ...p, client_name: e.target.value }))} className="w-full px-3 py-2 rounded-xl text-sm" style={inputStyle} />
              <input type="number" placeholder="Amount (₹)" value={newEntry.amount} onChange={(e) => setNewEntry((p) => ({ ...p, amount: e.target.value }))} className="w-full px-3 py-2 rounded-xl text-sm" style={inputStyle} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select value={newEntry.project_type} onChange={(e) => setNewEntry((p) => ({ ...p, project_type: e.target.value }))} className="px-3 py-2 rounded-xl text-sm" style={inputStyle}>
                {['Landing page', 'Full website', 'Link-in-bio', 'Portfolio', 'E-commerce'].map((t) => <option key={t}>{t}</option>)}
              </select>
              <select value={newEntry.status} onChange={(e) => setNewEntry((p) => ({ ...p, status: e.target.value as IncomeEntry['status'] }))} className="px-3 py-2 rounded-xl text-sm" style={inputStyle}>
                <option>Paid</option><option>Pending</option><option>In Progress</option>
              </select>
              <input type="date" value={newEntry.date} onChange={(e) => setNewEntry((p) => ({ ...p, date: e.target.value }))} className="px-3 py-2 rounded-xl text-sm" style={inputStyle} />
            </div>
            <button onClick={addEntry} className="w-full py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary">Add Entry</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries list */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            layout
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{entry.client_name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{entry.project_type} · {formatDate(entry.date)}</p>
            </div>
            <div className="text-right flex items-center gap-3">
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{formatCurrency(entry.amount)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  entry.status === 'Paid' ? 'bg-success/15 text-success' :
                  entry.status === 'Pending' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'
                }`}>{entry.status}</span>
              </div>
              <button onClick={() => deleteEntry(entry.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: 'var(--text-muted)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {entries.length === 0 && (
        <EmptyState icon={<IndianRupee size={28} />} title="No entries logged yet" description="No income logged yet — track your first project" />
      )}
    </div>
  );
}

/* ==================== HABITS TAB ==================== */
function HabitsTab() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayCompleted, setTodayCompleted] = useState<Set<string>>(new Set());
  const [completionsLast7, setCompletionsLast7] = useState<Record<string, Set<string>>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', frequency: 'daily', category: 'Health', icon: '⭐' });

  const { awardXP } = useXPStore();
  const { showToast } = useToastStore();
  const today = getToday();

  useEffect(() => {
    loadHabits();
  }, []);

  async function loadHabits() {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: habitsData } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id);
      
      const { data: completionsData } = await supabase
        .from('habit_completions')
        .select('habit_id')
        .eq('user_id', user.id)
        .eq('date', today);

      const { data: completions7Data } = await supabase
        .from('habit_completions')
        .select('habit_id, date')
        .eq('user_id', user.id)
        .gte('date', getDaysAgo(7));

      setHabits(habitsData || []);
      setTodayCompleted(new Set(completionsData?.map((c) => c.habit_id) || []));

      const completionsMap: Record<string, Set<string>> = {};
      completions7Data?.forEach((row) => {
        if (!completionsMap[row.habit_id]) {
          completionsMap[row.habit_id] = new Set();
        }
        completionsMap[row.habit_id].add(row.date);
      });
      setCompletionsLast7(completionsMap);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleHabit = async (habitId: string) => {
    if (!isSupabaseConfigured) return;
    const isCompleted = todayCompleted.has(habitId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isCompleted) {
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('date', today);
        if (error) throw error;
        setTodayCompleted((prev) => {
          const next = new Set(prev);
          next.delete(habitId);
          return next;
        });
        showToast('Habit completion removed', 'info');
      } else {
        const { error } = await supabase
          .from('habit_completions')
          .insert({
            user_id: user.id,
            habit_id: habitId,
            date: today,
          });
        if (error) throw error;
        setTodayCompleted((prev) => {
          const next = new Set(prev);
          next.add(habitId);
          return next;
        });
        await awardXP('habit_done', 10);
        showToast('Habit completed! +10 XP', 'success');
      }
      
      // Reload completions list
      loadHabits();
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to update habit', 'error');
    }
  };

  const addHabit = async () => {
    if (!newHabit.name) return;
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: insertedHabit, error } = await supabase
        .from('habits')
        .insert({
          user_id: user.id,
          name: newHabit.name,
          frequency: newHabit.frequency,
          category: newHabit.category,
          icon: newHabit.icon || '⭐',
          streak: 0,
        })
        .select()
        .single();

      if (error) throw error;
      if (insertedHabit) {
        setHabits((prev) => [...prev, insertedHabit]);
        showToast('Habit created!', 'success');
      }

      setNewHabit({ name: '', frequency: 'daily', category: 'Health', icon: '⭐' });
      setShowAddForm(false);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to create habit', 'error');
    }
  };

  const deleteHabit = async (habitId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId);

      if (error) throw error;
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      showToast('Habit deleted', 'info');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to delete habit', 'error');
    }
  };

  const inputStyle = { background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' };

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      label: d.toLocaleDateString('en-IN', { weekday: 'narrow' }),
      dateStr: d.toISOString().split('T')[0],
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Today's Habits</h3>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-primary to-secondary">
          <Plus size={14} /> Add
        </motion.button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <input type="text" placeholder="Habit name" value={newHabit.name} onChange={(e) => setNewHabit((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-xl text-sm" style={inputStyle} />
            <div className="grid grid-cols-3 gap-3">
              <select value={newHabit.frequency} onChange={(e) => setNewHabit((p) => ({ ...p, frequency: e.target.value }))} className="px-3 py-2 rounded-xl text-sm" style={inputStyle}>
                <option value="daily">Daily</option><option value="weekly">Weekly</option>
              </select>
              <select value={newHabit.category} onChange={(e) => setNewHabit((p) => ({ ...p, category: e.target.value }))} className="px-3 py-2 rounded-xl text-sm" style={inputStyle}>
                {['Health', 'Learning', 'Productivity', 'Other'].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input type="text" placeholder="Icon emoji" value={newHabit.icon} onChange={(e) => setNewHabit((p) => ({ ...p, icon: e.target.value }))} className="px-3 py-2 rounded-xl text-sm text-center" style={inputStyle} />
            </div>
            <button onClick={addHabit} className="w-full py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary">Add Habit</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {habits.map((habit) => {
          const isDone = todayCompleted.has(habit.id);
          return (
            <motion.div
              key={habit.id}
              layout
              whileHover={{ scale: 1.01 }}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <motion.button
                onClick={() => toggleHabit(habit.id)}
                whileTap={{ scale: 0.85 }}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: isDone ? 'var(--color-success)' : 'var(--bg-input)',
                  color: isDone ? 'white' : 'var(--text-muted)',
                }}
              >
                {isDone ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  >
                    <Check size={18} />
                  </motion.div>
                ) : (
                  <span className="text-lg">{habit.icon}</span>
                )}
              </motion.button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: isDone ? 'var(--text-muted)' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>
                  {habit.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md capitalize" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>{habit.frequency}</span>
                  {habit.streak > 0 && (
                    <span className="text-[10px] flex items-center gap-0.5 text-warning font-medium">
                      🔥 {habit.streak} day streak
                    </span>
                  )}
                </div>
              </div>

              {/* Weekly dots */}
              <div className="hidden md:flex gap-1">
                {last7Days.map((dayObj, i) => {
                  const dayCompleted = completionsLast7[habit.id]?.has(dayObj.dateStr);
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>{dayObj.label}</span>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          background: dayCompleted ? 'var(--color-success)' : 'var(--bg-input)',
                          opacity: 0.8,
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              <button onClick={() => deleteHabit(habit.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: 'var(--text-muted)' }}>
                <Trash2 size={14} />
              </button>
            </motion.div>
          );
        })}
      </div>

      {habits.length === 0 && (
        <EmptyState icon={<Zap size={28} />} title="No habits yet" description="No habits yet — start building your routine" />
      )}
    </div>
  );
}
