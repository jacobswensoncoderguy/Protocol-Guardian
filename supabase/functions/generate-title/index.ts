import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userMessage, assistantMessage } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Generate a short, descriptive title (2-5 words, no more) for this conversation between a user and a protocol advisor AI. Return ONLY the title text, nothing else. No quotes, no punctuation at the end. Examples: 'BPC-157 Tendon Healing', 'GH Stack Timing', 'Deca Cycling Review', 'Liver Stress Reduction'",
          },
          {
            role: "user",
            content: `User asked: "${userMessage.slice(0, 200)}"\n\nAssistant replied about: "${assistantMessage.slice(0, 300)}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Title generation failed:", response.status);
      return new Response(JSON.stringify({ title: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim() || null;

    return new Response(JSON.stringify({ title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-title error:", e);
    return new Response(JSON.stringify({ title: null }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
