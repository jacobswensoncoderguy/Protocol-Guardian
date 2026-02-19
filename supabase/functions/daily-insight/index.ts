import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INSIGHT_PROMPTS: Record<string, (compounds: string[], goals: string[], symptoms: string[]) => string> = {
  performance: (compounds) =>
    `You are a protocol optimization AI. Active compounds: ${compounds.join(", ")}. Generate ONE insight (2-3 sentences) about how this stack is currently performing — focus on synergies, half-lives, or timing advantages. Be specific and data-informed. Never use disclaimers.`,
  recommendation: (compounds) =>
    `You are a health optimization coach. Active compounds: ${compounds.join(", ")}. Give ONE specific actionable recommendation for today — timing, meal pairing, or synergy to exploit. Start with a verb. Max 2-3 sentences.`,
  symptom: (compounds, _goals, symptoms) =>
    `You are a protocol analysis AI. Active compounds: ${compounds.join(", ")}${symptoms.length ? `. Recent symptoms: ${symptoms.join(", ")}` : ""}. Identify ONE meaningful connection between this protocol and how the user might be feeling. Specific, insightful, 2-3 sentences.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { compounds = [], goals = [], symptoms = [], insightType = "performance" } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const compoundNames: string[] = compounds.map((c: { name: string }) => c.name);
    const goalTitles: string[] = goals.map((g: { title: string }) => g.title);
    const symptomList: string[] = symptoms.map((s: string) => s);

    const userPrompt = (INSIGHT_PROMPTS[insightType] || INSIGHT_PROMPTS.performance)(compoundNames, goalTitles, symptomList);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a concise, evidence-informed protocol optimization AI. Always be specific. Never use disclaimers or hedge words. Respond in 2-3 sentences maximum.",
          },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 180,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits required — add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway: ${response.status}`);
    }

    const data = await response.json();
    const insight = data.choices?.[0]?.message?.content?.trim() || "Unable to generate insight at this time.";

    return new Response(JSON.stringify({ insight, insightType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-insight error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
