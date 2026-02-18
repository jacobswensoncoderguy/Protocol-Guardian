import { Users } from 'lucide-react';
import { HouseholdMember } from '@/hooks/useHousehold';

export interface HouseholdViewOption {
  id: string; // userId or 'combined'
  label: string;
  type: 'self' | 'member' | 'combined';
}

interface HouseholdMemberToggleProps {
  selfName: string | null;
  members: HouseholdMember[];
  selectedIds: string[]; // set of selected userIds, or ['combined'] for all
  onSelect: (option: HouseholdViewOption) => void;
}

/** Returns the best display label for a household member */
function getMemberLabel(m: HouseholdMember): string {
  if (m.displayName) return m.displayName;
  if (m.email) {
    const atIdx = m.email.indexOf('@');
    return atIdx > 0 ? m.email.slice(0, atIdx) : m.email;
  }
  return 'Member';
}

/**
 * Renders pill-style toggles for switching between individual and combined household views.
 * Only shown when there are accepted household members.
 */
const HouseholdMemberToggle = ({ selfName, members, selectedIds, onSelect }: HouseholdMemberToggleProps) => {
  if (members.length === 0) return null;

  const selfLabel = selfName || 'Mine';

  const selfOption: HouseholdViewOption = { id: 'self', label: selfLabel, type: 'self' };
  const memberOptions: HouseholdViewOption[] = members.map(m => ({
    id: m.userId,
    label: getMemberLabel(m),
    type: 'member',
  }));

  // Build combined label: "Jake + Abbie + ..."
  const allNames = [selfLabel, ...members.map(m => getMemberLabel(m))];
  const combinedLabel = allNames.join(' + ');
  const combinedOption: HouseholdViewOption = { id: 'combined', label: combinedLabel, type: 'combined' };

  const isSelfSelected = selectedIds.includes('self') && selectedIds.length === 1;
  const isCombinedSelected = selectedIds.includes('combined');

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1 mb-1.5">
        <Users className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Household View</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {/* Self */}
        <button
          onClick={() => onSelect(selfOption)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
            isSelfSelected
              ? 'bg-primary/15 text-primary border-primary/30'
              : 'bg-secondary text-muted-foreground border-border/50 hover:border-primary/20'
          }`}
        >
          {selfLabel}
        </button>

        {/* Individual members */}
        {memberOptions.map(opt => {
          const isSelected = selectedIds.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                isSelected && !isCombinedSelected
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-secondary text-muted-foreground border-border/50 hover:border-primary/20'
              }`}
            >
              {opt.label}
            </button>
          );
        })}

        {/* Combined */}
        <button
          onClick={() => onSelect(combinedOption)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border flex items-center gap-1 ${
            isCombinedSelected
              ? 'bg-accent/15 text-accent border-accent/30'
              : 'bg-secondary text-muted-foreground border-border/50 hover:border-accent/20'
          }`}
        >
          <Users className="w-2.5 h-2.5" />
          {combinedLabel}
        </button>
      </div>
    </div>
  );
};

export default HouseholdMemberToggle;

