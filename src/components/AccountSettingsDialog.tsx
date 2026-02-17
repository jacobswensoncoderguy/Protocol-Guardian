import { useState } from 'react';
import { AlertTriangle, RotateCcw, Trash2, HelpCircle, KeyRound, Loader2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onResetComplete: () => void;
  onStartTour?: () => void;
}

const USER_TABLES = [
  'protocol_chat_messages',
  'user_compound_protocols',
  'user_goal_protocols',
  'user_goal_readings',
  'user_goal_uploads',
  'user_goals',
  'user_compounds',
  'user_protocols',
  'chat_conversations',
  'chat_projects',
  'tolerance_history',
  'orders',
  'user_onboarding',
  'profiles',
] as const;

const AccountSettingsDialog = ({ open, onOpenChange, userId, onResetComplete, onStartTour }: AccountSettingsDialogProps) => {
  const { user } = useAuth();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState('');
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Check if user signed up via OAuth (no password identity)
  const isOAuthOnly = user?.app_metadata?.providers?.length === 1 && 
    user.app_metadata.providers[0] !== 'email';
  const hasEmailIdentity = user?.identities?.some(i => i.provider === 'email');

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSettingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password set! You can now sign in with email & password.');
        setShowSetPassword(false);
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (err) {
      console.error('Set password error:', err);
      toast.error('Failed to set password');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleReset = async () => {
    if (!userId) return;
    setResetting(true);
    try {
      for (const table of USER_TABLES) {
        await (supabase as any).from(table).delete().eq('user_id', userId);
      }
      toast.success('Profile reset. Starting fresh!');
      setShowResetConfirm(false);
      onOpenChange(false);
      onResetComplete();
    } catch (err) {
      console.error('Reset failed:', err);
      toast.error('Failed to reset profile');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      toast.success('Account deleted');
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Account Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {onStartTour && (
              <button
                onClick={() => { onOpenChange(false); onStartTour(); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left"
              >
                <HelpCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Guided Tour</p>
                  <p className="text-xs text-muted-foreground">Replay the app walkthrough</p>
                </div>
              </button>
            )}

            {/* Set Password - for OAuth users who want email/password login */}
            <button
              onClick={() => setShowSetPassword(true)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left"
            >
              <KeyRound className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{hasEmailIdentity ? 'Change Password' : 'Set Password'}</p>
                <p className="text-xs text-muted-foreground">
                  {hasEmailIdentity ? 'Update your login password' : 'Enable email & password sign-in'}
                </p>
              </div>
            </button>

            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors text-left"
            >
              <RotateCcw className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Reset Profile</p>
                <p className="text-xs text-muted-foreground">Clear all data and restart onboarding</p>
              </div>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-destructive/30 hover:bg-destructive/5 transition-colors text-left"
            >
              <Trash2 className="w-5 h-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Delete Account</p>
                <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Reset Profile?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all your compounds, protocols, goals, and chat history. You'll go through onboarding again. Your account will remain active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={resetting}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {resetting ? 'Resetting…' : 'Reset Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(v) => { setShowDeleteConfirm(v); if (!v) setDeleteTyped(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Account Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">This action is <strong>irreversible</strong>. All your data, protocols, and history will be permanently deleted.</span>
              <label className="block">
                <span className="text-xs text-muted-foreground">Type <strong>DELETE</strong> to confirm:</span>
                <input
                  type="text"
                  value={deleteTyped}
                  onChange={(e) => setDeleteTyped(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                  placeholder="DELETE"
                />
              </label>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting || deleteTyped !== 'DELETE'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete My Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set Password Dialog */}
      <Dialog open={showSetPassword} onOpenChange={(v) => { setShowSetPassword(v); if (!v) { setNewPassword(''); setConfirmNewPassword(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {hasEmailIdentity ? 'Change Password' : 'Set Password'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSetPassword} className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              {hasEmailIdentity
                ? 'Enter a new password for your account.'
                : `Set a password so you can sign in with ${user?.email} using email & password.`}
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              required
              minLength={6}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirm password"
              required
              minLength={6}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              type="submit"
              disabled={settingPassword}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {settingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              {hasEmailIdentity ? 'Update Password' : 'Set Password'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccountSettingsDialog;
