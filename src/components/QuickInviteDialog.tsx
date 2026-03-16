import { useState } from 'react';
import { UserPlus, Mail, MessageSquare, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface QuickInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendInvite: (email: string) => Promise<{ success: boolean; error?: string; isResend?: boolean }>;
}

const QuickInviteDialog = ({ open, onOpenChange, onSendInvite }: QuickInviteDialogProps) => {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  const baseUrl = 'https://superhumanprotocol.lovable.app';
  const inviteUrl = user ? `${baseUrl}/invite?ref=${user.id}` : `${baseUrl}/invite`;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const result = await onSendInvite(email.trim());
    if (result.success) {
      toast.success(result.isResend ? 'Invite resent!' : 'Household invite sent!');
      setEmail('');
      onOpenChange(false);
    } else {
      toast.error(result.error || 'Failed to send invite');
    }
    setSending(false);
  };

  const handleTextInvite = () => {
    const body = `Join my household on PROTOCOL Guardian to sync our protocols and track together! Sign up here: ${inviteUrl}`;
    window.open(`sms:?&body=${encodeURIComponent(body)}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4 text-primary" />
            Invite Household Member
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* Email invite */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Send a household invite by email. They'll receive an email to join.
            </p>
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="partner@email.com"
                className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                disabled={sending}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Email Invite
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Text invite */}
          <button
            type="button"
            onClick={handleTextInvite}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            Send Text Invite
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickInviteDialog;
