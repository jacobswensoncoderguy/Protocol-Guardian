import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INSIGHT_PROMPTS: Record<string, (compounds: string[], goals: string[], symptoms: string[]) => string> = {
  performance: (compounds) =>
    `You are a protocol optimization AI. Active compounds: ${compounds.join(", ")}. Give ONE insight about current stack performance — synergies, half-lives, or timing advantages. **Bold** the key compound names or numbers. End with a confidence line: [CONF:XX%|Tier] where XX is 0-100 and Tier is RCT/Meta-analysis/Clinical/Anecdotal/Theoretical/Mixed. Max 3 sentences. No disclaimers. No filler.`,
  recommendation: (compounds) =>
    `You are a health optimization coach. Active compounds: ${compounds.join(", ")}. Give ONE specific, actionable recommendation for today. Start with an action verb. **Bold** the key action. End with [CONF:XX%|Tier]. Max 3 sentences.`,
  symptom: (compounds, _goals, symptoms) =>
    `You are a protocol analysis AI. Active compounds: ${compounds.join(", ")}${symptoms.length ? `. Recent symptoms: ${symptoms.join(", ")}` : ""}. Identify ONE clear connection between protocol and symptoms. **Bold** the key finding. End with [CONF:XX%|Tier]. Max 3 sentences.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { compounds = [], goals = [], symptoms = [], insightType = "performance", followUp, previousInsight } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const compoundNames: string[] = compounds.map((c: { name: string }) => c.name);
    const goalTitles: string[] = goals.map((g: { title: string }) => g.title);
    const symptomList: string[] = symptoms.map((s: string) => s);

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: "You are a concise protocol optimization AI. Be specific, direct, and scannable. Use **bold** for key numbers, compound names, and actions. End every response with a confidence line: [CONF:XX%|Tier] where XX is 0-100 confidence and Tier is one of RCT, Meta-analysis, Clinical, Anecdotal, Theoretical, Mixed. Be honest about confidence — don't inflate. Max 3 sentences unless answering a follow-up. Zero disclaimers. Zero filler words. No emojis.",
      },
    ];

    if (followUp && previousInsight) {
      // Follow-up conversation: include previous context
      const userPrompt = (INSIGHT_PROMPTS[insightType] || INSIGHT_PROMPTS.performance)(compoundNames, goalTitles, symptomList);
      messages.push({ role: "user", content: userPrompt });
      messages.push({ role: "assistant", content: previousInsight });
      messages.push({ role: "user", content: followUp });
    } else {
      const userPrompt = (INSIGHT_PROMPTS[insightType] || INSIGHT_PROMPTS.performance)(compoundNames, goalTitles, symptomList);
      messages.push({ role: "user", content: userPrompt });
    }

    const fetchWithRetry = async (body: string, maxRetries = 2) => {
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body,
        });
        if (res.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (res.status === 402) {
          return new Response(JSON.stringify({ error: "Credits required — add funds to your workspace." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (res.ok) return res;
        if (res.status === 500 && attempt <= maxRetries) {
          const delay = attempt * 2000;
          console.warn(`AI gateway 500 on attempt ${attempt}, retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        throw new Error(`AI gateway: ${res.status}`);
      }
      throw new Error("AI gateway: max retries exceeded");
    };

    const requestBody = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      max_tokens: followUp ? 300 : 150,
    });

    const response = await fetchWithRetry(requestBody);
    if (response instanceof Response && response.status !== 200) return response;

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
