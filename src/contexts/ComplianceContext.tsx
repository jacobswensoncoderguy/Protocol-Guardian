import React, { createContext, useContext, useMemo } from 'react';
import { useComplianceData, ComplianceMap, CompoundCompliance } from '@/hooks/useComplianceData';
import { Compound, getEffectiveQuantity, getDaysRemaining, getConsumedSinceDate, consumedToContainerUnits } from '@/data/compounds';
import { getDaysRemainingWithCycling, getEffectiveDailyConsumption, ComplianceInfo } from '@/lib/cycling';

interface ComplianceContextValue {
  /** Raw compliance map */
  compliance: ComplianceMap;
  /** Get compliance info for a compound (to pass to calculation functions) */
  getComplianceInfo: (compoundId: string) => ComplianceInfo | undefined;
  /** Compliance-aware days remaining with cycling */
  getDaysRemainingAdjusted: (compound: Compound) => number;
  /** Compliance-aware effective daily consumption */
  getEffectiveDailyAdjusted: (compound: Compound) => number;
  /** Compliance-aware effective quantity */
  getEffectiveQtyAdjusted: (compound: Compound) => number;
  /** Compliance-aware consumed since date */
  getConsumedAdjusted: (compound: Compound) => number;
  /** Force re-fetch compliance data from DB */
  refetchCompliance: () => Promise<void>;
}

const ComplianceContext = createContext<ComplianceContextValue | null>(null);

export function ComplianceProvider({ userId, children }: { userId: string | undefined; children: React.ReactNode }) {
  const compliance = useComplianceData(userId);

  const value = useMemo<ComplianceContextValue>(() => {
    const getInfo = (compoundId: string): ComplianceInfo | undefined => {
      const c = compliance.get(compoundId);
      if (!c) return undefined;
      return { checkedDoses: c.checkedDoses, firstCheckDate: c.firstCheckDate, lastCheckDate: c.lastCheckDate };
    };

    return {
      compliance,
      getComplianceInfo: getInfo,
      getDaysRemainingAdjusted: (compound: Compound) =>
        getDaysRemainingWithCycling(compound, getInfo(compound.id)),
      getEffectiveDailyAdjusted: (compound: Compound) =>
        getEffectiveDailyConsumption(compound, getInfo(compound.id)),
      getEffectiveQtyAdjusted: (compound: Compound) =>
        getEffectiveQuantity(compound, getInfo(compound.id)),
      getConsumedAdjusted: (compound: Compound) =>
        getConsumedSinceDate(compound, new Date(), getInfo(compound.id)),
    };
  }, [compliance]);

  return (
    <ComplianceContext.Provider value={value}>
      {children}
    </ComplianceContext.Provider>
  );
}

export function useCompliance(): ComplianceContextValue {
  const ctx = useContext(ComplianceContext);
  if (!ctx) {
    // Fallback: return non-compliance-adjusted functions so components
    // work even outside the provider (e.g., tests)
    return {
      compliance: { get: () => undefined, entries: [], loading: false },
      getComplianceInfo: () => undefined,
      getDaysRemainingAdjusted: (c) => getDaysRemainingWithCycling(c),
      getEffectiveDailyAdjusted: (c) => getEffectiveDailyConsumption(c),
      getEffectiveQtyAdjusted: (c) => getEffectiveQuantity(c),
      getConsumedAdjusted: (c) => getConsumedSinceDate(c),
    };
  }
  return ctx;
}
