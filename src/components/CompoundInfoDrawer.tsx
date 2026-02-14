import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Compound } from '@/data/compounds';
import { compoundBenefits, TimelineEvent } from '@/data/compoundBenefits';
import { getCycleStatus } from '@/lib/cycling';
import { getDaysRemainingWithCycling } from '@/lib/cycling';
import { getStatus } from '@/data/compounds';
import { Info, Clock } from 'lucide-react';
import CompoundAISection from '@/components/CompoundAISection';
import { CompoundAnalysis } from '@/hooks/useProtocolAnalysis';

interface CompoundInfoDrawerProps {
  compound: Compound | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compoundAnalysis?: CompoundAnalysis | null;
  compoundLoading?: boolean;
  onAnalyzeCompound?: (compoundId: string) => void;
}

const TimelineViz = ({ events }: { events: TimelineEvent[] }) => {
  const maxWeek = Math.max(...events.map(e => e.week));

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Clock className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground/80">Benefits Timeline</span>
      </div>
      <div className="relative ml-3 border-l-2 border-primary/30 pl-4 space-y-3">
        {events.map((event, i) => {
          const pct = maxWeek > 0 ? (event.week / maxWeek) : 0;
          return (
            <div key={i} className="relative">
              {/* dot */}
              <div
                className="absolute -left-[calc(1rem+5px)] top-1 w-2.5 h-2.5 rounded-full border-2 border-primary bg-card"
                style={{ opacity: 0.6 + pct * 0.4 }}
              />
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-primary font-bold min-w-[3rem]">
                  {event.week < 1 ? `${Math.round(event.week * 7)}d` : event.week === 1 ? 'Wk 1' : `Wk ${event.week}`}
                </span>
                <span className="text-xs text-foreground/80 leading-snug">{event.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Map user-facing compound names → compoundBenefits keys
const NAME_TO_BENEFIT_KEY: Record<string, string> = {
  '5-amino-1mq': '5-amino-1mq',
  'b12': 'b12',
  'bpc-157': 'bpc-157',
  'cerebroprotein': 'cerebroprotein',
  'cjc-1295': 'cjc-1295',
  'ghk-cu': 'ghk-cu',
  'igf-1 lr3': 'igf1-lr3',
  'ipamorelin': 'ipamorelin',
  'mots-c': 'mots-c',
  'nad+': 'nad-plus',
  'retatrutide': 'retatrutide',
  'selank': 'selank',
  'semax': 'semax',
  'tb-500': 'tb-500',
  'tesamorelin': 'tesamorelin',
  'thymosin alpha-1': 'thymosin-a1',
  'deca': 'deca',
  'test cypionate': 'test-cyp',
  'anavar': 'anavar',
  'ashwagandha': 'ashwagandha',
  'ksm-66 ashwagandha': 'ashwagandha',
  'bergamot': 'bergamot',
  'citrus bergamot': 'bergamot',
  'cabergoline': 'cabergoline',
  'hawthorn': 'hawthorn',
  'hawthorn berry': 'hawthorn',
  'l-arginine': 'l-arginine',
  'magnesium': 'magnesium',
  'magnesium glycinate': 'magnesium',
  'milk thistle': 'milk-thistle',
  'nac': 'nac',
  'omega-3': 'omega3',
  'omega3': 'omega3',
  'super omega-3 fish oil': 'omega3',
  'fish oil': 'omega3',
  'pycnogenol': 'pycnogenol',
  'tadalafil': 'tadalafil',
  'tudca': 'tudca',
  'ubiquinol': 'ubiquinol',
  'coq10': 'ubiquinol',
  'qunol/coq10': 'ubiquinol',
  'qunol': 'ubiquinol',
  'collagen': 'collagen',
  'collagen peptides': 'collagen',
  'citrulline': 'citrulline',
  'l-citrulline': 'citrulline',
  'l-citrulline malate': 'citrulline',
  'l-citrulline malate 2:1': 'citrulline',
  'taurine': 'taurine',
  'vitamin c': 'vitamin-c',
  'vitamin-c': 'vitamin-c',
  'semaglutide': 'semaglutide',
  'winstrol': 'winstrol',
  'stanozolol': 'winstrol',
};

function toBenefitKey(name: string): string {
  // Strip trailing doses/sizes (e.g. "10mg", "500mg", "1,000mg", "1g", "200mg", "250mcg", "5mg")
  const stripped = name
    .replace(/\s*\d[\d,]*\s*(mg|mcg|g)\s*$/i, '')
    .replace(/\s*\(.*\)$/, '')
    .trim()
    .toLowerCase();

  if (NAME_TO_BENEFIT_KEY[stripped]) return NAME_TO_BENEFIT_KEY[stripped];

  const full = name.toLowerCase().replace(/\s*\(.*\)$/, '').trim();
  if (NAME_TO_BENEFIT_KEY[full]) return NAME_TO_BENEFIT_KEY[full];

  return stripped.replace(/\s+/g, '-');
}

const CompoundInfoDrawer = ({ compound, open, onOpenChange, compoundAnalysis, compoundLoading, onAnalyzeCompound }: CompoundInfoDrawerProps) => {
  if (!compound) return null;

  const key = toBenefitKey(compound.name);
  const benefits = compoundBenefits[key];
  const cycleStatus = getCycleStatus(compound);
  const daysLeft = getDaysRemainingWithCycling(compound);
  const status = getStatus(daysLeft);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto bg-card border-border rounded-t-2xl">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="flex items-center gap-3 text-foreground">
            <span className="text-3xl">{benefits?.icon || '💊'}</span>
            <div>
              <div className="text-lg font-bold">{compound.name}</div>
              <div className="text-xs text-muted-foreground font-normal capitalize">{compound.category.replace('-', ' ')}</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Status bar */}
        <div className="flex gap-2 flex-wrap mt-2 mb-4">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
            status === 'critical' ? 'bg-destructive/20 text-status-critical' :
            status === 'warning' ? 'bg-accent/20 text-status-warning' :
            'bg-status-good/10 text-status-good'
          }`}>
            {daysLeft}d supply
          </span>
          {cycleStatus.hasCycle && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              cycleStatus.isOn ? 'bg-status-good/10 text-status-good' : 'bg-accent/20 text-status-warning'
            }`}>
              {cycleStatus.phaseLabel}
            </span>
          )}
          {compound.timingNote && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {compound.timingNote}
            </span>
          )}
        </div>

        {/* Benefits */}
        {benefits ? (
          <div className="space-y-2.5">
            {benefits.benefits.map((b, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="text-primary text-xs mt-0.5">●</span>
                <p className="text-sm text-foreground/85 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Info className="w-4 h-4" />
            <span>No benefit data available for this compound yet.</span>
          </div>
        )}

        {/* Timeline */}
        {benefits?.timeline && benefits.timeline.length > 0 && (
          <TimelineViz events={benefits.timeline} />
        )}

        {/* Cycling note */}
        {compound.cyclingNote && (
          <div className="mt-4 p-3 rounded-lg bg-secondary/50 border border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/80">Cycling:</span> {compound.cyclingNote}
            </p>
          </div>
        )}

        {/* Notes */}
        {compound.notes && (
          <div className="mt-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/80">Notes:</span> {compound.notes}
            </p>
          </div>
        )}

        {/* AI Stack Analysis */}
        <CompoundAISection
          analysis={compoundAnalysis ?? null}
          loading={compoundLoading ?? false}
          onAnalyze={() => onAnalyzeCompound?.(compound.id)}
        />
      </SheetContent>
    </Sheet>
  );
};

export default CompoundInfoDrawer;
