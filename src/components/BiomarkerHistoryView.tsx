import { useState, useEffect, useCallback } from 'react';
import { Beaker, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Calendar, FileText } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { supabase } from '@/integrations/supabase/client';

interface BiomarkerHistoryProps {
  userId?: string;
  onUploadClick: () => void;
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

export default function BiomarkerHistoryView({ userId, onUploadClick }: BiomarkerHistoryProps) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMarker, setExpandedMarker] = useState<string | null>(null);
  const [expandedUpload, setExpandedUpload] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_goal_uploads')
      .select('*')
      .eq('user_id', userId)
      .order('reading_date', { ascending: true });

    if (!error && data) {
      setUploads(data as UploadRecord[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  // Build timeline of all biomarkers across uploads
  const allPoints: BiomarkerPoint[] = [];
  uploads.forEach(upload => {
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

  // Group by marker name
  const markerTimelines = new Map<string, BiomarkerPoint[]>();
  allPoints.forEach(p => {
    const arr = markerTimelines.get(p.name) || [];
    arr.push(p);
    markerTimelines.set(p.name, arr);
  });

  // Sort each timeline by date
  markerTimelines.forEach(points => points.sort((a, b) => a.date.localeCompare(b.date)));

  // Key markers to feature prominently
  const KEY_MARKERS = ['Total Testosterone', 'Free Testosterone', 'hs-CRP', 'Vitamin D', 'Total Cholesterol', 'LDL', 'HDL', 'Cortisol', 'IGF-1'];
  const keyMarkers = KEY_MARKERS.filter(m => markerTimelines.has(m));
  const otherMarkers = [...markerTimelines.keys()].filter(m => !KEY_MARKERS.includes(m));

  // Group by category for "all markers" section
  const categoryGroups = new Map<string, string[]>();
  [...markerTimelines.entries()].forEach(([name, points]) => {
    const cat = points[0].category;
    const arr = categoryGroups.get(cat) || [];
    if (!arr.includes(name)) arr.push(name);
    categoryGroups.set(cat, arr);
  });

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-4 text-center">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-32 bg-secondary rounded mx-auto" />
          <div className="h-24 bg-secondary/30 rounded-lg" />
        </div>
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/50 p-6 text-center">
        <Beaker className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-foreground mb-1">No Lab Results Yet</h3>
        <p className="text-xs text-muted-foreground mb-3">Upload bloodwork or DEXA scans to track biomarkers over time.</p>
        <button
          onClick={onUploadClick}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          Upload Lab Results
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Beaker className="w-3.5 h-3.5" />
          Biomarker History
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {uploads.length} upload{uploads.length !== 1 ? 's' : ''} · {markerTimelines.size} markers tracked
          </span>
          <button
            onClick={onUploadClick}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-medium"
          >
            + Upload
          </button>
        </div>
      </div>

      {/* Key Marker Trend Cards */}
      {keyMarkers.length > 0 && (
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
                <button
                  onClick={() => setExpandedMarker(isExpanded ? null : markerName)}
                  className="w-full p-3 text-left hover:bg-secondary/20 transition-colors"
                >
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
                  {points.length === 1 && (
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">1 reading</div>
                  )}
                </button>

                {isExpanded && chartData.length >= 2 && (
                  <div className="px-2 pb-3">
                    <div className="h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                            width={30}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '11px',
                            }}
                          />
                          {latest.reference_high && (
                            <ReferenceLine
                              y={latest.reference_high}
                              stroke="hsl(var(--destructive))"
                              strokeDasharray="3 3"
                              strokeWidth={1}
                            />
                          )}
                          {latest.reference_low && (
                            <ReferenceLine
                              y={latest.reference_low}
                              stroke="hsl(var(--chart-5))"
                              strokeDasharray="3 3"
                              strokeWidth={1}
                            />
                          )}
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 3, fill: color, strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: color }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {(latest.reference_low || latest.reference_high) && (
                      <div className="flex items-center justify-center gap-3 mt-1">
                        {latest.reference_low && (
                          <span className="text-[9px] text-muted-foreground">Low: {latest.reference_low}</span>
                        )}
                        {latest.reference_high && (
                          <span className="text-[9px] text-muted-foreground">High: {latest.reference_high}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* All markers by category */}
      {otherMarkers.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              All Markers ({otherMarkers.length})
            </h4>
          </div>
          <div className="divide-y divide-border/20">
            {otherMarkers.map(markerName => {
              const points = markerTimelines.get(markerName)!;
              const latest = points[points.length - 1];
              const StatusIcon = STATUS_ICONS[latest.status] || Minus;

              return (
                <div key={markerName} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon className={`w-3 h-3 flex-shrink-0 ${STATUS_TEXT_COLORS[latest.status]}`} />
                    <span className="text-xs text-foreground truncate">{markerName}</span>
                    <span className="text-[10px] text-muted-foreground/60 capitalize">{latest.category.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs font-mono font-semibold text-foreground">{latest.value}</span>
                    <span className="text-[10px] text-muted-foreground">{latest.unit}</span>
                    <span className={`text-[9px] ${STATUS_TEXT_COLORS[latest.status]}`}>
                      {latest.status === 'normal' ? '✓' : latest.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Timeline */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-border/30">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            Upload Timeline
          </h4>
        </div>
        {[...uploads].reverse().map(upload => {
          const isExpanded = expandedUpload === upload.id;
          const biomarkers = upload.ai_extracted_data?.biomarkers || [];
          const flagged = biomarkers.filter((b: any) => b.status !== 'normal').length;
          const summary = upload.ai_extracted_data?.summary;
          const docType = upload.upload_type || 'lab results';

          return (
            <div key={upload.id} className="border-b border-border/20 last:border-0">
              <button
                onClick={() => setExpandedUpload(isExpanded ? null : upload.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs text-foreground capitalize">{docType.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">
                      {new Date(upload.reading_date || upload.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">{biomarkers.length} markers</span>
                  {flagged > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {flagged} flagged
                    </span>
                  )}
                  {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {summary && (
                    <p className="text-[10px] text-muted-foreground bg-secondary/20 rounded-lg px-2.5 py-2">{summary}</p>
                  )}
                  <div className="space-y-1">
                    {biomarkers.map((b: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-secondary/20">
                        <span className="text-foreground">{b.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-foreground">{b.value} {b.unit}</span>
                          <span className={`text-[9px] ${STATUS_TEXT_COLORS[b.status] || 'text-muted-foreground'}`}>
                            {b.status === 'normal' ? '✓' : b.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
