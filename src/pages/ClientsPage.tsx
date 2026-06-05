import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, closestCorners, DragOverlay,
  type DragEndEvent, type DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, X, Users, TrendingUp, Target, IndianRupee,
  AtSign, Mail, GripVertical, Check, Trash2,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useXPStore } from '@/stores/xpStore';
import { useToastStore } from '@/stores/toastStore';

interface Lead {
  id: string;
  name: string;
  instagram_url: string;
  email: string;
  service_type: string;
  budget_estimate: number;
  status: string;
  notes: string;
  follow_up_date: string;
  created_at: string;
}

const STATUSES = ['Prospecting', 'Pitched', 'In Talks', 'Project Active', 'Completed'] as const;

const statusColors: Record<string, string> = {
  Prospecting: '#6366f1',
  Pitched: '#f59e0b',
  'In Talks': '#06b6d4',
  'Project Active': '#8b5cf6',
  Completed: '#10b981',
};

function SortableCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        onClick={onClick}
        className="rounded-xl p-3 cursor-pointer group"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{lead.name}</p>
          <div {...listeners} className="cursor-grab p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          {lead.instagram_url && (
            <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
              <AtSign size={10} />
              {lead.instagram_url}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
            {lead.service_type}
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
            {formatCurrency(lead.budget_estimate)}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

export function ClientsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newLead, setNewLead] = useState({
    name: '', instagram_url: '', email: '', service_type: 'Landing page',
    budget_estimate: '', notes: '', follow_up_date: '',
  });

  const { awardXP } = useXPStore();
  const { showToast } = useToastStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setLeads(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const getLeadsByStatus = (status: string) => leads.filter((l) => l.status === status);

  const totalActive = leads.filter((l) => l.status !== 'Completed').length;
  const totalCompleted = leads.filter((l) => l.status === 'Completed').length;
  const conversionRate = leads.length > 0 ? Math.round((totalCompleted / leads.length) * 100) : 0;
  const avgDeal = leads.length > 0 ? leads.reduce((s, l) => s + l.budget_estimate, 0) / leads.length : 0;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    const targetStatus = STATUSES.find((s) => s === overId);
    if (targetStatus && isSupabaseConfigured) {
      const leadId = active.id as string;
      try {
        const { error } = await supabase
          .from('leads')
          .update({ status: targetStatus })
          .eq('id', leadId);
        if (error) throw error;

        setLeads((prev) =>
          prev.map((l) => l.id === leadId ? { ...l, status: targetStatus } : l)
        );
        showToast(`Lead status updated to ${targetStatus}`, 'success');
      } catch (e: any) {
        console.error(e);
        showToast(e.message || 'Failed to move lead', 'error');
      }
    }
  };

  const addLead = async () => {
    if (!newLead.name) return;
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: insertedLead, error } = await supabase
        .from('leads')
        .insert({
          user_id: user.id,
          name: newLead.name,
          instagram_url: newLead.instagram_url,
          email: newLead.email,
          service_type: newLead.service_type,
          budget_estimate: Number(newLead.budget_estimate) || 0,
          status: 'Prospecting',
          notes: newLead.notes,
          follow_up_date: newLead.follow_up_date || null,
        })
        .select()
        .single();

      if (error) throw error;
      if (insertedLead) {
        setLeads((prev) => [insertedLead, ...prev]);
        await awardXP('lead_added', 10);
        showToast('Lead added! +10 XP', 'success');
      }

      setNewLead({ name: '', instagram_url: '', email: '', service_type: 'Landing page', budget_estimate: '', notes: '', follow_up_date: '' });
      setShowAddDrawer(false);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to add lead', 'error');
    }
  };

  const markAsWon = async (id: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'Completed' })
        .eq('id', id);
      if (error) throw error;

      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: 'Completed' } : l));
      setSelectedLead(null);
      showToast('Lead marked as won! 🎉', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to update lead', 'error');
    }
  };

  const deleteLead = async (id: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      if (error) throw error;

      setLeads((prev) => prev.filter((l) => l.id !== id));
      setSelectedLead(null);
      showToast('Lead deleted', 'info');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to delete lead', 'error');
    }
  };

  const inputStyle = { background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' };

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: 'Active leads', value: String(totalActive), color: '#6366f1' },
          { icon: Target, label: 'Completed', value: String(totalCompleted), color: '#10b981' },
          { icon: TrendingUp, label: 'Conversion', value: `${conversionRate}%`, color: '#06b6d4' },
          { icon: IndianRupee, label: 'Avg deal', value: formatCurrency(avgDeal), color: '#f59e0b' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}18`, color: stat.color }}>
              <stat.icon size={16} />
            </div>
            <div>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
              <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add lead button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Pipeline</h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddDrawer(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-primary to-secondary"
        >
          <Plus size={14} /> Add Lead
        </motion.button>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title="No leads yet"
          description="No leads yet — generate your first pitch"
        />
      ) : (
        /* Kanban Board */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUSES.map((status) => {
              const statusLeads = getLeadsByStatus(status);
              return (
                <div
                  key={status}
                  id={status}
                  className="flex-shrink-0 w-64 md:w-72 rounded-2xl p-3"
                  style={{ background: 'var(--bg-input)', minHeight: 200 }}
                >
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: statusColors[status] }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                      {status}
                    </span>
                    <span className="text-[10px] ml-auto px-1.5 py-0.5 rounded-md" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                      {statusLeads.length}
                    </span>
                  </div>

                  <SortableContext items={statusLeads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {statusLeads.map((lead) => (
                        <SortableCard
                          key={lead.id}
                          lead={lead}
                          onClick={() => setSelectedLead(lead)}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  {statusLeads.length === 0 && (
                    <p className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>
                      Drop leads here
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </DndContext>
      )}

      {/* Add Lead Drawer */}
      <AnimatePresence>
        {showAddDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowAddDrawer(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 p-6 overflow-y-auto"
              style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Add Lead</h3>
                <button onClick={() => setShowAddDrawer(false)} className="p-2 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: 'var(--text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Name / Page name *</label>
                  <input type="text" value={newLead.name} onChange={(e) => setNewLead((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} placeholder="e.g. Fitness Guru Page" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Instagram URL</label>
                  <input type="text" value={newLead.instagram_url} onChange={(e) => setNewLead((p) => ({ ...p, instagram_url: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} placeholder="@handle" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email (optional)</label>
                  <input type="email" value={newLead.email} onChange={(e) => setNewLead((p) => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Service type</label>
                  <select value={newLead.service_type} onChange={(e) => setNewLead((p) => ({ ...p, service_type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle}>
                    {['Landing page', 'Full website', 'Link-in-bio page', 'Portfolio site', 'E-commerce store'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Budget estimate (₹)</label>
                  <input type="number" value={newLead.budget_estimate} onChange={(e) => setNewLead((p) => ({ ...p, budget_estimate: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} placeholder="5000" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Notes</label>
                  <textarea value={newLead.notes} onChange={(e) => setNewLead((p) => ({ ...p, notes: e.target.value }))} rows={3} className="w-full px-3 py-2.5 rounded-xl text-sm resize-none" style={inputStyle} placeholder="Any notes about this lead..." />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Next follow-up</label>
                  <input type="date" value={newLead.follow_up_date} onChange={(e) => setNewLead((p) => ({ ...p, follow_up_date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} />
                </div>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={addLead}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary to-secondary"
                >
                  Add Lead
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lead Detail Modal */}
      <AnimatePresence>
        {selectedLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSelectedLead(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg z-50 rounded-2xl p-6 overflow-y-auto max-h-[90vh] flex flex-col justify-between"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{selectedLead.name}</h3>
                  <button onClick={() => setSelectedLead(null)} className="p-2 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: 'var(--text-muted)' }}>
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ background: statusColors[selectedLead.status] }}>
                      {selectedLead.status}
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{formatCurrency(selectedLead.budget_estimate)}</span>
                  </div>

                  {selectedLead.instagram_url && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <AtSign size={14} />
                      {selectedLead.instagram_url}
                    </div>
                  )}
                  {selectedLead.email && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <Mail size={14} />
                      {selectedLead.email}
                    </div>
                  )}

                  <div className="rounded-xl p-3" style={{ background: 'var(--bg-input)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Service</p>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>{selectedLead.service_type}</p>
                  </div>

                  {selectedLead.notes && (
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-input)' }}>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
                      <p className="text-sm" style={{ color: 'var(--text)' }}>{selectedLead.notes}</p>
                    </div>
                  )}

                  {selectedLead.follow_up_date && (
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-input)' }}>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Follow-up</p>
                      <p className="text-sm" style={{ color: 'var(--text)' }}>{formatDate(selectedLead.follow_up_date)}</p>
                    </div>
                  )}

                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Added: {formatDate(selectedLead.created_at)}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                {selectedLead.status !== 'Completed' && (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => markAsWon(selectedLead.id)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-success to-emerald-500 flex items-center justify-center gap-2"
                  >
                    <Check size={16} />
                    Mark as won
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => deleteLead(selectedLead.id)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-danger border border-danger/25 hover:bg-danger/5 flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
