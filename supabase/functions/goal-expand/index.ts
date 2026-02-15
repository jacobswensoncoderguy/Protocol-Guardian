import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { goals, protocols, compounds } = context || {};

    const systemPrompt = `You are an expert biohacking and health optimization coach helping a user refine and expand their health goals.

CURRENT USER CONTEXT:
- Goals: ${JSON.stringify(goals || [], null, 2)}
- Protocols: ${JSON.stringify(protocols?.map((p: any) => ({ name: p.name, description: p.description, compoundCount: p.compoundIds?.length })) || [], null, 2)}
- Active Compounds: ${JSON.stringify(compounds?.map((c: any) => ({ name: c.name, category: c.category, dosePerUse: c.dosePerUse, doseLabel: c.doseLabel, daysPerWeek: c.daysPerWeek })) || [], null, 2)}

YOUR ROLE:
1. Help users refine existing goals with more specific, measurable targets
2. Suggest NEW goals they haven't considered based on their current stack
3. Identify gaps — compounds they're taking that aren't aligned to any goal
4. Suggest protocol improvements: dosage adjustments, timing changes, or new compounds
5. When ready, use the tool to propose structured changes

GUIDELINES:
- Be concise (2-3 sentences per turn), direct, and actionable
- Reference their specific compounds and protocols by name
- Suggest evidence-based improvements with reasoning
- Format responses in markdown with **bold** for key points
- Ask focused follow-up questions to clarify their priorities`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_improvements",
              description: "Propose goal refinements and protocol improvements based on the conversation. Call when you have concrete suggestions.",
              parameters: {
                type: "object",
                properties: {
                  goal_updates: {
                    type: "array",
                    description: "Updates to existing goals or new goals to create",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string", enum: ["create", "update"] },
                        goal_id: { type: "string", description: "Existing goal ID for updates" },
                        goal_type: { type: "string", enum: ["muscle_gain", "fat_loss", "cardiovascular", "cognitive", "hormonal", "longevity", "recovery", "sleep", "libido", "custom"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        body_area: { type: "string" },
                        target_value: { type: "number" },
                        target_unit: { type: "string" },
                        priority: { type: "number", enum: [1, 2, 3] },
                      },
                      required: ["action", "title", "goal_type"],
                    },
                  },
                  protocol_suggestions: {
                    type: "array",
                    description: "Suggested changes to protocols or compounds",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["add_compound", "adjust_dose", "adjust_timing", "new_protocol"] },
                        protocol_name: { type: "string" },
                        compound_name: { type: "string" },
                        suggestion: { type: "string" },
                        reasoning: { type: "string" },
                      },
                      required: ["type", "suggestion", "reasoning"],
                    },
                  },
                },
                required: ["goal_updates", "protocol_suggestions"],
              },
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("goal-expand error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
