# Deployment Guide — Kira

This document outlines instructions for deploying the **Kira** Progressive Web App (PWA) to production using modern hosting solutions (Vercel, Netlify, and Cloudflare Pages) and configuring production databases like Supabase with Row-Level Security (RLS) policies.

---

## 1. Hosting Platforms Setup

### A. Vercel (Recommended)
1. **Import Project**: Log in to the [Vercel Dashboard](https://vercel.com) and click **Add New** > **Project**. Import your Git repository.
2. **Framework Preset**: Vercel will auto-detect **Vite**. If not, choose **Vite** or **Other**.
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Environment Variables**: Add your API keys and endpoints in the project settings:
   - `VITE_CLAUDE_API_KEY` (Optional if using custom credentials settings)
   - `VITE_SUPABASE_URL` (Optional)
   - `VITE_SUPABASE_ANON_KEY` (Optional)
6. **Click Deploy**: Vercel generates dynamic build processes and binds the standard production domain.

### B. Netlify
1. **Import Project**: Log in to [Netlify](https://netlify.com) and select **Add new site** > **Import an existing project**.
2. **Build Settings**:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. **Environment Variables**: Go to **Site Configuration** > **Environment variables** and configure your keys (`VITE_CLAUDE_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. **Deploy**: Trigger production deploy.

### C. Cloudflare Pages
1. **Import Project**: Log in to [Cloudflare](https://dash.cloudflare.com), navigate to **Workers & Pages** > **Pages** > **Create a project** > **Connect to Git**.
2. **Build Settings**:
   - **Framework preset**: **Vite**
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. **Environment Variables**: Go to project **Settings** > **Variables** and define the environment variables.
4. **Deploy**: Cloudflare builds and serves the assets globally via Cloudflare Edge Network.

---

## 2. Production Supabase Setup & RLS SQL Schema

Kira supports dynamic fallback "demo mode" when Supabase credentials are not supplied, but for production users, run the following SQL commands in your Supabase SQL editor to create the necessary tables, trigger auto-updating timestamps, enable RLS, and configure user isolation policies.

### A. Table Schemas & Tables Creation

```sql
-- 1. Diet & Nutrition Profiles
create table if not exists public.nutrition_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  weight_kg numeric,
  height_cm numeric,
  age int,
  gender text,
  activity_level text,
  goal text,
  protein_target numeric,
  calorie_target numeric,
  meal_plan jsonb default null, -- Stores generated meal plans
  updated_at timestamptz default now(),
  unique(user_id)
);

-- 2. Daily Food Logs
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null,
  foods jsonb default '[]',
  total_calories numeric default 0,
  total_protein numeric default 0,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- 3. Dynamic Custom Sections (AI-Generated Pages)
create table if not exists public.dynamic_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  section_id text not null,
  config jsonb not null,
  created_at timestamptz default now(),
  unique(user_id, section_id)
);

-- 4. Tab Data storage for Dynamic Sections
create table if not exists public.dynamic_section_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  section_id text not null,
  tab_id text not null,
  data jsonb default '{}',
  updated_at timestamptz default now(),
  unique(user_id, section_id, tab_id)
);

-- 5. Gamification XP Logs
create table if not exists public.xp_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  action text not null,
  xp int not null,
  created_at timestamptz default now()
);

-- 6. Journal Entries & Reflection logs
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null,
  content text,
  ai_reflection text,
  created_at timestamptz default now(),
  unique(user_id, date)
);
```

### B. Row-Level Security (RLS) Enablement

```sql
-- Enable Row Level Security (RLS) to enforce data privacy
alter table public.nutrition_profiles enable row level security;
alter table public.food_logs enable row level security;
alter table public.dynamic_sections enable row level security;
alter table public.dynamic_section_data enable row level security;
alter table public.xp_log enable row level security;
alter table public.journal_entries enable row level security;
```

### C. Security Policy Configuration (Row Isolation)

```sql
-- Enforce user identity checks (auth.uid() matches user_id column)
create policy "Users can modify own nutrition profiles" 
  on public.nutrition_profiles for all 
  using (auth.uid() = user_id);

create policy "Users can modify own food logs" 
  on public.food_logs for all 
  using (auth.uid() = user_id);

create policy "Users can modify own dynamic sections" 
  on public.dynamic_sections for all 
  using (auth.uid() = user_id);

create policy "Users can modify own dynamic section data" 
  on public.dynamic_section_data for all 
  using (auth.uid() = user_id);

create policy "Users can modify own xp logs" 
  on public.xp_log for all 
  using (auth.uid() = user_id);

create policy "Users can modify own journal entries" 
  on public.journal_entries for all 
  using (auth.uid() = user_id);
```

---

## 3. Progressive Web App (PWA) Assets

1. Ensure HTTPS is enabled on the hosting provider (this is a mandatory requirement for PWAs).
2. Service workers and offline configuration will be built automatically by the Vite Workbox plugin into the `dist/sw.js` bundle.
3. Assets defined in `public/manifest.webmanifest` and related icons will be cached locally by client browsers for offline support.
