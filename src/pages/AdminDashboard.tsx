import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Activity, UserPlus, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import AdminUserDrawer from '@/components/AdminUserDrawer';
import DauChart from '@/components/DauChart';
import AvgSessionChart from '@/components/AvgSessionChart';

interface UserProfile {
  user_id: string;
  display_name: string | null;
  last_sign_in_at: string | null;
  sign_in_count: number;
  signup_source: string | null;
  last_active_at: string | null;
  created_at: string;
}

export interface UserSession {
  id: string;
  session_start: string;
  session_end: string | null;
  duration_seconds: number | null;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole(user?.id);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [sessions, setSessions] = useState<Record<string, UserSession[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin || roleLoading) return;

    const fetchData = async () => {
      const [profilesRes, sessionsRes] = await Promise.all([
        (supabase as any)
          .from('profiles')
          .select('user_id, display_name, last_sign_in_at, sign_in_count, signup_source, last_active_at, created_at')
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('user_sessions')
          .select('id, user_id, session_start, session_end, duration_seconds')
          .order('session_start', { ascending: false }),
      ]);

      setProfiles(profilesRes.data || []);

      // Group sessions by user_id
      const grouped: Record<string, UserSession[]> = {};
      for (const s of (sessionsRes.data || [])) {
        if (!grouped[s.user_id]) grouped[s.user_id] = [];
        grouped[s.user_id].push(s);
      }
      setSessions(grouped);
      setLoading(false);
    };

    fetchData();
  }, [isAdmin, roleLoading]);

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-sm">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalUsers = profiles.length;
  const activeToday = profiles.filter(p => {
    if (!p.last_active_at) return false;
    const d = new Date(p.last_active_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const allSessions = Object.values(sessions).flat();
  const completedSessions = allSessions.filter(s => s.duration_seconds != null);
  const avgSessionMin = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((s, sess) => s + (sess.duration_seconds || 0), 0) / completedSessions.length / 60)
    : 0;
  const totalSessionCount = allSessions.length;

  const sourceCounts = profiles.reduce((acc, p) => {
    const src = p.signup_source || 'unknown';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getUserTotalTime = (userId: string) => {
    const userSessions = sessions[userId] || [];
    const totalSec = userSessions.reduce((s, sess) => s + (sess.duration_seconds || 0), 0);
    if (totalSec < 60) return `${totalSec}s`;
    if (totalSec < 3600) return `${Math.round(totalSec / 60)}m`;
    return `${(totalSec / 3600).toFixed(1)}h`;
  };

  const getUserSessionCount = (userId: string) => (sessions[userId] || []).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Intel Dashboard</h1>
            <p className="text-sm text-muted-foreground">Tap any user row for full engagement detail</p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeToday}</p>
                <p className="text-xs text-muted-foreground">Active Today</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{avgSessionMin}m</p>
                <p className="text-xs text-muted-foreground">Avg Session</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <UserPlus className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalSessionCount}</p>
                <p className="text-xs text-muted-foreground">Total Sessions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DauChart sessions={sessions} />
          <AvgSessionChart sessions={sessions} />
        </div>

        {/* Signup sources breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Signup Sources</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(sourceCounts).map(([src, count]) => (
              <Badge key={src} variant="secondary" className="text-sm">
                {src}: {count}
              </Badge>
            ))}
            {Object.keys(sourceCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">No signup source data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Users list - card-based for better mobile & clickability */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Users ({totalUsers})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : profiles.map(p => (
                <button
                  key={p.user_id}
                  onClick={() => setSelectedUser(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {p.display_name || <span className="text-muted-foreground italic">No name</span>}
                      </span>
                      {p.last_active_at && new Date(p.last_active_at).toDateString() === new Date().toDateString() && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" title="Active today" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{p.sign_in_count} sign-in{p.sign_in_count !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{getUserSessionCount(p.user_id)} session{getUserSessionCount(p.user_id) !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{getUserTotalTime(p.user_id)} total</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
                      {p.signup_source || '—'}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {p.last_active_at
                        ? formatDistanceToNow(new Date(p.last_active_at), { addSuffix: true })
                        : 'Never'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User detail drawer */}
      <AdminUserDrawer
        user={selectedUser}
        sessions={selectedUser ? (sessions[selectedUser.user_id] || []) : []}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  );
}
