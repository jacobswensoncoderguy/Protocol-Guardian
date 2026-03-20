import React from 'react';
import { MessageCircle } from 'lucide-react';

interface GuardianAskBarProps {
  onOpen: () => void;
  visible?: boolean;
}

const GuardianAskBar: React.FC<GuardianAskBarProps> = ({ onOpen, visible = true }) => {
  if (!visible) return null;

  return (
    <div className="fixed bottom-[72px] left-0 right-0 z-30 px-3 pb-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))' }}>
      <button
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/50 bg-card/95 backdrop-blur-md shadow-lg hover:border-primary/30 transition-all active:scale-[0.98]"
      >
        {/* Guardian orb */}
        <div className="relative w-8 h-8 flex-shrink-0">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-[hsl(270,100%,65%)] opacity-80 animate-pulse" />
          <div className="absolute inset-[3px] rounded-full bg-card flex items-center justify-center">
            <MessageCircle className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
        <span className="text-sm text-muted-foreground flex-1 text-left">
          Ask Guardian anything about your protocol…
        </span>
      </button>
    </div>
  );
};

export default GuardianAskBar;
