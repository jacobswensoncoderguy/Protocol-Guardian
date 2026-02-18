import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Beaker, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Calendar,
  X, Trash2, RefreshCw, Loader2, Upload, AlertTriangle, FlaskConical,
  AlertCircle, Droplets, Bone, Zap, Syringe, Heart, Bug, ClipboardList,
  Link2, Pencil, Check,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import BiomarkerComparisonChart from './BiomarkerComparisonChart';
import DexaScanView from './DexaScanView';
import AlignToGoalDialog from './AlignToGoalDialog';
import ConfirmDialog from './ConfirmDialog';
import { UserGoal } from '@/hooks/useGoals';
import { toast } from 'sonner';

interface BiomarkerHistoryProps {
  userId?: string;
  onUploadClick: () => void;
  onFlaggedCountChange?: (count: number) => void;
  goals?: UserGoal[];
  onCreateGoal?: (goals: Omit<UserGoal, 'id' | 'status'>[]) => Promise<void>;
  onRefreshGoals?: () => void;
}

interface UploadRecord {
  id: string;
  file_name: string;
  upload_type: string;
  reading_date: string;
  ai_extracted_data: any;
  created_at: string;
}

interface BiomarkerPoint {
  name: string;
  value: number;
  unit: string;
  status: string;
  date: string;
  category: string;
  reference_low?: number;
  reference_high?: number;
}

// ─── Design tokens ────────────────────────────────────────────
const MARKER_COLORS: Record<string, string> = {
  'Total Testosterone': 'hsl(var(--primary))',
  'Free Testosterone': 'hsl(var(--chart-2))',
  'hs-CRP': 'hsl(var(--destructive))',
  'Vitamin D': 'hsl(var(--chart-5))',
  'Total Cholesterol': 'hsl(var(--chart-4))',
  'LDL': 'hsl(var(--chart-4))',
  'HDL': 'hsl(var(--chart-2))',
  'Cortisol': 'hsl(var(--chart-3))',
  'IGF-1': 'hsl(var(--primary))',
  'Hemoglobin': 'hsl(var(--destructive))',
  'Glucose': 'hsl(var(--chart-5))',
  'Estradiol': 'hsl(var(--chart-3))',
};
const DEFAULT_COLOR = 'hsl(var(--muted-foreground))';

const STATUS_ICONS: Record<string, typeof TrendingUp> = {
  normal: Minus, low: TrendingDown, high: TrendingUp, critical_low: TrendingDown, critical_high: TrendingUp,
};
const STATUS_TEXT_COLORS: Record<string, string> = {
  normal: 'text-emerald-400', low: 'text-amber-400', high: 'text-amber-400',
  critical_low: 'text-destructive', critical_high: 'text-destructive',
};

const DOC_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bloodwork: Droplets, dexa_scan: Bone, metabolic_panel: Zap,
  hormone_panel: Syringe, lipid_panel: Heart, thyroid_panel: Bug, other: ClipboardList,
};

const CATEGORY_LABELS: Record<string, string> = {
  bloodwork: 'Bloodwork Panels',
  dexa_scan: 'DEXA Scans',
  metabolic_panel: 'Metabolic Panels',
  hormone_panel: 'Hormone Panels',
  lipid_panel: 'Lipid Panels',
  thyroid_panel: 'Thyroid Panels',
  other: 'Lab Results',
};

// ─── Inline edit form ─────────────────────────────────────────
function InlineEditForm({
  upload,
  onSave,
  onCancel,
}: {
  upload: UploadRecord;
  onSave: (label: string, date: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(upload.file_name || '');
  const [date, setDate] = useState(upload.reading_date?.split('T')[0] || '');
  return (
    <div
      className="absolute inset-0 z-10 bg-card rounded-xl border border-primary/40 p-3 flex flex-col gap-2"
      onClick={e => e.stopPropagation()}
    >
      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Record name"
        autoFocus
        className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-secondary/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
      />
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-secondary/30 text-xs text-foreground focus:outline-none focus:border-primary/50"
      />
      <div className="flex gap-1.5 mt-auto">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg border border-border/50 text-[10px] text-muted-foreground hover:bg-secondary/30 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(label.trim(), date)}
          disabled={!label.trim()}
          className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
        >
          <Check className="w-3 h-3" /> Save
        </button>
      </div>
    </div>
  );
}

// ─── Detail sheet (full AI analysis) ─────────────────────────
function DetailSheet({
  upload,
  onClose,
  onDelete,
  onReanalyze,
  onAlignToGoal,
  isDeleting,
  isReanalyzing,
}: {
  upload: UploadRecord;
  onClose: () => void;
  onDelete: (id: string) => void;
  onReanalyze: (u: UploadRecord) => void;
  onAlignToGoal: (u: UploadRecord) => void;
  isDeleting: boolean;
  isReanalyzing: boolean;
}) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const biomarkers: any[] = upload.ai_extracted_data?.biomarkers || [];
  const recommendations: any[] = upload.ai_extracted_data?.recommendations || [];
  const summary: string = upload.ai_extracted_data?.summary || '';
  const DocIcon = DOC_TYPE_ICONS[upload.upload_type] || ClipboardList;

  const critical = biomarkers.filter(b => b.status?.startsWith('critical'));
  const flaggedOnly = biomarkers.filter(b => b.status !== 'normal' && !b.status?.startsWith('critical'));
  const normal = biomarkers.filter(b => b.status === 'normal');

  const groupedByCategory = biomarkers.reduce((acc, b) => {
    const cat = b.category || 'other';
    (acc[cat] = acc[cat] || []).push(b);
    return acc;
  }, {} as Record<string, any[]>);

  const labelDate = upload.reading_date
    ? new Date(upload.reading_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(upload.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-2 pb-2 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 sticky top-0 bg-card border-b border-border/30 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <DocIcon className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{upload.file_name || upload.upload_type.replace(/_/g, ' ')}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" /> {labelDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { onAlignToGoal(upload); onClose(); }}
              title="Align to a goal"
              disabled={isReanalyzing || isDeleting}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              <Link2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onReanalyze(upload)}
              title="Re-analyze with AI"
              disabled={isReanalyzing || isDeleting}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              {isReanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { onDelete(upload.id); onClose(); }}
              title="Delete record"
              disabled={isDeleting || isReanalyzing}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          {/* AI Summary */}
          {summary && (
            <p className="text-xs text-muted-foreground bg-secondary/20 rounded-xl px-3 py-2.5 leading-relaxed border border-border/30">
              {summary}
            </p>
          )}

          {/* Quick stats */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400" /> {normal.length} normal
            </div>
            {flaggedOnly.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-status-warning">
                <div className="w-2 h-2 rounded-full bg-status-warning" /> {flaggedOnly.length} flagged
              </div>
            )}
            {critical.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-destructive font-semibold">
                <div className="w-2 h-2 rounded-full bg-destructive" /> {critical.length} critical
              </div>
            )}
          </div>

          {/* Critical alerts */}
          {critical.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Critical Alerts
              </p>
              {critical.map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium">{m.name}</span>
                  <span className="font-mono text-destructive">{m.value} {m.unit}</span>
                </div>
              ))}
            </div>
          )}

          {/* Out of range (non-critical) */}
          {flaggedOnly.length > 0 && (
            <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-status-warning uppercase tracking-wider">Out of Range</p>
              {flaggedOnly.map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-foreground">{m.value} {m.unit}</span>
                    <span className="text-[10px] uppercase text-status-warning">{m.status.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All markers by category */}
          <div className="space-y-1.5">
            {Object.entries(groupedByCategory).map(([cat, markers]: [string, any[]]) => {
              const isCatExpanded = expandedCategory === cat;
              const catFlagged = markers.filter(m => m.status !== 'normal').length;
              return (
                <div key={cat} className="border border-border/40 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedCategory(isCatExpanded ? null : cat)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground capitalize">{cat.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-muted-foreground">{markers.length}</span>
                      {catFlagged > 0 && (
                        <span className="text-[10px] px-1 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/20">
                          {catFlagged}↑
                        </span>
                      )}
                    </div>
                    {isCatExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </button>
                  {isCatExpanded && (
                    <div className="px-3 pb-2.5 space-y-1">
                      {markers.map((m: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-secondary/20">
                          <span className="text-foreground">{m.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-foreground">{m.value} {m.unit}</span>
                            <span className={`text-[10px] ${STATUS_TEXT_COLORS[m.status] || 'text-muted-foreground'}`}>
                              {m.status === 'normal' ? '✓' : m.status?.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* AI Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-secondary/20 rounded-xl p-3 border border-border/30 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">AI Recommendations</p>
              {recommendations.map((rec: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertCircle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                    rec.priority === 'high' ? 'text-destructive' : rec.priority === 'medium' ? 'text-status-warning' : 'text-muted-foreground'
                  }`} />
                  <div>
                    <span className="text-xs text-foreground font-medium">{rec.biomarker}: </span>
                    <span className="text-xs text-muted-foreground">{rec.suggestion}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Align to goal CTA */}
          <button
            onClick={() => { onAlignToGoal(upload); onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-xs font-semibold text-primary"
          >
            <Link2 className="w-3.5 h-3.5" />
            Align This Lab to a Goal
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clean tile card ──────────────────────────────────────────
function UploadTile({
  upload,
  onDelete,
  onReanalyze,
  onAlignToGoal,
  onEditSaved,
  isDeleting,
  isReanalyzing,
}: {
  upload: UploadRecord;
  onDelete: (id: string) => void;
  onReanalyze: (u: UploadRecord) => void;
  onAlignToGoal: (u: UploadRecord) => void;
  onEditSaved: (id: string, label: string, date: string) => void;
  isDeleting: boolean;
  isReanalyzing: boolean;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const biomarkers: any[] = upload.ai_extracted_data?.biomarkers || [];
  const critical = biomarkers.filter(b => b.status?.startsWith('critical'));
  const flagged = biomarkers.filter(b => b.status !== 'normal');
  const DocIcon = DOC_TYPE_ICONS[upload.upload_type] || ClipboardList;

  const labelDate = upload.reading_date
    ? new Date(upload.reading_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : new Date(upload.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const tileName = upload.file_name || upload.upload_type.replace(/_/g, ' ');

  const handleEditSave = async (label: string, date: string) => {
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('user_goal_uploads')
        .update({ file_name: label, reading_date: date })
        .eq('id', upload.id);
      if (error) throw error;
      onEditSaved(upload.id, label, date);
      toast.success('Record updated');
    } catch {
      toast.error('Failed to update record');
    } finally {
      setSavingEdit(false);
      setEditing(false);
    }
  };

  return (
    <>
      {/* Tile */}
      <div
        className={cn(
          'relative bg-card rounded-xl border cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden',
          critical.length > 0 ? 'border-destructive/30' : flagged.length > 0 ? 'border-status-warning/30' : 'border-border/50'
        )}
        onClick={() => !editing && setDetailOpen(true)}
      >
        {/* Status stripe */}
        {(critical.length > 0 || flagged.length > 0) && (
          <div className={`h-0.5 w-full ${critical.length > 0 ? 'bg-destructive' : 'bg-status-warning'}`} />
        )}

        {/* Inline edit form overlay */}
        {editing && (
          <InlineEditForm
            upload={upload}
            onSave={handleEditSave}
            onCancel={() => setEditing(false)}
          />
        )}

        <div className="p-3">
          {/* Header row with icon + edit button */}
          <div className="flex items-start justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <DocIcon className="w-4 h-4 text-primary" />
            </div>
            <button
              onClick={e => { e.stopPropagation(); setEditing(true); }}
              title="Edit label & date"
              className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary/40 transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>

          {/* Name */}
          <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2 mb-1">{tileName}</p>

          {/* Date */}
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-2">
            <Calendar className="w-2.5 h-2.5 flex-shrink-0" />
            {labelDate}
          </p>

          {/* Status chips */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] text-muted-foreground">{biomarkers.length}m</span>
            {critical.length > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-semibold">
                {critical.length}!
              </span>
            )}
            {flagged.length > 0 && critical.length === 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/20">
                {flagged.length}↑
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Detail sheet */}
      {detailOpen && (
        <DetailSheet
          upload={upload}
          onClose={() => setDetailOpen(false)}
          onDelete={onDelete}
          onReanalyze={onReanalyze}
          onAlignToGoal={onAlignToGoal}
          isDeleting={isDeleting}
          isReanalyzing={isReanalyzing}
        />
      )}
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────
export default function BiomarkerHistoryView({
  userId,
  onUploadClick,
  onFlaggedCountChange,
  goals = [],
  onCreateGoal,
  onRefreshGoals,
}: BiomarkerHistoryProps) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMarker, setExpandedMarker] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alignUpload, setAlignUpload] = useState<UploadRecord | null>(null);
  const trendsRef = useRef<HTMLDivElement>(null);

  const fetchUploads = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_goal_uploads')
      .select('*')
      .eq('user_id', userId)
      .order('reading_date', { ascending: false });
    if (!error && data) setUploads(data as UploadRecord[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  const handleDelete = useCallback((id: string) => setDeleteConfirmId(id), []);

  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      const { error } = await supabase.from('user_goal_uploads').delete().eq('id', id);
      if (error) throw error;
      setUploads(prev => prev.filter(u => u.id !== id));
      toast.success('Record deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setDeletingId(null); }
  }, [deleteConfirmId]);

  const handleReanalyze = useCallback(async (upload: UploadRecord) => {
    setReanalyzingId(upload.id);
    try {
      const content = JSON.stringify(upload.ai_extracted_data?.biomarkers || []);
      const { data, error } = await supabase.functions.invoke('parse-biomarkers', {
        body: {
          fileContent: `Re-analyze these biomarkers and improve categorization, status, and recommendations:\n${content}`,
          fileType: upload.upload_type || 'medical document',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const { error: updateError } = await supabase
        .from('user_goal_uploads')
        .update({ ai_extracted_data: data })
        .eq('id', upload.id);
      if (updateError) throw updateError;
      setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, ai_extracted_data: data } : u));
      toast.success('Re-analysis complete');
      setTimeout(() => trendsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    } catch (e: any) {
      toast.error(e.message || 'Re-analysis failed');
    } finally { setReanalyzingId(null); }
  }, []);

  const handleEditSaved = useCallback((id: string, label: string, date: string) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, file_name: label, reading_date: date } : u));
  }, []);

  // Date filter
  const filteredUploads = useMemo(() => uploads.filter(u => {
    const d = new Date(u.reading_date || u.created_at);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo) { const e = new Date(dateTo); e.setHours(23, 59, 59, 999); if (d > e) return false; }
    return true;
  }), [uploads, dateFrom, dateTo]);

  const hasDateFilter = dateFrom || dateTo;

  // Build cross-upload timelines for trend cards
  const allPoints: BiomarkerPoint[] = [];
  [...uploads].reverse().forEach(upload => {
    (upload.ai_extracted_data?.biomarkers || []).forEach((b: any) => {
      allPoints.push({
        name: b.name, value: b.value, unit: b.unit, status: b.status,
        date: upload.reading_date?.split('T')[0] || upload.created_at.split('T')[0],
        category: b.category, reference_low: b.reference_low, reference_high: b.reference_high,
      });
    });
  });

  const markerTimelines = new Map<string, BiomarkerPoint[]>();
  allPoints.forEach(p => {
    const arr = markerTimelines.get(p.name) || [];
    arr.push(p);
    markerTimelines.set(p.name, arr);
  });
  markerTimelines.forEach(pts => pts.sort((a, b) => a.date.localeCompare(b.date)));

  const KEY_MARKERS = ['Total Testosterone', 'Free Testosterone', 'hs-CRP', 'Vitamin D', 'Total Cholesterol', 'LDL', 'HDL', 'Cortisol', 'IGF-1'];
  const keyMarkers = KEY_MARKERS.filter(m => markerTimelines.has(m));

  const totalMarkersTracked = markerTimelines.size;
  const totalFlagged = useMemo(() => {
    let count = 0;
    markerTimelines.forEach(pts => { if (pts[pts.length - 1].status !== 'normal') count++; });
    return count;
  }, [markerTimelines]);

  useEffect(() => { onFlaggedCountChange?.(totalFlagged); }, [totalFlagged, onFlaggedCountChange]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="bg-card rounded-xl border border-border/50 p-4 animate-pulse">
            <div className="h-4 w-40 bg-secondary rounded mb-2" />
            <div className="h-3 w-24 bg-secondary/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
        <FlaskConical className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground mb-1">No Lab Results Yet</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto leading-relaxed">
          Upload bloodwork, DEXA scans, or metabolic panels to track biomarkers over time.
        </p>
        <button
          onClick={onUploadClick}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Lab Results
        </button>
      </div>
    );
  }

  // Group filtered uploads by category for tile grid
  const categoryOrder: string[] = [];
  const categoryMap: Record<string, UploadRecord[]> = {};
  [...filteredUploads]
    .sort((a, b) => new Date(a.reading_date || a.created_at).getTime() - new Date(b.reading_date || b.created_at).getTime())
    .forEach(upload => {
      const cat = upload.upload_type || 'other';
      if (!categoryMap[cat]) { categoryMap[cat] = []; categoryOrder.push(cat); }
      categoryMap[cat].push(upload);
    });

  return (
    <div className="space-y-4">
      {/* Summary header + Upload button */}
      <div className="bg-card rounded-xl border border-border/50 p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {totalMarkersTracked} marker{totalMarkersTracked !== 1 ? 's' : ''} tracked
              </span>
              {totalFlagged > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/20 font-medium">
                  <AlertTriangle className="w-2.5 h-2.5" /> {totalFlagged} flagged
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {uploads.length} upload{uploads.length !== 1 ? 's' : ''} · tap a tile to view full analysis
            </p>
          </div>
        </div>
        <button
          onClick={onUploadClick}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              'text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 font-medium',
              dateFrom ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary/30 text-muted-foreground border-border/50 hover:bg-secondary/50'
            )}>
              <Calendar className="w-3 h-3" />
              {dateFrom ? format(dateFrom, 'MMM d, yyyy') : 'From'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker mode="single" selected={dateFrom} onSelect={setDateFrom}
              disabled={date => !!dateTo && date > dateTo} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <span className="text-[10px] text-muted-foreground">→</span>
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              'text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 font-medium',
              dateTo ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary/30 text-muted-foreground border-border/50 hover:bg-secondary/50'
            )}>
              <Calendar className="w-3 h-3" />
              {dateTo ? format(dateTo, 'MMM d, yyyy') : 'To'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker mode="single" selected={dateTo} onSelect={setDateTo}
              disabled={date => !!dateFrom && date < dateFrom} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {hasDateFilter && (
          <button
            onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
            className="text-[10px] px-2 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors inline-flex items-center gap-1 font-medium"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* DEXA Body Composition */}
      <DexaScanView uploads={filteredUploads} />

      {/* Key Marker Trend Cards (multi-upload only) */}
      {keyMarkers.length > 0 && uploads.length >= 2 && (
        <div ref={trendsRef}>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Trends Across Uploads</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {keyMarkers.map(markerName => {
              const points = markerTimelines.get(markerName)!;
              const latest = points[points.length - 1];
              const previous = points.length > 1 ? points[points.length - 2] : null;
              const change = previous ? latest.value - previous.value : null;
              const changePercent = previous ? ((change! / previous.value) * 100) : null;
              const color = MARKER_COLORS[markerName] || DEFAULT_COLOR;
              const StatusIcon = STATUS_ICONS[latest.status] || Minus;
              const isExpanded = expandedMarker === markerName;
              const chartData = points.map(p => ({
                date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: p.value,
              }));
              return (
                <div key={markerName} className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <button onClick={() => setExpandedMarker(isExpanded ? null : markerName)} className="w-full p-3 text-left hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground truncate">{markerName}</span>
                      <StatusIcon className={`w-3 h-3 ${STATUS_TEXT_COLORS[latest.status]}`} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-mono font-bold text-foreground">{latest.value}</span>
                      <span className="text-[10px] text-muted-foreground">{latest.unit}</span>
                    </div>
                    {change !== null && (
                      <div className={`text-[10px] font-mono mt-0.5 ${change > 0 ? 'text-emerald-400' : change < 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                        {change > 0 ? '+' : ''}{change.toFixed(1)} ({changePercent! > 0 ? '+' : ''}{changePercent!.toFixed(1)}%)
                      </div>
                    )}
                  </button>
                  {isExpanded && chartData.length >= 2 && (
                    <div className="px-2 pb-3">
                      <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={30} domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                            {latest.reference_high && <ReferenceLine y={latest.reference_high} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeWidth={1} />}
                            {latest.reference_low && <ReferenceLine y={latest.reference_low} stroke="hsl(var(--chart-5))" strokeDasharray="3 3" strokeWidth={1} />}
                            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5, fill: color }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comparison Chart */}
      {markerTimelines.size >= 2 && uploads.length >= 2 && (
        <BiomarkerComparisonChart markerTimelines={markerTimelines} markerColors={MARKER_COLORS} defaultColor={DEFAULT_COLOR} />
      )}

      {/* ── Category-grouped tile grid ── */}
      <div className="space-y-6">
        {categoryOrder.map(cat => {
          const catUploads = categoryMap[cat];
          const label = CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          return (
            <div key={cat}>
              {/* Category header + horizontal separator */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-bold text-foreground uppercase tracking-widest whitespace-nowrap">
                  {label}
                </span>
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] text-muted-foreground tabular-nums">{catUploads.length}</span>
              </div>

              {/* Tiles — horizontal first, 2 per row mobile → 3 on sm */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {catUploads.map(upload => (
                  <UploadTile
                    key={upload.id}
                    upload={upload}
                    onDelete={handleDelete}
                    onReanalyze={handleReanalyze}
                    onAlignToGoal={setAlignUpload}
                    onEditSaved={handleEditSaved}
                    isDeleting={deletingId === upload.id}
                    isReanalyzing={reanalyzingId === upload.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}
        title="Delete Lab Record?"
        description="This will permanently remove this lab upload and all its extracted biomarker data. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirmed}
      />

      {/* Align to Goal dialog */}
      {alignUpload && (
        <AlignToGoalDialog
          open={!!alignUpload}
          onOpenChange={open => { if (!open) setAlignUpload(null); }}
          userId={userId}
          uploadId={alignUpload.id}
          uploadLabel={alignUpload.file_name || alignUpload.upload_type}
          uploadDate={alignUpload.reading_date?.split('T')[0] || new Date().toISOString().split('T')[0]}
          biomarkers={alignUpload.ai_extracted_data?.biomarkers || []}
          goals={goals}
          onCreateGoal={onCreateGoal}
          onGoalAligned={() => { onRefreshGoals?.(); fetchUploads(); }}
        />
      )}
    </div>
  );
}
