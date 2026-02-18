import { Settings, Target, FileText, LogOut, Sun, Moon, Plus, Share2, MessageSquare, Mail, Link } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface ProfileDropdownProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onAccountSettings: () => void;
  onFeatureManager: () => void;
  onGoalExpansion: () => void;
  onBiomarkerUpload: () => void;
  onSignOut: () => void;
  displayName?: string | null;
}

const ProfileDropdown = ({
  isDark,
  onToggleTheme,
  onAccountSettings,
  onFeatureManager,
  onGoalExpansion,
  onBiomarkerUpload,
  onSignOut,
  displayName,
}: ProfileDropdownProps) => {
  const { user } = useAuth();
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : 'SH';

  const baseUrl = 'https://superhumanprotocol.lovable.app';
  const inviteUrl = user ? `${baseUrl}/invite?ref=${user.id}` : `${baseUrl}/invite`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Avatar className="h-8 w-8 border border-border/50 hover:border-primary/50 transition-colors">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-popover border-border z-50">
        <DropdownMenuItem onClick={onToggleTheme} className="gap-2 cursor-pointer">
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAccountSettings} className="gap-2 cursor-pointer">
          <Settings className="w-4 h-4" />
          Account Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onFeatureManager} className="gap-2 cursor-pointer">
          <Plus className="w-4 h-4" />
          Manage Features
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onGoalExpansion} className="gap-2 cursor-pointer">
          <Target className="w-4 h-4" />
          Goal Expansion
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onBiomarkerUpload} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4" />
          Upload Lab Results
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
            <Share2 className="w-4 h-4" />
            Invite a Friend
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48" sideOffset={4} alignOffset={-5}>
            <DropdownMenuItem onClick={() => {
              const body = `Check out PROTOCOL Guardian — track your protocol and optimize your performance. Create your account here: ${inviteUrl}`;
              window.open(`sms:?&body=${encodeURIComponent(body)}`);
            }} className="gap-2 cursor-pointer">
              <MessageSquare className="w-4 h-4" />
              Share via Text
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const subject = 'Try PROTOCOL Guardian';
              const body = `Check out PROTOCOL Guardian — track your protocol and optimize your performance.\n\nCreate your account here: ${inviteUrl}`;
              window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
            }} className="gap-2 cursor-pointer">
              <Mail className="w-4 h-4" />
              Share via Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              toast.success('Link copied to clipboard!');
            }} className="gap-2 cursor-pointer">
              <Link className="w-4 h-4" />
              Copy Link
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;
