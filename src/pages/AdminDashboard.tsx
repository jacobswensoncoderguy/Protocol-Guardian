import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Activity, UserPlus, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';

interface UserProfile {
  user_id: string;
  display_name: string | null;
  last_sign_in_at: string | null;
  sign_in_count: number;
  signup_source: string | null;
  last_active_at: string | null;
  created_at: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole(user?.id);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin || roleLoading) return;
    (supabase as any)
      .from('profiles')
      .select('user_id, display_name, last_sign_in_at, sign_in_count, signup_source, last_active_at, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }: any) => {
        setProfiles(data || []);
        setLoading(false);
      });
  }, [isAdmin, roleLoading]);

  if (roleLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>;
  }

  if (!isAdmin) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-sm">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>Go Home</Button>
        </CardContent>
      </Card>
    </div>;
  }

  const totalUsers = profiles.length;
  const activeToday = profiles.filter(p => {
    if (!p.last_active_at) return false;
    const d = new Date(p.last_active_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const avgSignIns = totalUsers > 0 ? Math.round(profiles.reduce((s, p) => s + (p.sign_in_count || 0), 0) / totalUsers) : 0;
  const sourceCounts = profiles.reduce((acc, p) => {
    const src = p.signup_source || 'unknown';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
            <p className="text-sm text-muted-foreground">Admin-only view of all user activity</p>
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
                <p className="text-2xl font-bold text-foreground">{avgSignIns}</p>
                <p className="text-xs text-muted-foreground">Avg Sign-ins</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <UserPlus className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{Object.keys(sourceCounts).length}</p>
                <p className="text-xs text-muted-foreground">Signup Sources</p>
              </div>
            </CardContent>
          </Card>
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
              <p className="text-sm text-muted-foreground">No signup source data yet — users need to sign in again.</p>
            )}
          </CardContent>
        </Card>

        {/* Users table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Users ({totalUsers})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Sign-ins</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Last Sign-in</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                    </TableRow>
                  ) : profiles.map(p => (
                    <TableRow key={p.user_id}>
                      <TableCell className="font-medium">
                        {p.display_name || <span className="text-muted-foreground italic">No name</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.sign_in_count > 5 ? 'default' : 'secondary'}>
                          {p.sign_in_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {p.signup_source || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.last_active_at
                          ? formatDistanceToNow(new Date(p.last_active_at), { addSuffix: true })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.last_sign_in_at
                          ? formatDistanceToNow(new Date(p.last_sign_in_at), { addSuffix: true })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(p.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
