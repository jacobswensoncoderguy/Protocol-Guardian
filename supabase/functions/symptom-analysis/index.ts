import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, days = 30 } = await req.json();
    if (!userId) throw new Error("userId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Fetch all relevant data in parallel
    const [logsRes, checkinRes, changesRes, defsRes, compoundsRes] = await Promise.all([
      supabase.from("symptom_logs").select("*").eq("user_id", userId).gte("log_date", since).order("log_date"),
      supabase.from("daily_checkins").select("*").eq("user_id", userId).gte("checkin_date", since).order("checkin_date"),
      supabase.from("protocol_changes").select("*").eq("user_id", userId).gte("change_date", since).order("change_date"),
      supabase.from("symptom_definitions").select("id, name, category"),
      supabase.from("user_compounds").select("name, category, dose_per_use, unit_label, doses_per_day, timing_note, cycling_note, cycle_on_days, cycle_off_days, cycle_start_date, paused_at").eq("user_id", userId),
    ]);

    const logs = logsRes.data || [];
    const checkins = checkinRes.data || [];
    const changes = changesRes.data || [];
    const defs = defsRes.data || [];
    const compounds = compoundsRes.data || [];

    const defMap = Object.fromEntries(defs.map((d: any) => [d.id, d]));

    // Build a day-by-day timeline for richer context
    const dayMap: Record<string, { symptoms: any[]; checkin: any | null }> = {};
    logs.forEach((l: any) => {
      if (!dayMap[l.log_date]) dayMap[l.log_date] = { symptoms: [], checkin: null };
      dayMap[l.log_date].symptoms.push({
        name: l.custom_symptom || defMap[l.symptom_definition_id]?.name || "Unknown",
        category: defMap[l.symptom_definition_id]?.category || "custom",
        severity: l.severity,
        timing: l.timing,
        notes: l.notes,
      });
    });
    checkins.forEach((c: any) => {
      if (!dayMap[c.checkin_date]) dayMap[c.checkin_date] = { symptoms: [], checkin: null };
      dayMap[c.checkin_date].checkin = {
        energy: c.energy_score, mood: c.mood_score, pain: c.pain_score, sleep: c.sleep_score, notes: c.notes,
      };
    });

    // Build timeline entries with protocol change markers
    const timeline = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, data]) => {
      const dateChanges = changes.filter((ch: any) => ch.change_date === date);
      return { date, ...data, protocolChanges: dateChanges.map((ch: any) => ch.description) };
    });

    const systemPrompt = `You are an expert health analyst correlating symptoms with compounds and protocol changes.

RESPONSE RULES — MANDATORY:
- summary: 1-2 sentences MAX. Lead with the single most critical finding. **Bold** key compounds/symptoms.
- key_insight: ONE sentence. The single most important thing to act on.
- suggestions: max 4 items. Each action max 10 words. Each rationale max 15 words.
- correlations: max 6. Each finding max 15 words.
- No filler, no hedging, no disclaimers.
- EVERY correlation and suggestion MUST include a confidencePct (0-100) and evidenceTier.

CONFIDENCE SCORING:
- confidencePct: 0-100 based on evidence quality. 90+: strong clinical data. 70-89: good evidence. 50-69: limited/mixed. 30-49: anecdotal. <30: theoretical.
- evidenceTier: "RCT-backed", "Meta-analysis", "Clinical observation", "Anecdotal", "Theoretical", "Mixed"
- Be honest. A 40% Anecdotal score is better than an inflated 90%.

Return ONLY valid JSON with this exact structure:
{
  "summary": "1-2 sentence summary — most important finding first, bold key terms",
  "overallConfidencePct": number_0_to_100,
  "overallEvidenceTier": "string",
  "riskSummary": "1-2 sentence overall risk assessment",
  "correlations": [
    {"finding": "string (max 15 words)", "confidence": "high|medium|low", "type": "positive|negative|neutral", "compound": "compound name or null", "symptom": "symptom name or null", "dayOffset": number_or_null, "confidencePct": number_0_to_100, "evidenceTier": "string"}
  ],
  "concerning_trends": ["string (max 10 words each)"],
  "positive_trends": ["string (max 10 words each)"],
  "suggestions": [
    {"action": "string - max 10 words", "rationale": "string - max 15 words", "priority": "high|medium|low", "category": "timing|dose|lifestyle|monitoring|consult", "confidencePct": number_0_to_100, "evidenceTier": "string"}
  ],
  "wellness_trend": "improving|stable|declining|mixed",
  "key_insight": "Single most important finding in one sentence",
  "timeline_events": [
    {"date": "YYYY-MM-DD", "type": "change|symptom_spike|wellness_dip|positive", "description": "string", "severity": "high|medium|low"}
  ],
  "symptom_frequency": [{"name": "symptom name", "count": number, "avgSeverity": number, "category": "string"}]
}`;

    const userPrompt = `Analyze this patient's tracking data for the past ${days} days:

ACTIVE COMPOUNDS: ${JSON.stringify(compounds.map((c: any) => ({
  name: c.name,
  category: c.category,
  dose: `${c.dose_per_use}${c.unit_label} × ${c.doses_per_day}x/day`,
  timing: c.timing_note,
  cycling: c.cycle_on_days ? `${c.cycle_on_days} on / ${c.cycle_off_days} off` : null,
  paused: !!c.paused_at,
})))}

PROTOCOL CHANGES (${changes.length} events): ${JSON.stringify(changes.map((ch: any) => ({
  date: ch.change_date, type: ch.change_type, description: ch.description, from: ch.previous_value, to: ch.new_value,
})))}

DAY-BY-DAY TIMELINE (${timeline.length} days with data): ${JSON.stringify(timeline)}

Total: ${logs.length} symptom logs, ${checkins.length} daily check-ins, ${changes.length} protocol changes.

Focus on: timing correlations between protocol changes and symptom changes, compound-specific patterns, and actionable insights.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

    let analysis;
    try {
      analysis = JSON.parse(jsonStr.trim());
    } catch {
      analysis = { summary: content, correlations: [], suggestions: [], concerning_trends: [], positive_trends: [], wellness_trend: "mixed", key_insight: "", timeline_events: [], symptom_frequency: [] };
    }

    // Also return the raw data for chart rendering on the client
    const chartData = {
      dailyCheckins: checkins.map((c: any) => ({
        date: c.checkin_date,
        energy: c.energy_score,
        mood: c.mood_score,
        pain: c.pain_score,
        sleep: c.sleep_score,
        avg: Number(((c.energy_score + c.mood_score + (6 - c.pain_score) + c.sleep_score) / 4).toFixed(1)),
      })),
      symptomsByDay: Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, data]) => ({
        date,
        count: data.symptoms.length,
        avgSeverity: data.symptoms.length > 0 ? Number((data.symptoms.reduce((s: number, sym: any) => s + sym.severity, 0) / data.symptoms.length).toFixed(1)) : 0,
      })),
      protocolChangeDates: changes.map((ch: any) => ({ date: ch.change_date, description: ch.description })),
    };

    return new Response(JSON.stringify({ analysis, dataPoints: { logs: logs.length, checkins: checkins.length, changes: changes.length }, chartData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("symptom-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
