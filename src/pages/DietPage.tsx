import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Salad, Calculator, FileText, Droplet, Plus, Minus, Trash2, 
  Sparkles, Check, Loader2, Info
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useXPStore } from '@/stores/xpStore';
import { useToastStore } from '@/stores/toastStore';
import { callClaude } from '@/lib/claude';
import { getToday } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type Tab = 'calculator' | 'food' | 'planner' | 'water';

interface NutritionProfile {
  weight_kg: number;
  height_cm: number;
  age: number;
  gender: 'Male' | 'Female';
  activity_level: string;
  goal: string;
  protein_target: number;
  calorie_target: number;
  meal_plan?: any;
}

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export function DietPage() {
  const [activeTab, setActiveTab] = useState<Tab>('calculator');
  const { awardXP } = useXPStore();
  const { showToast } = useToastStore();

  // Tab 1: Calculator States
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [activity, setActivity] = useState('Moderately active (3–5 days/week)');
  const [goal, setGoal] = useState('Build muscle');
  const [profileResults, setProfileResults] = useState<NutritionProfile | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Tab 2: Food Log States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [scannedFood, setScannedFood] = useState<FoodItem | null>(null);
  const [dailyFoods, setDailyFoods] = useState<FoodItem[]>([]);

  // Tab 3: Meal Planner States
  const [preference, setPreference] = useState<'Veg' | 'Non-veg' | 'Vegan'>('Veg');
  const [plannerDays, setPlannerDays] = useState('3');
  const [restrictions, setRestrictions] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [mealPlan, setMealPlan] = useState<any>(null);

  // Tab 4: Water Tracker States
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [waterTarget, setWaterTarget] = useState(8);
  const [waterStreak, setWaterStreak] = useState(0);

  // Initial Load
  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStr = getToday();

      // 1. Load nutrition profile
      const { data: profileRow } = await supabase
        .from('nutrition_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileRow) {
        const fetchedProfile: NutritionProfile = {
          weight_kg: profileRow.weight_kg,
          height_cm: profileRow.height_cm,
          age: profileRow.age,
          gender: profileRow.gender,
          activity_level: profileRow.activity_level,
          goal: profileRow.goal,
          protein_target: profileRow.protein_target,
          calorie_target: profileRow.calorie_target,
          meal_plan: profileRow.meal_plan || null,
        };
        setProfileResults(fetchedProfile);
        setWeight(String(fetchedProfile.weight_kg));
        setHeight(String(fetchedProfile.height_cm));
        setAge(String(fetchedProfile.age));
        setGender(fetchedProfile.gender);
        setActivity(fetchedProfile.activity_level);
        setGoal(fetchedProfile.goal);
        if (fetchedProfile.meal_plan) {
          setMealPlan(fetchedProfile.meal_plan);
        }
      }

      // 2. Load food logs for today
      const { data: foodLogRow } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle();
      if (foodLogRow) {
        setDailyFoods(foodLogRow.foods || []);
      } else {
        setDailyFoods([]);
      }

      // 3. Load daily logs for water tracker
      const { data: dailyLogRow } = await supabase
        .from('daily_logs')
        .select('water_glasses')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle();
      if (dailyLogRow) {
        setWaterGlasses(dailyLogRow.water_glasses || 0);
      } else {
        setWaterGlasses(0);
      }

      calculateWaterStreak();
    } catch (e) {
      console.error('Failed to load user data:', e);
    }
  };

  const calculateWaterStreak = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('daily_logs')
        .select('date, water_glasses')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      let streak = 0;
      const todayStr = getToday();
      
      for (const log of (data || [])) {
        if (log.date === todayStr && log.water_glasses && log.water_glasses < waterTarget) {
          continue;
        }
        if (log.water_glasses && log.water_glasses >= waterTarget) {
          streak++;
        } else {
          break;
        }
      }
      setWaterStreak(streak);
    } catch (e) {
      console.error(e);
    }
  };

  // Tab 1: Calculate Targets
  const handleCalculate = async () => {
    const w = Number(weight);
    const h = Number(height);
    const a = Number(age);

    if (!w || !h || !a) {
      showToast('Please fill out all fields', 'error');
      return;
    }

    setCalcLoading(true);

    let bmr = 10 * w + 6.25 * h - 5 * a;
    if (gender === 'Male') {
      bmr += 5;
    } else {
      bmr -= 161;
    }

    let factor = 1.2;
    if (activity.includes('Lightly')) factor = 1.375;
    else if (activity.includes('Moderately')) factor = 1.55;
    else if (activity.includes('Very')) factor = 1.725;
    else if (activity.includes('Athlete')) factor = 1.9;

    const tdee = bmr * factor;

    let calories = tdee;
    if (goal === 'Lose fat') calories -= 500;
    else if (goal === 'Build muscle') calories += 300;
    else if (goal === 'Bulk') calories += 500;

    calories = Math.round(calories);

    let pMultiplier = 1.8;
    if (goal === 'Lose fat' || goal === 'Build muscle') pMultiplier = 2.2;
    else if (goal === 'Bulk') pMultiplier = 2.0;

    const protein = Math.round(w * pMultiplier);

    const result: NutritionProfile = {
      weight_kg: w,
      height_cm: h,
      age: a,
      gender,
      activity_level: activity,
      goal,
      protein_target: protein,
      calorie_target: calories,
    };

    setProfileResults(result);

    if (isSupabaseConfigured) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase.from('nutrition_profiles').upsert({
            user_id: user.id,
            weight_kg: w,
            height_cm: h,
            age: a,
            gender,
            activity_level: activity,
            goal,
            protein_target: protein,
            calorie_target: calories,
          }, { onConflict: 'user_id' });

          if (error) throw error;

          await awardXP('Configured nutrition targets', 20);
          showToast('Targets calculated and saved! +20 XP', 'success');
        }
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'Failed to save calculation', 'error');
      }
    }
    setCalcLoading(false);
  };

  // Tab 2: Food Logger search
  const handleFoodSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setScannedFood(null);

    const systemPrompt = `You are a nutrition database. Return ONLY a JSON object with no markdown, no explanation:
{"name": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number}`;

    try {
      const response = await callClaude(systemPrompt, [{ role: 'user', content: searchQuery }], 200);
      const clean = response.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (parsed.name && typeof parsed.calories === 'number') {
        setScannedFood({
          id: crypto.randomUUID(),
          name: parsed.name,
          calories: parsed.calories,
          protein_g: parsed.protein_g || 0,
          carbs_g: parsed.carbs_g || 0,
          fat_g: parsed.fat_g || 0,
          fiber_g: parsed.fiber_g || 0,
        });
      } else {
        showToast('Could not parse nutrition data. Try another query.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('AI scanner failed. Check API keys.', 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  const logFoodItem = async () => {
    if (!scannedFood) return;
    if (!isSupabaseConfigured) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStr = getToday();

      // Get existing log for today
      const { data: existing } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle();

      const updatedFoods = [...(existing?.foods || []), scannedFood];
      const totalCalories = updatedFoods.reduce((sum, f) => sum + f.calories, 0);
      const totalProtein = updatedFoods.reduce((sum, f) => sum + f.protein_g, 0);

      const { error } = await supabase.from('food_logs').upsert({
        user_id: user.id,
        date: todayStr,
        foods: updatedFoods,
        total_calories: totalCalories,
        total_protein: totalProtein
      }, { onConflict: 'user_id,date' });

      if (error) throw error;

      setDailyFoods(updatedFoods);
      setScannedFood(null);
      setSearchQuery('');

      await awardXP('food_logged', 5);
      showToast('Food logged successfully! +5 XP', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to log food', 'error');
    }
  };

  const deleteFoodItem = async (id: string) => {
    if (!isSupabaseConfigured) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStr = getToday();

      const { data: existing } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle();

      const updatedFoods = (existing?.foods || []).filter((f: any) => f.id !== id);
      const totalCalories = updatedFoods.reduce((sum: number, f: any) => sum + f.calories, 0);
      const totalProtein = updatedFoods.reduce((sum: number, f: any) => sum + f.protein_g, 0);

      const { error } = await supabase.from('food_logs').upsert({
        user_id: user.id,
        date: todayStr,
        foods: updatedFoods,
        total_calories: totalCalories,
        total_protein: totalProtein
      }, { onConflict: 'user_id,date' });

      if (error) throw error;

      setDailyFoods(updatedFoods);
      showToast('Food entry deleted', 'info');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to delete food entry', 'error');
    }
  };

  // Tab 3: Meal Planner Generator
  const generateMealPlan = async () => {
    if (!profileResults) {
      showToast('Calculate your nutrition targets first!', 'warning');
      setActiveTab('calculator');
      return;
    }

    setPlanLoading(true);
    const systemPrompt = `You are a professional nutritionist. Return ONLY valid structured JSON matching this example (no markdown, no other text):
{
  "days": [
    {
      "day": 1,
      "meals": {
        "breakfast": { "name": "Spiced Paneer Scramble", "macros": "350 kcal · 20g P · 15g C · 22g F" },
        "lunch": { "name": "Moong Dal & Roti", "macros": "500 kcal · 22g P · 60g C · 12g F" },
        "dinner": { "name": "Tofu Stir-fry with Brown Rice", "macros": "450 kcal · 25g P · 45g C · 14g F" },
        "snacks": { "name": "Roasted Chana & Whey Shake", "macros": "300 kcal · 32g P · 25g C · 5g F" }
      }
    }
  ]
}`;

    const prompt = `Generate a ${plannerDays}-day Indian meal plan for someone with these targets: ${profileResults.protein_target}g protein, ${profileResults.calorie_target} calories/day. Preference: ${preference}. Restrictions: ${restrictions || 'None'}. For each day show: breakfast, lunch, dinner, snacks. Include approximate macros per meal.`;

    try {
      const response = await callClaude(systemPrompt, [{ role: 'user', content: prompt }]);
      const clean = response.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (parsed.days && Array.isArray(parsed.days)) {
        setMealPlan(parsed);
      } else {
        showToast('Failed to parse plan. Try again.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('AI plan generation failed. Check API configuration.', 'error');
    } finally {
      setPlanLoading(false);
    }
  };

  const saveMealPlan = async () => {
    if (!mealPlan || !profileResults) return;
    if (!isSupabaseConfigured) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updatedProfile = { ...profileResults, meal_plan: mealPlan };
      setProfileResults(updatedProfile);

      const { error } = await supabase.from('nutrition_profiles').upsert({
        user_id: user.id,
        ...updatedProfile,
      }, { onConflict: 'user_id' });

      if (error) throw error;

      await awardXP('Saved meal plan', 15);
      showToast('Meal plan saved to profile! +15 XP', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to save meal plan', 'error');
    }
  };

  // Tab 4: Water Tracker actions
  const adjustWater = async (diff: number) => {
    if (!isSupabaseConfigured) return;
    const newVal = Math.max(0, waterGlasses + diff);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dateStr = getToday();

      const { error } = await supabase.from('daily_logs').upsert({
        user_id: user.id,
        date: dateStr,
        water_glasses: newVal,
      }, { onConflict: 'user_id,date' });

      if (error) throw error;

      setWaterGlasses(newVal);

      if (newVal === waterTarget && waterGlasses < waterTarget) {
        await awardXP('Met water hydration target', 10);
        showToast('Daily hydration target met! 💧 +10 XP', 'success');
      }
      
      calculateWaterStreak();
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to update hydration', 'error');
    }
  };

  // Pie chart config for macros
  const getPieData = () => {
    if (!profileResults) return [];
    
    const p = profileResults.protein_target;
    const pCal = p * 4;
    const fCal = profileResults.calorie_target * 0.25;
    const f = Math.round(fCal / 9);
    const cCal = profileResults.calorie_target - (pCal + fCal);
    const c = Math.round(cCal / 4);

    return [
      { name: `Protein (${p}g)`, value: pCal, color: '#6366f1' },
      { name: `Carbs (${c}g)`, value: cCal, color: '#06b6d4' },
      { name: `Fat (${f}g)`, value: fCal, color: '#f59e0b' },
    ];
  };

  const macroData = getPieData();

  const getProgressColor = (current: number, target: number, isProtein = false) => {
    const ratio = current / target;
    if (isProtein) {
      if (ratio >= 1.0) return 'var(--color-success)';
      if (ratio >= 0.8) return 'var(--color-warning)';
      return 'var(--color-danger)';
    } else {
      if (ratio <= 1.0) return 'var(--color-success)';
      if (ratio <= 1.1) return 'var(--color-warning)';
      return 'var(--color-danger)';
    }
  };

  const dailyCalories = dailyFoods.reduce((sum, item) => sum + item.calories, 0);
  const dailyProtein = dailyFoods.reduce((sum, item) => sum + item.protein_g, 0);
  const dailyCarbs = dailyFoods.reduce((sum, item) => sum + item.carbs_g, 0);
  const dailyFat = dailyFoods.reduce((sum, item) => sum + item.fat_g, 0);

  const calTarget = profileResults?.calorie_target || 2000;
  const proTarget = profileResults?.protein_target || 120;
  const carbTarget = Math.round((calTarget * 0.5) / 4);
  const fatTarget = Math.round((calTarget * 0.25) / 9);

  const getBMICategory = (w: number, h: number) => {
    const bmi = w / Math.pow(h / 100, 2);
    let category = 'Normal';
    let badgeColor = 'bg-success/15 text-success';
    
    if (bmi < 18.5) {
      category = 'Underweight';
      badgeColor = 'bg-warning/15 text-warning';
    } else if (bmi >= 25 && bmi < 29.9) {
      category = 'Overweight';
      badgeColor = 'bg-warning/15 text-warning';
    } else if (bmi >= 30) {
      category = 'Obese';
      badgeColor = 'bg-danger/15 text-danger';
    }

    return { bmi: bmi.toFixed(1), category, badgeColor };
  };

  const bmiInfo = profileResults ? getBMICategory(profileResults.weight_kg, profileResults.height_cm) : null;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Tabs list */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--bg-input)' }}>
        {[
          { key: 'calculator', label: 'Macros Calculator', icon: Calculator },
          { key: 'food', label: 'Food Diary', icon: Salad },
          { key: 'planner', label: 'Meal Planner', icon: FileText },
          { key: 'water', label: 'Hydration', icon: Droplet },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as Tab)}
            className="relative flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center"
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

      {/* Tab content wrapper */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* ================= TAB 1: MACROS CALCULATOR ================= */}
          {activeTab === 'calculator' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Form Input */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Calculator size={16} className="text-primary" /> Nutrition Parameters
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Weight (kg)</label>
                    <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 70" className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Height (cm)</label>
                    <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 175" className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Age</label>
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 24" className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Gender</label>
                    <div className="flex gap-2 h-9">
                      {['Male', 'Female'].map((g) => (
                        <button
                          key={g}
                          onClick={() => setGender(g as 'Male' | 'Female')}
                          className="flex-1 rounded-xl text-xs font-medium border"
                          style={{
                            background: gender === g ? 'var(--color-primary)' : 'var(--bg-input)',
                            color: gender === g ? 'white' : 'var(--text-muted)',
                            borderColor: gender === g ? 'var(--color-primary)' : 'var(--border)',
                          }}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Activity Level</label>
                  <select value={activity} onChange={(e) => setActivity(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <option>Sedentary (desk job, no exercise)</option>
                    <option>Lightly active (1–3 days/week)</option>
                    <option>Moderately active (3–5 days/week)</option>
                    <option>Very active (6–7 days/week)</option>
                    <option>Athlete (2x/day training)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Primary Goal</label>
                  <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <option>Lose fat</option>
                    <option>Maintain</option>
                    <option>Build muscle</option>
                    <option>Bulk</option>
                  </select>
                </div>

                <button
                  onClick={handleCalculate}
                  disabled={calcLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  {calcLoading ? <Loader2 className="animate-spin" size={14} /> : 'Calculate Macro Split'}
                </button>
              </div>

              {/* Calculations Output */}
              <div className="space-y-4">
                {profileResults ? (
                  <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Nutrition Dashboard</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl p-3 bg-[var(--bg-input)]">
                        <span className="text-[10px] text-zinc-500 font-medium">CALORIE TARGET</span>
                        <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                          {profileResults.calorie_target} <span className="text-xs font-medium text-zinc-400">kcal/day</span>
                        </h2>
                      </div>
                      <div className="rounded-xl p-3 bg-[var(--bg-input)]">
                        <span className="text-[10px] text-zinc-500 font-medium">PROTEIN TARGET</span>
                        <h2 className="text-2xl font-bold tracking-tight text-primary mt-1">
                          {profileResults.protein_target} <span className="text-xs font-medium text-zinc-400">g/day</span>
                        </h2>
                      </div>
                    </div>

                    {/* Chart & Badges */}
                    {bmiInfo && (
                      <div className="flex items-center justify-between border-t border-b border-zinc-800 py-3">
                        <div>
                          <p className="text-xs text-zinc-400 font-medium">Body Mass Index (BMI)</p>
                          <p className="text-sm font-bold text-white mt-0.5">{bmiInfo.bmi} kg/m²</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${bmiInfo.badgeColor}`}>
                          {bmiInfo.category}
                        </span>
                      </div>
                    )}

                    {/* Macro Split Chart */}
                    <div className="h-44 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={macroData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {macroData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => `${Math.round((value / profileResults.calorie_target) * 100)}% (${Math.round(value / (value === macroData[2].value ? 9 : 4))}g)`} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="text-[10px] text-zinc-500 leading-relaxed bg-zinc-900/40 p-3 rounded-xl border border-zinc-850 flex items-start gap-2">
                      <Info size={14} className="mt-0.5 text-zinc-400" />
                      <span>
                        Recommended meal distribution: <b>{activity.includes('Sedentary') || activity.includes('Lightly') ? '3 meals' : '4-5 meals'} per day</b>. Mifflin-St Jeor formula uses height/weight parameters for BMR and adjusts calories depending on current energy expenditures.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-full rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-[var(--bg-card)] border border-[var(--border)]">
                    <span className="text-4xl mb-3">🥗</span>
                    <h4 className="text-sm font-semibold text-white">No nutrition results yet</h4>
                    <p className="text-xs text-zinc-500 mt-1 max-w-[240px]">Enter details on the left to determine your daily protein and calorie requirements.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 2: DAILY FOOD LOG ================= */}
          {activeTab === 'food' && (
            <div className="space-y-6">
              {/* Scan / Add Food Bar */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Log Meal Items</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFoodSearch()}
                    placeholder="Enter meal item (e.g. 2 eggs, 1 roti, 100g paneer)..."
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                  <button
                    onClick={handleFoodSearch}
                    disabled={searchLoading || !searchQuery.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {searchLoading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                    Scan Food
                  </button>
                </div>

                {/* Scanned Card Confirmation */}
                <AnimatePresence>
                  {scannedFood && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-white">{scannedFood.name}</h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-zinc-400">
                          <span>🔥 {scannedFood.calories} kcal</span>
                          <span>🍗 P: {scannedFood.protein_g}g</span>
                          <span>🍞 C: {scannedFood.carbs_g}g</span>
                          <span>🥑 F: {scannedFood.fat_g}g</span>
                        </div>
                      </div>
                      <button
                        onClick={logFoodItem}
                        className="py-1.5 px-4 bg-success text-white text-xs font-semibold rounded-lg self-end md:self-center flex items-center gap-1"
                      >
                        <Check size={14} /> Confirm and Log
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Progress Tracker metrics */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Micro Progress Bars */}
                <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Today's Nutrients Summary</h3>
                  <div className="space-y-4">
                    {/* Calories */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-zinc-400">Energy (kcal)</span>
                        <span style={{ color: getProgressColor(dailyCalories, calTarget) }}>{dailyCalories} / {calTarget} kcal</span>
                      </div>
                      <div className="h-2 w-full rounded-full" style={{ background: 'var(--bg-input)' }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (dailyCalories / calTarget) * 100)}%`, background: getProgressColor(dailyCalories, calTarget) }} />
                      </div>
                    </div>

                    {/* Protein */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-zinc-400">Protein (g)</span>
                        <span style={{ color: getProgressColor(dailyProtein, proTarget, true) }}>{dailyProtein} / {proTarget}g</span>
                      </div>
                      <div className="h-2 w-full rounded-full" style={{ background: 'var(--bg-input)' }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (dailyProtein / proTarget) * 100)}%`, background: getProgressColor(dailyProtein, proTarget, true) }} />
                      </div>
                    </div>

                    {/* Carbs */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-zinc-400">Carbs (g)</span>
                        <span style={{ color: getProgressColor(dailyCarbs, carbTarget) }}>{dailyCarbs} / {carbTarget}g</span>
                      </div>
                      <div className="h-2 w-full rounded-full" style={{ background: 'var(--bg-input)' }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (dailyCarbs / carbTarget) * 100)}%`, background: getProgressColor(dailyCarbs, carbTarget) }} />
                      </div>
                    </div>

                    {/* Fat */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-zinc-400">Fat (g)</span>
                        <span style={{ color: getProgressColor(dailyFat, fatTarget) }}>{dailyFat} / {fatTarget}g</span>
                      </div>
                      <div className="h-2 w-full rounded-full" style={{ background: 'var(--bg-input)' }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (dailyFat / fatTarget) * 100)}%`, background: getProgressColor(dailyFat, fatTarget) }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logged items list */}
                <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Logged Items</h3>
                  {dailyFoods.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {dailyFoods.map((food) => (
                        <div key={food.id} className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-850 flex items-center justify-between gap-3 text-xs" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                          <div>
                            <p className="font-semibold text-white">{food.name}</p>
                            <p className="text-[10px] text-zinc-505 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {food.calories} kcal · P: {food.protein_g}g · C: {food.carbs_g}g · F: {food.fat_g}g
                            </p>
                          </div>
                          <button
                            onClick={() => deleteFoodItem(food.id)}
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-danger transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 bg-zinc-900/20 rounded-xl border border-zinc-850">
                      <span className="text-2xl mb-1.5">🍽️</span>
                      <p className="text-xs text-zinc-500">No items logged today yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: MEAL PLANNER ================= */}
          {activeTab === 'planner' && (
            <div className="space-y-6">
              <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Sparkles size={16} className="text-primary" /> AI Meal Plan Generator
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Dietary Preference</label>
                    <select value={preference} onChange={(e) => setPreference(e.target.value as any)} className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                      <option value="Veg">Veg</option>
                      <option value="Non-veg">Non-veg</option>
                      <option value="Vegan">Vegan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Duration (days)</label>
                    <select value={plannerDays} onChange={(e) => setPlannerDays(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={d} value={d}>{d} Day{d > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Allergies / Restrictions</label>
                  <input
                    type="text"
                    value={restrictions}
                    onChange={(e) => setRestrictions(e.target.value)}
                    placeholder="e.g. No peanut, lactose intolerant, high fiber..."
                    className="w-full px-3 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={generateMealPlan}
                    disabled={planLoading}
                    className="flex-1 py-2.5 bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {planLoading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                    Generate Meal Plan
                  </button>
                  {mealPlan && (
                    <button
                      onClick={saveMealPlan}
                      className="px-5 py-2.5 border border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 hover:bg-zinc-850"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    >
                      <Check size={14} /> Save Plan
                    </button>
                  )}
                </div>
              </div>

              {/* Meal plan render results */}
              {mealPlan && mealPlan.days && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Your generated meal plan</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {mealPlan.days.map((dayItem: any) => (
                      <div key={dayItem.day} className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-zinc-800 pb-2 flex items-center justify-between">
                          <span>Day {dayItem.day}</span>
                          <span className="text-[10px] text-zinc-500 font-medium font-mono">Macros calculated below</span>
                        </h4>
                        
                        <div className="space-y-3">
                          {['breakfast', 'lunch', 'dinner', 'snacks'].map((mealKey) => {
                            const meal = dayItem.meals[mealKey];
                            return (
                              <div key={mealKey} className="space-y-0.5">
                                <span className="text-[9px] uppercase font-bold text-zinc-505 tracking-wide" style={{ color: 'var(--text-muted)' }}>{mealKey}</span>
                                <p className="text-xs font-semibold text-white">{meal?.name}</p>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{meal?.macros}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: WATER HYDRATION ================= */}
          {activeTab === 'water' && (
            <div className="grid md:grid-cols-2 gap-6 items-center">
              {/* Tracker Graphic */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Water Intake</h3>
                
                {/* Animated Water Cup SVG */}
                <div className="relative w-40 h-60 border-[4px] border-zinc-800 rounded-b-2xl rounded-t-sm overflow-hidden flex items-end">
                  <div className="absolute inset-0 bg-zinc-950 opacity-40 z-0" />
                  
                  {/* Visual wave/water representation */}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.min(100, (waterGlasses / waterTarget) * 100)}%` }}
                    transition={{ type: 'spring', damping: 20, stiffness: 60 }}
                    className="w-full relative bg-gradient-to-t from-cyan-600 to-cyan-400 z-10"
                  >
                    {/* SVG wave effect */}
                    <div className="absolute -top-2 left-0 right-0 h-3 overflow-hidden">
                      <svg viewBox="0 0 120 28" className="w-full h-full text-cyan-400 fill-current animate-pulse opacity-80">
                        <path d="M0,15 C30,5 90,20 120,10 L120,28 L0,28 Z" />
                      </svg>
                    </div>
                  </motion.div>
                  
                  {/* Inside glass label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-center select-none pointer-events-none">
                    <h2 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
                      {waterGlasses} <span className="text-sm font-semibold">/ {waterTarget}</span>
                    </h2>
                    <p className="text-[10px] text-zinc-400 font-medium tracking-wide drop-shadow-md mt-0.5">glasses</p>
                  </div>
                </div>

                {/* large adjustments */}
                <div className="flex items-center gap-6 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => adjustWater(-1)}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center bg-zinc-900 border border-zinc-850 hover:bg-zinc-850 text-zinc-300"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <Minus size={20} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => adjustWater(1)}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white shadow-md shadow-cyan-500/20"
                  >
                    <Plus size={20} />
                  </motion.button>
                </div>
              </div>

              {/* Streak Info */}
              <div className="space-y-4">
                <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <h4 className="text-sm font-semibold text-zinc-300">Hydration Streak</h4>
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">🔥</span>
                    <div>
                      <h2 className="text-2xl font-black text-white">{waterStreak} Days</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">consecutive days meeting your hydration goal.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl p-5 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <h4 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">Coach Reminder 💡</h4>
                  <p className="text-xs leading-relaxed text-zinc-300">
                    {waterGlasses === 0 && 'Hydration keeps you sharp. Sip a glass of water first thing to kickstart metabolism.'}
                    {waterGlasses > 0 && waterGlasses < waterTarget && `You are at ${Math.round((waterGlasses / waterTarget) * 100)}% of your target. Keep ticking it up every hour.`}
                    {waterGlasses >= waterTarget && 'Exceptional! Today\'s hydration goal met. Keep up this consistency tomorrow.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
