import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Copy, Trash2, FileText, Check, Loader2, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useXPStore } from '@/stores/xpStore';
import { useDynamicSectionsStore, type DynamicSectionConfig } from '@/stores/dynamicSectionsStore';
import { useToastStore } from '@/stores/toastStore';
import { callClaude } from '@/lib/claude';
import { SkeletonChat } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  buildIntent?: {
    intent: string;
    title: string;
    description: string;
  };
}

const suggestedPrompts = [
  'Review my week and give me feedback',
  'What should I focus on today?',
  'Help me write a pitch for an Instagram page',
  "I'm feeling unmotivated, help me",
  'Give me a study plan for this week',
];

export function CoachPage() {
  const { profile } = useAuthStore();
  const { awardXP } = useXPStore();
  const { createSection } = useDynamicSectionsStore();
  const { showToast } = useToastStore();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Custom Section Builder states
  const [buildingSectionName, setBuildingSectionName] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const displayName = profile?.display_name || 'User';

  const systemPrompt = `You are Kira, a personal AI life coach and guide for this user. You are talking to ${displayName}.
You know their context:
- Goals: earning money for a camera (₹15,000) and travel fund (₹30,000)
- Current focus: building websites for Instagram pages, learning ML/AI
- Personal growth: self-improvement, discipline, consistency
- You track their daily mood, study hours, diet, habits, and income

Your personality: warm, direct, motivating. Smart, expert coaching. Give concrete advice, not vague motivation. Be concise. Use bullet points when listing steps. Ask one follow-up question at the end of each response if relevant.

You have special abilities:
1. NORMAL COACHING: Answer questions, give advice, track progress.
2. BUILD SECTION: If the user mentions wanting to prepare for an exam (e.g. GATE), track a new goal area, or add/build a new tracker/section, you must respond with a special JSON block wrapped in <BUILD_SECTION> tags in addition to explaining what you will build:
<BUILD_SECTION>
{"intent": "gate_prep", "title": "GATE Preparation", "description": "Full GATE CS preparation tracker"}
</BUILD_SECTION>

3. LOG ACTION: If user says they completed something trackable (e.g. studied for 2 hours, drank water, completed a habit), wrap a log action in <LOG_ACTION> tags:
<LOG_ACTION>
{"type": "habit_done"|"study_session"|"goal_update"|"income_log", "data": {"minutes": 120, "topic": "ML"}}
</LOG_ACTION>`;

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const contextMessages = [...messages, userMessage].slice(-20).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await callClaude(systemPrompt, contextMessages);

      // Parse tags
      const buildRegex = /<BUILD_SECTION>([\s\S]*?)<\/BUILD_SECTION>/;
      const logRegex = /<LOG_ACTION>([\s\S]*?)<\/LOG_ACTION>/;

      let cleanContent = response.replace(buildRegex, '').replace(logRegex, '').trim();
      let buildIntent: any = undefined;

      const matchBuild = response.match(buildRegex);
      if (matchBuild) {
        try {
          buildIntent = JSON.parse(matchBuild[1].trim());
        } catch (e) {
          console.error('Failed to parse BUILD_SECTION JSON:', e);
        }
      }

      const matchLog = response.match(logRegex);
      if (matchLog) {
        try {
          const action = JSON.parse(matchLog[1].trim());
          handleLoggedAction(action);
        } catch (e) {
          console.error('Failed to parse LOG_ACTION JSON:', e);
        }
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: cleanContent,
        created_at: new Date().toISOString(),
        buildIntent,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t process that right now. Please check your API key in Settings or try again later.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleLoggedAction = (action: { type: string; data?: any }) => {
    let xpPoints = 10;
    let desc = 'Logged coaching item';

    if (action.type === 'habit_done') {
      xpPoints = 10;
      desc = 'Completed habit log via coach';
    } else if (action.type === 'study_session') {
      xpPoints = 25;
      desc = `Study session: ${action.data?.topic || 'ML study'}`;
    } else if (action.type === 'goal_update') {
      xpPoints = 20;
      desc = 'Goal progression log';
    } else if (action.type === 'income_log') {
      xpPoints = 10;
      desc = 'Income log update';
    }

    awardXP(desc, xpPoints);
    showToast(`✓ Logged action! +${xpPoints} XP`, 'success');
  };

  // Trigger building dynamic section config via Claude
  const triggerBuildSection = async (intent: string, title: string, description: string, msgId: string) => {
    setBuildingSectionName(title);
    
    // Hide intent card from list
    setMessages((prev) => 
      prev.map((m) => m.id === msgId ? { ...m, buildIntent: undefined } : m)
    );

    const builderPrompt = `You are building a custom tabbed section for a React application. The user wants a section named "${title}" (${description}).
Return ONLY a valid JSON object (no markdown code blocks, no trailing comments, no other text) with this exact schema:
{
  "id": "${intent.toLowerCase().replace(/[^a-z0-9]/g, '_')}",
  "title": "${title}",
  "icon": "GraduationCap" or any other relevant Lucide icon (e.g. Salad, BookOpen, Activity, Sparkles, Trophy, Calendar),
  "description": "${description}",
  "color": "#6366f1" or other elegant accent color,
  "tabs": [
    {
      "id": "checklist",
      "label": "Tracker",
      "type": "checklist",
      "title": "Tasks Checklist",
      "description": "Mark subjects/milestones off",
      "items": ["Milestone 1", "Milestone 2"]
    }
  ],
  "goals": [
    { "id": "goal1", "label": "Milestones met", "target": 10, "unit": "milestones" }
  ],
  "quickStats": ["Weekly Study Hours", "XP Earned", "Days Remaining"]
}

If the section is for GATE (e.g. "GATE Preparation"), populate it with:
1. checklist tab containing major GATE CS topics: Data Structures, Algorithms, OS, DBMS, Computer Networks, TOC, Compilers, Digital Logic, COA, Engineering Mathematics.
2. resource_list tab containing standard sources: NPTEL, GeeksForGeeks, GATE Overflow.
3. progress_tracker tab for Subject-wise progress.
4. notes tab for Formula Sheets.
5. schedule tab for Weekly Study Schedule.
6. flashcards tab for Study Cards (at least 3 sample Q&As).
7. countdown tab pointing to next year's exam date (e.g. 2027-02-07T09:00:00Z).
Otherwise use your knowledge to pre-populate relevant, extensive contents.`;

    try {
      const response = await callClaude(
        'You are an expert JSON configuration generator. Follow schemas perfectly.',
        [{ role: 'user', content: builderPrompt }]
      );
      
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const config: DynamicSectionConfig = JSON.parse(cleaned);

      if (config.id && config.tabs) {
        await createSection(config);
        awardXP(`Created new custom section: ${title}`, 25);
        showToast(`Section "${title}" generated! +25 XP`, 'success');
        navigate(`/section/${config.id}`);
      } else {
        showToast('JSON validation failed. Re-generation required.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Claude builder failed. Please verify configurations.', 'error');
    } finally {
      setBuildingSectionName(null);
    }
  };

  const copyMessage = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] relative">
      {/* Loading overlay for dynamic page construction */}
      {buildingSectionName && (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="animate-spin text-primary" size={36} />
          <h2 className="text-lg font-bold text-white">Assembling custom space: {buildingSectionName}</h2>
          <p className="text-xs text-zinc-400 max-w-xs">Generating layout schemas, checklists, countdown widgets, and syllabus files...</p>
        </div>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {messages.length} messages
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => sendMessage('Generate a comprehensive weekly review of my progress. Include wins, patterns, things to improve, and next week\'s focus.')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-input)]"
            style={{ color: 'var(--color-primary)' }}
          >
            <FileText size={14} />
            Weekly review
          </button>
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-input)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <EmptyState
              icon={<span className="text-3xl">💬</span>}
              title="Start a conversation"
              description="Your AI coach is ready to help with goals, habits, study plans, and more."
            />
            <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-md">
              {suggestedPrompts.map((prompt) => (
                <motion.button
                  key={prompt}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => sendMessage(prompt)}
                  className="px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            <AnimatePresence>
              {messages.map((message) => (
                <div key={message.id} className="space-y-3">
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`group relative max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-primary to-secondary text-white rounded-br-md'
                          : 'rounded-bl-md'
                      }`}
                      style={
                        message.role === 'assistant'
                          ? {
                              background: 'var(--bg-card)',
                              borderColor: 'var(--border)',
                              borderWidth: '1px',
                              color: 'var(--text)',
                            }
                          : undefined
                      }
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>

                      {/* Copy button */}
                      <button
                        onClick={() => copyMessage(message.id, message.content)}
                        className={`absolute -bottom-3 ${
                          message.role === 'user' ? 'right-2' : 'left-2'
                        } opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md`}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {copiedId === message.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </motion.div>

                  {/* AI-Generated custom section prompt block card */}
                  {message.role === 'assistant' && message.buildIntent && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 ml-4 max-w-md space-y-3"
                    >
                      <p className="text-xs text-zinc-300 font-semibold flex items-center gap-1.5">
                        <Sparkles size={14} className="text-primary animate-pulse" />
                        Shall I construct the custom tabbed section: <b>{message.buildIntent.title}</b>?
                      </p>
                      <p className="text-[11px] text-zinc-500 leading-normal">{message.buildIntent.description}</p>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => triggerBuildSection(
                            message.buildIntent!.intent,
                            message.buildIntent!.title,
                            message.buildIntent!.description,
                            message.id
                          )}
                          className="px-4 py-1.5 bg-gradient-to-r from-primary to-secondary text-white text-[10px] font-bold rounded-lg"
                        >
                          Yes, build it
                        </button>
                        <button
                          onClick={() => {
                            setMessages((prev) => 
                              prev.map((m) => m.id === message.id ? { ...m, buildIntent: undefined } : m)
                            );
                          }}
                          className="px-4 py-1.5 border border-zinc-800 text-zinc-400 hover:text-white text-[10px] font-bold rounded-lg"
                        >
                          Not now
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div
                  className="rounded-2xl rounded-bl-md px-4 py-3"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="flex gap-1">
                    <div className="typing-dot w-2 h-2 rounded-full bg-primary animate-bounce" />
                    <div className="typing-dot w-2 h-2 rounded-full bg-primary animate-bounce delay-75" />
                    <div className="typing-dot w-2 h-2 rounded-full bg-primary animate-bounce delay-150" />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Inputs panel */}
      <div className="px-4 pb-4 pt-2">
        <div
          className="max-w-3xl mx-auto flex items-end gap-2 p-2 rounded-2xl"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your coach anything or request to track a new study topic/exam..."
            rows={1}
            className="flex-1 px-3 py-2 text-sm bg-transparent resize-none outline-none border-none focus:ring-0"
            style={{ color: 'var(--text)', maxHeight: 120 }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-r from-primary to-secondary text-white disabled:opacity-40 transition-opacity"
          >
            <Send size={16} />
          </motion.button>
        </div>
        <p className="text-center text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
