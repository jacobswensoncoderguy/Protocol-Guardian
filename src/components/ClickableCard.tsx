import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpRight } from 'lucide-react';

interface ClickableCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  accentColor?: string; // left border accent color
  showArrow?: boolean;
  disabled?: boolean;
}

const ClickableCard = React.forwardRef<HTMLDivElement, ClickableCardProps>(
  ({ children, onClick, className, accentColor, showArrow = true, disabled = false }, ref) => {
    return (
      <div
        ref={ref}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick && !disabled ? 0 : undefined}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(e) => {
          if (!disabled && onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          'relative rounded-[14px] border border-border/50 bg-card p-4 transition-all duration-200 group',
          onClick && !disabled && 'cursor-pointer hover:border-primary/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'opacity-50 cursor-default',
          className,
        )}
        style={accentColor ? { borderLeftWidth: '3px', borderLeftColor: accentColor } : undefined}
      >
        {children}
        {showArrow && onClick && !disabled && (
          <ArrowUpRight className="absolute top-3 right-3 w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    );
  }
);
ClickableCard.displayName = 'ClickableCard';

export default ClickableCard;
