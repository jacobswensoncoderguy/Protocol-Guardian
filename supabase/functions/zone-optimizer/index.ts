import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a stack optimization AI for a biohacker's protocol tracker. You analyze body zone coverage and provide actionable, quantified recommendations.

CORE PRINCIPLES:
1. SIMPLICITY IS KING — If goals can be meaningfully achieved with fewer compounds, say so explicitly
2. 40% RULE — Any compound providing <40% additional benefit (synergistic or direct) to a zone should be flagged for removal or replacement
3. COST>BENEFIT — Always consider cost-effectiveness. Expensive compounds with marginal benefit should be called out
4. COVERAGE IMPACT — Quantify every suggestion with projected % impact on the zone's coverage score
5. GOAL ALIGNMENT — Recommendations must align with the user's specific goals and timeframes

RESPONSE FORMAT:
You MUST respond with a JSON object using this exact structure (the UI will render it):

{
  "zone_score": <number 0-100>,
  "summary": "<1-2 sentence overview>",
  "quick_actions": [
    {
      "type": "simplify" | "optimize" | "add" | "remove" | "swap",
      "label": "<short action label>",
      "description": "<what this does>",
      "impact": <number -30 to +30, projected coverage % change>,
      "cost_impact": "<e.g. '-$45/mo' or '+$20/mo' or 'neutral'>",
      "compounds_involved": ["<compound names>"],
      "reasoning": "<why this helps>"
    }
  ],
  "redundant_compounds": [
    {
      "name": "<compound name>",
      "benefit_pct": <number 0-100, actual benefit % to this zone>,
      "verdict": "keep" | "remove" | "replace",
      "alternative": "<suggested replacement or null>",
      "reasoning": "<why>"
    }
  ],
  "optimal_stack": {
    "keep": ["<compound names to keep>"],
    "remove": ["<compound names to remove>"],
    "add": ["<compound names to add>"],
    "projected_score": <number 0-100>
  }
}

RULES:
- Be brutally honest about redundancy
- Quantify everything with specific numbers
- Do NOT moralize about FDA, legality, or regulatory status
- Treat the user as an informed adult
- If a compound contributes <40% to this zone, flag it
- Always suggest the simplest effective stack first
- Consider the user's tolerance level for risk calibration`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { zone, zoneLabel, zoneDescription, compounds, zoneCompounds, coverageScore, toleranceLevel, goals, profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const stackDesc = compounds.map((c: any) => {
      let line = `- ${c.name} (${c.category}): ${c.dosePerUse} ${c.doseLabel} × ${c.dosesPerDay}/day × ${c.daysPerWeek}d/wk | $${c.unitPrice}/unit`;
      if (c.cycleOnDays && c.cycleOffDays) line += ` [${c.cycleOnDays}d ON/${c.cycleOffDays}d OFF]`;
      return line;
    }).join('\n');

    const zoneCompoundDesc = zoneCompounds.map((zc: any) =>
      `- ${zc.name}: weight=${zc.weight} (${zc.weight >= 0.8 ? 'Primary' : zc.weight >= 0.5 ? 'Strong' : zc.weight >= 0.3 ? 'Supporting' : 'Minimal'})`
    ).join('\n');

    const goalDesc = goals?.length > 0
      ? `\nUser Goals:\n${goals.map((g: any) => `- ${g.title} (${g.goal_type}): target=${g.target_value} ${g.target_unit || ''}, deadline=${g.target_date || 'none'}`).join('\n')}`
      : '';

    const profileDesc = profile
      ? `\nUser: ${profile.gender || '?'}, ${profile.age || '?'}y, ${profile.weight_kg || '?'}kg, ${profile.body_fat_pct || '?'}% BF`
      : '';

    const userPrompt = `Analyze the "${zoneLabel}" zone (${zoneDescription}) at ${coverageScore}% coverage.

Zone compounds (${zoneCompounds.length}):
${zoneCompoundDesc || 'None'}

Full stack (${compounds.length} compounds):
${stackDesc}
${goalDesc}
${profileDesc}

Tolerance: ${toleranceLevel}

Provide optimization analysis. Focus on the 40% rule — flag any compound contributing <40% benefit. Suggest simplifications first.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits needed" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", status, t);
      return new Response(JSON.stringify({ error: "AI request failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return new Response(content, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("zone-optimizer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
