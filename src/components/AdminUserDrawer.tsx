import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { Clock, LogIn, Calendar, Timer, TrendingUp } from 'lucide-react';
import type { UserSession } from '@/pages/AdminDashboard';

interface UserProfile {
  user_id: string;
  display_name: string | null;
  last_sign_in_at: string | null;
  sign_in_count: number;
  signup_source: string | null;
  last_active_at: string | null;
  created_at: string;
}

interface AdminUserDrawerProps {
  user: UserProfile | null;
  sessions: UserSession[];
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function AdminUserDrawer({ user, sessions, onClose }: AdminUserDrawerProps) {
  if (!user) return null;

  const completedSessions = sessions.filter(s => s.duration_seconds != null);
  const totalTimeSec = completedSessions.reduce((s, sess) => s + (sess.duration_seconds || 0), 0);
  const avgSessionSec = completedSessions.length > 0 ? Math.round(totalTimeSec / completedSessions.length) : 0;
  const longestSec = completedSessions.length > 0 ? Math.max(...completedSessions.map(s => s.duration_seconds || 0)) : 0;
  const daysSinceSignup = differenceInDays(new Date(), new Date(user.created_at));
  const daysActive = daysSinceSignup || 1;
  const avgSessionsPerDay = (sessions.length / daysActive).toFixed(1);

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-left">
            {user.display_name || 'Unnamed User'}
          </SheetTitle>
          <p className="text-xs text-muted-foreground font-mono truncate">{user.user_id}</p>
        </SheetHeader>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <CardContent className="pt-3 pb-3 flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">{formatDuration(totalTimeSec)}</p>
                <p className="text-[10px] text-muted-foreground">Total Time in App</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">{formatDuration(avgSessionSec)}</p>
                <p className="text-[10px] text-muted-foreground">Avg Session</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <div>
                <p className="text-lg font-bold text-foreground">{formatDuration(longestSec)}</p>
                <p className="text-[10px] text-muted-foreground">Longest Session</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 flex items-center gap-2">
              <LogIn className="w-4 h-4 text-accent" />
              <div>
                <p className="text-lg font-bold text-foreground">{avgSessionsPerDay}</p>
                <p className="text-[10px] text-muted-foreground">Sessions / Day</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metadata */}
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-foreground">Profile Intel</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sign-in Count</span>
              <Badge variant={user.sign_in_count > 5 ? 'default' : 'secondary'}>{user.sign_in_count}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Signup Source</span>
              <Badge variant="outline">{user.signup_source || '—'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Active</span>
              <span className="text-foreground">
                {user.last_active_at ? formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true }) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Sign-in</span>
              <span className="text-foreground">
                {user.last_sign_in_at ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true }) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Joined</span>
              <span className="text-foreground">{format(new Date(user.created_at), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Days Since Signup</span>
              <span className="text-foreground">{daysSinceSignup}</span>
            </div>
          </div>
        </div>

        {/* Session history */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Session History ({sessions.length})
          </h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No sessions recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div>
                    <p className="text-sm text-foreground">
                      {format(new Date(s.session_start), 'MMM d, h:mm a')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(s.session_start), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant={s.duration_seconds ? 'default' : 'secondary'} className="text-xs">
                    {s.duration_seconds != null
                      ? formatDuration(s.duration_seconds)
                      : 'Active now'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
