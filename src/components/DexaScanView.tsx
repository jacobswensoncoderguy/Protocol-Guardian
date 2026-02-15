import { useMemo } from 'react';
import { Scan, Activity, Bone, Flame, Scale, TrendingUp, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, LineChart, Line, Legend } from 'recharts';
import { cn } from '@/lib/utils';

interface DexaUpload {
  id: string;
  reading_date: string;
  created_at: string;
  ai_extracted_data: any;
}

interface DexaScanViewProps {
  uploads: DexaUpload[];
}

interface DexaMetric {
  name: string;
  value: number;
  unit: string;
  category: string;
}

// Extract DEXA-specific metrics from parsed biomarker data
function extractDexaMetrics(upload: DexaUpload): DexaMetric[] {
  const biomarkers = upload.ai_extracted_data?.biomarkers || [];
  return biomarkers.map((b: any) => ({
    name: b.name,
    value: b.value,
    unit: b.unit,
    category: b.category,
  }));
}

// Map common DEXA metric names to categories
const COMPOSITION_KEYS = ['Total Body Fat', 'Body Fat', 'Total Body Fat %', 'Body Fat %', 'Fat %'];
const LEAN_KEYS = ['Lean Mass', 'Total Lean Mass', 'Lean Body Mass', 'Fat-Free Mass'];
const BMD_KEYS = ['Bone Mineral Density', 'BMD', 'Total BMD', 'Bone Density'];
const VAT_KEYS = ['Visceral Adipose Tissue', 'VAT', 'Visceral Fat', 'VAT Mass', 'VAT Volume'];
const REGIONAL_FAT_KEYS = ['Arms Fat', 'Arm Fat', 'Legs Fat', 'Leg Fat', 'Trunk Fat', 'Torso Fat', 'Android Fat', 'Gynoid Fat'];
const REGIONAL_LEAN_KEYS = ['Arms Lean', 'Arm Lean', 'Legs Lean', 'Leg Lean', 'Trunk Lean', 'Torso Lean'];

function findMetric(metrics: DexaMetric[], keys: string[]): DexaMetric | undefined {
  return metrics.find(m => keys.some(k => m.name.toLowerCase().includes(k.toLowerCase())));
}

function calcRecompScore(current: DexaMetric[], prev: DexaMetric[]): number | null {
  const fat = findMetric(current, COMPOSITION_KEYS);
  const prevFat = findMetric(prev, COMPOSITION_KEYS);
  const lean = findMetric(current, LEAN_KEYS);
  const prevLean = findMetric(prev, LEAN_KEYS);
  if (!fat || !prevFat || !lean || !prevLean) return null;
  const fatDelta = prevFat.value - fat.value;
  const leanDelta = lean.value - prevLean.value;
  const vatCur = findMetric(current, VAT_KEYS);
  const vatPrev = findMetric(prev, VAT_KEYS);
  const vatDelta = vatCur && vatPrev ? vatPrev.value - vatCur.value : 0;
  const fatScore = Math.min(50, Math.max(-25, fatDelta * 10));
  const leanScore = Math.min(50, Math.max(-25, leanDelta * 5));
  const vatScore = vatCur && vatPrev ? Math.min(20, Math.max(-10, vatDelta * 20)) : 0;
  return Math.round(Math.min(100, Math.max(0, 50 + fatScore + leanScore + vatScore)));
}

function findAllMetrics(metrics: DexaMetric[], keys: string[]): DexaMetric[] {
  return metrics.filter(m => keys.some(k => m.name.toLowerCase().includes(k.toLowerCase())));
}

function GaugeCard({ label, value, unit, icon: Icon, max, color }: {
  label: string;
  value: number;
  unit: string;
  icon: typeof Activity;
  max: number;
  color: string;
}) {
  const percent = Math.min(100, (value / max) * 100);
  const radialData = [{ value: percent, fill: color }];

  return (
    <div className="bg-secondary/20 rounded-xl p-3 flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <RadialBarChart
          width={80}
          height={80}
          cx={40}
          cy={40}
          innerRadius={28}
          outerRadius={38}
          barSize={8}
          data={radialData}
          startAngle={210}
          endAngle={-30}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={4}
            background={{ fill: 'hsl(var(--secondary))' }}
          />
        </RadialBarChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-mono font-bold text-foreground">{value}</span>
          <span className="text-[8px] text-muted-foreground">{unit}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

export default function DexaScanView({ uploads }: DexaScanViewProps) {
  const dexaUploads = useMemo(() => {
    return uploads.filter(u =>
      u.ai_extracted_data?.document_type === 'dexa_scan' ||
      u.ai_extracted_data?.biomarkers?.some((b: any) =>
        b.category === 'body_composition' || b.category === 'bone_density'
      )
    );
  }, [uploads]);

  if (dexaUploads.length === 0) return null;

  const latest = dexaUploads[dexaUploads.length - 1];
  const previous = dexaUploads.length > 1 ? dexaUploads[dexaUploads.length - 2] : null;
  const metrics = extractDexaMetrics(latest);
  const prevMetrics = previous ? extractDexaMetrics(previous) : [];

  const bodyFat = findMetric(metrics, COMPOSITION_KEYS);
  const leanMass = findMetric(metrics, LEAN_KEYS);
  const bmd = findMetric(metrics, BMD_KEYS);
  const vat = findMetric(metrics, VAT_KEYS);

  const prevBodyFat = findMetric(prevMetrics, COMPOSITION_KEYS);
  const prevLeanMass = findMetric(prevMetrics, LEAN_KEYS);
  const prevBmd = findMetric(prevMetrics, BMD_KEYS);
  const prevVat = findMetric(prevMetrics, VAT_KEYS);

  const regionalFat = findAllMetrics(metrics, REGIONAL_FAT_KEYS);
  const regionalLean = findAllMetrics(metrics, REGIONAL_LEAN_KEYS);

  function delta(current?: DexaMetric, prev?: DexaMetric): string | null {
    if (!current || !prev) return null;
    const diff = current.value - prev.value;
    if (diff === 0) return null;
    return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`;
  }

  const summary = latest.ai_extracted_data?.summary;
  const scanDate = new Date(latest.reading_date || latest.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Regional bar chart data
  const regionBarData = useMemo(() => {
    const regions: { name: string; fat: number; lean: number }[] = [];
    const regionNames = ['Arms', 'Arm', 'Legs', 'Leg', 'Trunk', 'Torso', 'Android', 'Gynoid'];

    regionNames.forEach(region => {
      const fat = regionalFat.find(m => m.name.toLowerCase().includes(region.toLowerCase()));
      const lean = regionalLean.find(m => m.name.toLowerCase().includes(region.toLowerCase()));
      if (fat || lean) {
        // Deduplicate Arm/Arms, Leg/Legs, Trunk/Torso
        const normalName = region === 'Arm' ? 'Arms' : region === 'Leg' ? 'Legs' : region === 'Torso' ? 'Trunk' : region;
        if (!regions.find(r => r.name === normalName)) {
          regions.push({
            name: normalName,
            fat: fat?.value || 0,
            lean: lean?.value || 0,
          });
        }
      }
    });
    return regions;
  }, [regionalFat, regionalLean]);

  // Body composition trend data across all DEXA scans
  const trendData = useMemo(() => {
    if (dexaUploads.length < 2) return [];
    return dexaUploads.map((upload, idx) => {
      const m = extractDexaMetrics(upload);
      const fat = findMetric(m, COMPOSITION_KEYS);
      const lean = findMetric(m, LEAN_KEYS);
      const bmdVal = findMetric(m, BMD_KEYS);
      const vatVal = findMetric(m, VAT_KEYS);
      const date = new Date(upload.reading_date || upload.created_at);
      // Calculate recomp score vs previous scan
      let recompScore: number | null = null;
      if (idx > 0) {
        const prevM = extractDexaMetrics(dexaUploads[idx - 1]);
        recompScore = calcRecompScore(m, prevM);
      }
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        'Fat %': fat?.value ?? null,
        'Lean Mass': lean?.value ?? null,
        'BMD': bmdVal?.value ?? null,
        'VAT': vatVal?.value ?? null,
        'Recomp': recompScore,
      };
    });
  }, [dexaUploads]);

  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/30 flex items-center justify-between">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Scan className="w-3.5 h-3.5 text-primary" />
          DEXA Scan · Body Composition
        </h4>
        <span className="text-[10px] text-muted-foreground">{scanDate}</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Summary */}
        {summary && (
          <p className="text-[10px] text-muted-foreground bg-secondary/20 rounded-lg px-2.5 py-2">{summary}</p>
        )}

        {/* Recomposition Score */}
        {previous && bodyFat && prevBodyFat && leanMass && prevLeanMass && (() => {
          const fatDelta = prevBodyFat.value - bodyFat.value; // positive = fat lost
          const leanDelta = leanMass.value - prevLeanMass.value; // positive = lean gained
          // Score: weighted combo — fat loss (40%) + lean gain (40%) + VAT improvement (20%)
          // Normalize: 1% fat loss ≈ 10pts, 1lb lean gain ≈ 5pts, 0.5lb VAT loss ≈ 10pts
          const fatScore = Math.min(50, Math.max(-25, fatDelta * 10));
          const leanScore = Math.min(50, Math.max(-25, leanDelta * 5));
          const vatDelta = (prevVat?.value ?? 0) - (vat?.value ?? 0);
          const vatScore = vat && prevVat ? Math.min(20, Math.max(-10, vatDelta * 20)) : 0;
          const raw = fatScore + leanScore + vatScore;
          const score = Math.round(Math.min(100, Math.max(0, 50 + raw)));
          const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
          const gradeColor = score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-destructive';
          const gradeBg = score >= 70 ? 'bg-emerald-500/10 border-emerald-500/20' : score >= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-destructive/10 border-destructive/20';
          const barColor = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-destructive';

          return (
            <div className={`rounded-xl p-3 border ${gradeBg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Zap className={`w-4 h-4 ${gradeColor}`} />
                  <span className="text-xs font-semibold text-foreground">Recomposition Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-mono font-bold ${gradeColor}`}>{grade}</span>
                  <span className="text-xs font-mono text-muted-foreground">{score}/100</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className={fatDelta > 0 ? 'text-emerald-400' : fatDelta < 0 ? 'text-amber-400' : 'text-muted-foreground'}>
                  Fat: {fatDelta > 0 ? '-' : '+'}{Math.abs(fatDelta).toFixed(1)}{bodyFat.unit === '%' ? 'pp' : bodyFat.unit}
                </span>
                <span className={leanDelta > 0 ? 'text-emerald-400' : leanDelta < 0 ? 'text-amber-400' : 'text-muted-foreground'}>
                  Lean: {leanDelta > 0 ? '+' : ''}{leanDelta.toFixed(1)} {leanMass.unit}
                </span>
                {vat && prevVat && (
                  <span className={vatDelta > 0 ? 'text-emerald-400' : vatDelta < 0 ? 'text-amber-400' : 'text-muted-foreground'}>
                    VAT: {vatDelta > 0 ? '-' : '+'}{Math.abs(vatDelta).toFixed(1)} {vat.unit}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Key Metrics Gauges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {bodyFat && (
            <GaugeCard
              label="Body Fat"
              value={bodyFat.value}
              unit={bodyFat.unit}
              icon={Flame}
              max={bodyFat.unit === '%' ? 50 : 100}
              color="hsl(var(--chart-4))"
            />
          )}
          {leanMass && (
            <GaugeCard
              label="Lean Mass"
              value={leanMass.value}
              unit={leanMass.unit}
              icon={Activity}
              max={leanMass.unit === 'lbs' ? 250 : leanMass.unit === 'kg' ? 115 : 100}
              color="hsl(var(--chart-2))"
            />
          )}
          {bmd && (
            <GaugeCard
              label="Bone Density"
              value={bmd.value}
              unit={bmd.unit}
              icon={Bone}
              max={2}
              color="hsl(var(--chart-5))"
            />
          )}
          {vat && (
            <GaugeCard
              label="Visceral Fat"
              value={vat.value}
              unit={vat.unit}
              icon={Scale}
              max={vat.unit === 'lbs' ? 10 : vat.unit === 'kg' ? 5 : 200}
              color="hsl(var(--destructive))"
            />
          )}
        </div>

        {/* Change from Previous */}
        {previous && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Fat', d: delta(bodyFat, prevBodyFat), good: 'down' },
              { label: 'Lean', d: delta(leanMass, prevLeanMass), good: 'up' },
              { label: 'BMD', d: delta(bmd, prevBmd), good: 'up' },
              { label: 'VAT', d: delta(vat, prevVat), good: 'down' },
            ].filter(x => x.d).map(({ label, d, good }) => {
              const isPositive = d!.startsWith('+');
              const isGood = (good === 'up' && isPositive) || (good === 'down' && !isPositive);
              return (
                <span
                  key={label}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium",
                    isGood
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  )}
                >
                  {label}: {d}
                </span>
              );
            })}
          </div>
        )}

        {/* Regional Distribution Chart */}
        {regionBarData.length > 0 && (
          <div>
            <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Regional Distribution
            </h5>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionBarData} barGap={2}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="fat" name="Fat" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="lean" name="Lean" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-1">
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-4))' }} />
                Fat
              </span>
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                Lean
              </span>
            </div>
          </div>
        )}

        {/* Body Composition Trend */}
        {trendData.length >= 2 && (
          <div>
            <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              Composition Trend
            </h5>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                    label={{ value: '%', position: 'insideTopLeft', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                    label={{ value: 'lbs', position: 'insideTopRight', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(value: number, name: string) => {
                      const unit = name === 'Fat %' ? '%' : name === 'BMD' ? 'g/cm²' : name === 'Recomp' ? '/100' : 'lbs';
                      return [`${value} ${unit}`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} iconSize={8} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="Fat %"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: 'hsl(var(--chart-4))', strokeWidth: 0 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="Recomp"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    strokeDasharray="6 3"
                    dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Lean Mass"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: 'hsl(var(--chart-2))', strokeWidth: 0 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="VAT"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={{ r: 3, fill: 'hsl(var(--destructive))', strokeWidth: 0 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* All DEXA metrics list */}
        {metrics.length > 0 && (
          <div>
            <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              All Measurements ({metrics.length})
            </h5>
            <div className="space-y-0.5 max-h-40 overflow-y-auto scrollbar-thin">
              {metrics.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-secondary/20">
                  <span className="text-foreground truncate">{m.name}</span>
                  <span className="font-mono text-foreground flex-shrink-0 ml-2">
                    {m.value} <span className="text-muted-foreground text-[10px]">{m.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multiple scans indicator */}
        {dexaUploads.length > 1 && (
          <p className="text-[9px] text-muted-foreground/60 text-center">
            Showing latest of {dexaUploads.length} DEXA scans · Changes compared to previous scan
          </p>
        )}
      </div>
    </div>
  );
}
