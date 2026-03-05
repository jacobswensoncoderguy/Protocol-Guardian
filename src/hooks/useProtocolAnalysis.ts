import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compound } from '@/data/compounds';
import { UserProtocol } from '@/hooks/useProtocols';
import { getCycleStatus, isPaused } from '@/lib/cycling';
import { toast } from 'sonner';

export type ToleranceLevel = 'conservative' | 'moderate' | 'performance';

export interface Contraindication {
  compounds: string[];
  severity: 'info' | 'warning' | 'danger';
  category: string;
  description: string;
  recommendation: string;
  confidencePct?: number;
  evidenceTier?: string;
  riskAtTolerance?: string;
}

export interface BioavailabilityIssue {
  compound: string;
  currentMethod: string;
  issue: string;
  suggestion: string;
  improvementEstimate: string;
  confidencePct?: number;
  evidenceTier?: string;
}

export interface ProtocolGrade {
  protocolName: string;
  grade: string;
  synergies: string[];
  redundancies: string[];
  gaps: string[];
}

export interface CostEfficiencyItem {
  compound: string;
  verdict: 'excellent' | 'good' | 'fair' | 'poor';
  reasoning: string;
  alternative: string;
  confidencePct?: number;
  evidenceTier?: string;
}

export interface StackAnalysis {
  overallGrade: string;
  overallSummary: string;
  contraindications: Contraindication[];
  bioavailabilityIssues: BioavailabilityIssue[];
  protocolGrades: ProtocolGrade[];
  costEfficiency: CostEfficiencyItem[];
  topRecommendations: string[];
  overallConfidencePct?: number;
  overallEvidenceTier?: string;
  riskSummary?: string;
}

export interface ToleranceComparison {
  conservative: { grade: string; summary: string; topRisk: string; topStrength: string };
  moderate: { grade: string; summary: string; topRisk: string; topStrength: string };
  performance: { grade: string; summary: string; topRisk: string; topStrength: string };
}

export interface CompoundAnalysis {
  interactions: {
    withCompound: string;
    type: 'synergy' | 'conflict' | 'caution' | 'neutral';
    description: string;
    severity: 'info' | 'warning' | 'danger';
    confidencePct?: number;
    evidenceTier?: string;
    riskAtTolerance?: string;
  }[];
  bioavailability: {
    currentMethod: string;
    absorptionRate: string;
    confidencePct?: number;
    evidenceTier?: string;
    alternatives: {
      method: string;
      improvement: string;
      description: string;
    }[];
  };
  suggestions: string[];
  riskSummary?: string;
}

/** Check if a compound is marked dormant */
function isDormant(c: Compound): boolean {
  return !!c.notes?.includes('[DORMANT]');
}

/** Serialize a compound's live state for AI analysis, including pause, dormant, and cycle phase context */
function serializeCompoundForAI(c: Compound) {
  const cycleStatus = getCycleStatus(c);
  const paused = isPaused(c);
  const dormant = isDormant(c);
  return {
    name: c.name,
    category: c.category,
    dosePerUse: c.dosePerUse,
    doseLabel: c.doseLabel,
    dosesPerDay: c.dosesPerDay,
    daysPerWeek: c.daysPerWeek,
    timingNote: c.timingNote,
    cyclingNote: c.cyclingNote,
    cycleOnDays: c.cycleOnDays,
    cycleOffDays: c.cycleOffDays,
    cycleStartDate: c.cycleStartDate,
    unitPrice: c.unitPrice,
    kitPrice: c.kitPrice,
    // Live state — AI uses these to adjust grading and recommendations
    isPaused: paused,
    isDormant: dormant,
    depletionAction: c.depletionAction ?? null,
    pauseRestartDate: c.pauseRestartDate,
    cyclePhase: cycleStatus.hasCycle ? (cycleStatus.isOn ? 'ON' : 'OFF') : 'continuous',
    daysLeftInPhase: cycleStatus.hasCycle ? cycleStatus.daysLeftInPhase : null,
    isActiveNow: !paused && !dormant && cycleStatus.isOn,
  };
}

export function useProtocolAnalysis(compounds: Compound[], protocols: UserProtocol[]) {
  const [stackAnalysis, setStackAnalysis] = useState<StackAnalysis | null>(null);
  const [compoundAnalyses, setCompoundAnalyses] = useState<Record<string, CompoundAnalysis>>({});
  const [toleranceComparison, setToleranceComparison] = useState<ToleranceComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compoundLoading, setCompoundLoading] = useState<string | null>(null);
  const [toleranceLevel, setToleranceLevel] = useState<ToleranceLevel>('moderate');
  const [lastAnalyzedHash, setLastAnalyzedHash] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Filter out dormant compounds — they are discontinued and should not influence analysis
  const analysisCompounds = compounds.filter(c => !isDormant(c));

  // Create a hash of the current stack to detect changes
  // Hash includes cycle, pause, and dormant fields so any state change triggers re-analysis
  const stackHash = analysisCompounds.map(c =>
    `${c.id}-${c.dosePerUse}-${c.dosesPerDay}-${c.daysPerWeek}-${c.cycleOnDays ?? 0}-${c.cycleOffDays ?? 0}-${c.cycleStartDate ?? ''}-${c.pausedAt ?? ''}-${c.pauseRestartDate ?? ''}-${c.depletionAction ?? ''}`
  ).sort().join('|') + `|${toleranceLevel}`;

  /** Fetch recent protocol changes (last 90 days) to give AI full context */
  const fetchRecentChanges = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const { data } = await supabase
        .from('protocol_changes')
        .select('change_date, change_type, description, previous_value, new_value, compound_id')
        .eq('user_id', user.id)
        .gte('change_date', cutoff.toISOString().slice(0, 10))
        .order('change_date', { ascending: false })
        .limit(50);
      return (data || []).map(c => ({
        date: c.change_date,
        type: c.change_type,
        description: c.description,
        previousValue: c.previous_value,
        newValue: c.new_value,
        compoundName: analysisCompounds.find(comp => comp.id === c.compound_id)?.name || null,
      }));
    } catch {
      return [];
    }
  }, [analysisCompounds]);

  const analyzeStack = useCallback(async () => {
    if (analysisCompounds.length === 0) return;
    setLoading(true);

    try {
      // Map protocol compound IDs to names (only active compounds)
      const activeIds = new Set(analysisCompounds.map(c => c.id));
      const protocolsWithNames = protocols.map(p => ({
        ...p,
        compoundNames: p.compoundIds
          .filter(id => activeIds.has(id))
          .map(id => analysisCompounds.find(c => c.id === id)?.name)
          .filter(Boolean),
      }));

      const recentChanges = await fetchRecentChanges();

      const { data, error } = await supabase.functions.invoke('analyze-protocol', {
        body: {
          compounds: analysisCompounds.map(serializeCompoundForAI),
          protocols: protocolsWithNames,
          toleranceLevel,
          analysisType: 'stack',
          recentChanges,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setStackAnalysis(data.analysis);
      setLastAnalyzedHash(stackHash);
    } catch (err) {
      console.error('Stack analysis failed:', err);
      toast.error('Protocol analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [analysisCompounds, protocols, toleranceLevel, stackHash, fetchRecentChanges]);

  const analyzeCompound = useCallback(async (compoundId: string) => {
    const target = analysisCompounds.find(c => c.id === compoundId);
    if (!target) return;

    setCompoundLoading(compoundId);

    try {
      const otherCompounds = analysisCompounds.filter(c => c.id !== compoundId);
      const allCompounds = [target, ...otherCompounds];
      const recentChanges = await fetchRecentChanges();

      const { data, error } = await supabase.functions.invoke('analyze-protocol', {
        body: {
          compounds: allCompounds.map(serializeCompoundForAI),
          toleranceLevel,
          analysisType: 'compound',
          recentChanges,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setCompoundAnalyses(prev => ({ ...prev, [compoundId]: data.analysis }));
    } catch (err) {
      console.error('Compound analysis failed:', err);
      toast.error('Compound analysis failed.');
    } finally {
      setCompoundLoading(null);
    }
  }, [analysisCompounds, toleranceLevel, fetchRecentChanges]);

  // Auto-analyze on changes (debounced)
  useEffect(() => {
    if (stackHash === lastAnalyzedHash) return;
    if (analysisCompounds.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      analyzeStack();
    }, 5000); // 5s debounce for auto-analysis

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stackHash, lastAnalyzedHash, analysisCompounds.length, analyzeStack]);

  const compareAllLevels = useCallback(async () => {
    if (analysisCompounds.length === 0) return;
    setCompareLoading(true);

    try {
      const activeIds = new Set(analysisCompounds.map(c => c.id));
      const protocolsWithNames = protocols.map(p => ({
        ...p,
        compoundNames: p.compoundIds
          .filter(id => activeIds.has(id))
          .map(id => analysisCompounds.find(c => c.id === id)?.name)
          .filter(Boolean),
      }));

      const recentChanges = await fetchRecentChanges();

      const { data, error } = await supabase.functions.invoke('analyze-protocol', {
        body: {
          compounds: analysisCompounds.map(serializeCompoundForAI),
          protocols: protocolsWithNames,
          analysisType: 'compare',
          recentChanges,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setToleranceComparison(data.comparison);
    } catch (err) {
      console.error('Comparison failed:', err);
      toast.error('Grade comparison failed. Please try again.');
    } finally {
      setCompareLoading(false);
    }
  }, [analysisCompounds, protocols, fetchRecentChanges]);

  return {
    stackAnalysis,
    compoundAnalyses,
    loading,
    compoundLoading,
    toleranceLevel,
    setToleranceLevel,
    analyzeStack,
    analyzeCompound,
    needsRefresh: stackHash !== lastAnalyzedHash,
    toleranceComparison,
    compareLoading,
    compareAllLevels,
  };
}
