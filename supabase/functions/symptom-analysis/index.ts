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
      supabase.from("user_compounds").select("name, category, dose_per_use, unit_label, doses_per_day").eq("user_id", userId),
    ]);

    const logs = logsRes.data || [];
    const checkins = checkinRes.data || [];
    const changes = changesRes.data || [];
    const defs = defsRes.data || [];
    const compounds = compoundsRes.data || [];

    const defMap = Object.fromEntries(defs.map((d: any) => [d.id, d]));

    const systemPrompt = `You are an expert health analyst specializing in correlating symptoms with medications, compounds, and behavioral changes. You have access to a patient's tracking data over the past ${days} days. 

Your role:
1. Identify patterns and correlations between protocol changes and symptom changes
2. Highlight any concerning symptom trends (worsening severity, new symptoms appearing after changes)
3. Note positive responses (symptoms improving after protocol changes)
4. Provide actionable, evidence-based suggestions for protocol or behavior adjustments
5. Always recommend consulting a healthcare provider for significant changes

CRITICAL: Be medically responsible. Never recommend stopping prescribed medications. Frame suggestions as questions to discuss with their doctor. Be specific about timing correlations.

Return a JSON object with:
{
  "summary": "2-3 sentence overall summary",
  "correlations": [{"finding": "string", "confidence": "high|medium|low", "type": "positive|negative|neutral"}],
  "concerning_trends": ["string"],
  "positive_trends": ["string"],
  "suggestions": [{"action": "string", "rationale": "string", "priority": "high|medium|low"}],
  "wellness_trend": "improving|stable|declining|mixed",
  "key_insight": "The single most important finding"
}`;

    const logsFormatted = logs.map((l: any) => ({
      date: l.log_date,
      symptom: l.custom_symptom || defMap[l.symptom_definition_id]?.name || "Unknown",
      category: defMap[l.symptom_definition_id]?.category || "custom",
      severity: l.severity,
      timing: l.timing,
      notes: l.notes,
    }));

    const userPrompt = `Analyze this patient's tracking data for the past ${days} days:

CURRENT COMPOUNDS: ${JSON.stringify(compounds)}

PROTOCOL CHANGES: ${JSON.stringify(changes)}

SYMPTOM LOGS (${logs.length} entries): ${JSON.stringify(logsFormatted)}

DAILY CHECK-INS (energy/mood/pain/sleep 1-5): ${JSON.stringify(checkins.map((c: any) => ({
  date: c.checkin_date, energy: c.energy_score, mood: c.mood_score, pain: c.pain_score, sleep: c.sleep_score, notes: c.notes
})))}

Please identify correlations, trends, and provide actionable insights. Focus especially on any symptoms that changed timing or severity after protocol changes.`;

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
      analysis = { summary: content, correlations: [], suggestions: [], concerning_trends: [], positive_trends: [], wellness_trend: "mixed", key_insight: "" };
    }

    return new Response(JSON.stringify({ analysis, dataPoints: { logs: logs.length, checkins: checkins.length, changes: changes.length } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("symptom-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
