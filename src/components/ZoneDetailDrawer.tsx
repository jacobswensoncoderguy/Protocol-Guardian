import { useState, useRef } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { BodyZone, BODY_ZONES, getCompoundsForZone } from '@/data/bodyZoneMapping';
import { Compound } from '@/data/compounds';
import { compoundBenefits } from '@/data/compoundBenefits';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface ZoneDetailDrawerProps {
  zone: BodyZone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compounds: Compound[];
  toleranceLevel?: string;
}

function normalizeBenefitKey(name: string): string {
  return name.toLowerCase()
    .replace(/\s*\d+\s*m[cg]g?\s*/gi, '')
    .replace(/\s*\d+\s*i\.?u\.?\s*/gi, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const ZoneDetailDrawer = ({ zone, open, onOpenChange, compounds, toleranceLevel = 'moderate' }: ZoneDetailDrawerProps) => {
  const [aiSuggestion, setAiSuggestion] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  if (!zone) return null;

  const info = BODY_ZONES[zone];
  // Only include active (non-dormant) compounds
  const activeCompounds = compounds.filter(c => !c.notes?.includes('[DORMANT]'));
  const compoundNameIds = activeCompounds.map(c => c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  const zoneCompounds = getCompoundsForZone(zone, compoundNameIds);

  const compoundDetails = zoneCompounds.map(zc => {
    const compound = activeCompounds.find(c =>
      c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') === zc.id
    );
    const benefitKey = compound ? normalizeBenefitKey(compound.name) : zc.id;
    const benefits = compoundBenefits[benefitKey];
    return { ...zc, compound, benefits };
  });

  const intensityLabel = (w: number) => w >= 0.8 ? 'Primary' : w >= 0.5 ? 'Strong' : w >= 0.3 ? 'Supporting' : 'Minimal';
  const intensityColor = (w: number) => w >= 0.8 ? 'text-emerald-400' : w >= 0.5 ? 'text-primary' : w >= 0.3 ? 'text-muted-foreground' : 'text-muted-foreground/50';

  // Compute what's keeping this zone from being stronger
  const zoneGapAnalysis = (() => {
    const currentIntensity = compoundDetails.reduce((max, cd) => Math.max(max, cd.weight), 0);
    const pct = Math.round(currentIntensity * 100);
    const compoundCount = compoundDetails.length;
    
    if (pct >= 90) return `${pct}% — Near maximum. ${compoundCount} compound${compoundCount > 1 ? 's' : ''} driving this zone at peak efficacy.`;
    if (pct >= 70) return `${pct}% — Strong coverage. Adding a synergistic compound or increasing frequency could push toward primary.`;
    if (pct >= 40) return `${pct}% — Moderate coverage. ${compoundCount === 0 ? 'No compounds target this zone directly.' : `${compoundCount} compound${compoundCount > 1 ? 's' : ''} contribute but at sub-optimal intensity.`} Consider higher doses or additional compounds.`;
    if (pct > 0) return `${pct}% — Low coverage. Current compounds provide only supporting impact. A dedicated compound for this zone would significantly improve coverage.`;
    return '0% — No active compounds target this zone. Add a compound to begin coverage.';
  })();

  const handleImproveImpact = async () => {
    setAiLoading(true);
    setAiSuggestion('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const stackDesc = compounds.map(c =>
      `- ${c.name} (${c.category}): ${c.dosePerUse} ${c.doseLabel} × ${c.dosesPerDay}/day × ${c.daysPerWeek}d/wk`
    ).join('\n');

    const zoneCompoundNames = compoundDetails.map(cd => cd.compound?.name || cd.id).join(', ');

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-protocol`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            compounds: compounds.map(c => ({
              name: c.name, category: c.category, dosePerUse: c.dosePerUse,
              doseLabel: c.doseLabel, dosesPerDay: c.dosesPerDay, daysPerWeek: c.daysPerWeek,
              timingNote: c.timingNote, cyclingNote: c.cyclingNote,
              cycleOnDays: c.cycleOnDays, cycleOffDays: c.cycleOffDays,
              unitPrice: c.unitPrice,
            })),
            protocols: [],
            toleranceLevel,
            analysisType: 'chat',
            messages: [{
              role: 'user',
              content: `I want to MAXIMIZE the impact on my "${info.label}" zone (${info.description}). Currently affecting this zone: ${zoneCompoundNames || 'nothing'}.

My full stack:
${stackDesc}

Give me specific, actionable suggestions to increase ${info.label} impact — considering synergy with my entire stack. Include:
1. Dose/timing/frequency adjustments to existing compounds
2. New compounds or behaviors I should consider adding
3. Lifestyle or behavioral optimizations (sleep, training, nutrition)
4. Any compounds in my stack that might be antagonizing ${info.label} goals

Keep it concise and practical. Calibrate to my ${toleranceLevel} tolerance level.`
            }],
          }),
          signal: abortRef.current.signal,
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) { toast.error('Rate limited — try again shortly'); setAiLoading(false); return; }
        if (resp.status === 402) { toast.error('AI credits needed — add in Settings'); setAiLoading(false); return; }
        throw new Error('AI request failed');
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAiSuggestion(fullText);
            }
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('AI zone suggestion error:', e);
        toast.error('Could not get AI suggestions');
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => {
      onOpenChange(o);
      if (!o) { setAiSuggestion(''); abortRef.current?.abort(); }
    }}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: info.color, boxShadow: `0 0 10px ${info.color}` }}
            />
            <DrawerTitle className="text-base">{info.label}</DrawerTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto scrollbar-thin space-y-3">
          {/* Zone gap analysis — always visible */}
          <div className="bg-secondary/30 rounded-lg border border-border/20 p-2.5">
            <p className="text-[11px] text-muted-foreground leading-snug">{zoneGapAnalysis}</p>
          </div>

          {compoundDetails.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No compounds targeting this zone</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Add compounds to your protocol to improve coverage</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/60 px-1">
                <span>{compoundDetails.length} compounds</span>
                <span>Impact</span>
              </div>
              {compoundDetails.map((item, i) => (
                <div key={i} className="bg-secondary/30 rounded-lg border border-border/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.benefits && <span className="text-sm">{item.benefits.icon}</span>}
                      <span className="text-sm font-medium text-foreground">
                        {item.compound?.name || item.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono font-semibold ${intensityColor(item.weight)}`}>
                        {intensityLabel(item.weight)}
                      </span>
                      <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.weight * 100}%`, backgroundColor: info.color }}
                        />
                      </div>
                    </div>
                  </div>
                  {item.compound && (
                    <p className="text-[10px] font-mono text-muted-foreground/70">
                      {item.compound.dosePerUse} {item.compound.doseLabel} · {item.compound.dosesPerDay}x/day · {item.compound.daysPerWeek}d/wk
                    </p>
                  )}
                  {item.benefits && (
                    <div className="space-y-1">
                      {item.benefits.benefits.slice(0, 3).map((b, j) => (
                        <p key={j} className="text-[11px] text-muted-foreground leading-tight">
                          {b.startsWith('📊') ? (
                            <span className="text-primary font-medium">{b}</span>
                          ) : (
                            <>• {b}</>
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* AI Improve Impact Button */}
          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full gap-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5"
              onClick={handleImproveImpact}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-primary" />
              )}
              <span className="text-sm">
                {aiLoading ? 'Analyzing stack synergies…' : `Improve ${info.label} Impact`}
              </span>
            </Button>
          </div>

          {/* AI Loading Skeleton */}
          {aiLoading && !aiSuggestion && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Generating suggestions…</span>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-3/4 rounded bg-primary/10 animate-pulse" />
                <div className="h-3 w-full rounded bg-primary/10 animate-pulse" />
                <div className="h-3 w-5/6 rounded bg-primary/10 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-primary/10 animate-pulse" />
                <div className="h-3 w-4/5 rounded bg-primary/10 animate-pulse" />
              </div>
            </div>
          )}

          {/* AI Suggestion Result */}
          {aiSuggestion && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">AI Suggestions</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={() => {
                    navigator.clipboard.writeText(aiSuggestion);
                    setCopied(true);
                    toast.success('Copied to clipboard');
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed text-foreground/90 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:pl-4 [&_li]:my-0.5 [&_strong]:text-foreground [&_blockquote]:border-primary/30 [&_blockquote]:text-muted-foreground [&_hr]:border-border/30">
                <ReactMarkdown>{aiSuggestion}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ZoneDetailDrawer;
