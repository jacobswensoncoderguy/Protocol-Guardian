import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, Calendar,
  X, Trash2, RefreshCw, Loader2, Upload, AlertTriangle, FlaskConical,
  AlertCircle, Droplets, Bone, Zap, Syringe, Heart, Bug, ClipboardList,
  Link2, Pencil, Check, GitCompare, BookMarked, Info, Sparkles,
  ArrowRightLeft, TrendingUp,
} from 'lucide-react';
import { getReferenceRange, formatRange } from '@/lib/biomarkerReferenceRanges';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, ReferenceArea } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import AlignToGoalDialog from './AlignToGoalDialog';
import ConfirmDialog from './ConfirmDialog';
import MiniSparkline from './MiniSparkline';
import DexaScanView from './DexaScanView';
import { UserGoal } from '@/hooks/useGoals';
import { toast } from 'sonner';

// ── Constants ────────────────────────────────────────────────────
const FLAG_RECENCY_DAYS = 30; // fixed 30-day window for badge count

interface UserProfileSnippet {
  gender?: string | null;
  age?: number | null;
}

interface BiomarkerHistoryProps {
  userId?: string;
  onUploadClick: () => void;
  onFlaggedCountChange?: (count: number) => void;
  goals?: UserGoal[];
  onCreateGoal?: (goals: Omit<UserGoal, 'id' | 'status'>[]) => Promise<void>;
  onRefreshGoals?: () => void;
  profile?: UserProfileSnippet | null;
}

interface UploadRecord {
  id: string;
  file_name: string;
  upload_type: string;
  reading_date: string;
  ai_extracted_data: any;
  created_at: string;
  file_url?: string;
}

interface SavedComparison {
  id: string;
  label: string;
  uploadIds: string[];
  aiSummary: string;
  createdAt: string;
}

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

function parseRecordDate(upload: UploadRecord): Date {
  const raw = upload.reading_date || upload.created_at;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function makeIsUploadRecent(flagRecencyDays: number) {
  return (upload: UploadRecord): boolean => {
    const days = differenceInDays(new Date(), parseRecordDate(upload));
    return days <= flagRecencyDays;
  };
}


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

// ─── Full Trend Chart (opens from sparkline tooltip) ──────────
function FullTrendChart({
  markerName,
  unit,
  trend,
  onClose,
  userGender,
  userAge,
}: {
  markerName: string;
  unit: string;
  trend: { values: number[]; dates: string[] };
  onClose: () => void;
  userGender?: string | null;
  userAge?: number | null;
}) {
  const chartData = trend.values.map((v, i) => ({ date: trend.dates[i], value: v }));
  const minV = Math.min(...trend.values);
  const maxV = Math.max(...trend.values);
  const padding = (maxV - minV) * 0.2 || 1;

  const refRange = getReferenceRange(markerName, userGender, userAge);
  const domainLow = refRange ? Math.min(minV - padding, refRange.low * 0.9) : minV - padding;
  const domainHigh = refRange ? Math.max(maxV + padding, refRange.high * 1.1) : maxV + padding;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-2 pb-2 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">{markerName}</p>
              <p className="text-[10px] text-muted-foreground">{trend.values.length} readings · {unit}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {refRange && (
              <span className="text-[9px] text-muted-foreground bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
                Normal: {formatRange(refRange)}
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
              {/* Reference band — green shaded normal range */}
              {refRange && (
                <ReferenceArea
                  y1={refRange.low}
                  y2={refRange.high}
                  fill="hsl(var(--chart-2) / 0.08)"
                  stroke="hsl(var(--chart-2) / 0.3)"
                  strokeDasharray="4 3"
                />
              )}
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[domainLow, domainHigh]}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={v => v.toFixed(1)}
              />
              <RechartsTooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(val: any) => [`${val} ${unit}`, markerName]}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Value list */}
        <div className="mt-3 space-y-1 max-h-24 overflow-y-auto">
          {chartData.map((d, i) => {
            const inRange = refRange ? d.value >= refRange.low && d.value <= refRange.high : true;
            return (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{d.date}</span>
                <div className="flex items-center gap-1.5">
                  {refRange && !inRange && (
                    <span className="text-[9px] text-status-warning">↑ out of range</span>
                  )}
                  <span className={`font-mono font-semibold ${i === chartData.length - 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {d.value} {unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Sparkline + tooltip + full chart button ──────────────────
function SparklineWithChart({
  markerName,
  unit,
  trend,
  userGender,
  userAge,
}: {
  markerName: string;
  unit: string;
  trend: { values: number[]; dates: string[] };
  userGender?: string | null;
  userAge?: number | null;
}) {
  const [fullChartOpen, setFullChartOpen] = useState(false);
  const refRange = getReferenceRange(markerName, userGender, userAge);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button className="focus:outline-none" title={`${markerName} trend — click for details`}>
            <MiniSparkline
              values={trend.values}
              width={40}
              height={14}
              className="opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2.5 bg-card border-border shadow-xl z-[70]" side="top" align="end">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{markerName} trend</p>
          {refRange && (
            <p className="text-[9px] text-muted-foreground bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 font-mono mb-1.5">
              Normal: {formatRange(refRange)}
            </p>
          )}
          <div className="space-y-1">
            {trend.dates.map((d, di) => {
              const v = trend.values[di];
              const inRange = refRange ? v >= refRange.low && v <= refRange.high : true;
              return (
                <div key={di} className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{d}</span>
                  <div className="flex items-center gap-1">
                    {refRange && !inRange && <span className="text-[8px] text-status-warning">↑</span>}
                    <span className={`font-mono font-medium ${di === trend.dates.length - 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {v} {unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1.5 italic">{trend.values.length} readings across uploads</p>
          <button
            onClick={() => setFullChartOpen(true)}
            className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-semibold text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-lg py-1.5 transition-colors"
          >
            <TrendingUp className="w-3 h-3" /> View Full Trend
          </button>
        </PopoverContent>
      </Popover>

      {fullChartOpen && (
        <FullTrendChart
          markerName={markerName}
          unit={unit}
          trend={trend}
          onClose={() => setFullChartOpen(false)}
          userGender={userGender}
          userAge={userAge}
        />
      )}
    </>
  );
}

// ─── Reference range chip ─────────────────────────────────────
function RangeChip({
  markerName,
  gender,
  age,
}: {
  markerName: string;
  gender?: string | null;
  age?: number | null;
}) {
  const range = getReferenceRange(markerName, gender, age);
  if (!range) return null;
  return (
    <span
      className="text-[9px] font-mono text-muted-foreground/70 bg-secondary/40 border border-border/30 rounded px-1 py-0.5 leading-none whitespace-nowrap flex-shrink-0"
      title={`Reference range${range.label ? ` (${range.label})` : ''}`}
    >
      {formatRange(range)}
    </span>
  );
}

// ─── Inline file preview (avoids 404 from opening storage URLs in new tab) ─
function FilePreviewSection({ fileUrl, fileName }: { fileUrl: string; fileName?: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  // Detect data URLs (base64 images captured at upload time) or image file extensions
  const isImage = fileUrl.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
  const isPlaceholder = fileUrl === 'parsed_text' || fileUrl === '';

  if (isPlaceholder) return null; // No file stored — skip section entirely for old records

  return (
    <>
      <div className="rounded-xl overflow-hidden border border-border/40 bg-secondary/10">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
          <Upload className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Original Upload</span>
          {isImage && (
            <button
              onClick={e => { e.stopPropagation(); setModalOpen(true); }}
              className="ml-auto text-[10px] text-primary hover:text-primary/80 transition-colors font-medium"
            >
              View full size ↗
            </button>
          )}
        </div>
        {isImage ? (
          <button
            className="w-full focus:outline-none"
            onClick={e => { e.stopPropagation(); setModalOpen(true); }}
          >
            <img
              src={fileUrl}
              alt={fileName || 'Uploaded lab report'}
              className="w-full max-h-56 object-contain bg-muted/20 cursor-zoom-in"
            />
          </button>
        ) : (
          <div className="px-3 py-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate flex-1">{fileName || 'Uploaded file'}</span>
            <span className="text-[10px] text-muted-foreground/60 bg-muted/30 px-2 py-0.5 rounded-full">PDF / Document</span>
          </div>
        )}
      </div>

      {/* Full-size image modal — stays inside app, no new tab */}
      {modalOpen && isImage && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl bg-card border border-border"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-card">
              <div className="flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground truncate">{fileName || 'Original Upload'}</span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Full image */}
            <div className="overflow-auto max-h-[80vh] bg-black/5 flex items-center justify-center">
              <img
                src={fileUrl}
                alt={fileName || 'Lab report'}
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailSheet({
  upload,
  allUploads,
  onClose,
  onDelete,
  onReanalyze,
  onAlignToGoal,
  isDeleting,
  isReanalyzing,
  userGender,
  userAge,
}: {
  upload: UploadRecord;
  allUploads: UploadRecord[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onReanalyze: (u: UploadRecord) => void;
  onAlignToGoal: (u: UploadRecord) => void;
  isDeleting: boolean;
  isReanalyzing: boolean;
  userGender?: string | null;
  userAge?: number | null;
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

  // Build cross-upload sparkline data per marker name
  // Collect all uploads of the same category sorted by date ascending
  const sparklineData = useMemo(() => {
    const sameTypeSorted = [...allUploads]
      .filter(u => u.upload_type === upload.upload_type)
      .sort((a, b) => parseRecordDate(a).getTime() - parseRecordDate(b).getTime());

    const markerTrends: Record<string, { values: number[]; dates: string[] }> = {};
    sameTypeSorted.forEach(u => {
      const dateLabel = parseRecordDate(u).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      (u.ai_extracted_data?.biomarkers || []).forEach((b: any) => {
        if (typeof b.value === 'number') {
          if (!markerTrends[b.name]) markerTrends[b.name] = { values: [], dates: [] };
          markerTrends[b.name].values.push(b.value);
          markerTrends[b.name].dates.push(dateLabel);
        }
      });
    });

    // Only return markers with 2+ data points (trend meaningful)
    return Object.fromEntries(
      Object.entries(markerTrends).filter(([, v]) => v.values.length >= 2)
    );
  }, [allUploads, upload.upload_type]);

  const rawDate = upload.reading_date || upload.created_at;
  const parsedDate = new Date(rawDate);
  const labelDate = isNaN(parsedDate.getTime()) ? '' : parsedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

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

          {/* ── Original file image preview — inline modal ── */}
          {upload.file_url && <FilePreviewSection fileUrl={upload.file_url} fileName={upload.file_name} />}

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
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Critical Alerts
              </p>
              {critical.map((m: any, i: number) => {
                const refRange = getReferenceRange(m.name, userGender, userAge);
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-foreground font-medium flex-1 min-w-0 truncate">{m.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="font-mono text-destructive font-semibold">{m.value} {m.unit}</span>
                        <span className="text-[9px] uppercase text-destructive border border-destructive/30 bg-destructive/10 px-1 py-0.5 rounded">{m.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                    {refRange && (
                      <p className="text-[9px] font-mono text-muted-foreground">
                        Normal range: {formatRange(refRange)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Out of range (non-critical) */}
          {flaggedOnly.length > 0 && (
            <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-status-warning uppercase tracking-wider">Out of Range</p>
              {flaggedOnly.map((m: any, i: number) => {
                const refRange = getReferenceRange(m.name, userGender, userAge);
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-foreground font-medium flex-1 min-w-0 truncate">{m.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="font-mono text-foreground">{m.value} {m.unit}</span>
                        <span className="text-[9px] uppercase text-status-warning border border-status-warning/30 bg-status-warning/10 px-1 py-0.5 rounded">{m.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                    {refRange && (
                      <p className="text-[9px] font-mono text-muted-foreground">
                        Normal range: {formatRange(refRange)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* DEXA Scan visualization — shown inline for DEXA uploads */}
          {upload.upload_type === 'dexa_scan' && (
            <DexaScanView
              uploads={allUploads.filter(u => u.upload_type === 'dexa_scan')}
              userGender={userGender}
              userAge={userAge}
            />
          )}

          {/* All markers by category — with sparklines when 2+ data points exist */}
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
                      {markers.map((m: any, i: number) => {
                        const trend = sparklineData[m.name];
                        return (
                          <div key={i} className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg bg-secondary/20">
                            <span className="text-foreground flex-1 min-w-0 truncate">{m.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Sparkline with tooltip if 2+ historical data points */}
                              {trend ? (
                                <SparklineWithChart
                                  markerName={m.name}
                                  unit={m.unit}
                                  trend={trend}
                                  userGender={userGender}
                                  userAge={userAge}
                                />
                              ) : null}
                              <RangeChip markerName={m.name} gender={userGender} age={userAge} />
                              <span className="font-mono text-foreground">{m.value} {m.unit}</span>
                              <span className={`text-[10px] ${STATUS_TEXT_COLORS[m.status] || 'text-muted-foreground'}`}>
                                {m.status === 'normal' ? '✓' : m.status?.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Range chip disclaimer legend */}
          <div className="flex items-start justify-between gap-2 px-0.5">
            <p className="text-[9px] text-muted-foreground opacity-60 leading-relaxed flex-1">
              {Object.keys(sparklineData).length > 0 && '∿ Trend lines show values across multiple uploads · '}
              <span className="font-mono">[ ]</span> = age/gender-adjusted reference range
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex-shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-0.5" type="button">
                  <Info className="w-3 h-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-64 p-3 bg-popover border-border text-xs z-[60]">
                <p className="font-semibold text-foreground mb-1">Reference Ranges</p>
                <p className="text-muted-foreground leading-relaxed text-[11px]">
                  Ranges shown are approximate clinical guidelines adjusted for your age and sex. They are <strong>not</strong> a substitute for medical advice — always consult your healthcare provider to interpret your results.
                </p>
              </PopoverContent>
            </Popover>
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

// ─── AI Comparison Sheet ────────────────────────────────────────
function ComparisonSheet({
  uploads,
  allUploads,
  onClose,
  userId,
}: {
  uploads: UploadRecord[];
  allUploads: UploadRecord[];
  onClose: () => void;
  userId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saved, setSaved] = useState(false);

  // Key Changes diff: markers that moved normal↔flagged between first and last upload
  const keyChanges = useMemo(() => {
    if (uploads.length < 2) return [];
    const sorted = [...uploads].sort((a, b) => parseRecordDate(a).getTime() - parseRecordDate(b).getTime());
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    const oldMap = new Map<string, { value: any; unit: string; status: string }>();
    const newMap = new Map<string, { value: any; unit: string; status: string }>();
    (earliest.ai_extracted_data?.biomarkers || []).forEach((b: any) => oldMap.set(b.name, { value: b.value, unit: b.unit, status: b.status }));
    (latest.ai_extracted_data?.biomarkers || []).forEach((b: any) => newMap.set(b.name, { value: b.value, unit: b.unit, status: b.status }));

    const changes: { name: string; from: string; to: string; oldValue: any; value: any; unit: string; direction: 'improved' | 'worsened' | 'changed' }[] = [];
    newMap.forEach((curr, name) => {
      const prev = oldMap.get(name);
      if (!prev || prev.status === curr.status) return;
      const wasNormal = prev.status === 'normal';
      const isNormal = curr.status === 'normal';
      const direction = wasNormal && !isNormal ? 'worsened' : !wasNormal && isNormal ? 'improved' : 'changed';
      changes.push({ name, from: prev.status, to: curr.status, oldValue: prev.value, value: curr.value, unit: curr.unit, direction });
    });
    return changes;
  }, [uploads]);

  // Shared markers trend: markers present in ALL selected uploads, sorted by date
  const sharedMarkerTrends = useMemo(() => {
    const sorted = [...uploads].sort((a, b) => parseRecordDate(a).getTime() - parseRecordDate(b).getTime());
    // Build name→values map across all uploads
    const markerValues = new Map<string, { date: string; value: number; unit: string }[]>();
    sorted.forEach(u => {
      const d = parseRecordDate(u).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      (u.ai_extracted_data?.biomarkers || []).forEach((b: any) => {
        if (typeof b.value !== 'number') return;
        if (!markerValues.has(b.name)) markerValues.set(b.name, []);
        markerValues.get(b.name)!.push({ date: d, value: b.value, unit: b.unit });
      });
    });
    // Keep only markers present in every upload with numeric values
    const shared: { name: string; unit: string; points: { date: string; value: number }[] }[] = [];
    markerValues.forEach((points, name) => {
      if (points.length === sorted.length) {
        // Filter to top flagged or changed markers first
        shared.push({ name, unit: points[0].unit, points: points.map(p => ({ date: p.date, value: p.value })) });
      }
    });
    // Prioritize markers that changed or are flagged
    const flaggedNames = new Set(keyChanges.map(c => c.name));
    shared.sort((a, b) => (flaggedNames.has(b.name) ? 1 : 0) - (flaggedNames.has(a.name) ? 1 : 0));
    return shared.slice(0, 6); // show top 6
  }, [uploads, keyChanges]);

  const generateComparison = useCallback(async () => {
    if (uploads.length < 2) {
      toast.error('Select at least 2 uploads to compare');
      return;
    }
    setLoading(true);
    setAiResult('');
    try {
      const sorted = [...uploads].sort((a, b) => parseRecordDate(a).getTime() - parseRecordDate(b).getTime());

      const summaries = sorted.map((u, i) => {
        const bm = u.ai_extracted_data?.biomarkers || [];
        const flagged = bm.filter((b: any) => b.status !== 'normal');
        const d = parseRecordDate(u).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return `Upload ${i + 1} — "${u.file_name || u.upload_type}" (${d})\n` +
          `  Markers: ${bm.length} total, ${flagged.length} flagged\n` +
          `  Data: ${bm.map((b: any) => `${b.name}=${b.value}${b.unit}[${b.status}]`).join(', ')}`;
      }).join('\n\n');

      const prompt = `You are an expert health data analyst reviewing multiple lab uploads from the same person over time.

Analyze these ${sorted.length} lab uploads and provide a structured report covering:
1. **Key Trends** — what's improving or worsening over the time period
2. **Correlations** — biomarkers that appear to move together (e.g., inflammatory markers trending together)
3. **Contradictions** — unexpected findings or biomarkers moving in opposite directions from what's expected
4. **Notable Changes** — the most clinically significant status changes (normal→flagged or flagged→normal)
5. **Overall Assessment** — one-line summary of overall health trajectory

Be specific with numbers. Keep under 300 words. Use plain text with no markdown symbols.

Lab Data:
${summaries}`;

      const { data, error } = await supabase.functions.invoke('analyze-protocol', {
        body: { prompt, context: 'lab_comparison' },
      });
      if (error) throw error;
      if (data?.status === 429) throw new Error('Rate limit reached. Please try again in a moment.');
      if (data?.status === 402) throw new Error('AI usage limit reached. Add credits in workspace settings.');
      setAiResult(data?.analysis || data?.response || 'Analysis complete.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate comparison');
    } finally {
      setLoading(false);
    }
  }, [uploads]);

  useEffect(() => {
    if (uploads.length >= 2) generateComparison();
  }, []);

  const handleSave = async () => {
    if (!userId || !saveLabel.trim() || !aiResult) return;
    setSaving(true);
    try {
      const comparison: SavedComparison = {
        id: crypto.randomUUID(),
        label: saveLabel.trim(),
        uploadIds: uploads.map(u => u.id),
        aiSummary: aiResult,
        createdAt: new Date().toISOString(),
      };
      // Store in user profile's app_features JSON blob under 'lab_comparisons'
      const { data: profile } = await supabase.from('profiles').select('app_features').eq('user_id', userId).single();
      const existing: SavedComparison[] = (profile?.app_features as any)?.lab_comparisons || [];
      await supabase.from('profiles').update({
        app_features: { ...(profile?.app_features as any || {}), lab_comparisons: [comparison, ...existing] },
      }).eq('user_id', userId);

      setSaved(true);
      setShowSaveForm(false);
      toast.success(`Comparison "${comparison.label}" saved to Library`);
    } catch {
      toast.error('Failed to save comparison');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-2 pb-2 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 sticky top-0 bg-card border-b border-border/30 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <GitCompare className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">AI Lab Comparison</p>
              <p className="text-[10px] text-muted-foreground">{uploads.length} uploads selected</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {aiResult && !saved && (
              <button
                onClick={() => { setShowSaveForm(v => !v); setSaveLabel(`Comparison ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`); }}
                title="Save to library"
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <BookMarked className="w-4 h-4" />
              </button>
            )}
            {saved && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 px-2">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-3">
          {/* Selected uploads list */}
          <div className="space-y-1.5">
            {uploads.map((u, i) => {
              const DocIcon = DOC_TYPE_ICONS[u.upload_type] || ClipboardList;
              const d = parseRecordDate(u).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <div key={u.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/20 text-xs">
                  <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                  <DocIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-foreground font-medium flex-1 truncate">{u.file_name || u.upload_type}</span>
                  <span className="text-muted-foreground text-[10px]">{d}</span>
                </div>
              );
            })}
          </div>

          {/* Cross-category trend LineChart — each shared marker as a colored line */}
          {sharedMarkerTrends.length > 0 && (
            <div className="rounded-xl border border-border/30 bg-secondary/10 p-3 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-primary" />
                Shared Marker Trends
                <span className="text-[9px] font-normal text-muted-foreground/60">{sharedMarkerTrends.length} markers across all uploads</span>
              </p>

              {/* Full recharts LineChart — X = upload date, each marker = a colored line.
                  Build a merged dataset: each row is a date, each marker has its own key */}
              {(() => {
                const HUE_STEPS = [200, 150, 30, 270, 0, 60];
                // Merge all marker values into rows keyed by date
                const dateSet = new Set<string>();
                sharedMarkerTrends.forEach(m => m.points.forEach(p => dateSet.add(p.date)));
                const dates = Array.from(dateSet);
                const mergedData = dates.map(date => {
                  const row: Record<string, any> = { date };
                  sharedMarkerTrends.forEach(m => {
                    const pt = m.points.find(p => p.date === date);
                    if (pt) row[m.name] = pt.value;
                  });
                  return row;
                });
                return (
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mergedData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                          tickLine={false}
                          axisLine={false}
                          width={30}
                          tickFormatter={(v: number) => v.toFixed(0)}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: 'hsl(var(--foreground))',
                          }}
                          labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
                        />
                        {sharedMarkerTrends.map((marker, idx) => {
                          const hue = HUE_STEPS[idx % HUE_STEPS.length];
                          const color = `hsl(${hue}, 80%, 55%)`;
                          return (
                            <Line
                              key={marker.name}
                              dataKey={marker.name}
                              stroke={color}
                              strokeWidth={2}
                              dot={{ r: 3, fill: color, strokeWidth: 0 }}
                              activeDot={{ r: 5 }}
                              type="monotone"
                              connectNulls
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* Legend */}
              <div className="flex flex-wrap gap-2">
                {sharedMarkerTrends.map((marker, idx) => {
                  const HUE_STEPS = [200, 150, 30, 270, 0, 60];
                  const hue = HUE_STEPS[idx % HUE_STEPS.length];
                  const color = `hsl(${hue}, 80%, 55%)`;
                  const values = marker.points.map(p => p.value);
                  const delta = values[values.length - 1] - values[0];
                  return (
                    <div key={marker.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[9px] text-muted-foreground">{marker.name}</span>
                      {delta !== 0 && (
                        <span className={`text-[9px] font-mono font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mini sparkline tiles below */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/20">
                {sharedMarkerTrends.map(marker => {
                  const values = marker.points.map(p => p.value);
                  const delta = values[values.length - 1] - values[0];
                  const isGood = Math.abs(delta) < 0.01 ? null : delta > 0;
                  return (
                    <div key={marker.name} className="bg-card rounded-lg p-2 border border-border/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-foreground truncate flex-1">{marker.name}</span>
                        {delta !== 0 && (
                          <span className={`text-[9px] font-mono font-semibold flex-shrink-0 ml-1 ${isGood === null ? 'text-muted-foreground' : isGood ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <MiniSparkline values={values} width={100} height={20} className="w-full" />
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground/60">
                        <span>{marker.points[0].date}</span>
                        <span>{marker.points[marker.points.length - 1].date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save form */}
          {showSaveForm && (
            <div className="bg-secondary/20 rounded-xl p-3 border border-primary/20 space-y-2">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Save to Library</p>
              <input
                type="text"
                value={saveLabel}
                onChange={e => setSaveLabel(e.target.value)}
                placeholder="Name this comparison…"
                className="w-full px-2.5 py-1.5 rounded-lg border border-border/50 bg-card text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={handleSave}
                disabled={saving || !saveLabel.trim()}
                className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookMarked className="w-3 h-3" />}
                Save Comparison
              </button>
            </div>
          )}

          {/* AI Result */}
          {loading && (
            <div className="py-8 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <div>
                <p className="text-sm font-medium text-foreground">Analyzing your labs…</p>
                <p className="text-xs text-muted-foreground mt-1">Finding correlations & trends across {uploads.length} uploads</p>
              </div>
            </div>
          )}

          {aiResult && !loading && (
            <div className="bg-secondary/20 rounded-xl p-3.5 border border-border/30 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary" /> AI Analysis
              </p>
              {/* Render structured sections if they appear */}
              <div className="space-y-2">
                {aiResult.split(/\n(?=\d\.)/).map((section, i) => (
                  <p key={i} className="text-xs text-foreground leading-relaxed whitespace-pre-line">{section.trim()}</p>
                ))}
              </div>
              <button
                onClick={generateComparison}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Re-analyze
              </button>
            </div>
          )}

          {/* Key Changes diff table — shown after analysis if any markers changed status */}
          {keyChanges.length > 0 && !loading && (
            <div className="rounded-xl border border-border/50 bg-secondary/10 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRightLeft className="w-3 h-3 text-primary" /> Key Changes
              </p>
              <p className="text-[10px] text-muted-foreground">Markers that changed status across selected uploads</p>
              <div className="space-y-1.5">
                {keyChanges.map((c, i) => (
                  <div key={i} className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-card border border-border/30">
                    {/* Top row: name + direction indicator */}
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground text-xs truncate flex-1 mr-2">{c.name}</span>
                      <span className={`text-[10px] font-bold ${c.direction === 'improved' ? 'text-emerald-400' : c.direction === 'worsened' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {c.direction === 'improved' ? '↑ Improved' : c.direction === 'worsened' ? '↓ Worsened' : '↔ Changed'}
                      </span>
                    </div>
                    {/* Bottom row: numeric values + status badges */}
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-mono text-muted-foreground">{c.oldValue ?? '—'} {c.unit}</span>
                      <span className={`px-1 py-0.5 rounded font-medium ${c.from === 'normal' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-status-warning/10 text-status-warning'}`}>
                        {c.from.replace('_', ' ')}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-foreground font-semibold">{c.value ?? '—'} {c.unit}</span>
                      <span className={`px-1 py-0.5 rounded font-medium ${c.to === 'normal' ? 'bg-emerald-500/10 text-emerald-400' : c.to.startsWith('critical') ? 'bg-destructive/10 text-destructive' : 'bg-status-warning/10 text-status-warning'}`}>
                        {c.to.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Saved Comparisons Library ────────────────────────────────
function SavedComparisonsLibrary({
  comparisons,
  allUploads,
  onDelete,
}: {
  comparisons: SavedComparison[];
  allUploads: UploadRecord[];
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (comparisons.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 mb-1">
        <BookMarked className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saved Comparisons</span>
        <span className="text-[9px] text-muted-foreground">({comparisons.length})</span>
      </div>
      {comparisons.map(comp => {
        const isExp = expanded === comp.id;
        const d = new Date(comp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const linkedUploads = allUploads.filter(u => comp.uploadIds.includes(u.id));
        return (
          <div key={comp.id} className="border border-border/40 rounded-xl overflow-hidden bg-card">
            <button
              onClick={() => setExpanded(isExp ? null : comp.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-secondary/20 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <BookMarked className="w-3 h-3 text-primary flex-shrink-0" />
                <span className="text-xs font-medium text-foreground truncate">{comp.label}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{d}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground">{linkedUploads.length}↔</span>
                {isExp ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
              </div>
            </button>
            {isExp && (
              <div className="px-3 pb-3 space-y-2 border-t border-border/30">
                {linkedUploads.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {linkedUploads.map(u => (
                      <div key={u.id} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                        {u.file_name || u.upload_type}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-line">{comp.aiSummary}</p>
                <button
                  onClick={() => onDelete(comp.id)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Remove from library
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Clean tile card ──────────────────────────────────────────
function UploadTile({
  upload,
  allUploads,
  onDelete,
  onReanalyze,
  onAlignToGoal,
  onEditSaved,
  isDeleting,
  isReanalyzing,
  selected,
  onToggleSelect,
  compareMode,
  userGender,
  userAge,
}: {
  upload: UploadRecord;
  allUploads: UploadRecord[];
  onDelete: (id: string) => void;
  onReanalyze: (u: UploadRecord) => void;
  onAlignToGoal: (u: UploadRecord) => void;
  onEditSaved: (id: string, label: string, date: string) => void;
  isDeleting: boolean;
  isReanalyzing: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  compareMode: boolean;
  userGender?: string | null;
  userAge?: number | null;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const biomarkers: any[] = upload.ai_extracted_data?.biomarkers || [];
  const critical = biomarkers.filter(b => b.status?.startsWith('critical'));
  const flagged = biomarkers.filter(b => b.status !== 'normal');
  const DocIcon = DOC_TYPE_ICONS[upload.upload_type] || ClipboardList;

  const labelDate = (() => {
    const raw = upload.reading_date || upload.created_at;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  })();

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
      {/* Tile — compact */}
      <div
        className={cn(
          'relative bg-card rounded-lg border cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden',
          !compareMode && (critical.length > 0 ? 'border-destructive/30' : flagged.length > 0 ? 'border-status-warning/30' : 'border-border/50'),
          compareMode && selected && 'border-primary ring-[3px] ring-primary/50 shadow-[0_0_10px_hsl(var(--primary)/0.25)]',
          compareMode && !selected && 'border-border/30 opacity-60',
        )}
        onClick={() => {
          if (editing) return;
          if (compareMode) { onToggleSelect(upload.id); return; }
          setDetailOpen(true);
        }}
      >
        {/* Status stripe */}
        {!compareMode && (critical.length > 0 || flagged.length > 0) && (
          <div className={`h-0.5 w-full ${critical.length > 0 ? 'bg-destructive' : 'bg-status-warning'}`} />
        )}
        {compareMode && selected && <div className="h-0.5 w-full bg-primary" />}

        {/* Compare checkmark */}
        {compareMode && (
          <div className={cn(
            'absolute top-1.5 right-1.5 flex items-center justify-center transition-all z-10',
            selected
              ? 'w-5 h-5 rounded-full bg-primary shadow-md border-2 border-primary-foreground/20'
              : 'w-4 h-4 rounded-full border-2 border-muted-foreground/30 bg-card/80'
          )}>
            {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
          </div>
        )}

        {/* Inline edit form overlay */}
        {editing && (
          <InlineEditForm
            upload={upload}
            onSave={handleEditSave}
            onCancel={() => setEditing(false)}
          />
        )}

        <div className="p-2">
          {/* Icon row */}
          <div className="flex items-start justify-between mb-1.5">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <DocIcon className="w-3.5 h-3.5 text-primary" />
            </div>
            {!compareMode && (
              <button
                onClick={e => { e.stopPropagation(); setEditing(true); }}
                title="Edit label & date"
                className="p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-secondary/40 transition-colors"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Name */}
          <p className="text-[10px] font-semibold text-foreground leading-snug line-clamp-2 mb-1">{tileName}</p>

          {/* Date */}
          <p className="text-[9px] text-muted-foreground mb-1.5">{labelDate}</p>

          {/* Status row */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Uploaded badge */}
            <span className="text-[8px] px-1 py-0.5 rounded bg-secondary/60 text-muted-foreground border border-border/30 leading-none">
              uploaded
            </span>
            {critical.length > 0 && (
              <span className="text-[8px] px-1 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-semibold leading-none">
                {critical.length}!
              </span>
            )}
            {flagged.length > 0 && critical.length === 0 && (
              <span className="text-[8px] px-1 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/20 leading-none">
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
          allUploads={allUploads}
          onClose={() => setDetailOpen(false)}
          onDelete={onDelete}
          onReanalyze={onReanalyze}
          onAlignToGoal={onAlignToGoal}
          isDeleting={isDeleting}
          isReanalyzing={isReanalyzing}
          userGender={userGender}
          userAge={userAge}
        />
      )}
    </>
  );
}



const ALERT_RECENCY_OPTIONS = [30, 60] as const;
type AlertRecencyDays = typeof ALERT_RECENCY_OPTIONS[number];

function AlertsPanel({
  uploads,
  userGender,
  userAge,
}: {
  uploads: UploadRecord[];
  userGender?: string | null;
  userAge?: number | null;
}) {
  const [recencyDays, setRecencyDays] = useState<AlertRecencyDays>(30);

  const alertContext: Record<string, string> = {
    high: 'Value exceeds the upper reference limit. Elevated levels may indicate inflammation, metabolic stress, or organ strain depending on the marker.',
    low: 'Value falls below the lower reference limit. Low readings can signal deficiency, suppression, or underproduction of this biomarker.',
    critical_high: 'Critically elevated — significantly above normal range. This warrants prompt medical attention and follow-up.',
    critical_low: 'Critically low — significantly below normal range. This requires urgent medical review.',
  };

  const { currentAlerts, noAlerts } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - recencyDays);

    const seen = new Map<string, {
      name: string; value: any; unit: string; status: string;
      uploadLabel: string; uploadDate: Date; uploadType: string;
      referenceHigh?: number; referenceLow?: number;
    }>();

    [...uploads]
      .sort((a, b) => parseRecordDate(a).getTime() - parseRecordDate(b).getTime())
      .forEach(u => {
        const d = parseRecordDate(u);
        if (d < cutoff) return;
        (u.ai_extracted_data?.biomarkers || []).forEach((b: any) => {
          if (b.status && b.status !== 'normal') {
            seen.set(b.name, {
              name: b.name,
              value: b.value,
              unit: b.unit,
              status: b.status,
              uploadLabel: u.file_name || u.upload_type,
              uploadDate: d,
              uploadType: u.upload_type,
              referenceHigh: b.reference_high,
              referenceLow: b.reference_low,
            });
          }
        });
      });

    return {
      currentAlerts: Array.from(seen.values()).sort((a, b) => {
        const sev = (s: string) => s.startsWith('critical') ? 0 : 1;
        return sev(a.status) - sev(b.status);
      }),
      noAlerts: seen.size === 0,
    };
  }, [uploads, recencyDays]);

  return (
    <div className="space-y-3">
      {/* Recency toggle */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Showing flags from the last <strong className="text-foreground">{recencyDays} days</strong>
        </p>
        <div className="flex items-center gap-1 bg-secondary/40 rounded-lg p-0.5">
          {ALERT_RECENCY_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setRecencyDays(opt)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
                recencyDays === opt
                  ? 'bg-card text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt}d
            </button>
          ))}
        </div>
      </div>

      {noAlerts ? (
        <div className="py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
            <Check className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-foreground">No alerts in last {recencyDays} days</p>
          <p className="text-xs text-muted-foreground mt-1">All recent labs are within range</p>
        </div>
      ) : (
        <div className="space-y-2">
          {currentAlerts.map((alert, i) => {
            const isCritical = alert.status.startsWith('critical');
            const refRange = getReferenceRange(alert.name, userGender, userAge);
            const context = alertContext[alert.status] || '';
            const DocIcon = DOC_TYPE_ICONS[alert.uploadType] || ClipboardList;
            const dateStr = alert.uploadDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            // Compute deviation from range
            let deviation = '';
            if (refRange) {
              if (alert.status.includes('high') && typeof alert.value === 'number') {
                const pct = Math.round(((alert.value - refRange.high) / refRange.high) * 100);
                deviation = `${pct > 0 ? '+' : ''}${pct}% above normal`;
              } else if (alert.status.includes('low') && typeof alert.value === 'number') {
                const pct = Math.round(((refRange.low - alert.value) / refRange.low) * 100);
                deviation = `${pct > 0 ? '+' : ''}${pct}% below normal`;
              }
            }

            return (
              <div
                key={i}
                className={cn(
                  'rounded-xl border p-3 space-y-2',
                  isCritical
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-status-warning/30 bg-status-warning/5'
                )}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{alert.name}</span>
                      <span className={cn(
                        'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border',
                        isCritical
                          ? 'bg-destructive/15 text-destructive border-destructive/30'
                          : 'bg-status-warning/15 text-status-warning border-status-warning/30'
                      )}>
                        {alert.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                      <DocIcon className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="truncate">{alert.uploadLabel}</span>
                      <span>·</span>
                      <span>{dateStr}</span>
                    </div>
                  </div>
                  {/* Value + range */}
                  <div className="text-right flex-shrink-0">
                    <span className={cn(
                      'text-sm font-bold font-mono',
                      isCritical ? 'text-destructive' : 'text-status-warning'
                    )}>
                      {alert.value} {alert.unit}
                    </span>
                    {refRange && (
                      <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
                        Normal: {formatRange(refRange)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Deviation pill */}
                {deviation && (
                  <div className={cn(
                    'inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border',
                    isCritical ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-status-warning/10 text-status-warning border-status-warning/20'
                  )}>
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {deviation}
                  </div>
                )}

                {/* Context explanation */}
                {context && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/30 pt-1.5">
                    {context}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
  profile,
}: BiomarkerHistoryProps) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [alignUpload, setAlignUpload] = useState<UploadRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'uploads' | 'alerts'>('uploads');

  // Compare mode state — global (cross-category)
  const [compareMode, setCompareMode] = useState(false);
  const [compareModeCategory, setCompareModeCategory] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showComparisonSheet, setShowComparisonSheet] = useState(false);

  // Saved comparisons
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>([]);

  // Recency threshold for flags — persisted to profile


  const fetchUploads = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_goal_uploads')
      .select('id, file_name, upload_type, reading_date, ai_extracted_data, created_at, file_url')
      .eq('user_id', userId)
      .order('reading_date', { ascending: false });
    if (!error && data) setUploads(data as UploadRecord[]);
    setLoading(false);
  }, [userId]);

  const fetchSavedComparisons = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('profiles').select('app_features').eq('user_id', userId).single();
    const comps: SavedComparison[] = (data?.app_features as any)?.lab_comparisons || [];
    setSavedComparisons(comps);
  }, [userId]);

  useEffect(() => { fetchUploads(); fetchSavedComparisons(); }, [fetchUploads, fetchSavedComparisons]);

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
    } catch (e: any) {
      toast.error(e.message || 'Re-analysis failed');
    } finally { setReanalyzingId(null); }
  }, []);

  const handleEditSaved = useCallback((id: string, label: string, date: string) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, file_name: label, reading_date: date } : u));
  }, []);

  const handleDeleteComparison = useCallback(async (compId: string) => {
    if (!userId) return;
    const updated = savedComparisons.filter(c => c.id !== compId);
    setSavedComparisons(updated);
    const { data: profile } = await supabase.from('profiles').select('app_features').eq('user_id', userId).single();
    await supabase.from('profiles').update({
      app_features: { ...(profile?.app_features as any || {}), lab_comparisons: updated },
    }).eq('user_id', userId);
    toast.success('Comparison removed');
  }, [userId, savedComparisons]);

  // Date filter
  const filteredUploads = useMemo(() => uploads.filter(u => {
    const d = new Date(u.reading_date || u.created_at);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo) { const e = new Date(dateTo); e.setHours(23, 59, 59, 999); if (d > e) return false; }
    return true;
  }), [uploads, dateFrom, dateTo]);

  const hasDateFilter = dateFrom || dateTo;

  // Flagged count — fixed 30-day window
  const recentFlaggedCount = useMemo(() => {
    const isRecent = makeIsUploadRecent(FLAG_RECENCY_DAYS);
    const recentUploads = uploads.filter(isRecent);
    const markerMap = new Map<string, string>();
    [...recentUploads].reverse().forEach(upload => {
      (upload.ai_extracted_data?.biomarkers || []).forEach((b: any) => {
        markerMap.set(b.name, b.status);
      });
    });
    let count = 0;
    markerMap.forEach(status => { if (status !== 'normal') count++; });
    return count;
  }, [uploads]);


  const totalMarkersTracked = useMemo(() => {
    const names = new Set<string>();
    uploads.forEach(upload => {
      (upload.ai_extracted_data?.biomarkers || []).forEach((b: any) => names.add(b.name));
    });
    return names.size;
  }, [uploads]);

  useEffect(() => { onFlaggedCountChange?.(recentFlaggedCount); }, [recentFlaggedCount, onFlaggedCountChange]);

  // Category grouping
  const { categoryOrder, categoryMap } = useMemo(() => {
    const order: string[] = [];
    const map: Record<string, UploadRecord[]> = {};
    [...filteredUploads]
      .sort((a, b) => parseRecordDate(a).getTime() - parseRecordDate(b).getTime())
      .forEach(upload => {
        const cat = upload.upload_type || 'other';
        if (!map[cat]) { map[cat] = []; order.push(cat); }
        map[cat].push(upload);
      });
    return { categoryOrder: order, categoryMap: map };
  }, [filteredUploads]);

  const handleToggleCompareMode = (_cat?: string) => {
    if (compareMode) {
      setCompareMode(false);
      setCompareModeCategory(null);
      setSelectedIds(new Set());
    } else {
      setCompareMode(true);
      setCompareModeCategory(_cat || null);
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      } else {
        toast.error('Maximum 4 uploads can be compared at once');
      }
      return next;
    });
  };

  const selectedUploads = uploads.filter(u => selectedIds.has(u.id));

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
    <div className="space-y-4">
      {/* Header row: upload + compare + tab buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-secondary/40 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('uploads')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
              activeTab === 'uploads' ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Uploads
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
              activeTab === 'alerts' ? 'bg-card text-foreground shadow-sm border border-border/50' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Alerts
            {recentFlaggedCount > 0 && (
              <span className="text-[9px] font-bold bg-status-warning/20 text-status-warning px-1 py-0.5 rounded-full">
                {recentFlaggedCount}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {uploads.length >= 2 && activeTab === 'uploads' && (
            <button
              onClick={() => handleToggleCompareMode()}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                compareMode
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
              )}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {compareMode ? 'Cancel' : 'Compare'}
            </button>
          )}
          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        </div>
      </div>

      {/* ── Alerts Tab ── */}
      {activeTab === 'alerts' && (
        <AlertsPanel
          uploads={uploads}
          userGender={profile?.gender}
          userAge={profile?.age}
        />
      )}

      {activeTab === 'uploads' && <>

      {/* Biomarker summary strip — compact */}
      <div className="bg-card rounded-xl border border-border/50 px-3 py-2 flex items-center gap-2">
        <FlaskConical className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-semibold text-foreground">
          {totalMarkersTracked} marker{totalMarkersTracked !== 1 ? 's' : ''} tracked
        </span>
        <span className="text-[10px] text-muted-foreground">across {uploads.length} upload{uploads.length !== 1 ? 's' : ''}</span>
        {recentFlaggedCount > 0 && (
          <span className="ml-auto text-[9px] font-bold bg-status-warning/15 text-status-warning border border-status-warning/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />{recentFlaggedCount} flagged
          </span>
        )}
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

      {/* ── Compare Mode Selection Bar ── */}
      {compareMode && (
        <div className="sticky top-0 z-20 rounded-xl bg-card border border-primary/30 shadow-lg px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <ArrowRightLeft className="w-3 h-3 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                {selectedIds.size === 0
                  ? 'Select 2–4 uploads'
                  : `${selectedIds.size} selected`}
                {selectedIds.size >= 4 && <span className="text-[10px] text-muted-foreground font-normal ml-1">(max)</span>}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {selectedIds.size === 0 ? 'Tap any tile to add to comparison' : 'AI will find correlations & trends'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {selectedIds.size >= 2 && (
              <button
                onClick={() => setShowComparisonSheet(true)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-foreground bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Compare {selectedIds.size}
              </button>
            )}
            <button
              onClick={() => handleToggleCompareMode()}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Category-grouped tile grid ── */}
      <div className="space-y-6">
        {categoryOrder.map(cat => {
          const catUploads = categoryMap[cat];
          const label = CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

          return (
            <div key={cat}>
              {/* Category header — tappable to enter compare mode */}
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => handleToggleCompareMode(cat)}
                  className={cn(
                    'text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors flex items-center gap-1.5 rounded px-1 -mx-1 py-0.5',
                    compareMode
                      ? 'text-primary bg-primary/5'
                      : 'text-foreground hover:text-primary'
                  )}
                  title={compareMode ? 'Exit compare mode' : 'Tap to enter compare mode'}
                >
                  {label}
                  <GitCompare className={cn('w-3 h-3', compareMode ? 'text-primary' : 'text-muted-foreground/40')} />
                </button>
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] text-muted-foreground tabular-nums">{catUploads.length}</span>
              </div>

              {/* Tiles */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {catUploads.map(upload => (
                  <UploadTile
                    key={upload.id}
                    upload={upload}
                    allUploads={uploads}
                    onDelete={handleDelete}
                    onReanalyze={handleReanalyze}
                    onAlignToGoal={setAlignUpload}
                    onEditSaved={handleEditSaved}
                    isDeleting={deletingId === upload.id}
                    isReanalyzing={reanalyzingId === upload.id}
                    selected={selectedIds.has(upload.id)}
                    onToggleSelect={handleToggleSelect}
                    compareMode={compareMode}
                    userGender={profile?.gender}
                    userAge={profile?.age}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Saved Comparisons Library */}
      {savedComparisons.length > 0 && (
        <SavedComparisonsLibrary
          comparisons={savedComparisons}
          allUploads={uploads}
          onDelete={handleDeleteComparison}
        />
      )}

      </>}

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

      {/* AI Comparison Sheet */}
      {showComparisonSheet && (
        <ComparisonSheet
          uploads={selectedUploads}
          allUploads={uploads}
          onClose={() => { setShowComparisonSheet(false); setCompareMode(false); setCompareModeCategory(null); setSelectedIds(new Set()); }}
          userId={userId}
        />
      )}
    </div>
  );
}
