import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compound } from '@/data/compounds';
import { UserProtocol } from '@/hooks/useProtocols';
import { toast } from 'sonner';

export type ToleranceLevel = 'conservative' | 'moderate' | 'aggressive' | 'performance';

export interface Contraindication {
  compounds: string[];
  severity: 'info' | 'warning' | 'danger';
  category: string;
  description: string;
  recommendation: string;
}

export interface BioavailabilityIssue {
  compound: string;
  currentMethod: string;
  issue: string;
  suggestion: string;
  improvementEstimate: string;
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
}

export interface StackAnalysis {
  overallGrade: string;
  overallSummary: string;
  contraindications: Contraindication[];
  bioavailabilityIssues: BioavailabilityIssue[];
  protocolGrades: ProtocolGrade[];
  costEfficiency: CostEfficiencyItem[];
  topRecommendations: string[];
}

export interface ToleranceComparison {
  conservative: { grade: string; summary: string; topRisk: string; topStrength: string };
  moderate: { grade: string; summary: string; topRisk: string; topStrength: string };
  aggressive: { grade: string; summary: string; topRisk: string; topStrength: string };
  performance: { grade: string; summary: string; topRisk: string; topStrength: string };
}

export interface CompoundAnalysis {
  interactions: {
    withCompound: string;
    type: 'synergy' | 'conflict' | 'caution' | 'neutral';
    description: string;
    severity: 'info' | 'warning' | 'danger';
  }[];
  bioavailability: {
    currentMethod: string;
    absorptionRate: string;
    alternatives: {
      method: string;
      improvement: string;
      description: string;
    }[];
  };
  suggestions: string[];
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

  // Create a hash of the current stack to detect changes
  const stackHash = compounds.map(c => `${c.id}-${c.dosePerUse}-${c.dosesPerDay}-${c.daysPerWeek}`).sort().join('|') + `|${toleranceLevel}`;

  const analyzeStack = useCallback(async () => {
    if (compounds.length === 0) return;
    setLoading(true);

    try {
      // Map protocol compound IDs to names
      const protocolsWithNames = protocols.map(p => ({
        ...p,
        compoundNames: p.compoundIds.map(id => compounds.find(c => c.id === id)?.name).filter(Boolean),
      }));

      const { data, error } = await supabase.functions.invoke('analyze-protocol', {
        body: {
          compounds: compounds.map(c => ({
            name: c.name,
            category: c.category,
            dosePerUse: c.dosePerUse,
            doseLabel: c.doseLabel,
            dosesPerDay: c.dosesPerDay,
            daysPerWeek: c.daysPerWeek,
            timingNote: c.timingNote,
            cyclingNote: c.cyclingNote,
            unitPrice: c.unitPrice,
            kitPrice: c.kitPrice,
          })),
          protocols: protocolsWithNames,
          toleranceLevel,
          analysisType: 'stack',
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
  }, [compounds, protocols, toleranceLevel, stackHash]);

  const analyzeCompound = useCallback(async (compoundId: string) => {
    const target = compounds.find(c => c.id === compoundId);
    if (!target) return;

    setCompoundLoading(compoundId);

    try {
      const otherCompounds = compounds.filter(c => c.id !== compoundId);
      const allCompounds = [target, ...otherCompounds];

      const { data, error } = await supabase.functions.invoke('analyze-protocol', {
        body: {
          compounds: allCompounds.map(c => ({
            name: c.name,
            category: c.category,
            dosePerUse: c.dosePerUse,
            doseLabel: c.doseLabel,
            dosesPerDay: c.dosesPerDay,
            daysPerWeek: c.daysPerWeek,
            timingNote: c.timingNote,
            cyclingNote: c.cyclingNote,
            unitPrice: c.unitPrice,
            kitPrice: c.kitPrice,
          })),
          toleranceLevel,
          analysisType: 'compound',
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
  }, [compounds, toleranceLevel]);

  // Auto-analyze on changes (debounced)
  useEffect(() => {
    if (stackHash === lastAnalyzedHash) return;
    if (compounds.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      analyzeStack();
    }, 5000); // 5s debounce for auto-analysis

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stackHash, lastAnalyzedHash, compounds.length, analyzeStack]);

  const compareAllLevels = useCallback(async () => {
    if (compounds.length === 0) return;
    setCompareLoading(true);

    try {
      const protocolsWithNames = protocols.map(p => ({
        ...p,
        compoundNames: p.compoundIds.map(id => compounds.find(c => c.id === id)?.name).filter(Boolean),
      }));

      const { data, error } = await supabase.functions.invoke('analyze-protocol', {
        body: {
          compounds: compounds.map(c => ({
            name: c.name,
            category: c.category,
            dosePerUse: c.dosePerUse,
            doseLabel: c.doseLabel,
            dosesPerDay: c.dosesPerDay,
            daysPerWeek: c.daysPerWeek,
            timingNote: c.timingNote,
            cyclingNote: c.cyclingNote,
            unitPrice: c.unitPrice,
            kitPrice: c.kitPrice,
          })),
          protocols: protocolsWithNames,
          analysisType: 'compare',
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
  }, [compounds, protocols]);

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
