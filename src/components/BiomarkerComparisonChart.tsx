import { useState, useMemo } from 'react';
import { GitCompareArrows, X, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '@/lib/utils';

interface BiomarkerPoint {
  name: string;
  value: number;
  unit: string;
  date: string;
}

interface BiomarkerComparisonChartProps {
  markerTimelines: Map<string, BiomarkerPoint[]>;
  markerColors: Record<string, string>;
  defaultColor: string;
}

const COMPARISON_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--destructive))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
];

export default function BiomarkerComparisonChart({
  markerTimelines,
  markerColors,
  defaultColor,
}: BiomarkerComparisonChartProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMarkers, setSelectedMarkers] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [normalize, setNormalize] = useState(false);

  const allMarkerNames = useMemo(() => [...markerTimelines.keys()].sort(), [markerTimelines]);

  const toggleMarker = (name: string) => {
    setSelectedMarkers(prev =>
      prev.includes(name)
        ? prev.filter(m => m !== name)
        : prev.length < 6 ? [...prev, name] : prev
    );
  };

  // Build unified chart data: one entry per unique date, with a column per selected marker
  const chartData = useMemo(() => {
    if (selectedMarkers.length === 0) return [];

    const dateSet = new Set<string>();
    selectedMarkers.forEach(name => {
      markerTimelines.get(name)?.forEach(p => dateSet.add(p.date));
    });

    const dates = [...dateSet].sort();

    // For normalization, get first value of each marker
    const firstValues: Record<string, number> = {};
    if (normalize) {
      selectedMarkers.forEach(name => {
        const points = markerTimelines.get(name);
        if (points && points.length > 0) firstValues[name] = points[0].value;
      });
    }

    return dates.map(date => {
      const entry: Record<string, any> = {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
      selectedMarkers.forEach(name => {
        const point = markerTimelines.get(name)?.find(p => p.date === date);
        if (point) {
          entry[name] = normalize && firstValues[name]
            ? ((point.value / firstValues[name]) * 100)
            : point.value;
        }
      });
      return entry;
    });
  }, [selectedMarkers, markerTimelines, normalize]);

  // Get units for tooltip
  const markerUnits = useMemo(() => {
    const units: Record<string, string> = {};
    selectedMarkers.forEach(name => {
      const points = markerTimelines.get(name);
      if (points && points.length > 0) units[name] = points[0].unit;
    });
    return units;
  }, [selectedMarkers, markerTimelines]);

  if (allMarkerNames.length < 2) return null;

  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/20 transition-colors"
      >
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <GitCompareArrows className="w-3.5 h-3.5" />
          Compare Markers
        </h4>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-2.5">
          {/* Selected markers as chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedMarkers.map((name, i) => (
              <span
                key={name}
                className="text-[10px] px-2 py-1 rounded-full border inline-flex items-center gap-1 font-medium"
                style={{
                  borderColor: COMPARISON_COLORS[i % COMPARISON_COLORS.length],
                  color: COMPARISON_COLORS[i % COMPARISON_COLORS.length],
                  backgroundColor: `color-mix(in srgb, ${COMPARISON_COLORS[i % COMPARISON_COLORS.length]} 10%, transparent)`,
                }}
              >
                {name}
                <button onClick={() => toggleMarker(name)} className="hover:opacity-70">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="text-[10px] px-2 py-1 rounded-full bg-secondary/30 text-muted-foreground border border-border/50 hover:bg-secondary/50 transition-colors font-medium"
            >
              {selectedMarkers.length === 0 ? '+ Select markers' : '+ Add'}
            </button>
          </div>

          {/* Marker picker */}
          {showPicker && (
            <div className="bg-secondary/20 rounded-lg p-2 max-h-40 overflow-y-auto space-y-0.5">
              {allMarkerNames.map(name => {
                const isSelected = selectedMarkers.includes(name);
                const isDisabled = !isSelected && selectedMarkers.length >= 6;
                return (
                  <button
                    key={name}
                    onClick={() => { if (!isDisabled) toggleMarker(name); }}
                    disabled={isDisabled}
                    className={cn(
                      "w-full text-left text-[11px] px-2 py-1.5 rounded-md transition-colors flex items-center justify-between",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : isDisabled
                          ? "text-muted-foreground/30 cursor-not-allowed"
                          : "text-foreground hover:bg-secondary/40"
                    )}
                  >
                    <span>{name}</span>
                    {isSelected && <span className="text-[9px]">✓</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Normalize toggle */}
          {selectedMarkers.length >= 2 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNormalize(!normalize)}
                className={cn(
                  "text-[10px] px-2.5 py-1 rounded-lg border transition-colors font-medium",
                  normalize
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-secondary/30 text-muted-foreground border-border/50 hover:bg-secondary/50"
                )}
              >
                {normalize ? '% Normalized' : 'Normalize %'}
              </button>
              <span className="text-[9px] text-muted-foreground">
                {normalize ? 'Showing % change from first reading' : 'Compare markers with different scales'}
              </span>
            </div>
          )}

          {/* Chart */}
          {selectedMarkers.length >= 2 && chartData.length >= 2 && (
            <div className="h-48">
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
                    width={40}
                    tickFormatter={v => normalize ? `${v.toFixed(0)}%` : v}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (normalize) return [`${value.toFixed(1)}%`, name];
                      return [`${value} ${markerUnits[name] || ''}`, name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '10px' }}
                    iconSize={8}
                  />
                  {selectedMarkers.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={COMPARISON_COLORS[i % COMPARISON_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0, fill: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {selectedMarkers.length < 2 && (
            <p className="text-[10px] text-muted-foreground/60 text-center py-4">
              Select at least 2 markers to compare trends
            </p>
          )}

          {selectedMarkers.length >= 2 && chartData.length < 2 && (
            <p className="text-[10px] text-muted-foreground/60 text-center py-4">
              Need at least 2 data points to render a comparison
            </p>
          )}
        </div>
      )}
    </div>
  );
}
