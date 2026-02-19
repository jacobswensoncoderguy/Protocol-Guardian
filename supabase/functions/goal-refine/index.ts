import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, goal } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a biohacking coach helping a user fine-tune a specific health goal.

GOAL DETAILS:
- Title: ${goal.title}
- Type: ${goal.goal_type}
- Baseline: ${goal.baseline_value ?? 'not set'} ${goal.target_unit ?? ''}
- Current: ${goal.current_value ?? 'not set'} ${goal.target_unit ?? ''}
- Target: ${goal.target_value ?? 'not set'} ${goal.target_unit ?? ''}
- Body Area: ${goal.body_area ?? 'not set'}
- Description: ${goal.description ?? 'none'}
- Priority: ${goal.priority ?? 'not set'}
- Achievement Date: ${goal.target_date ?? 'not set'}

YOUR ROLE:
1. Help the user refine this goal to be more specific, measurable, and achievable
2. Suggest better target values based on clinical evidence
3. Recommend tracking frequency and methods
4. When the user confirms changes, call the update_goal tool

RULES:
- Max 2 sentences per response — be ruthlessly concise
- Lead with the most important number or insight
- **Bold** all key numbers, metrics, and compound names
- No filler phrases ("Great question!", "That's a good point", etc.)
- No hedging language or disclaimers
- Only call update_goal when the user explicitly agrees to changes`;

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
          ...messages,
        ],
        stream: true,
        tools: [
          {
            type: "function",
            function: {
              name: "update_goal",
              description: "Update the goal with refined targets. Only call when the user confirms.",
              parameters: {
                type: "object",
                properties: {
                  updates: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Refined goal title" },
                      description: { type: "string", description: "Updated description" },
                      target_value: { type: "number", description: "New target value" },
                      target_unit: { type: "string", description: "Unit of measurement" },
                      baseline_value: { type: "number", description: "Baseline value" },
                      target_date: { type: "string", description: "ISO date string for achievement date" },
                    },
                  },
                },
                required: ["updates"],
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
    console.error("goal-refine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
