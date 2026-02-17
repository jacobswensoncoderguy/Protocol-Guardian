import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, AlertCircle, Activity, Smile, Zap, Moon, Trash2, ArrowRightLeft, X, Brain, Loader2, TrendingUp, TrendingDown, Minus, ChevronRight, Sparkles, Clock, CheckCircle2, Info, LayoutGrid } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import SymptomHeatmapView from '@/components/SymptomHeatmapView';

interface SymptomDefinition {
  id: string;
  name: string;
  category: string;
  body_area: string | null;
  is_system: boolean;
}

interface SymptomLog {
  id: string;
  symptom_definition_id: string | null;
  custom_symptom: string | null;
  severity: number;
  timing: string;
  log_date: string;
  log_time: string | null;
  notes: string | null;
}

interface DailyCheckin {
  id: string;
  checkin_date: string;
  energy_score: number | null;
  mood_score: number | null;
  pain_score: number | null;
  sleep_score: number | null;
  notes: string | null;
}

interface ProtocolChange {
  id: string;
  change_date: string;
  compound_id: string | null;
  change_type: string;
  description: string;
  previous_value: string | null;
  new_value: string | null;
}

const SEVERITY_LABELS = ['', 'Minimal', 'Mild', 'Moderate', 'Severe', 'Extreme'];
const SEVERITY_COLORS = ['', 'text-status-good', 'text-status-good', 'text-status-warning', 'text-status-critical', 'text-destructive'];
const TIMING_OPTIONS = ['new', 'chronic', 'infrequent', 'recurring'];
const CHANGE_TYPES = ['dose_change', 'started', 'stopped', 'timing_change', 'new_compound', 'behavior_change'];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  pain: AlertCircle,
  energy: Zap,
  mood: Smile,
  sleep: Moon,
  digestive: Activity,
  neurological: Activity,
  skin: Activity,
  hormonal: Activity,
  other: Activity,
};

const CHECKIN_EMOJIS = ['', '😞', '😕', '😐', '🙂', '😄'];

const ScoreSelector = ({ label, icon: Icon, value, onChange, emoji }: { label: string; icon: React.ElementType; value: number; onChange: (v: number) => void; emoji: boolean }) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-primary" />
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(score => (
        <button
          key={score}
          onClick={() => onChange(score)}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
            value === score
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
          }`}
        >
          {emoji ? CHECKIN_EMOJIS[score] : score}
        </button>
      ))}
    </div>
  </div>
);

const SymptomsTrackerView = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [definitions, setDefinitions] = useState<SymptomDefinition[]>([]);
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [changes, setChanges] = useState<ProtocolChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('log');

  // AI correlation state
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDays, setAiDays] = useState(30);

  // Dialogs
  const [showAddSymptom, setShowAddSymptom] = useState(false);
  const [showAddChange, setShowAddChange] = useState(false);

  // Symptom form
  const [selectedDefId, setSelectedDefId] = useState('');
  const [customSymptom, setCustomSymptom] = useState('');
  const [severity, setSeverity] = useState(3);
  const [timing, setTiming] = useState('new');
  const [symptomNotes, setSymptomNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Change form
  const [changeType, setChangeType] = useState('dose_change');
  const [changeDescription, setChangeDescription] = useState('');
  const [changeDate, setChangeDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [prevValue, setPrevValue] = useState('');
  const [newValue, setNewValue] = useState('');

  // Checkin form
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [pain, setPain] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [checkinNotes, setCheckinNotes] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [defsRes, logsRes, checkinRes, changesRes] = await Promise.all([
      supabase.from('symptom_definitions').select('*').order('category').order('name'),
      supabase.from('symptom_logs').select('*').eq('user_id', user.id).eq('log_date', selectedDate).order('created_at', { ascending: false }),
      supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('checkin_date', selectedDate).single(),
      supabase.from('protocol_changes').select('*').eq('user_id', user.id).order('change_date', { ascending: false }).limit(20),
    ]);

    setDefinitions((defsRes.data || []) as unknown as SymptomDefinition[]);
    setLogs((logsRes.data || []) as unknown as SymptomLog[]);
    setCheckin(checkinRes.data as unknown as DailyCheckin | null);
    setChanges((changesRes.data || []) as unknown as ProtocolChange[]);

    if (checkinRes.data) {
      const c = checkinRes.data as any;
      setEnergy(c.energy_score || 3);
      setMood(c.mood_score || 3);
      setPain(c.pain_score || 3);
      setSleep(c.sleep_score || 3);
      setCheckinNotes(c.notes || '');
    } else {
      setEnergy(3); setMood(3); setPain(3); setSleep(3); setCheckinNotes('');
    }

    setLoading(false);
  }, [user, selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredDefs = useMemo(() => {
    if (!searchQuery.trim()) return definitions;
    const q = searchQuery.toLowerCase();
    return definitions.filter(d => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
  }, [definitions, searchQuery]);

  const groupedDefs = useMemo(() => {
    const groups: Record<string, SymptomDefinition[]> = {};
    filteredDefs.forEach(d => {
      if (!groups[d.category]) groups[d.category] = [];
      groups[d.category].push(d);
    });
    return groups;
  }, [filteredDefs]);

  const handleAddSymptom = async () => {
    if (!user || (!selectedDefId && !customSymptom.trim())) return;

    const { data, error } = await supabase.from('symptom_logs').insert({
      user_id: user.id,
      symptom_definition_id: selectedDefId || null,
      custom_symptom: selectedDefId ? null : customSymptom.trim(),
      severity,
      timing,
      log_date: selectedDate,
      notes: symptomNotes.trim() || null,
    }).select().single();

    if (error) { toast.error('Failed to log symptom'); return; }
    setLogs(prev => [data as unknown as SymptomLog, ...prev]);
    toast.success('Symptom logged');
    setShowAddSymptom(false);
    setSelectedDefId(''); setCustomSymptom(''); setSeverity(3); setTiming('new'); setSymptomNotes('');
  };

  const handleDeleteLog = async (id: string) => {
    await supabase.from('symptom_logs').delete().eq('id', id);
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const handleSaveCheckin = async () => {
    if (!user) return;

    if (checkin) {
      await supabase.from('daily_checkins').update({
        energy_score: energy, mood_score: mood, pain_score: pain, sleep_score: sleep, notes: checkinNotes.trim() || null,
      }).eq('id', checkin.id);
    } else {
      const { data } = await supabase.from('daily_checkins').insert({
        user_id: user.id, checkin_date: selectedDate,
        energy_score: energy, mood_score: mood, pain_score: pain, sleep_score: sleep, notes: checkinNotes.trim() || null,
      }).select().single();
      if (data) setCheckin(data as unknown as DailyCheckin);
    }
    toast.success('Check-in saved');
  };

  const handleAddChange = async () => {
    if (!user || !changeDescription.trim()) return;

    const { data, error } = await supabase.from('protocol_changes').insert({
      user_id: user.id,
      change_date: changeDate,
      change_type: changeType,
      description: changeDescription.trim(),
      previous_value: prevValue.trim() || null,
      new_value: newValue.trim() || null,
    }).select().single();

    if (error) { toast.error('Failed to log change'); return; }
    setChanges(prev => [data as unknown as ProtocolChange, ...prev]);
    toast.success('Protocol change logged');
    setShowAddChange(false);
    setChangeDescription(''); setPrevValue(''); setNewValue('');
  };

  const getSymptomName = (log: SymptomLog) => {
    if (log.custom_symptom) return log.custom_symptom;
    const def = definitions.find(d => d.id === log.symptom_definition_id);
    return def?.name || 'Unknown';
  };

  const dateLabel = selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'Today' :
    format(parseISO(selectedDate), 'EEE, MMM d');

  return (
    <div className="space-y-4">
      {/* Date selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">{dateLabel}</h2>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-auto h-8 text-xs"
        />
      </div>

      {/* Sub-navigation */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full bg-card/80 border border-border/60 h-9 p-0.5 gap-0.5">
          <TabsTrigger value="log" className="flex-1 text-[10px] font-semibold rounded data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <AlertCircle className="w-3 h-3 mr-1" />Symptoms
          </TabsTrigger>
          <TabsTrigger value="checkin" className="flex-1 text-[10px] font-semibold rounded data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Smile className="w-3 h-3 mr-1" />Check-in
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="flex-1 text-[10px] font-semibold rounded data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <LayoutGrid className="w-3 h-3 mr-1" />Map
          </TabsTrigger>
          <TabsTrigger value="changes" className="flex-1 text-[10px] font-semibold rounded data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ArrowRightLeft className="w-3 h-3 mr-1" />Changes
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 text-[10px] font-semibold rounded data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Brain className="w-3 h-3 mr-1" />AI
          </TabsTrigger>
        </TabsList>

        {/* Symptoms log tab */}
        <TabsContent value="log" className="space-y-3 mt-3">
          <Button onClick={() => setShowAddSymptom(true)} size="sm" className="w-full gap-1.5">
            <Plus className="w-4 h-4" /> Log Symptom
          </Button>

          {logs.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No symptoms logged for {dateLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">Tap "Log Symptom" to start tracking</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <Card key={log.id} className="border-border/50">
                  <CardContent className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-foreground">{getSymptomName(log)}</span>
                        <Badge variant="outline" className={`text-[10px] h-4 ${SEVERITY_COLORS[log.severity]}`}>
                          {SEVERITY_LABELS[log.severity]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="capitalize">{log.timing}</span>
                        {log.notes && <span>· {log.notes}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteLog(log.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Daily check-in tab */}
        <TabsContent value="checkin" className="mt-3">
          <Card className="border-border/50">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Smile className="w-4 h-4 text-primary" />
                Daily Wellness Check-in
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-4">
              <ScoreSelector label="Energy" icon={Zap} value={energy} onChange={setEnergy} emoji />
              <ScoreSelector label="Mood" icon={Smile} value={mood} onChange={setMood} emoji />
              <ScoreSelector label="Pain Level" icon={AlertCircle} value={pain} onChange={setPain} emoji={false} />
              <ScoreSelector label="Sleep Quality" icon={Moon} value={sleep} onChange={setSleep} emoji />
              <Textarea
                placeholder="Any notes about how you're feeling today..."
                value={checkinNotes}
                onChange={e => setCheckinNotes(e.target.value)}
                className="text-sm min-h-[60px]"
              />
              <Button onClick={handleSaveCheckin} className="w-full">
                {checkin ? 'Update Check-in' : 'Save Check-in'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Heatmap tab */}
        <TabsContent value="heatmap" className="mt-3">
          <SymptomHeatmapView />
        </TabsContent>

        {/* Protocol changes tab */}
        <TabsContent value="changes" className="space-y-3 mt-3">
          <Button onClick={() => setShowAddChange(true)} size="sm" className="w-full gap-1.5">
            <Plus className="w-4 h-4" /> Log Protocol Change
          </Button>

          {changes.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-6 text-center">
                <ArrowRightLeft className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No protocol changes logged</p>
                <p className="text-xs text-muted-foreground mt-1">Record dose changes, new compounds, or behavior adjustments</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {changes.map(change => (
                <Card key={change.id} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="secondary" className="text-[10px] h-4 capitalize">
                            {change.change_type.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{format(parseISO(change.change_date), 'MMM d, yyyy')}</span>
                        </div>
                        <p className="text-xs text-foreground">{change.description}</p>
                        {(change.previous_value || change.new_value) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {change.previous_value && <span>{change.previous_value}</span>}
                            {change.previous_value && change.new_value && <span> → </span>}
                            {change.new_value && <span className="text-primary">{change.new_value}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* AI Correlation tab */}
        <TabsContent value="ai" className="space-y-3 mt-3">
          {/* Header control card */}
          <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground">AI Correlation Engine</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Analyzes symptoms against compound timelines and protocol changes to detect patterns.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xs text-muted-foreground">Analyze last</span>
                {[7, 14, 30, 60].map(d => (
                  <button key={d} onClick={() => setAiDays(d)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${aiDays === d ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'}`}>
                    {d}d
                  </button>
                ))}
              </div>
              <Button
                onClick={async () => {
                  if (!user) return;
                  setAiLoading(true);
                  const { data, error } = await supabase.functions.invoke('symptom-analysis', {
                    body: { userId: user.id, days: aiDays },
                  });
                  setAiLoading(false);
                  if (error || data?.error) { toast.error(data?.error || 'Analysis failed'); return; }
                  setAiAnalysis(data);
                }}
                disabled={aiLoading}
                className="w-full gap-2"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiLoading ? 'Analyzing patterns…' : aiAnalysis ? 'Re-run Analysis' : 'Run Analysis'}
              </Button>
              {aiLoading && (
                <p className="text-[10px] text-muted-foreground text-center mt-2">Correlating symptoms, compounds & protocol changes…</p>
              )}
            </CardContent>
          </Card>

          {aiAnalysis && !aiLoading && (() => {
            const { analysis, dataPoints, chartData } = aiAnalysis;
            const trendIcon = analysis.wellness_trend === 'improving' ? TrendingUp :
                              analysis.wellness_trend === 'declining' ? TrendingDown : Minus;
            const TrendIcon = trendIcon;
            const trendColor = analysis.wellness_trend === 'improving' ? 'text-status-good' :
                               analysis.wellness_trend === 'declining' ? 'text-destructive' : 'text-status-warning';

            return (
              <div className="space-y-3">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Symptoms', value: dataPoints.logs, icon: AlertCircle },
                    { label: 'Check-ins', value: dataPoints.checkins, icon: Smile },
                    { label: 'Changes', value: dataPoints.changes, icon: ArrowRightLeft },
                  ].map(item => (
                    <div key={item.label} className="p-2 rounded-lg bg-secondary/30 text-center">
                      <item.icon className="w-3 h-3 text-muted-foreground mx-auto mb-0.5" />
                      <div className="text-base font-bold text-foreground">{item.value}</div>
                      <div className="text-[9px] text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Key insight */}
                {analysis.key_insight && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Brain className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Key Insight</span>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">{analysis.key_insight}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Wellness trend + summary */}
                <Card className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendIcon className={`w-4 h-4 ${trendColor}`} />
                      <span className={`text-xs font-bold capitalize ${trendColor}`}>{analysis.wellness_trend} trend</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{analysis.summary}</p>
                  </CardContent>
                </Card>

                {/* Wellness chart */}
                {chartData?.dailyCheckins?.length > 1 && (
                  <Card className="border-border/50">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-1.5">
                        <Activity className="w-3 h-3" />Wellness Over Time
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData.dailyCheckins} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                            <defs>
                              <linearGradient id="wellnessGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 8 }} tickFormatter={(v) => v.slice(5)} />
                            <YAxis domain={[0, 5]} tick={{ fontSize: 8 }} />
                            <Tooltip
                              contentStyle={{ fontSize: '10px', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                              itemStyle={{ color: 'hsl(var(--primary))' }}
                            />
                            {chartData.protocolChangeDates?.map((pc: any) => (
                              <ReferenceLine key={pc.date} x={pc.date} stroke="hsl(var(--status-warning))" strokeDasharray="3 3" strokeWidth={1.5} />
                            ))}
                            <Area type="monotone" dataKey="avg" stroke="hsl(var(--primary))" fill="url(#wellnessGrad)" strokeWidth={2} dot={false} name="Wellness" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      {chartData.protocolChangeDates?.length > 0 && (
                        <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                          <span className="inline-block w-3 border-t border-dashed border-status-warning" />
                          Protocol change marker
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Symptom severity chart */}
                {chartData?.symptomsByDay?.filter((d: any) => d.count > 0).length > 1 && (
                  <Card className="border-border/50">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" />Symptom Load
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.symptomsByDay.filter((d: any) => d.count > 0)} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                            <XAxis dataKey="date" tick={{ fontSize: 8 }} tickFormatter={(v) => v.slice(5)} />
                            <YAxis tick={{ fontSize: 8 }} />
                            <Tooltip
                              contentStyle={{ fontSize: '10px', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            {chartData.protocolChangeDates?.map((pc: any) => (
                              <ReferenceLine key={pc.date} x={pc.date} stroke="hsl(var(--status-warning))" strokeDasharray="3 3" strokeWidth={1.5} />
                            ))}
                            <Bar dataKey="count" fill="hsl(var(--destructive))" fillOpacity={0.6} radius={[2, 2, 0, 0]} name="Symptoms" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Symptom frequency breakdown */}
                {analysis.symptom_frequency?.length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Most Frequent Symptoms</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-1.5">
                      {analysis.symptom_frequency.slice(0, 5).map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] font-medium text-foreground truncate">{s.name}</span>
                              <span className="text-[10px] text-muted-foreground ml-2">{s.count}×</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary/60 transition-all"
                                style={{ width: `${(s.avgSeverity / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[9px] text-muted-foreground w-12 text-right">
                            {SEVERITY_LABELS[Math.round(s.avgSeverity)] || `${s.avgSeverity.toFixed(1)}`}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Correlations */}
                {analysis.correlations?.length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-1.5">
                        <Activity className="w-3 h-3" />Correlations Detected
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-2">
                      {analysis.correlations.map((c: any, i: number) => (
                        <div key={i} className={`flex items-start gap-2.5 p-2 rounded-lg ${
                          c.type === 'positive' ? 'bg-status-good/8' :
                          c.type === 'negative' ? 'bg-destructive/8' : 'bg-secondary/20'
                        }`}>
                          <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                            c.type === 'positive' ? 'bg-status-good' : c.type === 'negative' ? 'bg-destructive' : 'bg-muted-foreground'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground leading-relaxed">{c.finding}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[9px] font-semibold ${c.confidence === 'high' ? 'text-status-good' : c.confidence === 'medium' ? 'text-status-warning' : 'text-muted-foreground'}`}>
                                {c.confidence} confidence
                              </span>
                              {c.dayOffset != null && (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />{c.dayOffset}d after change
                                </span>
                              )}
                              {c.compound && (
                                <span className="text-[9px] text-primary">· {c.compound}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Concerning + Positive trends side by side if both present, else full width */}
                {(analysis.concerning_trends?.length > 0 || analysis.positive_trends?.length > 0) && (
                  <div className="space-y-2">
                    {analysis.concerning_trends?.length > 0 && (
                      <Card className="border-destructive/30 bg-destructive/5">
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-xs text-destructive font-semibold uppercase tracking-wide flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />Watch closely
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-1.5">
                          {analysis.concerning_trends.map((t: string, i: number) => (
                            <p key={i} className="text-xs text-foreground flex items-start gap-1.5">
                              <ChevronRight className="w-3 h-3 text-destructive flex-shrink-0 mt-0.5" />{t}
                            </p>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                    {analysis.positive_trends?.length > 0 && (
                      <Card className="border-status-good/30 bg-status-good/5">
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'hsl(var(--status-good))' }}>
                            <TrendingUp className="w-3.5 h-3.5" />Positive signals
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-1.5">
                          {analysis.positive_trends.map((t: string, i: number) => (
                            <p key={i} className="text-xs text-foreground flex items-start gap-1.5">
                              <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: 'hsl(var(--status-good))' }} />{t}
                            </p>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Protocol change timeline events */}
                {analysis.timeline_events?.length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />Key Timeline Events
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="relative pl-4 space-y-3">
                        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border/50" />
                        {analysis.timeline_events.slice(0, 6).map((ev: any, i: number) => (
                          <div key={i} className="relative flex items-start gap-2">
                            <div className={`absolute -left-3 w-2 h-2 rounded-full mt-0.5 flex-shrink-0 border-2 border-background ${
                              ev.type === 'change' ? 'bg-status-warning' :
                              ev.type === 'positive' ? 'bg-status-good' :
                              ev.type === 'symptom_spike' ? 'bg-destructive' : 'bg-muted-foreground'
                            }`} />
                            <div className="min-w-0">
                              <p className="text-[9px] text-muted-foreground">{ev.date}</p>
                              <p className="text-xs text-foreground leading-tight">{ev.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Suggestions */}
                {analysis.suggestions?.length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" />Suggestions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-2">
                      {analysis.suggestions.map((s: any, i: number) => (
                        <div key={i} className={`p-2.5 rounded-lg space-y-1 border ${
                          s.priority === 'high' ? 'border-destructive/30 bg-destructive/5' :
                          s.priority === 'medium' ? 'border-status-warning/30 bg-status-warning/5' :
                          'border-border/50 bg-secondary/20'
                        }`}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant={s.priority === 'high' ? 'destructive' : 'secondary'} className="text-[9px] h-4">{s.priority}</Badge>
                            {s.category && <Badge variant="outline" className="text-[9px] h-4 capitalize">{s.category}</Badge>}
                          </div>
                          <p className="text-xs font-medium text-foreground">{s.action}</p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{s.rationale}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-start gap-1.5 p-2 rounded-lg bg-secondary/20">
                  <Info className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground">Always discuss protocol changes with your healthcare provider before making adjustments.</p>
                </div>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Add symptom dialog */}
      <Dialog open={showAddSymptom} onOpenChange={setShowAddSymptom}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              Log Symptom
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search symptoms or type custom..."
              value={searchQuery || customSymptom}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCustomSymptom(e.target.value);
                setSelectedDefId('');
              }}
              autoFocus
            />

            {/* Predefined symptoms */}
            {!selectedDefId && (
              <div className="max-h-40 overflow-y-auto space-y-2 border border-border/50 rounded-lg p-2">
                {Object.entries(groupedDefs).map(([category, defs]) => (
                  <div key={category}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{category}</p>
                    <div className="flex flex-wrap gap-1">
                      {defs.map(d => (
                        <button
                          key={d.id}
                          onClick={() => { setSelectedDefId(d.id); setSearchQuery(d.name); setCustomSymptom(''); }}
                          className="px-2 py-0.5 text-[11px] rounded-full bg-secondary/50 text-foreground hover:bg-primary/20 hover:text-primary transition-colors"
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedDefId && (
              <div className="flex items-center gap-2">
                <Badge className="text-xs">{searchQuery}</Badge>
                <button onClick={() => { setSelectedDefId(''); setSearchQuery(''); }} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Severity */}
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Severity</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all flex flex-col items-center gap-0.5 ${
                      severity === s ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <span>{s}</span>
                    <span className="text-[8px]">{SEVERITY_LABELS[s]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Timing */}
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Symptom timing</p>
              <div className="flex gap-1">
                {TIMING_OPTIONS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTiming(t)}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-all ${
                      timing === t ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              placeholder="Additional notes..."
              value={symptomNotes}
              onChange={e => setSymptomNotes(e.target.value)}
              className="min-h-[50px] text-sm"
            />

            <Button onClick={handleAddSymptom} disabled={!selectedDefId && !customSymptom.trim()} className="w-full">
              Log Symptom
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add protocol change dialog */}
      <Dialog open={showAddChange} onOpenChange={setShowAddChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Log Protocol Change
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Change type</p>
              <Select value={changeType} onValueChange={setChangeType}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map(ct => (
                    <SelectItem key={ct} value={ct} className="capitalize">{ct.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input
              type="date"
              value={changeDate}
              onChange={e => setChangeDate(e.target.value)}
            />

            <Textarea
              placeholder="Describe what changed (e.g., 'Increased BPC-157 from 250mcg to 500mcg')"
              value={changeDescription}
              onChange={e => setChangeDescription(e.target.value)}
              className="min-h-[60px] text-sm"
              autoFocus
            />

            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Previous value" value={prevValue} onChange={e => setPrevValue(e.target.value)} className="text-sm" />
              <Input placeholder="New value" value={newValue} onChange={e => setNewValue(e.target.value)} className="text-sm" />
            </div>

            <Button onClick={handleAddChange} disabled={!changeDescription.trim()} className="w-full">
              Log Change
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SymptomsTrackerView;
