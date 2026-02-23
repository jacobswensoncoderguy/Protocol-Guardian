import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Build a deterministic cache key from all inputs that affect scoring */
function buildCacheKey(parts: Record<string, unknown>): string {
  const sorted = JSON.stringify(parts, Object.keys(parts).sort());
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) - hash + sorted.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

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

    const { compoundName, category, dosePerUse, dosesPerDay, daysPerWeek, unitLabel, doseLabel, forceRefresh } = await req.json();
    if (!compoundName) throw new Error("compoundName is required");

    // ── 1. Fetch user profile ──
    const { data: profile } = await supabase
      .from("profiles")
      .select("gender, weight_kg, height_cm, body_fat_pct, age, measurement_system")
      .eq("user_id", user.id)
      .single();

    // ── 2. Fetch recent lab biomarkers (90 days) ──
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const { data: labUploads } = await supabase
      .from("user_goal_uploads")
      .select("ai_extracted_data, reading_date, upload_type")
      .eq("user_id", user.id)
      .gte("reading_date", ninetyDaysAgo)
      .order("reading_date", { ascending: false })
      .limit(10);

    const recentBiomarkers: { name: string; value: number; unit: string; status: string; date: string }[] = [];
    if (labUploads) {
      for (const upload of labUploads) {
        const extracted = upload.ai_extracted_data as any;
        if (extracted?.biomarkers) {
          for (const b of extracted.biomarkers) {
            recentBiomarkers.push({
              name: b.name, value: b.value, unit: b.unit,
              status: b.status || "normal", date: upload.reading_date || "",
            });
          }
        }
      }
    }

    // ── 3. Fetch active stack ──
    const { data: stack } = await supabase
      .from("user_compounds")
      .select("name, category, dose_per_use, doses_per_day, days_per_week, dose_label, unit_label, paused_at")
      .eq("user_id", user.id)
      .is("paused_at", null);

    const activeStack = (stack || []).filter(c => c.name !== compoundName).map(c => ({
      name: c.name, category: c.category,
      dose: `${c.dose_per_use} ${c.dose_label}`,
      frequency: `${c.doses_per_day}x/day, ${c.days_per_week}d/week`,
    }));

    // ── 4. Build cache key from ALL scoring inputs ──
    const cacheKey = buildCacheKey({
      compoundName, category,
      dosePerUse: dosePerUse || 0,
      dosesPerDay: dosesPerDay || 1,
      daysPerWeek: daysPerWeek || 7,
      gender: profile?.gender, age: profile?.age,
      weight: profile?.weight_kg, height: profile?.height_cm,
      bf: profile?.body_fat_pct,
      labHash: recentBiomarkers.map(b => `${b.name}:${b.value}`).join(","),
      stackHash: activeStack.map(c => c.name).sort().join(","),
    });

    // ── 5. Check cache (skip if forceRefresh) ──
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("personalized_score_cache")
        .select("scores, context, created_at, cache_key")
        .eq("user_id", user.id)
        .eq("compound_name", compoundName)
        .single();

      if (cached && cached.cache_key === cacheKey) {
        return new Response(JSON.stringify({
          personalized: cached.scores,
          context: cached.context,
          cached: true,
          cachedAt: cached.created_at,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── 6. Cache miss or stale — compute via AI ──
    const cat = (category || "").toLowerCase();
    const deliveryMethod = (cat === "peptide") ? "SubQ Injection" :
      (cat === "injectable-oil" || cat === "oil" || cat.includes("inject")) ? "IM Injection" :
      (cat === "powder") ? "Oral (Powder)" : "Oral";

    // Reconstitution context for peptides
    const isPeptideCat = cat === "peptide";
    const reconContext = isPeptideCat
      ? `\nRECONSTITUTION RULES (CRITICAL — use these for all potency calculations):
- Standard peptide reconstitution: 200 IU (2mL) of bacteriostatic water per vial.
- EXCEPTION: Tesamorelin uses 300 IU (3mL) of bacteriostatic water per vial.
- The dose in IU is drawn from this reconstituted solution. Do NOT confuse mg content of the vial with the IU dosage.
- Example: A 10mg vial reconstituted with 200 IU bacstat water. If dose is 10 IU, that equals (10/200)*10mg = 0.5mg per injection.
- Always factor the vial's mg content and reconstitution volume when assessing dosage adequacy.`
      : "";

    const prompt = `You are a clinical pharmacology advisor computing PERSONALIZED compound scores.

COMPOUND: ${compoundName}
DELIVERY METHOD: ${deliveryMethod} (category: ${category})
CURRENT DOSAGE: ${dosePerUse} ${doseLabel || unitLabel} × ${dosesPerDay}x/day × ${daysPerWeek} days/week
${reconContext}

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
1. **Bioavailability (0-100%)**: Adjust for delivery method, user's body weight/composition, and any lab markers indicating absorption issues.
2. **Efficacy (0-100%)**: Adjust for whether the current dosage is in the therapeutic range for this user's weight/age/gender, whether lab biomarkers show the compound is actually working, and evidence quality.
3. **Effectiveness (0-100%)**: Real-world outcome combining bioavailability, efficacy, dosing adequacy, compliance factors, stack synergies or conflicts, and any lab-indicated contraindications.
4. **Evidence Tier**: One of: RCT, Meta, Clinical, Anecdotal, Theoretical, Mixed.
5. **Dosage Assessment**: Is the current dose optimal, subtherapeutic, or supratherapeutic for this user?
6. **Key Interactions**: Note any significant synergies or conflicts with other compounds in the stack.
7. **AI Confidence (0-100%)**: How confident are you in the ACCURACY of these scores? Factor in:
   - Data completeness: Does the user have labs, profile data, stack info? More data = higher confidence.
   - Evidence quality: RCT-backed compounds get higher confidence than anecdotal ones.
   - Specificity: Generic dosage ranges vs. well-studied exact dosages.
   - Compound research depth: Well-studied compounds (e.g. creatine, testosterone) get higher confidence than novel peptides.
   Score this honestly — if data is sparse, confidence should be low (40-60%). If data is rich and evidence is strong, confidence can be high (80-95%). Never output 100%.
8. **Evidence Sources**: Cite the specific types of evidence underpinning your scores. Be explicit about WHERE your knowledge comes from. Examples:
   - "Published RCTs in peer-reviewed journals (e.g., JAMA, NEJM, Lancet)"
   - "Meta-analyses from Cochrane reviews"
   - "Clinical pharmacology references (Goodman & Gilman's, FDA prescribing information)"
   - "Observational/cohort studies"
   - "Case reports and clinical observations"
   - "Manufacturer data / pharmacokinetic studies"
   - "Anecdotal community reports (no peer-reviewed data available)"
   List 2-4 most relevant source types for this specific compound. Be honest — if evidence is primarily anecdotal, say so.

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
  "interactions": "<1-2 sentences on key stack interactions or 'No significant interactions detected.'>",
  "confidencePct": <number 0-100>,
  "confidenceNote": "<1 sentence explaining what's driving the confidence level>",
  "evidenceSources": ["<source type 1>", "<source type 2>", "<up to 4 sources>"],
  "dataFactors": "<1-2 sentences: which user data (labs, profile, stack) was available vs missing and how that affected scoring accuracy>"
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
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let scores;
    try {
      scores = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI scores:", cleaned);
      throw new Error("Failed to parse AI response");
    }

    const contextData = {
      hasProfile: !!profile,
      hasLabs: recentBiomarkers.length > 0,
      labCount: recentBiomarkers.length,
      stackSize: activeStack.length,
      deliveryMethod,
    };

    // ── 7. Upsert cache ──
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    await adminClient
      .from("personalized_score_cache")
      .upsert({
        user_id: user.id,
        compound_name: compoundName,
        cache_key: cacheKey,
        scores,
        context: contextData,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
      }, { onConflict: "user_id,compound_name" });

    return new Response(JSON.stringify({
      personalized: scores,
      context: contextData,
      cached: false,
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
