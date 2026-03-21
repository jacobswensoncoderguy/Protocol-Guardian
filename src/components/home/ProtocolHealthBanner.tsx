import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Compound } from '@/data/compounds';
import { getCompoundsNeedingAttention } from '@/lib/compoundValidation';

interface ProtocolHealthBannerProps {
  compounds: Compound[];
  onNavigate?: (compoundId?: string) => void;
}

const ProtocolHealthBanner: React.FC<ProtocolHealthBannerProps> = ({ compounds, onNavigate }) => {
  const needsAttention = getCompoundsNeedingAttention(compounds);

  if (needsAttention.length === 0) return null;

  const count = needsAttention.length;
  const firstId = needsAttention[0]?.compound.id;

  return (
    <button
      onClick={() => onNavigate?.(firstId)}
      className="w-full rounded-[14px] p-3.5 text-left transition-all active:scale-[0.98] flex items-center gap-3"
      style={{
        background: '#1A0F0F',
        border: '1px solid #FF3B3B',
      }}
    >
      <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0" strokeWidth={1.5} style={{ color: '#FF3B3B' }} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: '#FF3B3B' }}>
          {count} compound{count > 1 ? 's' : ''} need{count === 1 ? 's' : ''} attention
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
          Missing data is preventing accurate depletion and reorder tracking
        </p>
      </div>
      <ChevronRight className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} style={{ color: '#9CA3AF' }} />
    </button>
  );
};

export default ProtocolHealthBanner;
