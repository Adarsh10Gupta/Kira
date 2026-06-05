import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sparkles, Copy, RefreshCw, Save, Check, Trash2, Loader2 } from 'lucide-react';
import { callClaude } from '@/lib/claude';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useXPStore } from '@/stores/xpStore';
import { useToastStore } from '@/stores/toastStore';

const pitchSchema = z.object({
  pageUrl: z.string().min(1, 'Please enter a page URL or description'),
  context: z.string().optional(),
  serviceType: z.string().min(1, 'Select a service type'),
  budget: z.string().min(1, 'Select a budget range'),
});

type PitchFormData = z.infer<typeof pitchSchema>;

interface PitchResult {
  main: string;
  subjectLine: string;
  followUps: string[];
  talkingPoints: string[];
}

interface SavedPitch {
  id: string;
  pageName: string;
  serviceType: string;
  date: string;
  pitch: PitchResult;
}

const serviceTypes = [
  'Landing page',
  'Full website',
  'Link-in-bio page',
  'Portfolio site',
  'E-commerce store',
];

const budgetRanges = [
  '₹2,000–5,000',
  '₹5,000–10,000',
  '₹10,000–20,000',
  'Negotiable',
];

function TypewriterText({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState('');
  const [done, setDone] = useState(false);

  useState(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, 12);
    return () => clearInterval(interval);
  });

  return (
    <span>
      {displayedText}
      {!done && <span className="animate-pulse">|</span>}
    </span>
  );
}

export function PitchPage() {
  const [result, setResult] = useState<PitchResult | null>(null);
  const [activeTab, setActiveTab] = useState<'main' | 'followups' | 'points'>('main');
  const [generating, setGenerating] = useState(false);
  const [savedPitches, setSavedPitches] = useState<SavedPitch[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedPitch, setExpandedPitch] = useState<string | null>(null);

  const { awardXP } = useXPStore();
  const { showToast } = useToastStore();

  const form = useForm<PitchFormData>({
    resolver: zodResolver(pitchSchema),
    defaultValues: { serviceType: '', budget: '' },
  });

  useEffect(() => {
    loadSavedPitches();
  }, []);

  const loadSavedPitches = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('pitches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setSavedPitches(data.map((p) => {
          let parsedPitch: PitchResult = { main: '', subjectLine: '', followUps: [], talkingPoints: [] };
          try {
            parsedPitch = JSON.parse(p.pitch_content);
          } catch (e) {
            parsedPitch = { main: p.pitch_content, subjectLine: '', followUps: [], talkingPoints: [] };
          }
          return {
            id: p.id,
            pageName: p.page_name,
            serviceType: p.service_type,
            date: p.created_at,
            pitch: parsedPitch,
          };
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyText = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const generatePitch = async (formData: PitchFormData) => {
    setGenerating(true);
    setResult(null);

    const systemPrompt = 'You output only valid JSON, no markdown, no other text.';
    const prompt = `You are a professional freelance web designer's outreach assistant. The user wants to pitch website services to an Instagram page.

Page info: ${formData.pageUrl}
Extra context: ${formData.context || 'None provided'}
Service type: ${formData.serviceType}
Budget range: ${formData.budget}

Write a highly personalised, professional outreach message they can send via Instagram DM or email.

The message should:
1. Open with a specific compliment about their page (reference their niche/content style)
2. Identify one specific problem their current online presence has
3. Pitch the solution (website/landing page) with a clear benefit
4. Include a soft call to action (not pushy)
5. Be conversational, not salesy — like one creator talking to another
6. Max 150 words

Respond in this exact JSON format:
{
  "main": "The main pitch message",
  "subjectLine": "Subject line for email",
  "followUps": ["Follow-up 1", "Follow-up 2", "Follow-up 3"],
  "talkingPoints": ["Point 1", "Point 2", "Point 3", "Point 4"]
}

Only output valid JSON, nothing else.`;

    try {
      const response = await callClaude(systemPrompt, [
        { role: 'user', content: prompt },
      ]);

      const parsed = JSON.parse(response) as PitchResult;
      setResult(parsed);
      setActiveTab('main');

      // Save to Supabase immediately and award XP
      if (isSupabaseConfigured) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: insertedPitch, error } = await supabase
            .from('pitches')
            .insert({
              user_id: user.id,
              page_name: formData.pageUrl.slice(0, 50),
              pitch_content: response,
              service_type: formData.serviceType,
              budget_range: formData.budget,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (!error && insertedPitch) {
            setSavedPitches((prev) => [
              {
                id: insertedPitch.id,
                pageName: insertedPitch.page_name,
                serviceType: insertedPitch.service_type,
                date: insertedPitch.created_at,
                pitch: parsed,
              },
              ...prev,
            ]);
          }
          await awardXP('pitch_generated', 10);
          showToast('Pitch generated and saved! +10 XP', 'success');
        }
      }
    } catch (err: any) {
      console.error(err);
      setResult({
        main: 'Failed to generate pitch: ' + (err.message || 'Please check your API key and try again.'),
        subjectLine: '',
        followUps: [],
        talkingPoints: [],
      });
      showToast('Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const deletePitch = async (id: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('pitches')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setSavedPitches((prev) => prev.filter((p) => p.id !== id));
      showToast('Pitch deleted', 'info');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to delete pitch', 'error');
    }
  };

  const savePitch = () => {
    showToast('Pitch is already saved to your history!', 'success');
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl p-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Sparkles size={20} className="text-primary" />
            Generate Pitch
          </h2>

          <form onSubmit={form.handleSubmit(generatePitch)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Instagram page URL or description
              </label>
              <input
                {...form.register('pageUrl')}
                placeholder="@pagename or describe the page..."
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
              {form.formState.errors.pageUrl && (
                <p className="text-xs text-danger mt-1">{form.formState.errors.pageUrl.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Extra context (optional)
              </label>
              <textarea
                {...form.register('context')}
                placeholder="Niche, page size, what you noticed..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                What are you selling?
              </label>
              <select
                {...form.register('serviceType')}
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              >
                <option value="">Select service...</option>
                {serviceTypes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {form.formState.errors.serviceType && (
                <p className="text-xs text-danger mt-1">{form.formState.errors.serviceType.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Budget range
              </label>
              <select
                {...form.register('budget')}
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              >
                <option value="">Select budget...</option>
                {budgetRanges.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {form.formState.errors.budget && (
                <p className="text-xs text-danger mt-1">{form.formState.errors.budget.message}</p>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={generating}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Pitch
                </>
              )}
            </motion.button>
          </form>
        </motion.div>

        {/* Output Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl p-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {!result && !generating ? (
            <EmptyState
              icon={<Sparkles size={28} />}
              title="Your pitch will appear here"
              description="Fill in the details and generate a personalised outreach message."
            />
          ) : generating ? (
            <div className="space-y-3 animate-pulse">
              <div className="skeleton h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
              <div className="skeleton h-4 w-full animate-pulse rounded bg-zinc-800" />
              <div className="skeleton h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
              <div className="skeleton h-4 w-5/6 animate-pulse rounded bg-zinc-800" />
              <div className="skeleton h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
            </div>
          ) : result ? (
            <>
              {/* Subject line */}
              {result.subjectLine && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Subject line</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{result.subjectLine}</p>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                {(['main', 'followups', 'points'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
                      color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
                      boxShadow: activeTab === tab ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {tab === 'main' ? 'Main pitch' : tab === 'followups' ? 'Follow-ups' : 'Talking points'}
                  </button>
                ))}
              </div>

              {/* Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--text)' }}
                >
                  {activeTab === 'main' && (
                    <div className="whitespace-pre-wrap">{result.main}</div>
                  )}
                  {activeTab === 'followups' && (
                    <div className="space-y-3">
                      {result.followUps.map((fu, i) => (
                        <div key={i} className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                            Follow-up {i + 1}
                          </p>
                          <p>{fu}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 'points' && (
                    <ul className="space-y-2">
                      {result.talkingPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => copyText(
                    activeTab === 'main' ? result.main :
                    activeTab === 'followups' ? result.followUps.join('\n\n') :
                    result.talkingPoints.join('\n'),
                    activeTab
                  )}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-[var(--bg-input)]"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  {copiedField === activeTab ? <Check size={14} /> : <Copy size={14} />}
                  {copiedField === activeTab ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => form.handleSubmit(generatePitch)()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-[var(--bg-input)]"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  <RefreshCw size={14} />
                  Regenerate
                </button>
                <button
                  onClick={savePitch}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                >
                  <Save size={14} />
                  Save
                </button>
              </div>
            </>
          ) : null}
        </motion.div>
      </div>

      {/* Saved Pitches */}
      {savedPitches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text)' }}>Saved Pitches</h3>
          <div className="space-y-3">
            {savedPitches.map((pitch) => (
              <motion.div
                key={pitch.id}
                layout
                className="rounded-2xl p-4 cursor-pointer transition-colors hover:bg-[var(--bg-input)]"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                }}
                onClick={() => setExpandedPitch(expandedPitch === pitch.id ? null : pitch.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{pitch.pageName}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {pitch.serviceType} · {formatDate(pitch.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyText(pitch.pitch.main, pitch.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {copiedField === pitch.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePitch(pitch.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {expandedPitch === pitch.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 text-sm border-t"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                    >
                      {pitch.pitch.main}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
