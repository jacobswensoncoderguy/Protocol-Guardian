import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { goals, bodyAreas } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build a descriptive prompt based on user goals and body areas
    const goalDescriptions = (goals || []).map((g: any) => {
      const progress = g.target_value && g.current_value && g.baseline_value
        ? Math.round(((g.current_value - g.baseline_value) / (g.target_value - g.baseline_value)) * 100)
        : null;
      return `${g.title} (${g.goal_type.replace(/_/g, ' ')}${progress !== null ? `, ${progress}% progress` : ''})`;
    }).join('; ');

    const focusAreas = (bodyAreas || []).join(', ') || 'full body';

    const prompt = `Create a clean, modern anatomical body vector illustration in a dark theme style (dark background, cyan/teal accent colors). 
Show a front-facing human body silhouette with highlighted muscle groups and progress indicators.
Focus areas: ${focusAreas}.
Goals: ${goalDescriptions || 'general fitness optimization'}.
Style: Minimalist vector art, glowing cyan outlines on dark navy background, subtle gradient overlays on active muscle groups showing gains.
Show heat-map style overlays: brighter cyan/green for areas with more progress, dimmer for areas needing work.
No text labels. Clean, professional medical illustration style. Square aspect ratio.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
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
      console.error("Image generation error:", response.status, t);
      return new Response(JSON.stringify({ error: "Image generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textContent = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ imageUrl, description: textContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("body-illustration error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
