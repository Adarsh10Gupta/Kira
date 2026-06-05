import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { useDynamicSectionsStore, type TabItem } from '@/stores/dynamicSectionsStore';
import { useXPStore } from '@/stores/xpStore';
import { useToastStore } from '@/stores/toastStore';
import { getToday } from '@/lib/utils';

export function DynamicSectionPage() {
  const { id } = useParams<{ id: string }>();
  const { sections, updateTabData, getTabData, loading } = useDynamicSectionsStore();
  const { awardXP } = useXPStore();
  const { showToast } = useToastStore();

  const section = sections.find((s) => s.id === id);

  const [activeTabId, setActiveTabId] = useState('');

  // Set active tab once section loads
  useEffect(() => {
    if (section && section.tabs.length > 0) {
      setActiveTabId(section.tabs[0].id);
    }
  }, [section, id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-zinc-500">
        <Icons.Loader2 className="animate-spin mr-2" size={18} />
        <span>Loading section data...</span>
      </div>
    );
  }

  if (!section) {
    return <Navigate to="/" replace />;
  }

  const activeTab = section.tabs.find((t) => t.id === activeTabId);

  // Dynamic Lucide Icon
  const SectionIcon = (Icons as any)[section.icon] || Icons.Folder;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Section Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 md:p-6 relative overflow-hidden border"
        style={{
          background: `linear-gradient(135deg, ${section.color}10, ${section.color}05)`,
          borderColor: `${section.color}20`,
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{ background: section.color }}
          >
            <SectionIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">{section.title}</h1>
            <p className="text-xs text-zinc-400 mt-1">{section.description}</p>
          </div>
        </div>

        {/* Quick Stats Banner */}
        {section.quickStats && section.quickStats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6 border-t border-zinc-800/40 pt-4">
            {section.quickStats.map((stat, i) => (
              <div key={i} className="p-3 bg-zinc-900/45 rounded-xl border border-zinc-850">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{stat}</p>
                <p className="text-xs text-zinc-300 font-medium mt-1">Status Loaded</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--bg-input)' }}>
        {section.tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className="relative flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center"
            style={{
              background: activeTabId === tab.id ? 'var(--bg-card)' : 'transparent',
              color: activeTabId === tab.id ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: activeTabId === tab.id ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Tab Render Grid */}
      <AnimatePresence mode="wait">
        {activeTab && (
          <motion.div
            key={activeTab.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="rounded-2xl p-5 md:p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white">{activeTab.title}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">{activeTab.description}</p>
            </div>

            <TabContentRenderer
              sectionId={section.id}
              tab={activeTab}
              getTabData={getTabData}
              updateTabData={updateTabData}
              awardXP={awardXP}
              showToast={showToast}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Inner tab manager
interface TabProps {
  sectionId: string;
  tab: TabItem;
  getTabData: (secId: string, tabId: string) => any;
  updateTabData: (secId: string, tabId: string, data: any) => void;
  awardXP: (action: string, xp: number) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function TabContentRenderer({ sectionId, tab, getTabData, updateTabData, awardXP, showToast }: TabProps) {
  const rawData = getTabData(sectionId, tab.id) || {};

  // 1. Checklist Renderer
  if (tab.type === 'checklist') {
    const checked = rawData.checked || [];
    const total = tab.items.length;
    const progress = total > 0 ? (checked.length / total) * 100 : 0;

    const toggleItem = (item: string) => {
      let newChecked = [...checked];
      const index = newChecked.indexOf(item);
      if (index > -1) {
        newChecked.splice(index, 1);
      } else {
        newChecked.push(item);
        awardXP(`Checklist item completed: ${item}`, 5);
        showToast('Task completed! +5 XP', 'success');
      }
      updateTabData(sectionId, tab.id, { checked: newChecked });
    };

    return (
      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-1 bg-zinc-900/30 p-3 rounded-xl border border-zinc-850">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-zinc-400">Completion Progress</span>
            <span className="text-primary">{checked.length} / {total} Done ({Math.round(progress)}%)</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Checkbox Listing */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {tab.items.map((item: string, idx: number) => {
            const isChecked = checked.includes(item);
            return (
              <div
                key={idx}
                onClick={() => toggleItem(item)}
                className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-850 flex items-center gap-3 cursor-pointer hover:bg-zinc-850/40 transition-colors"
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                    isChecked ? 'bg-success text-white' : 'border border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {isChecked && <Icons.Check size={14} />}
                </div>
                <span className={`text-xs font-medium ${isChecked ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. Resource List Renderer
  if (tab.type === 'resource_list') {
    const read = rawData.read || [];

    const toggleRead = (title: string) => {
      let newRead = [...read];
      const idx = newRead.indexOf(title);
      if (idx > -1) {
        newRead.splice(idx, 1);
      } else {
        newRead.push(title);
        awardXP(`Completed reading: ${title}`, 10);
        showToast('Resource completed! +10 XP', 'success');
      }
      updateTabData(sectionId, tab.id, { read: newRead });
    };

    return (
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {tab.items.map((res: any, idx: number) => {
          const isRead = read.includes(res.title);
          return (
            <div
              key={idx}
              className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <a
                  href={res.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"
                >
                  {res.title} <Icons.ExternalLink size={11} className="text-zinc-500" />
                </a>
                <p className="text-[11px] text-zinc-500">{res.description || 'Reference materials'}</p>
              </div>
              <button
                onClick={() => toggleRead(res.title)}
                className={`py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                  isRead 
                    ? 'bg-success/10 text-success border border-success/20' 
                    : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-750'
                }`}
              >
                {isRead ? 'Completed' : 'Mark Complete'}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // 3. Progress Tracker Renderer (Sliders)
  if (tab.type === 'progress_tracker') {
    const progress = rawData.progress || {};

    const handleProgressChange = (topic: string, val: number) => {
      const updated = { ...progress, [topic]: val };
      updateTabData(sectionId, tab.id, { progress: updated });
    };

    return (
      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {tab.items.map((topic: string, idx: number) => {
          const val = progress[topic] || 0;
          return (
            <div key={idx} className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-zinc-300">{topic}</span>
                <span className="text-[11px] font-bold text-primary">{val}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={val}
                onChange={(e) => handleProgressChange(topic, Number(e.target.value))}
                className="w-full accent-primary h-1 rounded-full cursor-pointer bg-zinc-800"
              />
            </div>
          );
        })}
      </div>
    );
  }

  // 4. Notes Markdown Editor
  if (tab.type === 'notes') {
    const [noteText, setNoteText] = useState(rawData.text || '');
    const [previewMode, setPreviewMode] = useState(false);

    const handleTextChange = (txt: string) => {
      setNoteText(txt);
      updateTabData(sectionId, tab.id, { text: txt });
    };

    return (
      <div className="space-y-3">
        <div className="flex justify-end gap-1.5">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold rounded-lg"
          >
            {previewMode ? 'Editor View' : 'Markdown Preview'}
          </button>
        </div>

        {previewMode ? (
          <div className="p-4 bg-zinc-900/30 border border-zinc-850 rounded-xl text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap font-sans min-h-[160px]">
            {noteText || <span className="text-zinc-600 italic">No notes created yet.</span>}
          </div>
        ) : (
          <textarea
            value={noteText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Document formulas, syllabus points, cheat sheets, or notes here..."
            rows={8}
            className="w-full bg-zinc-900/50 border border-zinc-850 rounded-xl p-3 text-xs leading-relaxed text-zinc-300 focus:outline-none focus:border-zinc-750"
          />
        )}
      </div>
    );
  }

  // 5. Weekly Schedule Renderer
  if (tab.type === 'schedule') {
    const schedule = rawData.schedule || {};

    const handleEditSlot = (slot: string, text: string) => {
      const updated = { ...schedule, [slot]: text };
      updateTabData(sectionId, tab.id, { schedule: updated });
    };

    return (
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {tab.items.map((slot: string, idx: number) => {
          const val = schedule[slot] || '';
          return (
            <div
              key={idx}
              className="p-3 bg-zinc-900/40 border border-zinc-850 rounded-xl flex items-center gap-3 text-xs"
            >
              <span className="w-20 font-bold text-primary select-none">{slot}</span>
              <input
                type="text"
                value={val}
                onChange={(e) => handleEditSlot(slot, e.target.value)}
                placeholder="Log daily focus schedule..."
                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-zinc-300 text-xs py-0"
              />
            </div>
          );
        })}
      </div>
    );
  }

  // 6. Flashcards study deck
  if (tab.type === 'flashcards') {
    const [cardIdx, setCardIdx] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const mastered = rawData.mastered || [];

    const isMastered = mastered.includes(cardIdx);

    const toggleMastered = () => {
      let newMastered = [...mastered];
      if (isMastered) {
        newMastered = newMastered.filter((m) => m !== cardIdx);
      } else {
        newMastered.push(cardIdx);
        awardXP('Mastered study flashcard', 10);
        showToast('Card mastered! +10 XP', 'success');
      }
      updateTabData(sectionId, tab.id, { mastered: newMastered });
    };

    const nextCard = () => {
      setFlipped(false);
      setCardIdx((prev) => (prev < tab.items.length - 1 ? prev + 1 : 0));
    };

    const prevCard = () => {
      setFlipped(false);
      setCardIdx((prev) => (prev > 0 ? prev - 1 : tab.items.length - 1));
    };

    if (tab.items.length === 0) {
      return (
        <div className="p-8 text-center text-zinc-500 text-xs">
          No flashcards defined in configuration.
        </div>
      );
    }

    const currentCard = tab.items[cardIdx];

    return (
      <div className="space-y-5 flex flex-col items-center">
        {/* Flashcard container with flip animation */}
        <div
          onClick={() => setFlipped(!flipped)}
          className="w-full max-w-sm h-48 relative cursor-pointer select-none perspective"
        >
          <motion.div
            animate={{ rotateX: flipped ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full relative transform-style-3d border border-zinc-800 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg bg-zinc-900/65"
          >
            {/* Front text */}
            <div className="backface-hidden w-full px-4 text-xs font-bold text-white leading-relaxed">
              {!flipped && (
                <>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Question</p>
                  <p>{currentCard.q || currentCard}</p>
                </>
              )}
            </div>

            {/* Back text */}
            <div className="backface-hidden transform rotate-x-180 w-full px-4 text-xs font-semibold text-primary leading-relaxed">
              {flipped && (
                <>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Answer</p>
                  <p>{currentCard.a || 'Click to reveal'}</p>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Action Panel */}
        <div className="flex items-center justify-between max-w-sm w-full gap-4">
          <div className="flex items-center gap-2">
            <button onClick={prevCard} className="p-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-zinc-300">
              <Icons.ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-mono text-zinc-500 font-semibold">{cardIdx + 1} / {tab.items.length}</span>
            <button onClick={nextCard} className="p-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-zinc-300">
              <Icons.ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={toggleMastered}
            className={`py-1.5 px-3 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1 ${
              isMastered 
                ? 'bg-success/15 border-success/30 text-success' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icons.CheckCircle2 size={13} />
            {isMastered ? 'Mastered' : 'Mark Mastered'}
          </button>
        </div>
      </div>
    );
  }

  // 7. Exam Countdown Timer Renderer
  if (tab.type === 'countdown') {
    const targetStr = tab.items[0] || '2027-02-07T09:00:00Z';
    const labelStr = tab.items[1] || 'Target Exam';

    const [timeLeftUnit, setTimeLeftUnit] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
      const calcTime = () => {
        const diff = new Date(targetStr).getTime() - Date.now();
        if (diff <= 0) {
          setTimeLeftUnit({ days: 0, hours: 0, minutes: 0, seconds: 0 });
          return;
        }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeftUnit({ days, hours, minutes, seconds });
      };

      calcTime();
      const tid = setInterval(calcTime, 1000);
      return () => clearInterval(tid);
    }, [targetStr]);

    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <h4 className="text-zinc-400 font-bold uppercase tracking-widest text-[10px]">{labelStr} Countdown</h4>
        
        <div className="flex gap-4 items-center justify-center select-none font-mono">
          {[
            { label: 'Days', val: timeLeftUnit.days },
            { label: 'Hrs', val: timeLeftUnit.hours },
            { label: 'Min', val: timeLeftUnit.minutes },
            { label: 'Sec', val: timeLeftUnit.seconds },
          ].map((unit, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-md">
                <h1 className="text-2xl font-black text-white">{String(unit.val).padStart(2, '0')}</h1>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1.5">{unit.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <div className="text-xs text-zinc-500 italic">Unknown tab renderer configuration.</div>;
}
