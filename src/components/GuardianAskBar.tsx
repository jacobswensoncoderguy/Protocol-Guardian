import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuardianAskBarProps {
  onOpen: () => void;
  visible?: boolean;
}

const GuardianAskBar: React.FC<GuardianAskBarProps> = ({ onOpen, visible = true }) => {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  if (!visible) return null;

  const handleSubmit = () => {
    setExpanded(false);
    onOpen();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity duration-250",
          expanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setExpanded(false)}
      />

      <div ref={barRef} className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
        {/* Expanded input bar */}
        <div
          className={cn(
            "w-[calc(100vw-2rem)] max-w-sm origin-bottom-right transition-all duration-300",
            expanded
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-3 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card border border-border/60 shadow-xl">
            <div className="relative w-7 h-7 flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-primary/60 opacity-80" />
              <div className="absolute inset-[2.5px] rounded-full bg-card flex items-center justify-center">
                <MessageCircle className="w-3 h-3 text-primary" />
              </div>
            </div>
            <input
              ref={inputRef}
              type="text"
              readOnly
              onClick={handleSubmit}
              placeholder="Ask Guardian anything…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none cursor-pointer"
            />
            <button
              onClick={handleSubmit}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95"
            >
              <Send className="w-3.5 h-3.5 text-primary-foreground" />
            </button>
          </div>
        </div>

        {/* FAB */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 active:scale-90",
            expanded
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground shadow-primary/25 hover:shadow-2xl hover:scale-105"
          )}
          style={{ boxShadow: expanded ? undefined : '0 4px 20px hsl(var(--primary) / 0.3)' }}
        >
          {expanded ? (
            <X className="w-5 h-5" />
          ) : (
            <MessageCircle className="w-5 h-5" />
          )}
        </button>
      </div>
    </>
  );
};

export default GuardianAskBar;
