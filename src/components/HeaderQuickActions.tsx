import { Plus, Package, Target, Brain, Calendar, ShoppingCart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface QuickAction {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

interface HeaderQuickActionsProps {
  activeTab: string;
  onAddCompound: () => void;
  onManageProtocols: () => void;
  onGoalExpansion: () => void;
  onNavigateTab: (tab: string) => void;
}

const haptic = (ms = 8) => {
  try { navigator?.vibrate?.(ms); } catch {}
};

const HeaderQuickActions = ({ activeTab, onAddCompound, onManageProtocols, onGoalExpansion, onNavigateTab }: HeaderQuickActionsProps) => {
  const getActions = (): QuickAction[] => {
    switch (activeTab) {
      case 'dashboard':
        return [
          { icon: Sparkles, label: 'New Protocol', onClick: onManageProtocols },
          { icon: Target, label: 'New Goal', onClick: onGoalExpansion },
        ];
      case 'schedule':
        return [
          { icon: Package, label: 'Add Compound', onClick: onAddCompound },
          { icon: Sparkles, label: 'Protocols', onClick: onManageProtocols },
        ];
      case 'inventory':
        return [
          { icon: Package, label: 'Add Compound', onClick: onAddCompound },
        ];
      case 'outcomes':
        return [
          { icon: Target, label: 'New Goal', onClick: onGoalExpansion },
        ];
      case 'reorders':
        return [
          { icon: Package, label: 'Add Compound', onClick: onAddCompound },
        ];
      default:
        return [
          { icon: Package, label: 'Add Compound', onClick: onAddCompound },
        ];
    }
  };

  const actions = getActions();

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex items-center gap-1">
        {actions.map((action) => (
          <Tooltip key={action.label}>
            <TooltipTrigger asChild>
              <button
                onClick={() => { haptic(); action.onClick(); }}
                className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 active:scale-90 transition-all duration-150"
                aria-label={action.label}
              >
                <action.icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {action.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};

export default HeaderQuickActions;
