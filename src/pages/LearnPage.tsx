import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, BookOpen, MessageCircle, Award, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { roadmapPhases, getTotalTopics } from '@/data/roadmap';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useXPStore } from '@/stores/xpStore';
import { useToastStore } from '@/stores/toastStore';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function LearnPage() {
  const navigate = useNavigate();
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['phase-1']));
  const [celebratingPhase, setCelebratingPhase] = useState<string | null>(null);

  const { showToast } = useToastStore();

  const totalTopics = getTotalTopics();
  const overallProgress = totalTopics > 0 ? (completedTopics.size / totalTopics) * 100 : 0;

  useEffect(() => {
    loadRoadmapProgress();
  }, []);

  const loadRoadmapProgress = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('roadmap_progress')
        .select('*')
        .eq('user_id', user.id);

      const completed = new Set<string>(data?.filter((p) => p.completed).map((p) => p.topic_id) || []);
      setCompletedTopics(completed);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTopic = async (topicId: string, phaseId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isCompleted = completedTopics.has(topicId);
      
      const { error } = await supabase.from('roadmap_progress').upsert({
        user_id: user.id,
        topic_id: topicId,
        completed: !isCompleted,
        completed_at: !isCompleted ? new Date().toISOString() : null
      }, { onConflict: 'user_id,topic_id' });

      if (error) throw error;

      setCompletedTopics((prev) => {
        const next = new Set(prev);
        if (isCompleted) {
          next.delete(topicId);
        } else {
          next.add(topicId);

          // Check if phase is now complete
          const phase = roadmapPhases.find((p) => p.id === phaseId);
          if (phase) {
            const allDone = phase.topics.every((t) => next.has(t.id));
            if (allDone && !celebratingPhase) {
              setCelebratingPhase(phaseId);
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981'],
              });
              setTimeout(() => setCelebratingPhase(null), 3000);
            }
          }
        }
        return next;
      });

      if (!isCompleted) {
        await supabase.from('xp_log').insert({
          user_id: user.id,
          action: 'topic_completed',
          xp: 25
        });
        await useXPStore.getState().initXP();
        showToast('Topic completed! +25 XP', 'success');
      } else {
        showToast('Topic marked incomplete', 'info');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to update progress', 'error');
    }
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const getPhaseProgress = (phaseId: string): number => {
    const phase = roadmapPhases.find((p) => p.id === phaseId);
    if (!phase) return 0;
    const completed = phase.topics.filter((t) => completedTopics.has(t.id)).length;
    return (completed / phase.topics.length) * 100;
  };

  const askClaude = (topic: string) => {
    navigate('/coach');
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 max-w-4xl mx-auto space-y-6"
    >
      {/* Overall Progress */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl p-6 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))',
          border: '1px solid rgba(99,102,241,0.15)',
        }}
      >
        <ProgressRing progress={overallProgress} size={140} strokeWidth={10} color="#6366f1">
          <div className="text-center">
            <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              {Math.round(overallProgress)}%
            </span>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Complete</p>
          </div>
        </ProgressRing>
        <p className="text-sm mt-3 font-medium" style={{ color: 'var(--text)' }}>
          {completedTopics.size} of {totalTopics} topics completed
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          ML/AI Learning Roadmap
        </p>
      </motion.div>

      {/* Phases */}
      <div className="space-y-4">
        {roadmapPhases.map((phase, phaseIndex) => {
          const progress = getPhaseProgress(phase.id);
          const isExpanded = expandedPhases.has(phase.id);
          const isComplete = progress === 100;

          return (
            <motion.div
              key={phase.id}
              variants={itemVariants}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${isComplete ? 'var(--color-success)' : 'var(--border)'}`,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Phase header */}
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full flex items-center gap-4 p-5 text-left transition-colors hover:bg-[var(--bg-input)]"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{
                    background: isComplete ? 'var(--color-success)' : 'var(--color-primary)',
                    color: 'white',
                  }}
                >
                  {isComplete ? <Award size={20} /> : phaseIndex + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      Phase {phaseIndex + 1} — {phase.title}
                    </h3>
                    {isComplete && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">
                        Complete!
                      </span>
                    )}
                    {celebratingPhase === phase.id && (
                      <span className="text-sm animate-bounce">🎉</span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {phase.weeks} · ~{phase.estimatedHours}h
                  </p>

                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: isComplete
                          ? 'var(--color-success)'
                          : 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                <div style={{ color: 'var(--text-muted)' }}>
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-2">
                      {/* Topics */}
                      {phase.topics.map((topic) => {
                        const isDone = completedTopics.has(topic.id);
                        return (
                          <div
                            key={topic.id}
                            className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-[var(--bg-input)] group"
                          >
                            <button
                              onClick={() => toggleTopic(topic.id, phase.id)}
                              className="flex-shrink-0"
                            >
                              {isDone ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                >
                                  <CheckCircle2 size={20} className="text-success" />
                                </motion.div>
                              ) : (
                                <Circle size={20} style={{ color: 'var(--border)' }} />
                              )}
                            </button>
                            <span
                              className="flex-1 text-sm"
                              style={{
                                color: isDone ? 'var(--text-muted)' : 'var(--text)',
                                textDecoration: isDone ? 'line-through' : 'none',
                              }}
                            >
                              {topic.title}
                            </span>
                            <button
                              onClick={() => askClaude(topic.title)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--bg-input)]"
                              style={{ color: 'var(--color-primary)' }}
                              title={`Ask Claude about "${topic.title}"`}
                            >
                              <MessageCircle size={14} />
                            </button>
                          </div>
                        );
                      })}

                      {/* Resources */}
                      {phase.resources.length > 0 && (
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                            <BookOpen size={12} className="inline mr-1" />
                            Resources
                          </p>
                          <div className="space-y-1">
                            {phase.resources.map((resource, i) => (
                              <p key={i} className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                <ExternalLink size={10} />
                                {resource}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
