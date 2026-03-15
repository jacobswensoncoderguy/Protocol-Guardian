import * as React from 'react';
import { format, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DatePickerInputProps {
  /** ISO date string (YYYY-MM-DD) or empty */
  value: string;
  /** Called with ISO date string */
  onChange: (value: string) => void;
  /** Optional min date ISO string */
  min?: string;
  /** Optional max date ISO string */
  max?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Additional className for the trigger button */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export default function DatePickerInput({
  value,
  onChange,
  min,
  max,
  placeholder = 'Pick a date',
  className,
  disabled,
}: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false);

  const parsedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  const selectedDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : undefined;
  const minDate = min ? parse(min, 'yyyy-MM-dd', new Date()) : undefined;
  const maxDate = max ? parse(max, 'yyyy-MM-dd', new Date()) : undefined;

  const disabledMatcher = React.useCallback((date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  }, [min, max]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 w-full rounded-md border border-border/50 bg-secondary px-2.5 py-1.5 text-sm text-left font-mono transition-colors',
            'hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
          <span className="flex-1 truncate text-[11px]">
            {selectedDate ? format(selectedDate, 'MMM d, yyyy') : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[100]" align="start" side="bottom" sideOffset={4}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, 'yyyy-MM-dd'));
            } else {
              onChange('');
            }
            setOpen(false);
          }}
          disabled={disabledMatcher}
          defaultMonth={selectedDate || new Date()}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}
