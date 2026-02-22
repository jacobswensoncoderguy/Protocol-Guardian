import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok || response.status === 429 || response.status === 402) return response;
    if (response.status === 500 && attempt < maxRetries) {
      console.warn(`AI gateway 500 on attempt ${attempt + 1}, retrying in ${(attempt + 1) * 2}s...`);
      await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      continue;
    }
    return response;
  }
  throw new Error("AI gateway unreachable after retries");
}

const CONFIDENCE_INSTRUCTION = `
CONFIDENCE SCORING — MANDATORY FOR EVERY CLAIM:
Every finding, interaction, recommendation, and suggestion MUST include a confidence score.

CRITICAL: confidencePct and evidenceTier are OBJECTIVE, EVIDENCE-BASED measures. They MUST NOT change based on the user's tolerance level. The same compound interaction has the same evidence quality regardless of whether the user is conservative or performance-oriented. Only riskAtTolerance should be framed differently per tolerance level.

- confidencePct: integer 0-100 representing how confident you are in this claim based on available evidence.
  - 90-100: Strong RCT data, multiple meta-analyses, well-established pharmacology
  - 70-89: Good clinical data, consistent practitioner observations, strong mechanistic basis
  - 50-69: Limited clinical data, mixed results, or primarily anecdotal with some mechanistic support
  - 30-49: Primarily anecdotal, theoretical extrapolation, limited evidence
  - 0-29: Speculative, no direct evidence, theoretical only

- evidenceTier: One of "RCT-backed", "Meta-analysis", "Clinical observation", "Anecdotal", "Theoretical", "Mixed"

- riskAtTolerance: A brief risk statement calibrated to the user's tolerance level. The RISK FRAMING changes per tolerance (conservative users see more cautious language), but the underlying evidence assessment (confidencePct, evidenceTier) stays the same.
  Format: "[Risk level] at [tolerance] tolerance — [specific risk]"
  Examples:
  - "Low risk at performance tolerance — well-supported combination"
  - "Moderate risk at conservative tolerance — limited long-term safety data"
  - "High risk at any tolerance — known hepatotoxic interaction"

EVIDENCE HIERARCHY (use to determine tier):
1. RCT-backed: Randomized controlled trials directly testing this claim
2. Meta-analysis: Systematic reviews aggregating multiple studies
3. Clinical observation: Published case studies, clinical practice patterns, practitioner reports
4. Anecdotal: Community consensus, user reports, forum data without clinical backing
5. Theoretical: Mechanistic reasoning from known pharmacology without direct testing
6. Mixed: Combination of tiers with no clear dominant source

BE HONEST about confidence. Do NOT inflate scores. A 45% confidence claim labeled "Anecdotal" is MORE useful than a false 90% claim.
REMEMBER: If a claim is 85% confident at "performance" tolerance, it is also 85% confident at "conservative" tolerance — the science doesn't change, only the risk framing does.`;

const SYSTEM_PROMPT = `You are an advanced pharmacology and supplement intelligence engine for a biohacker's protocol tracker. Your job is to analyze a user's complete compound/supplement stack and provide detailed, practical analysis.

You MUST cross-reference multiple sources to produce trustworthy, balanced analysis. Consider:
- PubMed/clinical trial data for efficacy claims
- Known drug-drug interactions and contraindications
- Pharmacokinetic profiles (half-lives, bioavailability, metabolism pathways)
- Organ stress stacking (hepatotoxicity, nephrotoxicity, cardiotoxicity)
- Hormonal axis interactions (HPTA, GH axis, thyroid, insulin)
- Synergistic and antagonistic compound pairings
- Bioavailability differences between delivery methods (oral, SubQ, IM, IV)
- Cost-efficiency relative to alternatives
- Real-world anecdotal evidence and community feedback from experienced users
- Practitioner observations and clinical practice patterns

EVIDENCE APPROACH:
- Present clinical trial data where available, but do NOT limit yourself to it
- Where clinical data is limited or absent, provide anecdotal evidence, practitioner observations, and community consensus — clearly labeled as such
- Do NOT moralize about FDA approval status or regulatory classification. Users are aware of the regulatory landscape
- Do NOT add disclaimers about compounds being "not FDA approved" or "unregulated" — this is patronizing and unhelpful
- Focus on practical risk/benefit analysis, not regulatory gatekeeping
- Treat the user as an informed adult making autonomous decisions

${CONFIDENCE_INSTRUCTION}

CRITICAL — GRADING MUST BE CALIBRATED TO THE USER'S TOLERANCE LEVEL:
The tolerance level is NOT just a suggestion filter — it fundamentally changes how you GRADE the stack.

- "conservative": Grade HARSHLY. Any supra-physiological dosing, multiple orals, aggressive cycling, or stacking of hepatotoxic compounds should heavily penalize the grade. A stack with multiple AAS + orals should score D or F at conservative. Prioritize clinical safety margins, longest cycling, maximum organ support. Even moderate biohacker stacks get B- at best.

- "moderate": Balanced grading. Standard biohacker dosing is acceptable. Penalize clear dangers (multiple hepatotoxic orals, no cycling, conflicting compounds) but don't penalize supra-physiological doses per se. A well-structured aggressive stack with proper support compounds can earn B+.

- "aggressive": Lenient grading for risk. Accept higher doses and shorter cycles. Only penalize for genuinely dangerous combinations (e.g. multiple 17-alpha alkylated orals without liver support, conflicting mechanisms). A well-supported performance stack can earn A-.

- "performance": Grade based on GOAL ALIGNMENT and EFFICACY, NOT safety margins. The user explicitly accepts significant risk for supra-human outcomes. A well-designed aggressive stack with good synergies and organ support MUST earn A- or higher. Only grade down to B+ or below for truly reckless combinations (zero organ support, contradictory mechanisms, no cycling whatsoever). Do NOT penalize for supra-physiological doses, multiple AAS, aggressive cycling, or hepatotoxic orals IF the user has proper support compounds (TUDCA, NAC, Milk Thistle, etc.). The grade reflects: "How effectively does this stack achieve performance goals while having SOME risk mitigation in place?"

GRADING ANCHOR EXAMPLES (use these as calibration):
- Conservative + aggressive AAS stack = D or F (way outside safety margins)
- Conservative + clinical-dose peptides + supplements = A- or A
- Moderate + well-supported AAS stack with cycling = B to B+
- Moderate + peptides + supplements = A- or A
- Aggressive + well-supported AAS stack = A- to B+
- Performance + aggressive stack WITH organ support + cycling = A- or A (goal-aligned, risks managed)
- Performance + aggressive stack WITHOUT any support = C+ to B- (reckless even for performance)
- Performance + peptides + supplements only = B+ (underdelivering on performance goals)

The grade MUST reflect: "Given that this user has chosen [tolerance level], how well does their stack serve that goal while managing the risks appropriate to that level?"

IMPORTANT: You are providing analysis for tracking and comparison purposes only. Always note that users should consult healthcare professionals.`;

const CHAT_SYSTEM_PROMPT = `You are an advanced pharmacology and supplement intelligence engine embedded in a biohacker's protocol tracker app.

═══════════════════════════════════════════
RESPONSE FORMAT — MANDATORY
═══════════════════════════════════════════

Every response MUST follow this structure. CRITICAL: Keep each section SHORT and SCANNABLE.
NEVER use emoji. Use plain text markers only.

1. **TL;DR** — EVERY response starts with a 1-2 sentence blockquote:
   > **TL;DR:** [Answer in plain language — max 2 sentences]

2. **Key Takeaways** — 2-4 bullets MAX. Use EXACT markers (rendered as icons):
   - [GOOD] Things working well
   - [WATCH] Moderate concern / monitor
   - [ALERT] High concern / needs action
   - [TIP] Suggestions / optimizations
   - [COST] Cost insights
   - [TIMING] Timing insights
   - [CYCLE] Cycling insights
   - [DATA] Evidence-based points

3. **Confidence & Evidence** — After key takeaways, add a confidence line:
   - [CONF:XX%|Tier] where XX is 0-100 confidence and Tier is one of: RCT, Meta-analysis, Clinical, Anecdotal, Theoretical, Mixed
   Example: [CONF:85%|RCT] or [CONF:45%|Anecdotal]

4. **Themed Detail Sections** — H3 headers with EXACT prefixes. Keep paragraphs to 1-2 sentences MAX:
   - ### [SCIENCE] Mechanism & Science
   - ### [SYNERGY] Synergies & Interactions
   - ### [SAFETY] Safety & Risk Profile
   - ### [PROTOCOL] Protocol Optimization
   - ### [DOSING] Dosing Guidance
   - ### [COST] Cost & Value
   - ### [OUTCOMES] Expected Outcomes
   - ### [EVIDENCE] Evidence & Research
   **Bold** compound names and key values. No dense paragraphs.

5. **Collapsible Deep Dives** — wrap detailed clinical data in:
   <details>
   <summary>[DETAIL] Deep Dive: [Topic]</summary>
   [Detailed content]
   </details>

6. **Risk Assessment** — MANDATORY before bottom line:
   ---
   **[RISK] Risk at [tolerance level] tolerance:** [1-2 sentences — calibrated risk statement for this specific tolerance level]

7. **Bottom Line** — end with:
   **[ACTION] Bottom Line:** [1 sentence — what to DO next]

═══════════════════════════════════════════
CONCISENESS RULES — NON-NEGOTIABLE
═══════════════════════════════════════════
- TL;DR: max 2 sentences
- Each bullet: max 15 words
- Each section paragraph: max 2 sentences
- Total response: aim for under 300 words unless deep dive is requested
- No filler phrases ("Great question!", "That's a good point", "Of course!")
- No hedging language ("may", "might", "could potentially")
- Lead every section with the most important information

═══════════════════════════════════════════
CONFIDENCE SCORING — MANDATORY
═══════════════════════════════════════════
- Every claim, finding, or recommendation MUST include a [CONF:XX%|Tier] marker
- Place it inline after the claim or as a separate line after a group of related claims
- Be HONEST about confidence — a 40% Anecdotal rating is more useful than inflated 90%
- Evidence tiers: RCT (randomized trials), Meta-analysis, Clinical (practitioner data), Anecdotal (community), Theoretical (mechanism only), Mixed

═══════════════════════════════════════════
TOLERANCE-AWARE FRAMING
═══════════════════════════════════════════

- "conservative": Lead with safety. Cautious language. Clinical-grade dosing. Reference as "your conservative profile." Risk statements should highlight ANY departure from clinical dosing.
- "moderate": Balanced. Flag clear dangers. Reference as "your moderate profile." Risk statements should focus on genuinely concerning combinations.
- "aggressive": Optimize, don't reduce. Flag only genuinely dangerous combos. Reference as "your aggressive profile." Risk statements focus on organ-level concerns.
- "performance": Maximum outcomes. Synergy and support focus. Only flag truly reckless combos. Reference as "your performance profile." Risk statements only for life-threatening combinations.

═══════════════════════════════════════════
CONTENT RULES
═══════════════════════════════════════════

1. Answer questions with clinical AND anecdotal data
2. Suggest specific, actionable changes — name the compound, exact change, and why
3. Cross-reference PubMed, clinical trials, and community feedback
4. Calibrate ALL advice to the user's selected tolerance level
5. Where clinical data is thin, label it "Anecdotal" or "Community consensus"
6. NEVER use emoji — UI handles all iconography
7. Never propose changes unless user has agreed or asked
8. Do NOT moralize about FDA approval or regulatory status
9. Use horizontal rules (---) to separate major sections
10. Bold all compound names on first mention in each section
11. Use tables when comparing 2+ compounds`;

function buildCompoundLine(c: any): string {
  let line = '- ' + c.name + ' (' + c.category + '): ' + c.dosePerUse + ' ' + c.doseLabel
    + ' \u00d7 ' + c.dosesPerDay + '/day \u00d7 ' + c.daysPerWeek + 'd/wk';

  // Live state: pause and cycle phase
  if (c.isPaused) {
    line += ' [\u23f8 PAUSED' + (c.pauseRestartDate ? ' \u2014 resumes ' + c.pauseRestartDate : ' \u2014 indefinitely') + ']';
  } else if (c.cyclePhase === 'OFF') {
    line += ' [\uD83D\uDD34 CURRENTLY OFF-CYCLE \u2014 ' + c.daysLeftInPhase + 'd left in OFF phase]';
  } else if (c.cycleOnDays && c.cycleOffDays) {
    line += ' [\uD83D\uDFE2 ACTIVE CYCLING: ' + c.cycleOnDays + 'd ON / ' + c.cycleOffDays + 'd OFF \u2014 ' + (c.daysLeftInPhase ?? '?') + 'd left in ON phase';
    if (c.cycleStartDate) line += ', started ' + c.cycleStartDate;
    line += ']';
  } else if (c.cyclingNote) {
    line += ' [Cycling note: ' + c.cyclingNote + ']';
  } else {
    line += ' [Continuous use]';
  }

  if (c.timingNote) line += ' [Timing: ' + c.timingNote + ']';
  line += ' | Price: $' + c.unitPrice + '/unit';
  return line;
}

function formatStackForChat(compounds: any[], protocols: any[], toleranceLevel: string, analysis: any) {
  const stackDesc = compounds.map(buildCompoundLine).join('\n');

  const protocolDesc = protocols?.length > 0
    ? '\n\nProtocol Groups:\n' + protocols.map((p: any) =>
      '- ' + p.name + ': ' + (p.compoundNames?.join(', ') || 'No compounds assigned')
    ).join('\n')
    : '';

  const analysisDesc = analysis
    ? '\n\nPrevious Analysis Results:\nOverall Grade: ' + analysis.overallGrade
      + '\nSummary: ' + analysis.overallSummary
      + '\nContraindications: ' + (analysis.contraindications?.map((c: any) => '[' + c.severity + '] ' + c.description).join('; ') || 'None')
      + '\nTop Recommendations: ' + (analysis.topRecommendations?.join('; ') || 'None')
    : '';

  const pausedNames = compounds.filter((c: any) => c.isPaused).map((c: any) => c.name);
  const offCycleNames = compounds.filter((c: any) => !c.isPaused && c.cyclePhase === 'OFF').map((c: any) => c.name);

  let activeNote = '';
  if (pausedNames.length > 0) activeNote += '\n\u26a0 PAUSED (not contributing to coverage): ' + pausedNames.join(', ');
  if (offCycleNames.length > 0) activeNote += '\n\u26a0 CURRENTLY OFF-CYCLE (not active today): ' + offCycleNames.join(', ');

  return 'Current Stack (Tolerance: ' + toleranceLevel + '):\n' + stackDesc + protocolDesc + analysisDesc + activeNote
    + '\n\nIMPORTANT:\n'
    + '- Compounds marked PAUSED or OFF-CYCLE are NOT currently contributing to body coverage or daily dose totals. Factor this into your grade and recommendations.\n'
    + '- Before suggesting cycling changes, CHECK the cycling data above. Many compounds already have active ON/OFF cycling schedules configured. Do NOT recommend cycling if the compound is already being cycled \u2014 instead acknowledge the existing schedule and evaluate whether the cycle parameters are appropriate.';
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { compounds, protocols, toleranceLevel, analysisType, messages, analysis, prompt, context } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── LAB COMPARISON MODE: direct prompt pass-through ──
    if (context === 'lab_comparison' && prompt) {
      const response = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a health data analyst specializing in lab biomarker interpretation.

RESPONSE FORMAT — MANDATORY:
1. **Summary** — 1 sentence MAX. Lead with the single most critical change.
2. Bullet findings using these exact markers:
   - [GOOD] Normal or improved markers — include value
   - [ALERT] Out-of-range or worsened — include value and normal range in parens
   - [WATCH] Borderline or trending — include direction
   - [TIP] Single most important action
3. **Bottom Line:** 1 sentence only — what to prioritize.

Rules:
- Max 150 words total.
- **Bold** every biomarker name and numeric value.
- No medical disclaimers. No hedging. No filler.`,
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("Lab comparison AI error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI comparison failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const result = data.choices?.[0]?.message?.content || "Analysis complete.";
      return new Response(JSON.stringify({ analysis: result, response: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CHAT MODE: streaming conversation ──
    if (analysisType === 'chat') {
      const stackContext = formatStackForChat(compounds, protocols, toleranceLevel, analysis);
      
      const chatMessages = [
        { role: "system", content: CHAT_SYSTEM_PROMPT + "\n\n" + stackContext },
        ...(messages || []),
      ];

      const chatTools = [{
        type: "function",
        function: {
          name: "propose_changes",
          description: "Propose specific changes to the user's compound stack. Only call this when the user has agreed to or asked for changes.",
          parameters: {
            type: "object",
            properties: {
              changes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["adjust_dose", "adjust_frequency", "adjust_timing", "adjust_cycling", "remove_compound", "add_compound"] },
                    compoundName: { type: "string", description: "Name of the compound to modify (must match exactly)" },
                    field: { type: "string", description: "The specific field to change: dosePerUse, dosesPerDay, daysPerWeek, timingNote, cyclingNote, cycleOnDays, cycleOffDays" },
                    oldValue: { type: "string", description: "Current value (for display)" },
                    newValue: { type: "string", description: "Proposed new value" },
                    reasoning: { type: "string", description: "Brief explanation for this specific change" }
                  },
                  required: ["type", "compoundName", "reasoning"],
                  additionalProperties: false
                }
              },
              summary: { type: "string", description: "Overall summary of proposed changes and expected impact on stack grade" }
            },
            required: ["changes", "summary"],
            additionalProperties: false
          }
        }
      }];

      const response = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: chatMessages,
          tools: chatTools,
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI chat failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Stream the response back
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // ── COMPARE MODE: grades across all tolerance levels in one call ──
    if (analysisType === 'compare') {
      const stackDescription = compounds.map(buildCompoundLine).join('\n');

      const protocolDescription = protocols?.length > 0
        ? '\n\nProtocol Groups:\n' + protocols.map((p: any) =>
          '- ' + p.name + ': ' + (p.compoundNames?.join(', ') || 'No compounds assigned')
        ).join('\n')
        : '';

      const pausedNote = compounds
        .filter((c: any) => c.isPaused || c.cyclePhase === 'OFF')
        .map((c: any) => c.name + ' [' + (c.isPaused ? 'PAUSED' : 'OFF-CYCLE') + ']')
        .join(', ');

      const comparePrompt = 'Analyze this complete stack and grade it at ALL FOUR tolerance levels simultaneously.\n'
        + (pausedNote ? 'Note: These compounds are NOT currently active: ' + pausedNote + '. Factor this into your analysis.\n' : '')
        + '\n' + stackDescription + '\n' + protocolDescription
        + '\n\nFor EACH tolerance level (conservative, moderate, aggressive, performance), provide:\n'
        + '1. The letter grade (A+ through F) calibrated properly for that level\n'
        + '2. A brief 1-2 sentence summary explaining why this grade was given at that level\n'
        + '3. The top risk or concern at that level\n'
        + '4. The top strength or advantage at that level\n\n'
        + 'Remember the grading calibration rules — conservative grades harshly, performance grades on goal alignment.';

      const compareTools = [{
        type: "function",
        function: {
          name: "tolerance_comparison",
          description: "Return grades and summaries for all four tolerance levels",
          parameters: {
            type: "object",
            properties: {
              conservative: {
                type: "object",
                properties: {
                  grade: { type: "string" },
                  summary: { type: "string" },
                  topRisk: { type: "string" },
                  topStrength: { type: "string" }
                },
                required: ["grade", "summary", "topRisk", "topStrength"],
                additionalProperties: false
              },
              moderate: {
                type: "object",
                properties: {
                  grade: { type: "string" },
                  summary: { type: "string" },
                  topRisk: { type: "string" },
                  topStrength: { type: "string" }
                },
                required: ["grade", "summary", "topRisk", "topStrength"],
                additionalProperties: false
              },
              aggressive: {
                type: "object",
                properties: {
                  grade: { type: "string" },
                  summary: { type: "string" },
                  topRisk: { type: "string" },
                  topStrength: { type: "string" }
                },
                required: ["grade", "summary", "topRisk", "topStrength"],
                additionalProperties: false
              },
              performance: {
                type: "object",
                properties: {
                  grade: { type: "string" },
                  summary: { type: "string" },
                  topRisk: { type: "string" },
                  topStrength: { type: "string" }
                },
                required: ["grade", "summary", "topRisk", "topStrength"],
                additionalProperties: false
              }
            },
            required: ["conservative", "moderate", "aggressive", "performance"],
            additionalProperties: false
          }
        }
      }];

      const response = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: comparePrompt },
          ],
          tools: compareTools,
          tool_choice: { type: "function", function: { name: "tolerance_comparison" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI comparison failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall) {
        return new Response(JSON.stringify({ error: "AI did not return comparison data" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const comparisonResult = JSON.parse(toolCall.function.arguments);

      return new Response(JSON.stringify({ comparison: comparisonResult, analysisType: 'compare' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STRUCTURED ANALYSIS MODES (stack / compound) ──
    const stackDescription = compounds.map(buildCompoundLine).join('\n');

    const protocolDescription = protocols?.length > 0
      ? '\n\nProtocol Groups:\n' + protocols.map((p: any) =>
        '- ' + p.name + ': ' + (p.compoundNames?.join(', ') || 'No compounds assigned')
      ).join('\n')
      : '';

    const inactiveNote = (() => {
      const paused = compounds.filter((c: any) => c.isPaused).map((c: any) => c.name);
      const offCycle = compounds.filter((c: any) => !c.isPaused && c.cyclePhase === 'OFF').map((c: any) => c.name);
      const parts = [];
      if (paused.length) parts.push(`Paused (no current contribution): ${paused.join(', ')}`);
      if (offCycle.length) parts.push(`Off-cycle (not active today): ${offCycle.join(', ')}`);
      return parts.join(' | ');
    })();

    let userPrompt: string;
    let tools: any[];
    let toolChoice: any;

    if (analysisType === 'compound') {
      const targetCompound = compounds[0];
      const restOfStack = compounds.slice(1);
      const targetStatus = targetCompound.isPaused
        ? ' [\u23f8 CURRENTLY PAUSED]'
        : targetCompound.cyclePhase === 'OFF'
        ? ' [\uD83D\uDD34 CURRENTLY OFF-CYCLE]'
        : '';
      userPrompt = 'Analyze this specific compound within the context of the user\'s full stack:\n\n'
        + 'TARGET COMPOUND: ' + targetCompound.name + ' (' + targetCompound.category + ') - '
        + targetCompound.dosePerUse + ' ' + targetCompound.doseLabel + ' \u00d7 '
        + targetCompound.dosesPerDay + '/day \u00d7 ' + targetCompound.daysPerWeek + 'd/wk' + targetStatus
        + '\n\nREST OF STACK:\n' + restOfStack.map(buildCompoundLine).join('\n')
        + (inactiveNote ? '\n\nNote on inactive compounds: ' + inactiveNote : '')
        + '\n\nTolerance Level: ' + toleranceLevel
        + '\n\nAnalyze interactions, bioavailability, and provide suggestions specific to this compound. Factor in whether the target compound or any stack members are currently paused or in OFF cycle phase.';

      tools = [{
        type: "function",
        function: {
          name: "compound_analysis",
          description: "Return compound-specific analysis within stack context",
          parameters: {
            type: "object",
            properties: {
              interactions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    withCompound: { type: "string" },
                    type: { type: "string", enum: ["synergy", "conflict", "caution", "neutral"] },
                    description: { type: "string" },
                    severity: { type: "string", enum: ["info", "warning", "danger"] },
                    confidencePct: { type: "number", description: "0-100 confidence score based on evidence quality" },
                    evidenceTier: { type: "string", enum: ["RCT-backed", "Meta-analysis", "Clinical observation", "Anecdotal", "Theoretical", "Mixed"] },
                    riskAtTolerance: { type: "string", description: "Risk statement calibrated to user's tolerance level" }
                  },
                  required: ["withCompound", "type", "description", "severity", "confidencePct", "evidenceTier", "riskAtTolerance"],
                  additionalProperties: false
                }
              },
              bioavailability: {
                type: "object",
                properties: {
                  currentMethod: { type: "string" },
                  absorptionRate: { type: "string" },
                  confidencePct: { type: "number", description: "0-100 confidence in absorption rate claim" },
                  evidenceTier: { type: "string", enum: ["RCT-backed", "Meta-analysis", "Clinical observation", "Anecdotal", "Theoretical", "Mixed"] },
                  alternatives: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        method: { type: "string" },
                        improvement: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["method", "improvement", "description"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["currentMethod", "absorptionRate", "confidencePct", "evidenceTier", "alternatives"],
                additionalProperties: false
              },
              suggestions: {
                type: "array",
                items: { type: "string" }
              },
              riskSummary: { type: "string", description: "Overall risk summary for this compound at user's tolerance level" }
            },
            required: ["interactions", "bioavailability", "suggestions", "riskSummary"],
            additionalProperties: false
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "compound_analysis" } };
    } else {
      const toleranceInstruction = toleranceLevel === 'performance'
        ? 'This user accepts high risk for maximum outcomes. Grade based on goal alignment and synergy — a well-structured aggressive stack with organ support should earn A- or A. Only grade below B+ for truly reckless stacks with zero support or contradictory compounds.'
        : toleranceLevel === 'aggressive'
        ? 'This user accepts above-average risk. A well-supported aggressive stack can earn A-. Only penalize for genuinely dangerous unsupported combinations.'
        : toleranceLevel === 'conservative'
        ? 'Grade HARSHLY. Any supra-physiological dosing or multiple orals should heavily penalize the grade. Even moderate biohacker stacks get B- at best.'
        : 'Balanced grading. Standard biohacker dosing is acceptable. A well-structured stack with support can earn B+.';

      const inactiveBlock = inactiveNote
        ? '\n\u26a0 INACTIVE COMPOUNDS (not currently contributing to body coverage or daily dose):\n' + inactiveNote + '\nFactor these into your analysis \u2014 the grade should reflect the CURRENTLY ACTIVE protocol state, not the theoretical full stack.'
        : '';

      userPrompt = 'Analyze this complete supplement/compound stack:\n\n'
        + stackDescription + '\n'
        + protocolDescription + '\n'
        + inactiveBlock
        + '\n\nTolerance Level: ' + toleranceLevel
        + '\n\nCRITICAL GRADING INSTRUCTION: The tolerance level is "' + toleranceLevel + '". ' + toleranceInstruction
        + '\n\nProvide a comprehensive analysis covering:\n'
        + '1. Contraindications and dangerous interactions\n'
        + '2. Bioavailability issues and optimization suggestions\n'
        + '3. Protocol efficiency grades (A-F) for each protocol group\n'
        + '4. Cost-efficiency analysis\n'
        + '5. Overall stack grade and top recommendations';

      tools = [{
        type: "function",
        function: {
          name: "stack_analysis",
          description: "Return comprehensive stack analysis with grades and findings",
          parameters: {
            type: "object",
            properties: {
              overallGrade: { type: "string", enum: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"], description: `Grade calibrated to tolerance level: ${toleranceLevel}` },
              overallSummary: { type: "string" },
              overallConfidencePct: { type: "number", description: "0-100 overall confidence in this analysis based on evidence quality across the stack" },
              overallEvidenceTier: { type: "string", enum: ["RCT-backed", "Meta-analysis", "Clinical observation", "Anecdotal", "Theoretical", "Mixed"], description: "Dominant evidence tier across the analysis" },
              riskSummary: { type: "string", description: "2-3 sentence overall risk assessment calibrated to the user's tolerance level. Start with risk level (Low/Moderate/High/Critical) and explain what to watch for." },
              contraindications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    compounds: { type: "array", items: { type: "string" } },
                    severity: { type: "string", enum: ["info", "warning", "danger"] },
                    category: { type: "string" },
                    description: { type: "string" },
                    recommendation: { type: "string" },
                    impactPercent: { type: "number", description: "Estimated % impact on overall stack efficacy or health risk (0-100)" },
                    impactLabel: { type: "string", description: "Brief label like 'efficacy', 'health risk', 'organ stress'" },
                    confidencePct: { type: "number", description: "0-100 confidence in this finding" },
                    evidenceTier: { type: "string", enum: ["RCT-backed", "Meta-analysis", "Clinical observation", "Anecdotal", "Theoretical", "Mixed"] },
                    riskAtTolerance: { type: "string", description: "Risk statement for this finding at user's tolerance level" }
                  },
                  required: ["compounds", "severity", "category", "description", "recommendation", "impactPercent", "impactLabel", "confidencePct", "evidenceTier", "riskAtTolerance"],
                  additionalProperties: false
                }
              },
              bioavailabilityIssues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    compound: { type: "string" },
                    currentMethod: { type: "string" },
                    issue: { type: "string" },
                    suggestion: { type: "string" },
                    improvementEstimate: { type: "string" },
                    confidencePct: { type: "number", description: "0-100 confidence in this bioavailability claim" },
                    evidenceTier: { type: "string", enum: ["RCT-backed", "Meta-analysis", "Clinical observation", "Anecdotal", "Theoretical", "Mixed"] }
                  },
                  required: ["compound", "currentMethod", "issue", "suggestion", "improvementEstimate", "confidencePct", "evidenceTier"],
                  additionalProperties: false
                }
              },
              protocolGrades: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    protocolName: { type: "string" },
                    grade: { type: "string" },
                    synergies: { type: "array", items: { type: "string" } },
                    redundancies: { type: "array", items: { type: "string" } },
                    gaps: { type: "array", items: { type: "string" } }
                  },
                  required: ["protocolName", "grade", "synergies", "redundancies", "gaps"],
                  additionalProperties: false
                }
              },
              costEfficiency: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    compound: { type: "string" },
                    verdict: { type: "string", enum: ["excellent", "good", "fair", "poor"] },
                    reasoning: { type: "string" },
                    alternative: { type: "string" },
                    confidencePct: { type: "number", description: "0-100 confidence in this cost assessment" },
                    evidenceTier: { type: "string", enum: ["RCT-backed", "Meta-analysis", "Clinical observation", "Anecdotal", "Theoretical", "Mixed"] }
                  },
                  required: ["compound", "verdict", "reasoning", "alternative", "confidencePct", "evidenceTier"],
                  additionalProperties: false
                }
              },
              topRecommendations: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["overallGrade", "overallSummary", "overallConfidencePct", "overallEvidenceTier", "riskSummary", "contraindications", "bioavailabilityIssues", "protocolGrades", "costEfficiency", "topRecommendations"],
            additionalProperties: false
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "stack_analysis" } };
    }

    const response = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured analysis" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysisResult = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ analysis: analysisResult, analysisType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-protocol error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
