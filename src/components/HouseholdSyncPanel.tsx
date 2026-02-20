import { useState } from 'react';
import { Users, UserPlus, Check, X, Trash2, Loader2, Mail, Clock, UserCheck, LogOut, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { HouseholdMember } from '@/hooks/useHousehold';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface HouseholdSyncPanelProps {
  members: HouseholdMember[];
  pendingIncoming: HouseholdMember[];
  pendingOutgoing: HouseholdMember[];
  loading: boolean;
  onSendInvite: (email: string) => Promise<{ success: boolean; error?: string; isResend?: boolean }>;
  onAccept: (linkId: string) => Promise<boolean>;
  onReject: (linkId: string) => Promise<boolean>;
  onRemove: (linkId: string) => Promise<boolean>;
}

/** Returns the best display label for a household member */
function getMemberLabel(m: HouseholdMember): string {
  if (m.displayName) return m.displayName;
  if (m.email) {
    // Show everything before the @ symbol as a friendly fallback
    const atIdx = m.email.indexOf('@');
    return atIdx > 0 ? m.email.slice(0, atIdx) : m.email;
  }
  return 'Unknown User';
}

const HouseholdSyncPanel = ({
  members,
  pendingIncoming,
  pendingOutgoing,
  loading,
  onSendInvite,
  onAccept,
  onReject,
  onRemove,
}: HouseholdSyncPanelProps) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [leaveConfirmMember, setLeaveConfirmMember] = useState<HouseholdMember | null>(null);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    const result = await onSendInvite(inviteEmail.trim());
    if (result.success) {
      toast.success(result.isResend ? 'Invite resent!' : 'Household invite sent!');
      setInviteEmail('');
    } else {
      toast.error(result.error || 'Failed to send invite');
    }
    setSending(false);
  };

  const handleAction = async (action: () => Promise<boolean>, linkId: string, successMsg: string) => {
    setActionLoading(linkId);
    const ok = await action();
    if (ok) toast.success(successMsg);
    else toast.error('Something went wrong. Please try again.');
    setActionLoading(null);
  };

  const acceptedMembers = members.filter(m => m.status === 'accepted');

  return (
    <div className="space-y-4 pt-1">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <p className="text-sm font-semibold">Household Members</p>
          <p className="text-xs text-muted-foreground">Link accounts to share inventory & cost views</p>
        </div>
      </div>

      {/* Invite Form */}
      <form onSubmit={handleSendInvite} className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Invite by email</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="partner@email.com"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              disabled={sending}
            />
          </div>
          <button
            type="submit"
            disabled={sending || !inviteEmail.trim()}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Invite
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">They must have a PROTOCOL Guardian account</p>
      </form>

      {/* Pending Incoming */}
      {pendingIncoming.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Invites</p>
          {pendingIncoming.map(m => (
            <div key={m.linkId} className="flex items-center justify-between p-2.5 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <div>
                  <p className="text-xs font-medium">{getMemberLabel(m)}</p>
                  <p className="text-[10px] text-muted-foreground">Wants to link with you</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleAction(() => onAccept(m.linkId), m.linkId, 'Household link accepted!')}
                  disabled={actionLoading === m.linkId}
                  className="p-1.5 rounded-md bg-status-good/15 text-status-good border border-status-good/30 hover:bg-status-good/25 transition-colors"
                >
                  {actionLoading === m.linkId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleAction(() => onReject(m.linkId), m.linkId, 'Invite declined.')}
                  disabled={actionLoading === m.linkId}
                  className="p-1.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Outgoing */}
      {pendingOutgoing.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sent Invites</p>
          {pendingOutgoing.map(m => (
            <div key={m.linkId} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-secondary/40">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">{getMemberLabel(m)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Sent {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={async () => {
                    if (!m.email) return;
                    setActionLoading(m.linkId + '-resend');
                    const result = await onSendInvite(m.email);
                    if (result.success) toast.success('Invite resent!');
                    else toast.error(result.error || 'Failed to resend invite');
                    setActionLoading(null);
                  }}
                  disabled={actionLoading === m.linkId + '-resend' || !m.email}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-primary border border-primary/30 hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {actionLoading === m.linkId + '-resend' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Resend
                </button>
                <button
                  onClick={() => handleAction(() => onRemove(m.linkId), m.linkId, 'Invite cancelled.')}
                  disabled={actionLoading === m.linkId}
                  className="p-1.5 rounded-md bg-secondary text-muted-foreground border border-border/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accepted Members with Leave Household */}
      {acceptedMembers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Linked Members</p>
          {acceptedMembers.map(m => (
            <div key={m.linkId} className="flex items-center justify-between p-2.5 rounded-lg border border-status-good/30 bg-status-good/5">
              <div className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-status-good" />
                <div>
                  <p className="text-xs font-medium">{getMemberLabel(m)}</p>
                  {m.email && m.displayName && (
                    <p className="text-[10px] text-muted-foreground">{m.email}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setLeaveConfirmMember(m)}
                disabled={actionLoading === m.linkId}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground border border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Leave
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading household data…
        </div>
      )}

      {!loading && acceptedMembers.length === 0 && pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
        <div className="text-center py-3 text-xs text-muted-foreground">
          No household members yet. Invite someone above to get started.
        </div>
      )}

      {/* Leave Household Confirmation Dialog */}
      <AlertDialog open={!!leaveConfirmMember} onOpenChange={open => { if (!open) setLeaveConfirmMember(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Household?</AlertDialogTitle>
            <AlertDialogDescription>
              <span>
                You are about to remove the link with <strong>{leaveConfirmMember ? getMemberLabel(leaveConfirmMember) : ''}</strong>.
              </span>
              <span className="block mt-2 text-destructive/80 font-medium text-xs">
                ⚠️ Combined views (inventory, schedule, costs) will no longer be available and the household toggle will disappear.
              </span>
              <span className="block mt-1">
                This action can be undone by sending a new invite.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeaveConfirmMember(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!leaveConfirmMember) return;
                const m = leaveConfirmMember;
                setLeaveConfirmMember(null);
                await handleAction(
                  () => onRemove(m.linkId),
                  m.linkId,
                  'Left household. Combined views have been disabled.'
                );
              }}
            >
              Leave Household
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HouseholdSyncPanel;

