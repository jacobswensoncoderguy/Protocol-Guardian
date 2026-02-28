import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import type { UserSession } from '@/pages/AdminDashboard';

interface DauChartProps {
  sessions: Record<string, UserSession[]>;
  days?: number;
}

export default function DauChart({ sessions, days = 30 }: DauChartProps) {
  const data = useMemo(() => {
    const end = new Date();
    const start = subDays(end, days - 1);
    const allDays = eachDayOfInterval({ start, end });

    return allDays.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const uniqueUsers = new Set<string>();
      for (const [userId, userSessions] of Object.entries(sessions)) {
        for (const s of userSessions) {
          if (format(new Date(s.session_start), 'yyyy-MM-dd') === dayStr) {
            uniqueUsers.add(userId);
            break;
          }
        }
      }
      return {
        date: format(day, 'MMM d'),
        dau: uniqueUsers.size,
      };
    });
  }, [sessions, days]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Daily Active Users (Last {days} Days)</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'hsl(var(--foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              />
              <Area
                type="monotone"
                dataKey="dau"
                name="Active Users"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#dauGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
