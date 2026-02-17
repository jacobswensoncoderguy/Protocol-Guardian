import { useState } from 'react';
import { Plus, Package, Target, Brain, Calendar, ShoppingCart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

interface QuickActionsFABProps {
  activeTab: string;
  onAddCompound: () => void;
  onManageProtocols: () => void;
  onGoalExpansion: () => void;
  onNavigateTab: (tab: string) => void;
}

const QuickActionsFAB = ({ activeTab, onAddCompound, onManageProtocols, onGoalExpansion, onNavigateTab }: QuickActionsFABProps) => {
  const [open, setOpen] = useState(false);

  const getActions = (): QuickAction[] => {
    switch (activeTab) {
      case 'dashboard':
        return [
          { icon: Package, label: 'Add Compound', onClick: onAddCompound },
          { icon: Target, label: 'New Goal', onClick: onGoalExpansion },
          { icon: Brain, label: 'AI Insights', onClick: () => onNavigateTab('ai-insights') },
        ];
      case 'schedule':
        return [
          { icon: Package, label: 'Add Compound', onClick: onAddCompound },
          { icon: Calendar, label: 'Manage Protocols', onClick: onManageProtocols },
        ];
      case 'inventory':
        return [
          { icon: Package, label: 'Add Compound', onClick: onAddCompound },
          { icon: ShoppingCart, label: 'View Reorders', onClick: () => onNavigateTab('reorders') },
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
          { icon: Target, label: 'New Goal', onClick: onGoalExpansion },
        ];
    }
  };

  const actions = getActions();

  return (
    <div className="fixed bottom-20 left-4 z-40 sm:bottom-6 sm:left-6">
      {/* Action items */}
      <div className={cn(
        "flex flex-col-reverse gap-2 mb-2 transition-all duration-200",
        open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        {actions.map((action, i) => (
          <button
            key={action.label}
            onClick={() => { action.onClick(); setOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border/50 shadow-lg hover:bg-secondary/80 transition-all text-sm font-medium text-foreground animate-in fade-in-0 slide-in-from-bottom-2"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <action.icon className="w-4 h-4 text-primary" />
            {action.label}
          </button>
        ))}
      </div>

      {/* FAB trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 active:scale-95",
          open
            ? "bg-muted text-muted-foreground rotate-45"
            : "bg-primary text-primary-foreground"
        )}
      >
        {open ? <X className="w-5 h-5 rotate-[-45deg]" /> : <Plus className="w-5 h-5" />}
      </button>
    </div>
  );
};

export default QuickActionsFAB;
