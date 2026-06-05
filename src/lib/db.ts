import Dexie, { type EntityTable } from 'dexie';

export interface DailyLogOffline {
  id?: string;
  user_id: string;
  date: string;
  mood?: number;
  energy?: number;
  sleep_hours?: number;
  water_glasses?: number;
  meals?: Record<string, boolean>;
  exercise_minutes?: number;
  study_minutes?: number;
  study_topic?: string;
  one_win?: string;
  one_improve?: string;
  gratitude?: string;
  synced?: boolean;
  created_at?: string;
}

export interface HabitOffline {
  id?: string;
  user_id: string;
  name: string;
  frequency: string;
  category?: string;
  icon?: string;
  streak?: number;
  synced?: boolean;
}

export interface HabitCompletionOffline {
  id?: string;
  user_id: string;
  habit_id: string;
  date: string;
  synced?: boolean;
}

export interface GoalOffline {
  id?: string;
  user_id: string;
  name: string;
  target_amount?: number;
  current_amount?: number;
  category?: string;
  color?: string;
  deadline?: string;
  synced?: boolean;
}

export interface IncomeOffline {
  id?: string;
  user_id: string;
  client_name?: string;
  project_type?: string;
  amount: number;
  status?: string;
  date: string;
  notes?: string;
  synced?: boolean;
}

export interface ChatMessageOffline {
  id?: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  synced?: boolean;
}

// New schemas for Upgrade v2
export interface NutritionProfileOffline {
  id?: string;
  user_id: string;
  weight_kg?: number;
  height_cm?: number;
  age?: number;
  gender?: string;
  activity_level?: string;
  goal?: string;
  protein_target?: number;
  calorie_target?: number;
  meal_plan?: any;
  config?: any;
  updated_at?: string;
  synced?: boolean;
}

export interface FoodLogOffline {
  id?: string;
  user_id: string;
  date: string;
  foods: any[];
  total_calories: number;
  total_protein: number;
  created_at?: string;
  synced?: boolean;
}

export interface DynamicSectionOffline {
  id?: string;
  user_id: string;
  section_id: string;
  config: any;
  created_at?: string;
  synced?: boolean;
}

export interface DynamicSectionDataOffline {
  id?: string;
  user_id: string;
  section_id: string;
  tab_id: string;
  data: any;
  updated_at?: string;
  synced?: boolean;
}

export interface XPLogOffline {
  id?: string;
  user_id: string;
  action: string;
  xp: number;
  created_at?: string;
  synced?: boolean;
}

export interface JournalEntryOffline {
  id?: string;
  user_id: string;
  date: string;
  content: string;
  ai_reflection?: string;
  created_at?: string;
  synced?: boolean;
}

const db = new Dexie('KiraDB') as Dexie & {
  daily_logs: EntityTable<DailyLogOffline, 'id'>;
  habits: EntityTable<HabitOffline, 'id'>;
  habit_completions: EntityTable<HabitCompletionOffline, 'id'>;
  goals: EntityTable<GoalOffline, 'id'>;
  income: EntityTable<IncomeOffline, 'id'>;
  chat_messages: EntityTable<ChatMessageOffline, 'id'>;
  nutrition_profiles: EntityTable<NutritionProfileOffline, 'id'>;
  food_logs: EntityTable<FoodLogOffline, 'id'>;
  dynamic_sections: EntityTable<DynamicSectionOffline, 'id'>;
  dynamic_section_data: EntityTable<DynamicSectionDataOffline, 'id'>;
  xp_log: EntityTable<XPLogOffline, 'id'>;
  journal_entries: EntityTable<JournalEntryOffline, 'id'>;
};

// Version 1 Schema
db.version(1).stores({
  daily_logs: 'id, user_id, date, synced',
  habits: 'id, user_id, synced',
  habit_completions: 'id, user_id, habit_id, date, synced',
  goals: 'id, user_id, synced',
  income: 'id, user_id, date, synced',
  chat_messages: 'id, user_id, created_at, synced',
});

// Version 2 Schema (With Upgrade v2 Tables)
db.version(2).stores({
  daily_logs: 'id, user_id, date, synced',
  habits: 'id, user_id, synced',
  habit_completions: 'id, user_id, habit_id, date, synced',
  goals: 'id, user_id, synced',
  income: 'id, user_id, date, synced',
  chat_messages: 'id, user_id, created_at, synced',
  nutrition_profiles: 'id, user_id, synced',
  food_logs: 'id, user_id, date, synced',
  dynamic_sections: 'id, user_id, section_id, synced',
  dynamic_section_data: 'id, user_id, section_id, tab_id, synced',
  xp_log: 'id, user_id, synced',
  journal_entries: 'id, user_id, date, synced',
});

export { db };
