import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import type { UserSession } from '@/pages/AdminDashboard';

interface AvgSessionChartProps {
  sessions: Record<string, UserSession[]>;
  days?: number;
}

export default function AvgSessionChart({ sessions, days = 30 }: AvgSessionChartProps) {
  const data = useMemo(() => {
    const end = new Date();
    const start = subDays(end, days - 1);
    const allDays = eachDayOfInterval({ start, end });
    const allSessions = Object.values(sessions).flat();

    return allDays.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const daySessions = allSessions.filter(
        s => format(new Date(s.session_start), 'yyyy-MM-dd') === dayStr && s.duration_seconds != null
      );
      const avgMin = daySessions.length > 0
        ? Math.round(daySessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / daySessions.length / 60)
        : 0;
      return { date: format(day, 'MMM d'), avg: avgMin };
    });
  }, [sessions, days]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Avg Session Duration (Last {days} Days)</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
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
                unit="m"
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
                formatter={(value: number) => [`${value} min`, 'Avg Duration']}
              />
              <Area
                type="monotone"
                dataKey="avg"
                name="Avg Duration"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                fill="url(#avgGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
