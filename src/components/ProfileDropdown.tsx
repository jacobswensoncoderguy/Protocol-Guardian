import { Settings, Target, FileText, LogOut, Sun, Moon, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : 'SH';

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
        <DropdownMenuItem onClick={onSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;
