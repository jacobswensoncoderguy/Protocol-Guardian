import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    const { compoundName, category, dosePerUse, dosesPerDay, daysPerWeek, unitLabel, doseLabel } = await req.json();
    if (!compoundName) throw new Error("compoundName is required");

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("gender, weight_kg, height_cm, body_fat_pct, age, measurement_system")
      .eq("user_id", user.id)
      .single();

    // Fetch recent lab biomarkers (90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const { data: labUploads } = await supabase
      .from("user_goal_uploads")
      .select("ai_extracted_data, reading_date, upload_type")
      .eq("user_id", user.id)
      .gte("reading_date", ninetyDaysAgo)
      .order("reading_date", { ascending: false })
      .limit(10);

    // Extract biomarker summaries from lab data
    const recentBiomarkers: { name: string; value: number; unit: string; status: string; date: string }[] = [];
    if (labUploads) {
      for (const upload of labUploads) {
        const extracted = upload.ai_extracted_data as any;
        if (extracted?.biomarkers) {
          for (const b of extracted.biomarkers) {
            recentBiomarkers.push({
              name: b.name,
              value: b.value,
              unit: b.unit,
              status: b.status || "normal",
              date: upload.reading_date || "",
            });
          }
        }
      }
    }

    // Fetch full active stack for interaction analysis
    const { data: stack } = await supabase
      .from("user_compounds")
      .select("name, category, dose_per_use, doses_per_day, days_per_week, dose_label, unit_label, paused_at, cycle_on_days, cycle_off_days, cycle_start_date")
      .eq("user_id", user.id)
      .is("paused_at", null);

    const activeStack = (stack || []).filter(c => c.name !== compoundName).map(c => ({
      name: c.name,
      category: c.category,
      dose: `${c.dose_per_use} ${c.dose_label}`,
      frequency: `${c.doses_per_day}x/day, ${c.days_per_week}d/week`,
    }));

    // Determine delivery method
    const cat = (category || "").toLowerCase();
    const deliveryMethod = (cat === "peptide") ? "SubQ Injection" :
      (cat === "injectable-oil" || cat === "oil" || cat.includes("inject")) ? "IM Injection" :
      (cat === "powder") ? "Oral (Powder)" : "Oral";

    // Build AI prompt
    const prompt = `You are a clinical pharmacology advisor computing PERSONALIZED compound scores.

COMPOUND: ${compoundName}
DELIVERY METHOD: ${deliveryMethod} (category: ${category})
CURRENT DOSAGE: ${dosePerUse} ${doseLabel || unitLabel} × ${dosesPerDay}x/day × ${daysPerWeek} days/week

USER BIOLOGY:
- Gender: ${profile?.gender || "unknown"}
- Age: ${profile?.age || "unknown"}
- Weight: ${profile?.weight_kg ? `${profile.weight_kg} kg` : "unknown"}
- Height: ${profile?.height_cm ? `${profile.height_cm} cm` : "unknown"}
- Body Fat: ${profile?.body_fat_pct ? `${profile.body_fat_pct}%` : "unknown"}

RECENT LAB BIOMARKERS (last 90 days):
${recentBiomarkers.length > 0
  ? recentBiomarkers.slice(0, 30).map(b => `- ${b.name}: ${b.value} ${b.unit} (${b.status}) [${b.date}]`).join("\n")
  : "No recent lab data available."}

ACTIVE COMPOUND STACK (${activeStack.length} other compounds):
${activeStack.length > 0
  ? activeStack.map(c => `- ${c.name} (${c.category}): ${c.dose}, ${c.frequency}`).join("\n")
  : "No other active compounds."}

TASK: Compute personalized scores for this compound considering ALL the above context.

SCORING RULES:
1. **Bioavailability (0-100%)**: Adjust for delivery method, user's body weight/composition (higher body fat may affect absorption for lipophilic compounds), and any lab markers indicating absorption issues (e.g., low albumin, gut inflammation markers).

2. **Efficacy (0-100%)**: Adjust for whether the current dosage is in the therapeutic range for this user's weight/age/gender, whether lab biomarkers show the compound is actually working (e.g., testosterone levels rising on TRT, inflammatory markers dropping on anti-inflammatory peptides), and evidence quality.

3. **Effectiveness (0-100%)**: Real-world outcome combining bioavailability, efficacy, dosing adequacy, compliance factors, stack synergies or conflicts, and any lab-indicated contraindications.

4. **Evidence Tier**: One of: RCT, Meta, Clinical, Anecdotal, Theoretical, Mixed.

5. **Dosage Assessment**: Is the current dose optimal, subtherapeutic, or supratherapeutic for this user?

6. **Key Interactions**: Note any significant synergies or conflicts with other compounds in the stack.

RESPOND WITH ONLY THIS JSON (no markdown, no code fences):
{
  "bioavailability": <number 0-100>,
  "efficacy": <number 0-100>,
  "effectiveness": <number 0-100>,
  "evidenceTier": "<string>",
  "dosageAssessment": "<optimal|subtherapeutic|supratherapeutic|unknown>",
  "dosageNote": "<1-2 sentence explanation of dosage adequacy>",
  "bioNote": "<1 sentence on what's driving the bioavailability score>",
  "effNote": "<1 sentence on what's driving the efficacy score>",
  "ovrNote": "<1 sentence on what's driving the effectiveness score>",
  "interactions": "<1-2 sentences on key stack interactions or 'No significant interactions detected.'>"
}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response, stripping any markdown fences
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let scores;
    try {
      scores = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI scores:", cleaned);
      throw new Error("Failed to parse AI response");
    }

    return new Response(JSON.stringify({
      personalized: scores,
      context: {
        hasProfile: !!profile,
        hasLabs: recentBiomarkers.length > 0,
        labCount: recentBiomarkers.length,
        stackSize: activeStack.length,
        deliveryMethod,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("personalized-scores error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
