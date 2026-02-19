import { useState, useRef, useCallback, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { BodyZone, BODY_ZONES, getCompoundsForZone } from '@/data/bodyZoneMapping';
import { Compound } from '@/data/compounds';
import { compoundBenefits } from '@/data/compoundBenefits';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Copy, Check, TrendingUp, TrendingDown, ArrowRightLeft, Trash2, Plus, MessageSquare, Send, X, AlertTriangle, DollarSign, Zap, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { MeasurementSystem, displayHeight, displayWeight } from '@/lib/measurements';
import { UserProfile } from '@/hooks/useProfile';
import { UserGoal } from '@/hooks/useGoals';
import GeminiBadge from '@/components/GeminiBadge';

interface ZoneDetailDrawerProps {
  zone: BodyZone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compounds: Compound[];
  toleranceLevel?: string;
  measurementSystem?: MeasurementSystem;
  profile?: UserProfile | null;
  goals?: UserGoal[];
  onUpdateCompound?: (id: string, updates: Partial<Compound>) => void;
  onDeleteCompound?: (id: string) => void;
  userId?: string;
  zoneIntensity?: number; // 0–1, used to detect saturation for redundancy audit
  conversationManager?: {
    createProject: (name: string, description?: string, color?: string) => Promise<any>;
    createConversation: (title?: string, projectId?: string) => Promise<any>;
    projects: { id: string; name: string }[];
    refreshConversation: (convId: string, lastContent: string) => void;
  };
}

interface QuickAction {
  type: 'simplify' | 'optimize' | 'add' | 'remove' | 'swap';
  label: string;
  description: string;
  impact: number;
  cost_impact: string;
  compounds_involved: string[];
  reasoning: string;
}

interface RedundantCompound {
  name: string;
  benefit_pct: number;
  verdict: 'keep' | 'remove' | 'replace';
  alternative: string | null;
  reasoning: string;
}

interface ZoneAnalysis {
  zone_score: number;
  summary: string;
  quick_actions: QuickAction[];
  redundant_compounds: RedundantCompound[];
  optimal_stack: {
    keep: string[];
    remove: string[];
    add: string[];
    projected_score: number;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function normalizeBenefitKey(name: string): string {
  return name.toLowerCase()
    .replace(/\s*\d+\s*m[cg]g?\s*/gi, '')
    .replace(/\s*\d+\s*i\.?u\.?\s*/gi, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  simplify: <Trash2 className="w-3.5 h-3.5" />,
  optimize: <TrendingUp className="w-3.5 h-3.5" />,
  add: <Plus className="w-3.5 h-3.5" />,
  remove: <Trash2 className="w-3.5 h-3.5" />,
  swap: <ArrowRightLeft className="w-3.5 h-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  simplify: 'border-amber-500/30 bg-amber-500/5',
  optimize: 'border-primary/30 bg-primary/5',
  add: 'border-emerald-500/30 bg-emerald-500/5',
  remove: 'border-destructive/30 bg-destructive/5',
  swap: 'border-chart-5/30 bg-chart-5/5',
};

const ZoneDetailDrawer = ({ zone, open, onOpenChange, compounds, toleranceLevel = 'moderate', measurementSystem = 'metric', profile, goals = [], onUpdateCompound, onDeleteCompound, userId, zoneIntensity = 0, conversationManager }: ZoneDetailDrawerProps) => {
  const [analysis, setAnalysis] = useState<ZoneAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [zoneConversationId, setZoneConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load existing zone conversation when drawer opens
  useEffect(() => {
    if (!open || !zone || !userId || !conversationManager) return;
    const zoneInfo = BODY_ZONES[zone];
    const loadExisting = async () => {
      const project = conversationManager.projects.find(p => p.name === 'Body Coverage');
      if (!project) return;

      const { data: convs } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('project_id', project.id)
        .eq('title', `${zoneInfo.label} Zone`)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (convs && convs.length > 0) {
        const convId = convs[0].id;
        setZoneConversationId(convId);

        const { data: msgs } = await supabase
          .from('protocol_chat_messages')
          .select('role, content')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (msgs && msgs.length > 0) {
          setChatMessages(msgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
          setShowChat(true);
        }
      }
    };
    loadExisting();
  }, [open, zone]);

  if (!zone) return null;

  const info = BODY_ZONES[zone];
  const activeCompounds = compounds.filter(c => !c.notes?.includes('[DORMANT]'));
  const compoundNameIds = activeCompounds.map(c => c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  const zoneCompounds = getCompoundsForZone(zone, compoundNameIds);

  const compoundDetails = zoneCompounds.map(zc => {
    const compound = activeCompounds.find(c =>
      c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') === zc.id
    );
    const benefitKey = compound ? normalizeBenefitKey(compound.name) : zc.id;
    const benefits = compoundBenefits[benefitKey];
    return { ...zc, compound, benefits };
  });

  const intensityLabel = (w: number) => w >= 0.8 ? 'Primary' : w >= 0.5 ? 'Strong' : w >= 0.3 ? 'Supporting' : 'Minimal';
  const intensityColor = (w: number) => w >= 0.8 ? 'text-emerald-400' : w >= 0.5 ? 'text-primary' : w >= 0.3 ? 'text-muted-foreground' : 'text-muted-foreground/50';

  const currentCoverage = Math.round(compoundDetails.reduce((max, cd) => Math.max(max, cd.weight), 0) * 100);

  const zoneGapAnalysis = (() => {
    const pct = currentCoverage;
    const compoundCount = compoundDetails.length;
    if (pct >= 90) return `${pct}% — Near maximum. ${compoundCount} compound${compoundCount > 1 ? 's' : ''} driving this zone at peak efficacy.`;
    if (pct >= 70) return `${pct}% — Strong coverage. Adding a synergistic compound or increasing frequency could push toward primary.`;
    if (pct >= 40) return `${pct}% — Moderate coverage. ${compoundCount === 0 ? 'No compounds target this zone directly.' : `${compoundCount} compound${compoundCount > 1 ? 's' : ''} contribute but at sub-optimal intensity.`} Consider higher doses or additional compounds.`;
    if (pct > 0) return `${pct}% — Low coverage. Current compounds provide only supporting impact.`;
    return '0% — No active compounds target this zone.';
  })();

  const fetchAnalysis = async () => {
    setAnalysisLoading(true);
    setAnalysis(null);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zone-optimizer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            zone,
            zoneLabel: info.label,
            zoneDescription: info.description,
            compounds: activeCompounds.map(c => ({
              name: c.name, category: c.category, dosePerUse: c.dosePerUse,
              doseLabel: c.doseLabel, dosesPerDay: c.dosesPerDay, daysPerWeek: c.daysPerWeek,
              unitPrice: c.unitPrice, cycleOnDays: c.cycleOnDays, cycleOffDays: c.cycleOffDays,
            })),
            zoneCompounds: compoundDetails.map(cd => ({
              name: cd.compound?.name || cd.id,
              weight: cd.weight,
            })),
            coverageScore: currentCoverage,
            toleranceLevel,
            goals: goals.filter(g => g.status === 'active').map(g => ({
              title: g.title, goal_type: g.goal_type, target_value: g.target_value,
              target_unit: g.target_unit, target_date: g.target_date,
            })),
            profile: profile ? {
              gender: profile.gender, age: profile.age,
              weight_kg: profile.weight_kg, body_fat_pct: profile.body_fat_pct,
            } : null,
          }),
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) { toast.error('Rate limited — try again shortly'); return; }
        if (resp.status === 402) { toast.error('AI credits needed'); return; }
        throw new Error('Analysis failed');
      }

      const data = await resp.json();
      setAnalysis(data);
    } catch (e) {
      console.error('Zone analysis error:', e);
      toast.error('Could not analyze zone');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleImproveImpact = async () => {
    setAiLoading(true);
    setAiSuggestion('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const zoneCompoundNames = compoundDetails.map(cd => cd.compound?.name || cd.id).join(', ');

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-protocol`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            compounds: compounds.map(c => ({
              name: c.name, category: c.category, dosePerUse: c.dosePerUse,
              doseLabel: c.doseLabel, dosesPerDay: c.dosesPerDay, daysPerWeek: c.daysPerWeek,
              timingNote: c.timingNote, cyclingNote: c.cyclingNote,
              cycleOnDays: c.cycleOnDays, cycleOffDays: c.cycleOffDays,
              unitPrice: c.unitPrice,
            })),
            protocols: [],
            toleranceLevel,
            analysisType: 'chat',
            messages: [{
              role: 'user',
              content: `I want to MAXIMIZE the impact on my "${info.label}" zone (${info.description}). Currently affecting this zone: ${zoneCompoundNames || 'nothing'}.

${profile ? `My profile: ${profile.gender || 'unspecified'} · ${profile.height_cm ? displayHeight(profile.height_cm, measurementSystem) : 'height unknown'} · ${profile.weight_kg ? displayWeight(profile.weight_kg, measurementSystem) : 'weight unknown'}${profile.body_fat_pct != null ? ` · ${profile.body_fat_pct}% BF` : ''}${profile.age ? ` · ${profile.age}y` : ''}` : ''}

Give me specific, actionable suggestions to increase ${info.label} impact — considering synergy with my entire stack. Include dose/timing adjustments, new compounds, and any compounds antagonizing ${info.label} goals. Keep it concise. Calibrate to ${toleranceLevel} tolerance.${measurementSystem === 'imperial' ? ' Use imperial units.' : ' Use metric units.'}`
            }],
          }),
          signal: abortRef.current.signal,
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) { toast.error('Rate limited'); setAiLoading(false); return; }
        if (resp.status === 402) { toast.error('AI credits needed'); setAiLoading(false); return; }
        throw new Error('AI request failed');
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { fullText += content; setAiSuggestion(fullText); }
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') { console.error('AI error:', e); toast.error('Could not get suggestions'); }
    } finally { setAiLoading(false); }
  };


  // Get or create the "Body Coverage" project and a conversation for this zone
  const ensureZoneConversation = async (): Promise<string | null> => {
    if (zoneConversationId) return zoneConversationId;
    if (!userId || !conversationManager) return null;

    try {
      // Find or create the "Body Coverage" project
      let project = conversationManager.projects.find(p => p.name === 'Body Coverage');
      if (!project) {
        project = await conversationManager.createProject('Body Coverage', 'Zone optimization chats', '#06b6d4');
      }

      // Find existing conversation or create new one
      const { data: existingConvs } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('project_id', project.id)
        .eq('title', `${info.label} Zone`)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (existingConvs && existingConvs.length > 0) {
        setZoneConversationId(existingConvs[0].id);
        return existingConvs[0].id;
      }

      const conv = await conversationManager.createConversation(`${info.label} Zone`, project?.id);
      if (conv) {
        setZoneConversationId(conv.id);
        return conv.id;
      }
    } catch (e) {
      console.error('Failed to create zone conversation:', e);
    }
    return null;
  };

  const persistMessage = async (convId: string, role: string, content: string) => {
    if (!userId) return;
    await supabase.from('protocol_chat_messages').insert({
      user_id: userId,
      conversation_id: convId,
      role,
      content,
    });
    conversationManager?.refreshConversation(convId, content);
  };

  // Build and fire the redundancy audit message into chat
  const triggerRedundancyAudit = async () => {
    if (!zone) return;
    const compoundCosts = compoundDetails.map(cd => {
      const c = cd.compound;
      if (!c) return null;
      const weeklyDoses = c.dosesPerDay * c.daysPerWeek;
      const weeklyUnits = (c.dosePerUse * weeklyDoses) / c.unitSize;
      const monthlyCost = (weeklyUnits * c.unitPrice) * 4.33;
      return `${c.name}: $${monthlyCost.toFixed(0)}/mo (${cd.weight >= 0.8 ? 'Primary' : cd.weight >= 0.5 ? 'Strong' : cd.weight >= 0.3 ? 'Supporting' : 'Minimal'} impact, zone weight=${cd.weight})`;
    }).filter(Boolean);

    const auditPrompt = `🔍 REDUNDANCY AUDIT — ${info.label} zone (${Math.round(zoneIntensity * 100)}% saturated)

This zone is fully saturated. Identify which compounds are redundant and calculate exactly how much I'm wasting per month.

Compounds targeting this zone with estimated monthly costs:
${compoundCosts.length > 0 ? compoundCosts.join('\n') : 'None identified'}

Full stack: ${compounds.length} compounds total.

Please: 1) Identify overlapping/redundant compounds for this zone. 2) State each redundant compound's monthly cost. 3) Recommend the minimum effective set. 4) Calculate total monthly savings. 5) Apply the 40% rule — flag any compound providing <40% additional benefit beyond what others already cover. Be precise with dollar amounts.`;

    const userMsg: ChatMessage = { role: 'user', content: auditPrompt };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setShowChat(true);
    setChatLoading(true);

    const convId = await ensureZoneConversation();
    if (convId) await persistMessage(convId, 'user', auditPrompt);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-protocol`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({
            compounds: compounds.map(c => ({
              name: c.name, category: c.category, dosePerUse: c.dosePerUse,
              doseLabel: c.doseLabel, dosesPerDay: c.dosesPerDay, daysPerWeek: c.daysPerWeek,
              timingNote: c.timingNote, cyclingNote: c.cyclingNote,
              cycleOnDays: c.cycleOnDays, cycleOffDays: c.cycleOffDays, unitPrice: c.unitPrice,
            })),
            protocols: [],
            toleranceLevel,
            analysisType: 'chat',
            messages: [
              { role: 'user', content: `Context: "${info.label}" zone (${info.description}). Saturation: ${Math.round(zoneIntensity * 100)}%. Apply 40% rule strictly. Quantify all dollar waste.` },
              ...newMessages,
            ],
          }),
        }
      );

      if (!resp.ok) { if (resp.status === 429) { toast.error('Rate limited'); setChatLoading(false); return; } throw new Error(); }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullText } : m);
                return [...prev, { role: 'assistant', content: fullText }];
              });
            }
          } catch { /* partial */ }
        }
      }

      if (convId && fullText) await persistMessage(convId, 'assistant', fullText);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      console.error('Audit error:', e);
      toast.error('Audit failed');
    } finally { setChatLoading(false); }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    // Persist to conversation history
    const convId = await ensureZoneConversation();
    if (convId) await persistMessage(convId, 'user', userMsg.content);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-protocol`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            compounds: activeCompounds.map(c => ({
              name: c.name, category: c.category, dosePerUse: c.dosePerUse,
              doseLabel: c.doseLabel, dosesPerDay: c.dosesPerDay, daysPerWeek: c.daysPerWeek,
              timingNote: c.timingNote, cyclingNote: c.cyclingNote,
              cycleOnDays: c.cycleOnDays, cycleOffDays: c.cycleOffDays,
              unitPrice: c.unitPrice,
            })),
            protocols: [],
            toleranceLevel,
            analysisType: 'chat',
            messages: [
              { role: 'user', content: `Context: We're discussing the "${info.label}" zone (${info.description}). Current coverage: ${currentCoverage}%. Zone compounds: ${compoundDetails.map(cd => cd.compound?.name || cd.id).join(', ') || 'none'}. Apply the 40% rule: flag any compound with <40% additional benefit. Always prefer simplifying the stack.` },
              ...newMessages,
            ],
          }),
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) { toast.error('Rate limited'); setChatLoading(false); return; }
        if (resp.status === 402) { toast.error('AI credits needed'); setChatLoading(false); return; }
        throw new Error('Chat failed');
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: fullText } : m);
                }
                return [...prev, { role: 'assistant', content: fullText }];
              });
            }
          } catch { /* partial */ }
        }
      }

      // Persist assistant response
      if (convId && fullText) await persistMessage(convId, 'assistant', fullText);

      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      console.error('Chat error:', e);
      toast.error('Chat failed');
    } finally { setChatLoading(false); }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => {
      onOpenChange(o);
      if (!o) { setAnalysis(null); setAiSuggestion(''); setChatMessages([]); setShowChat(false); setZoneConversationId(null); abortRef.current?.abort(); }
    }}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: info.color, boxShadow: `0 0 10px ${info.color}` }}
            />
            <DrawerTitle className="text-base">{info.label}</DrawerTitle>
            <span className="text-xs font-mono text-muted-foreground ml-auto">{currentCoverage}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto scrollbar-thin space-y-3">
          {/* Zone gap analysis */}
          <div className="bg-secondary/30 rounded-lg border border-border/20 p-2.5">
            <p className="text-[11px] text-muted-foreground leading-snug">{zoneGapAnalysis}</p>
          </div>

          {/* Redundancy Audit Banner — shown when zone is saturated (≥95%) */}
          {zoneIntensity >= 0.95 && compoundDetails.length > 0 && (
            <button
              onClick={triggerRedundancyAudit}
              disabled={chatLoading}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/8 hover:bg-amber-500/15 hover:border-amber-500/60 transition-all active:scale-[0.99] text-left group"
            >
              <div className="w-7 h-7 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                {chatLoading ? <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-amber-400">Zone Saturated — Run Redundancy Audit</p>
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">AI will identify overlapping compounds &amp; calculate your exact monthly waste</p>
              </div>
              <DollarSign className="w-3.5 h-3.5 text-amber-400/60 group-hover:text-amber-400 transition-colors flex-shrink-0" />
            </button>
          )}

          {/* Quick Action Buttons — TOP */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl border border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all active:scale-95 disabled:opacity-50"
              onClick={fetchAnalysis}
              disabled={analysisLoading}
            >
              {analysisLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Zap className="w-3.5 h-3.5 text-primary" />}
              <span className="text-[10px] font-semibold text-foreground">Optimize</span>
              <span className="text-[8px] text-muted-foreground/60 leading-tight text-center">Trim &amp; rebalance stack</span>
            </button>
            <button
              className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl border border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5 transition-all active:scale-95 disabled:opacity-50"
              onClick={handleImproveImpact}
              disabled={aiLoading}
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
              <span className="text-[10px] font-semibold text-foreground">Improve</span>
              <span className="text-[8px] text-muted-foreground/60 leading-tight text-center">Boost zone impact</span>
            </button>
            <button
              className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl border border-chart-5/30 hover:border-chart-5/60 hover:bg-chart-5/5 transition-all active:scale-95"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageSquare className="w-3.5 h-3.5 text-chart-5" />
              <span className="text-[10px] font-semibold text-foreground">Chat</span>
              <span className="text-[8px] text-muted-foreground/60 leading-tight text-center">Ask anything</span>
            </button>
          </div>

          {/* Compound List */}
          {compoundDetails.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No compounds targeting this zone</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Add compounds to improve coverage</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/60 px-1">
                <span>{compoundDetails.length} compounds</span>
                <span>Impact</span>
              </div>
              {compoundDetails.map((item, i) => (
                <div key={i} className="bg-secondary/30 rounded-lg border border-border/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.benefits && <span className="text-sm">{item.benefits.icon}</span>}
                      <span className="text-sm font-medium text-foreground">{item.compound?.name || item.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono font-semibold ${intensityColor(item.weight)}`}>
                        {intensityLabel(item.weight)}
                      </span>
                      <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.weight * 100}%`, backgroundColor: info.color }}
                        />
                      </div>
                    </div>
                  </div>
                  {item.compound && (
                    <p className="text-[10px] font-mono text-muted-foreground/70">
                      {item.compound.dosePerUse} {item.compound.doseLabel} · {item.compound.dosesPerDay}x/day · {item.compound.daysPerWeek}d/wk
                    </p>
                  )}
                  {item.benefits && (
                    <div className="space-y-1">
                      {item.benefits.benefits.slice(0, 3).map((b, j) => (
                        <p key={j} className="text-[11px] text-muted-foreground leading-tight">
                          {b.startsWith('📊') ? <span className="text-primary font-medium">{b}</span> : <>• {b}</>}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}


          {/* Analysis Results — Quick Actions */}
          {analysisLoading && !analysis && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Analyzing stack...</span>
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-primary/10 animate-pulse" />)}
              </div>
            </div>
          )}

          {analysis && (
            <div className="space-y-3 animate-fade-in">
              {/* Summary Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Stack Analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-foreground">{analysis.zone_score}%</span>
                    {analysis.optimal_stack && (
                      <span className="text-[10px] font-mono text-emerald-400">→ {analysis.optimal_stack.projected_score}%</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{analysis.summary}</p>
              </div>

              {/* Quick Actions */}
              {analysis.quick_actions?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">Suggestions</span>
                  {analysis.quick_actions.map((action, i) => (
                    <div key={i} className={`rounded-lg border p-3 ${ACTION_COLORS[action.type] || 'border-border/30 bg-secondary/30'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className="mt-0.5 flex-shrink-0 text-foreground/70">{ACTION_ICONS[action.type]}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{action.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{action.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                          <span className={`text-xs font-mono font-semibold ${action.impact > 0 ? 'text-emerald-400' : action.impact < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {action.impact > 0 ? '+' : ''}{action.impact}%
                          </span>
                          {action.cost_impact && action.cost_impact !== 'neutral' && (
                            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
                              <DollarSign className="w-2.5 h-2.5" />{action.cost_impact}
                            </span>
                          )}
                        </div>
                      </div>
                      {action.reasoning && (
                        <p className="text-[10px] text-muted-foreground/70 mt-2 leading-snug italic">{action.reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Redundant Compounds */}
              {analysis.redundant_compounds?.filter(rc => rc.verdict !== 'keep').length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold px-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Below 40% Benefit
                  </span>
                  {analysis.redundant_compounds.filter(rc => rc.verdict !== 'keep').map((rc, i) => (
                    <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{rc.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                            {rc.benefit_pct}% benefit
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{rc.reasoning}</p>
                        {rc.alternative && (
                          <p className="text-[10px] text-primary mt-0.5">→ Consider: {rc.alternative}</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                        rc.verdict === 'remove' ? 'bg-destructive/15 text-destructive' : 'bg-chart-5/15 text-chart-5'
                      }`}>
                        {rc.verdict}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Projected Optimal */}
              {analysis.optimal_stack && (analysis.optimal_stack.remove.length > 0 || analysis.optimal_stack.add.length > 0) && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Optimal Stack</span>
                    <span className="text-xs font-mono text-emerald-400">{analysis.optimal_stack.projected_score}% projected</span>
                  </div>
                  <div className="space-y-1">
                    {analysis.optimal_stack.remove.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        <span className="text-destructive font-medium">Remove:</span> {analysis.optimal_stack.remove.join(', ')}
                      </p>
                    )}
                    {analysis.optimal_stack.add.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        <span className="text-emerald-400 font-medium">Add:</span> {analysis.optimal_stack.add.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <GeminiBadge />
            </div>
          )}

          {/* AI Improve Impact (streaming) */}
          {aiLoading && !aiSuggestion && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Generating suggestions...</span>
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-3 rounded bg-primary/10 animate-pulse" style={{ width: `${60 + i * 10}%` }} />)}
              </div>
            </div>
          )}

          {aiSuggestion && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">AI Suggestions</span>
                </div>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={() => { navigator.clipboard.writeText(aiSuggestion); setCopied(true); toast.success('Copied'); setTimeout(() => setCopied(false), 2000); }}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed text-foreground/90 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:pl-4 [&_li]:my-0.5 [&_strong]:text-foreground [&_blockquote]:border-primary/30 [&_blockquote]:text-muted-foreground [&_hr]:border-border/30">
                <ReactMarkdown>{aiSuggestion}</ReactMarkdown>
              </div>
              <GeminiBadge />
            </div>
          )}

          {/* Chat Panel */}
          {showChat && (
            <div className="border border-chart-5/20 rounded-lg overflow-hidden animate-fade-in">
              <div className="bg-chart-5/5 px-3 py-2 flex items-center justify-between border-b border-chart-5/20">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-chart-5" />
                  <span className="text-[10px] uppercase tracking-wider text-chart-5 font-semibold">Zone Chat</span>
                </div>
                <button onClick={() => setShowChat(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Messages */}
              <div className="max-h-64 overflow-y-auto scrollbar-thin p-3 space-y-3">
                {chatMessages.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-4">
                    Ask anything about optimizing your {info.label} zone coverage
                  </p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      msg.role === 'user'
                        ? 'bg-primary/15 text-foreground'
                        : 'bg-secondary/50 text-foreground'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:pl-3 [&_li]:my-0.5 [&_strong]:text-foreground [&_p]:my-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-xs">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
                  <div className="flex justify-start">
                    <div className="bg-secondary/50 rounded-lg px-3 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-chart-5" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="border-t border-chart-5/20 p-2 flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                  placeholder={`Ask about ${info.label}...`}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none border border-border/30 focus:border-chart-5/40"
                />
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-chart-5 hover:bg-chart-5/10"
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <GeminiBadge />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ZoneDetailDrawer;
