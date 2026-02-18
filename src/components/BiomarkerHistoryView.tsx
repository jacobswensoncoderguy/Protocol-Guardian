import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Beaker, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Calendar, FileText, X, Trash2, RefreshCw, Loader2, Upload, AlertTriangle, FlaskConical, AlertCircle, Droplets, Bone, Zap, Syringe, Heart, Bug, ClipboardList, Link2 } from 'lucide-react';
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
  normal: Minus,
  low: TrendingDown,
  high: TrendingUp,
  critical_low: TrendingDown,
  critical_high: TrendingUp,
};

const STATUS_TEXT_COLORS: Record<string, string> = {
  normal: 'text-emerald-400',
  low: 'text-amber-400',
  high: 'text-amber-400',
  critical_low: 'text-destructive',
  critical_high: 'text-destructive',
};

const STATUS_BG: Record<string, string> = {
  normal: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  low: 'bg-status-warning/10 border-status-warning/20 text-status-warning',
  high: 'bg-status-warning/10 border-status-warning/20 text-status-warning',
  critical_low: 'bg-destructive/10 border-destructive/20 text-destructive',
  critical_high: 'bg-destructive/10 border-destructive/20 text-destructive',
};

const DOC_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bloodwork: Droplets,
  dexa_scan: Bone,
  metabolic_panel: Zap,
  hormone_panel: Syringe,
  lipid_panel: Heart,
  thyroid_panel: Bug,
  other: ClipboardList,
};

/** A rich expandable card for a single upload record */
function UploadCard({
  upload,
  onDelete,
  onReanalyze,
  onAlignToGoal,
  isDeleting,
  isReanalyzing,
  startExpanded = false,
}: {
  upload: UploadRecord;
  onDelete: (id: string) => void;
  onReanalyze: (u: UploadRecord) => void;
  onAlignToGoal: (u: UploadRecord) => void;
  isDeleting: boolean;
  isReanalyzing: boolean;
  startExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(startExpanded);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const biomarkers: any[] = upload.ai_extracted_data?.biomarkers || [];
  const recommendations: any[] = upload.ai_extracted_data?.recommendations || [];
  const summary: string = upload.ai_extracted_data?.summary || '';
  const docType: string = upload.upload_type || 'other';
  const DocIcon = DOC_TYPE_ICONS[docType] || ClipboardList;

  const flagged = biomarkers.filter(b => b.status !== 'normal');
  const critical = biomarkers.filter(b => b.status?.startsWith('critical'));
  const normal = biomarkers.filter(b => b.status === 'normal');

  const groupedByCategory = biomarkers.reduce((acc, b) => {
    const cat = b.category || 'other';
    (acc[cat] = acc[cat] || []).push(b);
    return acc;
  }, {} as Record<string, any[]>);

  const labelDate = upload.reading_date
    ? new Date(upload.reading_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(upload.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      {/* Header row — always visible */}
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/20 transition-colors min-w-0"
        >
          {/* Doc type icon */}
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <DocIcon className="w-4 h-4 text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Label */}
            <p className="text-sm font-semibold text-foreground truncate">
              {upload.file_name || docType.replace(/_/g, ' ')}
            </p>
            {/* Meta row */}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {labelDate}
              </span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">{biomarkers.length} markers</span>
              {critical.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                  <AlertCircle className="w-2.5 h-2.5" />
                  {critical.length} critical
                </span>
              )}
              {flagged.length > 0 && critical.length === 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/20">
                  {flagged.length} flagged
                </span>
              )}
            </div>
          </div>

          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </button>

        {/* Action buttons */}
        <button
          onClick={() => onAlignToGoal(upload)}
          disabled={isReanalyzing || isDeleting}
          title="Align to a goal"
          className="p-2.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
        >
          <Link2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onReanalyze(upload)}
          disabled={isReanalyzing || isDeleting}
          title="Re-analyze with AI"
          className="p-2.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
        >
          {isReanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
        <button
          onClick={() => onDelete(upload.id)}
          disabled={isDeleting || isReanalyzing}
          title="Delete upload"
          className="p-2.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border/30 px-4 py-3 space-y-3">

          {/* AI summary */}
          {summary && (
            <p className="text-xs text-muted-foreground bg-secondary/20 rounded-lg px-3 py-2 leading-relaxed">
              {summary}
            </p>
          )}

          {/* Quick stats */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              {normal.length} normal
            </div>
            {flagged.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-status-warning">
                <div className="w-2 h-2 rounded-full bg-status-warning" />
                {flagged.length} flagged
              </div>
            )}
            {critical.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-destructive font-semibold">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                {critical.length} critical
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

          {/* Flagged (non-critical) */}
          {flagged.filter(b => !b.status?.startsWith('critical')).length > 0 && (
            <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-status-warning uppercase tracking-wider">Out of Range</p>
              {flagged.filter(b => !b.status?.startsWith('critical')).map((m: any, i: number) => (
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
                <div key={cat} className="border border-border/40 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedCategory(isCatExpanded ? null : cat)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-secondary/20 transition-colors"
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
                    <div className="px-3 pb-2 space-y-1">
                      {markers.map((m: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-secondary/20">
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
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                AI Recommendations
              </p>
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
        </div>
      )}
    </div>
  );
}

/** Compact tile for the category grid — click to open full UploadCard sheet */
function UploadTile({
  upload,
  onDelete,
  onReanalyze,
  onAlignToGoal,
  isDeleting,
  isReanalyzing,
}: {
  upload: UploadRecord;
  onDelete: (id: string) => void;
  onReanalyze: (u: UploadRecord) => void;
  onAlignToGoal: (u: UploadRecord) => void;
  isDeleting: boolean;
  isReanalyzing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const biomarkers: any[] = upload.ai_extracted_data?.biomarkers || [];
  const critical = biomarkers.filter(b => b.status?.startsWith('critical'));
  const flagged = biomarkers.filter(b => b.status !== 'normal');
  const docType: string = upload.upload_type || 'other';
  const DocIcon = DOC_TYPE_ICONS[docType] || ClipboardList;

  const labelDate = upload.reading_date
    ? new Date(upload.reading_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : new Date(upload.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const tileName = upload.file_name || docType.replace(/_/g, ' ');

  return (
    <>
      {/* The Tile */}
      <div
        className={`relative bg-card rounded-xl border cursor-pointer hover:border-primary/40 hover:bg-secondary/20 transition-all overflow-hidden ${
          critical.length > 0 ? 'border-destructive/30' : flagged.length > 0 ? 'border-status-warning/30' : 'border-border/50'
        }`}
        onClick={() => setExpanded(true)}
      >
        {/* Status stripe at top */}
        {(critical.length > 0 || flagged.length > 0) && (
          <div className={`h-0.5 w-full ${critical.length > 0 ? 'bg-destructive' : 'bg-status-warning'}`} />
        )}

        <div className="p-3">
          {/* Icon */}
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <DocIcon className="w-4 h-4 text-primary" />
          </div>

          {/* Name — truncated to 2 lines */}
          <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2 mb-1">{tileName}</p>

          {/* Date */}
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5 flex-shrink-0" />
            {labelDate}
          </p>

          {/* Marker count + flags */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[9px] text-muted-foreground">{biomarkers.length} markers</span>
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

      {/* Full detail — rendered as the old UploadCard in a dialog-like overlay */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-2 pb-2 sm:pb-0"
          onClick={() => setExpanded(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 sticky top-0 bg-card border-b border-border/30 z-10">
              <div className="flex items-center gap-2">
                <DocIcon className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground truncate">{tileName}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { onAlignToGoal(upload); setExpanded(false); }}
                  title="Align to goal"
                  disabled={isReanalyzing || isDeleting}
                  className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 rounded-lg"
                >
                  <Link2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onReanalyze(upload)}
                  title="Re-analyze"
                  disabled={isReanalyzing || isDeleting}
                  className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 rounded-lg"
                >
                  {isReanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => { onDelete(upload.id); setExpanded(false); }}
                  title="Delete"
                  disabled={isDeleting || isReanalyzing}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 rounded-lg"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Reuse the expanded body from UploadCard */}
            <UploadCard
              upload={upload}
              onDelete={id => { onDelete(id); setExpanded(false); }}
              onReanalyze={onReanalyze}
              onAlignToGoal={u => { onAlignToGoal(u); setExpanded(false); }}
              isDeleting={isDeleting}
              isReanalyzing={isReanalyzing}
              startExpanded
            />
          </div>
        </div>
      )}
    </>
  );
}


export default function BiomarkerHistoryView({ userId, onUploadClick, onFlaggedCountChange, goals = [], onCreateGoal, onRefreshGoals }: BiomarkerHistoryProps) {
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

    if (!error && data) {
      setUploads(data as UploadRecord[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  // Delete with confirm — confirm first, then execute
  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteConfirmId) return;
    const uploadId = deleteConfirmId;
    setDeleteConfirmId(null);
    setDeletingId(uploadId);
    try {
      const { error } = await supabase.from('user_goal_uploads').delete().eq('id', uploadId);
      if (error) throw error;
      setUploads(prev => prev.filter(u => u.id !== uploadId));
      toast.success('Upload deleted');
    } catch {
      toast.error('Failed to delete upload');
    } finally {
      setDeletingId(null);
    }
  }, [deleteConfirmId]);

  const handleDelete = useCallback((uploadId: string) => {
    setDeleteConfirmId(uploadId);
  }, []);

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
      // Auto-scroll to trends after re-analysis
      setTimeout(() => {
        trendsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (e: any) {
      toast.error(e.message || 'Re-analysis failed');
    } finally {
      setReanalyzingId(null);
    }
  }, []);

  // Filter uploads by date range
  const filteredUploads = useMemo(() => {
    return uploads.filter(upload => {
      const d = new Date(upload.reading_date || upload.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (d > endOfDay) return false;
      }
      return true;
    });
  }, [uploads, dateFrom, dateTo]);

  const hasDateFilter = dateFrom || dateTo;

  // Build timeline across ALL uploads for trend charts
  const allPoints: BiomarkerPoint[] = [];
  [...uploads].reverse().forEach(upload => {
    const biomarkers = upload.ai_extracted_data?.biomarkers || [];
    biomarkers.forEach((b: any) => {
      allPoints.push({
        name: b.name,
        value: b.value,
        unit: b.unit,
        status: b.status,
        date: upload.reading_date?.split('T')[0] || upload.created_at.split('T')[0],
        category: b.category,
        reference_low: b.reference_low,
        reference_high: b.reference_high,
      });
    });
  });

  const markerTimelines = new Map<string, BiomarkerPoint[]>();
  allPoints.forEach(p => {
    const arr = markerTimelines.get(p.name) || [];
    arr.push(p);
    markerTimelines.set(p.name, arr);
  });
  markerTimelines.forEach(points => points.sort((a, b) => a.date.localeCompare(b.date)));

  const KEY_MARKERS = ['Total Testosterone', 'Free Testosterone', 'hs-CRP', 'Vitamin D', 'Total Cholesterol', 'LDL', 'HDL', 'Cortisol', 'IGF-1'];
  const keyMarkers = KEY_MARKERS.filter(m => markerTimelines.has(m));

  // Summary stats
  const mostRecentUpload = uploads.length > 0 ? uploads[0] : null;
  const totalMarkersTracked = markerTimelines.size;
  const totalFlagged = useMemo(() => {
    let count = 0;
    markerTimelines.forEach(points => {
      const latest = points[points.length - 1];
      if (latest.status !== 'normal') count++;
    });
    return count;
  }, [markerTimelines]);

  useEffect(() => {
    onFlaggedCountChange?.(totalFlagged);
  }, [totalFlagged, onFlaggedCountChange]);

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

  return (
    <div className="space-y-3">
      {/* Summary Card + Upload Button */}
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
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {totalFlagged} flagged
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {mostRecentUpload
                ? `Last: ${mostRecentUpload.file_name || mostRecentUpload.upload_type} · ${uploads.length} upload${uploads.length !== 1 ? 's' : ''} total`
                : 'No uploads yet'}
            </p>
          </div>
        </div>
        <button
          onClick={onUploadClick}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 font-medium",
              dateFrom ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/30 text-muted-foreground border-border/50 hover:bg-secondary/50"
            )}>
              <Calendar className="w-3 h-3" />
              {dateFrom ? format(dateFrom, 'MMM d, yyyy') : 'From'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker mode="single" selected={dateFrom} onSelect={setDateFrom}
              disabled={(date) => dateTo ? date > dateTo : false} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <span className="text-[10px] text-muted-foreground">→</span>

        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              "text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 font-medium",
              dateTo ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/30 text-muted-foreground border-border/50 hover:bg-secondary/50"
            )}>
              <Calendar className="w-3 h-3" />
              {dateTo ? format(dateTo, 'MMM d, yyyy') : 'To'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker mode="single" selected={dateTo} onSelect={setDateTo}
              disabled={(date) => dateFrom ? date < dateFrom : false} initialFocus className="p-3 pointer-events-auto" />
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

      {/* Key Marker Trend Cards (only when multiple uploads exist) */}
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
        <BiomarkerComparisonChart
          markerTimelines={markerTimelines}
          markerColors={MARKER_COLORS}
          defaultColor={DEFAULT_COLOR}
        />
      )}

      {/* Upload Records — grouped by document type, tiles in horizontal-first grid */}
      {(() => {
        // Group uploads by upload_type (category)
        const categoryOrder: string[] = [];
        const categoryMap: Record<string, UploadRecord[]> = {};

        const sortedUploads = [...filteredUploads].sort((a, b) => {
          const da = new Date(a.reading_date || a.created_at).getTime();
          const db = new Date(b.reading_date || b.created_at).getTime();
          return da - db; // chronological within each category
        });

        sortedUploads.forEach(upload => {
          const cat = upload.upload_type || 'other';
          if (!categoryMap[cat]) {
            categoryMap[cat] = [];
            categoryOrder.push(cat);
          }
          categoryMap[cat].push(upload);
        });

        const CATEGORY_LABELS: Record<string, string> = {
          bloodwork: 'Bloodwork Panels',
          dexa_scan: 'DEXA Scans',
          metabolic_panel: 'Metabolic Panels',
          hormone_panel: 'Hormone Panels',
          lipid_panel: 'Lipid Panels',
          thyroid_panel: 'Thyroid Panels',
          other: 'Lab Results',
        };

        return (
          <div className="space-y-6">
            {categoryOrder.map(cat => {
              const uploads = categoryMap[cat];
              const label = CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <div key={cat}>
                  {/* Category header with separator */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-widest whitespace-nowrap">
                      {label}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[10px] text-muted-foreground">{uploads.length}</span>
                  </div>

                  {/* Tile grid — horizontal-first (2 per row on mobile, 3 on sm+) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {uploads.map(upload => (
                      <UploadTile
                        key={upload.id}
                        upload={upload}
                        onDelete={handleDelete}
                        onReanalyze={handleReanalyze}
                        onAlignToGoal={setAlignUpload}
                        isDeleting={deletingId === upload.id}
                        isReanalyzing={reanalyzingId === upload.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}
        title="Delete Lab Record?"
        description="This will permanently remove this lab upload and all its extracted biomarker data. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirmed}
      />

      {/* Align to Goal */}
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
          onGoalAligned={() => {
            onRefreshGoals?.();
            fetchUploads();
          }}
        />
      )}
    </div>
  );
}
