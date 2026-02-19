import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, structuredResponses, gender, questionNumber, maxQuestions, forceExtract } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isFemale = gender === 'female';
    const qNum = questionNumber || 1;
    const maxQ = maxQuestions || 3;

    const genderContext = isFemale
      ? `The user is female. Focus on female-specific health topics: hormonal balance (estrogen, progesterone, cortisol), 
cycle health, perimenopause/menopause support, bone density, skin & hair health, fertility considerations, and stress/mood support.
Do NOT ask about testosterone levels or male-specific concerns like prostate health.
Frame muscle goals as "body composition" and "toning" rather than "bulk" unless they specifically want that.
Consider female-appropriate peptide doses and supplement recommendations.`
      : `The user is male. You can discuss testosterone optimization, muscle building, libido, and male-specific health concerns.`;

    const progressInstruction = forceExtract
      ? `This is the user's FINAL answer (question ${qNum} of ${maxQ}). You MUST now call the create_goals tool to generate their personalized goals. Do NOT ask any more questions. Instead, briefly acknowledge their answer (1 sentence max), then immediately call create_goals with specific, measurable goals.`
      : `This is question ${qNum} of ${maxQ}. You have ${maxQ - qNum} question(s) remaining.

QUESTION STRATEGY:
- Question 1: Ask about their MOST important goal — what specific outcome would make them feel successful? Be direct.
- Question 2: Ask about current barriers or constraints (time, budget, experience) that affect their plan.
- Question 3: Ask about their measurement preferences — how will they know it's working?

RULES:
- Ask exactly ONE clear question per turn. Never ask multiple questions.
- Start each response by briefly explaining WHY you're asking (1 short sentence).
- Keep total response under 3 sentences.
- Be specific to their stated goals — don't ask generic questions.
- If this is question ${maxQ}, make it count — ask the most important remaining thing.`;

    const systemPrompt = `You are a biohacking and health optimization coach conducting a BRIEF, focused goal-setting session.
The user already answered structured questions. Here's what they shared:

${JSON.stringify(structuredResponses, null, 2)}

Gender context:
${genderContext}

CONVERSATION FORMAT:
${progressInstruction}

Your role:
1. Ask ONE focused, specific follow-up question that adds real value
2. Be warm but efficient — max 2 sentences before the question
3. **Bold** all key metrics, compounds, or target values
4. When calling create_goals, create 3-6 specific, measurable goals with clear targets

CRITICAL: Never exceed ${maxQ} questions total. The user sees a progress bar and expects to be done after ${maxQ} answers.
CRITICAL: Be concise. No verbose explanations. No hedging. No filler sentences.
Format responses in markdown. Use **bold** for key numbers and terms.`;

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
              description: "Create structured goals from the conversation. Call this when you have enough information to define specific, measurable goals. MUST be called after the final question is answered.",
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
                          description: isFemale 
                            ? "Goal type. One of: body_composition, fat_loss, cardiovascular, cognitive, hormonal_balance, longevity, recovery, sleep, skin_hair, fertility, stress, custom"
                            : "Goal type. One of: muscle_gain, fat_loss, cardiovascular, cognitive, hormonal, longevity, recovery, sleep, libido, custom"
                        },
                        title: { type: "string", description: "Short, specific goal title" },
                        description: { type: "string", description: "Detailed description of the goal" },
                        body_area: { type: "string", description: "Body area if applicable. One of: arms, chest, legs, core, back, full_body, brain, heart" },
                        target_value: { type: "number", description: "Numeric target value" },
                        target_unit: { type: "string", description: "Unit of measurement (e.g., lbs, %, ng/dL)" },
                        priority: { type: "number", description: "Priority: 1=high, 2=medium, 3=low" },
                      },
                    },
                  },
                },
                required: ["goals"],
              },
            },
          },
        ],
        ...(forceExtract ? { tool_choice: { type: "function", function: { name: "create_goals" } } } : {}),
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
