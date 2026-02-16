import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, structuredResponses, gender } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isFemale = gender === 'female';

    const genderContext = isFemale
      ? `The user is female. Focus on female-specific health topics: hormonal balance (estrogen, progesterone, cortisol), 
cycle health, perimenopause/menopause support, bone density, skin & hair health, fertility considerations, and stress/mood support.
Do NOT ask about testosterone levels or male-specific concerns like prostate health.
Frame muscle goals as "body composition" and "toning" rather than "bulk" unless they specifically want that.
Consider female-appropriate peptide doses and supplement recommendations.`
      : `The user is male. You can discuss testosterone optimization, muscle building, libido, and male-specific health concerns.`;

    const systemPrompt = `You are a biohacking and health optimization coach conducting a brief, conversational follow-up interview. 
The user has already answered structured questions about their goals. Here's what they shared:

${JSON.stringify(structuredResponses, null, 2)}

Gender context:
${genderContext}

Your role:
1. Ask 2-3 focused follow-up questions based on their answers to get specific, actionable details
2. Be warm, encouraging, and knowledgeable about peptides, supplements, and performance optimization
3. After gathering enough info, summarize their goal profile and suggest specific, measurable targets
4. Use tool calling to extract structured goals when the conversation feels complete
5. Tailor all recommendations and language to be appropriate for the user's gender

Keep responses concise (2-3 sentences max per turn). Be direct and avoid generic wellness advice.
Format your responses in markdown. Use bold for emphasis.`;

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
              name: "create_goals",
              description: "Create structured goals from the conversation. Call this when you have enough information to define specific, measurable goals.",
              parameters: {
                type: "object",
                properties: {
                  goals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        goal_type: { 
                          type: "string", 
                          enum: isFemale 
                            ? ["body_composition", "fat_loss", "cardiovascular", "cognitive", "hormonal_balance", "longevity", "recovery", "sleep", "skin_hair", "fertility", "stress", "custom"]
                            : ["muscle_gain", "fat_loss", "cardiovascular", "cognitive", "hormonal", "longevity", "recovery", "sleep", "libido", "custom"]
                        },
                        title: { type: "string", description: "Short, specific goal title" },
                        description: { type: "string", description: "Detailed description" },
                        body_area: { type: "string", enum: ["arms", "chest", "legs", "core", "back", "full_body", "brain", "heart"], description: "Body area if applicable" },
                        target_value: { type: "number", description: "Numeric target" },
                        target_unit: { type: "string", description: "Unit of measurement" },
                        priority: { type: "number", enum: [1, 2, 3], description: "1=high, 2=medium, 3=low" },
                      },
                      required: ["goal_type", "title", "priority"],
                    },
                  },
                },
                required: ["goals"],
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
    console.error("goal-interview error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
