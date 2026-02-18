import * as React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface InfoTooltipProps {
  text: string;
  className?: string;
}

const InfoTooltip = React.forwardRef<HTMLButtonElement, InfoTooltipProps>(
  ({ text, className = '' }, ref) => (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            className={`inline-flex items-center text-muted-foreground/50 hover:text-muted-foreground transition-colors ${className}`}
            type="button"
          >
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs bg-popover border-border z-50">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
);
InfoTooltip.displayName = 'InfoTooltip';

export default InfoTooltip;

