import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useComplianceTrend, CompoundMeta } from '@/hooks/useComplianceTrend';
import { CheckCircle2, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ComplianceTrendChartProps {
  userId?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-mono text-muted-foreground mb-1.5">Week of {label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-foreground/80 truncate max-w-[120px]">{entry.name}</span>
          </div>
          <span className="font-mono font-bold" style={{ color: entry.color }}>{entry.value}%</span>
        </div>
      ))}
    </div>
  );
};

const ComplianceTrendChart = ({ userId }: ComplianceTrendChartProps) => {
  const { data, compounds, loading } = useComplianceTrend(userId);
  const [expanded, setExpanded] = useState(true);
  const [hiddenCompounds, setHiddenCompounds] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="mt-6">
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (data.length === 0 || compounds.length === 0) return null;

  const toggleCompound = (name: string) => {
    setHiddenCompounds(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const visibleCompounds = compounds.filter(c => !hiddenCompounds.has(c.name));

  // Calculate overall average for latest week
  const latestWeek = data[data.length - 1];
  const avgRate = visibleCompounds.length > 0
    ? Math.round(visibleCompounds.reduce((sum, c) => sum + (Number(latestWeek[c.name]) || 0), 0) / visibleCompounds.length)
    : 0;

  return (
    <div className="mt-6">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-3 group"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Dose Compliance Trend</h3>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
            avgRate >= 90 ? 'bg-status-good/10 text-status-good' :
            avgRate >= 70 ? 'bg-accent/15 text-status-warning' :
            'bg-destructive/15 text-status-critical'
          }`}>
            {avgRate}% avg
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Chart */}
          <div className="bg-card/50 border border-border/50 rounded-xl p-3">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                {visibleCompounds.map((compound) => (
                  <Area
                    key={compound.compoundId}
                    type="monotone"
                    dataKey={compound.name}
                    stroke={compound.color}
                    fill={compound.color}
                    fillOpacity={0.08}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend — toggleable compound pills */}
          <div className="flex flex-wrap gap-1.5">
            {compounds.map((c) => {
              const isHidden = hiddenCompounds.has(c.name);
              return (
                <button
                  key={c.compoundId}
                  onClick={() => toggleCompound(c.name)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                    isHidden
                      ? 'border-border/50 text-muted-foreground/50 bg-transparent'
                      : 'border-transparent text-foreground/90'
                  }`}
                  style={!isHidden ? { backgroundColor: `${c.color}22`, borderColor: `${c.color}44` } : undefined}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: isHidden ? 'hsl(var(--muted-foreground))' : c.color, opacity: isHidden ? 0.3 : 1 }} />
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* Insight line */}
          {data.length >= 2 && (() => {
            const prev = visibleCompounds.reduce((s, c) => s + (Number(data[data.length - 2]?.[c.name]) || 0), 0) / Math.max(1, visibleCompounds.length);
            const diff = avgRate - Math.round(prev);
            if (diff === 0) return null;
            return (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <TrendingUp className={`w-3 h-3 ${diff > 0 ? 'text-status-good' : 'text-status-critical rotate-180'}`} />
                <span>{diff > 0 ? '+' : ''}{diff}% vs previous week</span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ComplianceTrendChart;
