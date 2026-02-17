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

const haptic = (ms = 10) => {
  try { navigator?.vibrate?.(ms); } catch {}
};

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

  const toggleOpen = () => {
    haptic(open ? 5 : 12);
    setOpen(!open);
  };

  const handleAction = (action: QuickAction) => {
    haptic(8);
    action.onClick();
    setOpen(false);
  };

  return (
    <div className="fixed bottom-20 left-4 z-40 sm:bottom-6 sm:left-6">
      {/* Scrim overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity duration-200 -z-10",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => { haptic(5); setOpen(false); }}
      />

      {/* Action items */}
      <div className={cn(
        "flex flex-col-reverse gap-2 mb-2 transition-all duration-300",
        open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none"
      )}>
        {actions.map((action, i) => (
          <button
            key={action.label}
            onClick={() => handleAction(action)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-card/95 border border-border/50 shadow-lg hover:bg-secondary/80 active:scale-95 transition-all duration-150 text-sm font-medium text-foreground"
            style={{
              animationDelay: `${i * 60}ms`,
              animation: open ? `fab-item-in 0.3s ease-out ${i * 60}ms both` : undefined,
            }}
          >
            <action.icon className="w-4 h-4 text-primary" />
            {action.label}
          </button>
        ))}
      </div>

      {/* FAB trigger */}
      <button
        onClick={toggleOpen}
        className={cn(
          "w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 active:scale-90",
          open
            ? "bg-muted text-muted-foreground rotate-[135deg] shadow-lg"
            : "bg-primary text-primary-foreground hover:shadow-primary/30 hover:shadow-2xl hover:scale-105"
        )}
      >
        <Plus className={cn("w-5 h-5 transition-transform duration-300", open && "rotate-[-135deg]")} />
      </button>

      <style>{`
        @keyframes fab-item-in {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default QuickActionsFAB;
