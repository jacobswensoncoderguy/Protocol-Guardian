import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const tabs = [
  { label: 'Card', path: '/invite-card' },
  { label: 'Email', path: '/invite-email' },
  { label: 'WhatsApp', path: '/invite-whatsapp' },
] as const;

const InviteNavBar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={() => navigate('/')}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Back to app"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <div className="flex gap-1 bg-card/60 border border-border/50 rounded-lg p-0.5">
        {tabs.map(t => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-colors ${
              pathname === t.path
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InviteNavBar;
