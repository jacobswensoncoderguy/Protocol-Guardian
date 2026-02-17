import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface InfoTooltipProps {
  text: string;
  className?: string;
}

const InfoTooltip = ({ text, className = '' }: InfoTooltipProps) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button className={`inline-flex items-center text-muted-foreground/50 hover:text-muted-foreground transition-colors ${className}`} type="button">
          <Info className="w-3 h-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-xs bg-popover border-border z-50">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default InfoTooltip;
