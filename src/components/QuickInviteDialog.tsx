import { useState } from 'react';
import { UserPlus, Mail, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface QuickInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendInvite: (email: string) => Promise<{ success: boolean; error?: string; isResend?: boolean }>;
}

const QuickInviteDialog = ({ open, onOpenChange, onSendInvite }: QuickInviteDialogProps) => {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4 text-primary" />
            Invite Household Member
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Enter their email to send a household invite. They'll receive an email to join.
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
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Send Invite
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickInviteDialog;
