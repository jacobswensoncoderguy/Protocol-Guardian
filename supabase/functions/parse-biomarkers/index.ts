import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileContent, fileType, goalContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!fileContent) {
      return new Response(JSON.stringify({ error: "No file content provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert clinical biomarker analyst. You receive extracted text from medical lab reports, DEXA scans, bloodwork panels, or health assessments.

YOUR TASK:
1. Identify ALL biomarkers, measurements, and health metrics found in the text
2. Extract their values, units, and reference ranges when available
3. Flag any values that are out of range (high or low)
4. Categorize each biomarker into a body system category
5. Suggest which health goals each biomarker is relevant to

CATEGORIES: hormonal, metabolic, cardiovascular, hepatic, renal, hematologic, inflammatory, bone_density, body_composition, cognitive, thyroid, lipid, vitamin_mineral

For DEXA scans specifically, extract: total body fat %, lean mass, bone mineral density, regional fat/lean distribution, visceral adipose tissue (VAT), android/gynoid ratio.

For bloodwork, extract: CBC, CMP, lipid panel, thyroid panel, hormone levels (testosterone, estrogen, cortisol, IGF-1, etc.), inflammatory markers (CRP, ESR), vitamins (D, B12), iron studies, etc.

Use the extract_biomarkers tool to return structured results.`;

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
          {
            role: "user",
            content: `Parse the following ${fileType || 'medical document'} and extract all biomarkers:\n\n${fileContent}\n\n${goalContext ? `\nUser's current health goals for context:\n${JSON.stringify(goalContext)}` : ''}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_biomarkers",
              description: "Extract structured biomarker data from a medical document",
              parameters: {
                type: "object",
                properties: {
                  document_type: {
                    type: "string",
                    enum: ["bloodwork", "dexa_scan", "metabolic_panel", "hormone_panel", "lipid_panel", "thyroid_panel", "other"],
                    description: "Type of medical document",
                  },
                  document_date: {
                    type: "string",
                    description: "Date of the test if found (YYYY-MM-DD format)",
                  },
                  summary: {
                    type: "string",
                    description: "Brief 1-2 sentence summary of key findings",
                  },
                  biomarkers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Biomarker name" },
                        value: { type: "number", description: "Numeric value" },
                        unit: { type: "string", description: "Unit of measurement" },
                        reference_low: { type: "number", description: "Low end of reference range" },
                        reference_high: { type: "number", description: "High end of reference range" },
                        status: { type: "string", enum: ["normal", "low", "high", "critical_low", "critical_high"] },
                        category: { type: "string", description: "Body system category" },
                        relevant_goal_types: {
                          type: "array",
                          items: { type: "string" },
                          description: "Goal types this biomarker relates to (e.g. hormonal, fat_loss, muscle_gain)",
                        },
                      },
                      required: ["name", "value", "unit", "status", "category"],
                    },
                  },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        biomarker: { type: "string" },
                        suggestion: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high"] },
                      },
                      required: ["biomarker", "suggestion", "priority"],
                    },
                    description: "Actionable recommendations based on out-of-range values",
                  },
                },
                required: ["document_type", "summary", "biomarkers"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_biomarkers" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI parsing failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured biomarker data");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-biomarkers error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
