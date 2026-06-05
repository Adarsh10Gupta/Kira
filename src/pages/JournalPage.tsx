import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Calendar, Sparkles, Check, Loader2, ArrowRight, LineChart as ChartIcon, 
  ChevronLeft, ChevronRight, HelpCircle, HeartHandshake
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useXPStore } from '@/stores/xpStore';
import { useToastStore } from '@/stores/toastStore';
import { callClaude } from '@/lib/claude';
import { getToday, formatDate } from '@/lib/utils';
import { db } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface MoodPoint {
  date: string;
  formattedDate: string;
  mood: number;
}

export function JournalPage() {
  const [date, setDate] = useState(getToday());
  const [content, setContent] = useState('');
  const [aiReflection, setAiReflection] = useState('');
  const [loading, setLoading] = useState(false);
  const [reflectLoading, setReflectLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState('');
  
  // Mood chart state
  const [moodHistory, setMoodHistory] = useState<MoodPoint[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { awardXP } = useXPStore();
  const { showToast } = useToastStore();

  // Load entry when date changes
  useEffect(() => {
    loadJournalEntry();
  }, [date]);

  // Load mood trend
  useEffect(() => {
    loadMoodTimeline();
  }, []);

  const loadJournalEntry = async () => {
    setLoading(true);
    setContent('');
    setAiReflection('');
    
    let fetchedContent = '';
    let fetchedReflection = '';

    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('journal_entries')
          .select('content, ai_reflection')
          .eq('date', date)
          .single();
        if (data) {
          fetchedContent = data.content || '';
          fetchedReflection = data.ai_reflection || '';
        }
      } catch (err) {
        console.error(err);
      }
    }

    try {
      const local = await db.journal_entries.where({ date }).first();
      if (!fetchedContent && local) {
        fetchedContent = local.content;
        fetchedReflection = local.ai_reflection || '';
      }
    } catch (err) {
      console.error(err);
    }

    setContent(fetchedContent);
    setAiReflection(fetchedReflection);
    setLoading(false);
  };

  const loadMoodTimeline = async () => {
    try {
      const logs = await db.daily_logs.orderBy('date').toArray();
      const points = logs
        .filter((l) => l.mood !== undefined && l.mood > 0)
        .slice(-14) // Last 14 logs
        .map((l) => ({
          date: l.date,
          formattedDate: new Date(l.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          mood: l.mood || 0,
        }));
      setMoodHistory(points);
    } catch (e) {
      console.error(e);
    }
  };

  const saveJournalEntry = async (updatedContent = content, updatedReflection = aiReflection) => {
    let userId = 'demo-user';
    
    if (isSupabaseConfigured) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          await supabase.from('journal_entries').upsert({
            user_id: userId,
            date,
            content: updatedContent,
            ai_reflection: updatedReflection,
          });
        }
      } catch (err) {
        console.error(err);
      }
    }

    try {
      const existing = await db.journal_entries.where({ date }).first();
      await db.journal_entries.put({
        id: existing?.id || undefined,
        user_id: userId,
        date,
        content: updatedContent,
        ai_reflection: updatedReflection,
        synced: isSupabaseConfigured,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;

    // Bold: Ctrl+B
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      const selected = value.substring(selectionStart, selectionEnd);
      const replacement = `**${selected}**`;
      const nextVal = value.substring(0, selectionStart) + replacement + value.substring(selectionEnd);
      setContent(nextVal);
      saveJournalEntry(nextVal, aiReflection);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(selectionStart + 2, selectionStart + 2 + selected.length);
      }, 0);
    }

    // Italic: Ctrl+I
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      const selected = value.substring(selectionStart, selectionEnd);
      const replacement = `*${selected}*`;
      const nextVal = value.substring(0, selectionStart) + replacement + value.substring(selectionEnd);
      setContent(nextVal);
      saveJournalEntry(nextVal, aiReflection);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(selectionStart + 1, selectionStart + 1 + selected.length);
      }, 0);
    }

    // Bullet indentation: Enter key
    if (e.key === 'Enter') {
      const lines = value.substring(0, selectionStart).split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine.startsWith('* ') || lastLine.startsWith('- ')) {
        e.preventDefault();
        const prefix = lastLine.substring(0, 2);
        const replacement = `\n${prefix}`;
        const nextVal = value.substring(0, selectionStart) + replacement + value.substring(selectionEnd);
        setContent(nextVal);
        saveJournalEntry(nextVal, aiReflection);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(selectionStart + replacement.length, selectionStart + replacement.length);
        }, 0);
      }
    }
  };

  // Reflect with Claude
  const reflectWithKira = async () => {
    if (!content.trim()) {
      showToast('Write down your thoughts first!', 'warning');
      return;
    }

    setReflectLoading(true);
    const systemPrompt = `You are Kira, a personal life coach. You read the user's journal entry and help them reflect. Respond with exactly a JSON object containing: { "questions": ["Question 1", "Question 2", "Question 3"], "affirmation": "One powerful, personalized affirmation" }. No other text.`;

    try {
      const response = await callClaude(systemPrompt, [{ role: 'user', content }]);
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.questions && parsed.affirmation) {
        // Format reflection as Markdown list
        const reflectionString = `### Reflections\n${parsed.questions.map((q: string) => `- ${q}`).join('\n')}\n\n### Affirmation\n> **${parsed.affirmation}**`;
        setAiReflection(reflectionString);
        await saveJournalEntry(content, reflectionString);
        awardXP('Generated journal AI reflection', 20);
        showToast('Reflection generated! +20 XP', 'success');
      } else {
        showToast('Failed to parse reflection data.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Claude reflection failed. Check API key.', 'error');
    } finally {
      setReflectLoading(false);
    }
  };

  // Monthly Summary
  const generateMonthlySummary = async () => {
    setSummaryLoading(true);
    setMonthlySummary('');

    // Fetch all journal entries from this month
    try {
      const now = new Date(date);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const localEntries = await db.journal_entries
        .where('date')
        .between(startOfMonth, endOfMonth, true, true)
        .toArray();
      
      if (localEntries.length === 0) {
        showToast('No entries recorded for this month.', 'warning');
        setSummaryLoading(false);
        return;
      }

      const consolidatedText = localEntries.map((e) => `Date: ${e.date}\nEntry: ${e.content}`).join('\n\n');
      const systemPrompt = `You are Kira, an AI life coach. Summarize the user's past month of journal entries. Highlight key themes, general mood patterns, progress made, and one piece of coaching guidance. Keep it within 3 short paragraphs.`;

      const summary = await callClaude(systemPrompt, [{ role: 'user', content: consolidatedText }]);
      setMonthlySummary(summary);
      awardXP('Summarized monthly logs', 25);
      showToast('Summary completed! +25 XP', 'success');
    } catch (e) {
      console.error(e);
      showToast('Could not compile entries.', 'error');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setContent(nextVal);
    saveJournalEntry(nextVal, aiReflection);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Editor (Columns: 2) */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            
            {/* Header: Date picker & icon */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <BookOpen size={16} className="text-primary" /> Daily Reflections
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl text-xs"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
                <Loader2 className="animate-spin" size={20} />
                <span className="text-xs">Loading logs...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleTextareaChange}
                  onKeyDown={handleEditorKeyDown}
                  placeholder="Record your experiences, goals, and daily insights. Shortcuts: Ctrl+B (bold) · Ctrl+I (italic) · Type '* ' to trigger auto-bullets."
                  rows={10}
                  className="w-full bg-transparent text-sm resize-none focus:outline-none focus:ring-0 leading-relaxed"
                  style={{ color: 'var(--text)' }}
                />

                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] text-zinc-500 font-medium">Auto-saved locally</span>
                  <button
                    onClick={reflectWithKira}
                    disabled={reflectLoading || !content.trim()}
                    className="px-3.5 py-2 bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {reflectLoading ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                    Reflect with Kira
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI Reflections Section */}
          <AnimatePresence>
            {aiReflection && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-2xl p-5 space-y-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <HeartHandshake size={14} /> Coach Reflection questions
                </h4>
                <div className="text-xs leading-relaxed space-y-3 prose prose-invert text-zinc-300">
                  {/* Clean styling for reflection output */}
                  {aiReflection.split('\n').map((line, i) => {
                    if (line.startsWith('###')) {
                      return <h5 key={i} className="text-xs font-semibold text-white mt-3 mb-1 first:mt-0">{line.replace('###', '').trim()}</h5>;
                    }
                    if (line.startsWith('-')) {
                      return (
                        <p key={i} className="flex gap-2 items-start pl-2">
                          <span className="text-primary font-bold">?</span>
                          <span>{line.replace('-', '').trim()}</span>
                        </p>
                      );
                    }
                    if (line.startsWith('>')) {
                      return (
                        <blockquote key={i} className="border-l-2 border-secondary pl-3 my-2 text-zinc-300 italic bg-zinc-900/30 py-2.5 rounded-r-xl">
                          {line.replace('>', '').replace(/\*\*/g, '').trim()}
                        </blockquote>
                      );
                    }
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar analytics / timeline (Column: 1) */}
        <div className="space-y-6">
          {/* Mood Trend chart */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <ChartIcon size={16} className="text-success" /> Mood Timeline
            </h3>
            {moodHistory.length > 0 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={moodHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="formattedDate" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis domain={[1, 5]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="mood"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="text-xl mb-1">📈</span>
                <p className="text-xs text-zinc-500">Record daily logs to plot your mood trends here.</p>
              </div>
            )}
          </div>

          {/* Monthly Summaries compiler */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Monthly Compilation</h3>
            <button
              onClick={generateMonthlySummary}
              disabled={summaryLoading}
              className="w-full py-2 border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5"
            >
              {summaryLoading ? <Loader2 className="animate-spin" size={14} /> : <BookOpen size={14} />}
              Summarize Month's Entries
            </button>

            <AnimatePresence>
              {monthlySummary && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 bg-zinc-900/40 border border-zinc-855 rounded-xl text-xs leading-relaxed text-zinc-300 mt-2 whitespace-pre-wrap"
                >
                  {monthlySummary}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}
