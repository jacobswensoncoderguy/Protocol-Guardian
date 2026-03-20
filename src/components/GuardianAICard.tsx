import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, ArrowRight, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClickableCard from './ClickableCard';
import { Compound } from '@/data/compounds';
import { UserGoal } from '@/hooks/useGoals';
import ChatMarkdown from './ChatMarkdown';

type InsightMode = 'stack' | 'today' | 'training' | 'recovery' | 'body';

const MODE_LABELS: Record<InsightMode, { label: string; emoji: string }> = {
  stack: { label: 'STACK INSIGHT', emoji: '⚡' },
  today: { label: 'TODAY', emoji: '🎯' },
  training: { label: 'TRAINING INSIGHT', emoji: '💪' },
  recovery: { label: 'RECOVERY', emoji: '🧘' },
  body: { label: 'BODY', emoji: '🧬' },
};

const MODES: InsightMode[] = ['stack', 'today', 'training', 'recovery', 'body'];

const MODE_TO_INSIGHT_TYPE: Record<InsightMode, string> = {
  stack: 'performance',
  today: 'recommendation',
  training: 'performance',
  recovery: 'recommendation',
  body: 'symptom',
};

interface GuardianAICardProps {
  compounds: Compound[];
  goals?: UserGoal[];
  onAskMore: () => void;
  onAction?: () => void;
}

const GuardianAICard: React.FC<GuardianAICardProps> = ({
  compounds,
  goals,
  onAskMore,
  onAction,
}) => {
  const [mode, setMode] = useState<InsightMode>('stack');
  const [insights, setInsights] = useState<Partial<Record<InsightMode, string>>>({});
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const fetchInsight = useCallback(async (m: InsightMode) => {
    if (insights[m] || compounds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-insight`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            compounds,
            goals: goals || [],
            symptoms: [],
            insightType: MODE_TO_INSIGHT_TYPE[m],
          }),
        },
      );
      const data = await res.json();
      if (mounted.current && data.insight) {
        setInsights(prev => ({ ...prev, [m]: data.insight }));
      }
    } catch {
      // silent fail
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [compounds, goals, insights]);

  useEffect(() => { fetchInsight(mode); }, [mode]);

  const cycleMode = () => {
    const idx = MODES.indexOf(mode);
    const next = MODES[(idx + 1) % MODES.length];
    setMode(next);
  };

  const modeInfo = MODE_LABELS[mode];

  return (
    <ClickableCard className="overflow-hidden" showArrow={false}>
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-[14px] p-px bg-gradient-to-r from-primary to-[hsl(270,100%,65%)] -z-10 opacity-30" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Animated orb */}
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-[hsl(270,100%,65%)] animate-pulse" />
            <div className="absolute inset-[2px] rounded-full bg-card flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
          </div>
          <span className="text-xs font-bold tracking-wider text-foreground">GUARDIAN AI</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); cycleMode(); }}
          className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          {modeInfo.emoji} {modeInfo.label}
        </button>
      </div>

      <div className="min-h-[60px] mb-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RotateCw className="w-3 h-3 animate-spin" />
            Generating insight…
          </div>
        ) : insights[mode] ? (
          <div className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
            <ChatMarkdown content={insights[mode]!} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">
            {compounds.length === 0 ? 'Add compounds to receive AI insights' : 'Tap to generate insight'}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={(e) => { e.stopPropagation(); onAskMore(); }}>
          Ask more <ArrowRight className="w-3 h-3" />
        </Button>
        {onAction && (
          <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={(e) => { e.stopPropagation(); onAction(); }}>
            Act on this <ArrowRight className="w-3 h-3" />
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-[10px] h-7 gap-1 ml-auto" onClick={(e) => { e.stopPropagation(); cycleMode(); }}>
          Next <RotateCw className="w-3 h-3" />
        </Button>
      </div>
    </ClickableCard>
  );
};

export default GuardianAICard;
