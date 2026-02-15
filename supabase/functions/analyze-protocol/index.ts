import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

const CHAT_SYSTEM_PROMPT = `You are an advanced pharmacology and supplement intelligence engine embedded in a biohacker's protocol tracker app. You have deep knowledge of pharmacology, peptide therapy, hormone optimization, and supplement science.

The user is discussing their compound stack with you based on an AI analysis that was already performed.

═══════════════════════════════════════════
RESPONSE FORMAT — MANDATORY STRUCTURE
═══════════════════════════════════════════

Every response MUST follow this structure for maximum readability on mobile screens.
CRITICAL: Do NOT use emoji anywhere in your responses. Use plain text markers instead.

1. **TL;DR** — Start EVERY response with a brief 1-3 sentence synopsis using a blockquote:
   > **TL;DR:** [Concise answer/summary in plain language]

2. **Key Takeaways** — Immediately after TL;DR, list 2-4 bullet points of the most important actionable insights. Use these EXACT text markers at the start of each bullet (they will be rendered as styled icons in the UI):
   - [GOOD] Things that are good / working well
   - [WATCH] Things to monitor / moderate concern
   - [ALERT] Things that need attention / high concern
   - [TIP] Suggestions / optimizations
   - [COST] Cost-related insights
   - [TIMING] Timing-related insights
   - [CYCLE] Cycling-related insights
   - [DATA] Data/evidence-based points

3. **Themed Detail Sections** — Use H3 headers (###) with these EXACT text prefixes to group related information. The UI will render appropriate icons automatically:
   - ### [SCIENCE] Mechanism & Science
   - ### [SYNERGY] Synergies & Interactions
   - ### [SAFETY] Safety & Risk Profile
   - ### [PROTOCOL] Protocol Optimization
   - ### [DOSING] Dosing Guidance
   - ### [COST] Cost & Value
   - ### [OUTCOMES] Expected Outcomes
   - ### [EVIDENCE] Evidence & Research

   Keep paragraphs SHORT (2-3 sentences max). Use bold for compound names and key terms.

4. **Collapsible Deep Dives** — For detailed clinical data, mechanism explanations, or study references that most users won't need, wrap them in HTML details tags:
   <details>
   <summary>[DETAIL] Deep Dive: [Topic]</summary>

   [Detailed content here with full clinical references, mechanism pathways, study data, etc.]

   </details>

5. **Bottom Line** — End substantive responses with a clear action-oriented conclusion:
   ---
   **[ACTION] Bottom Line:** [1-2 sentences summarizing what the user should DO next]

═══════════════════════════════════════════
TOLERANCE-AWARE FRAMING
═══════════════════════════════════════════

ALWAYS frame advice through the lens of the user's tolerance level. Include a subtle indicator:

- At "conservative": Lead with safety. Use cautious language. Recommend clinical-grade dosing. Flag anything supra-physiological. Frame optimizations as risk reduction. Reference as "your conservative profile."
- At "moderate": Balanced advice. Flag clear dangers but accept standard biohacker approaches. Frame optimizations as efficiency gains. Reference as "your moderate profile."
- At "aggressive": Accept higher risk. Focus on optimizing rather than reducing. Frame advice as performance enhancement. Only flag genuinely dangerous combinations. Reference as "your aggressive profile."
- At "performance": The user wants maximum outcomes. Focus on synergy optimization, proper support compounds, and cycling — NOT on reducing doses. Frame everything through the lens of goal achievement. Only flag truly reckless combinations. Reference as "your performance profile."

═══════════════════════════════════════════
CONTENT RULES
═══════════════════════════════════════════

Your role is to:
1. Answer questions about findings, explain reasoning with clinical AND anecdotal data
2. Suggest specific, actionable changes to improve the stack grade
3. When recommending changes, be SPECIFIC: name the compound, the exact change (dose adjustment, removal, addition, timing change), and why
4. Cross-reference PubMed, clinical trials, practitioner experience, and community feedback
5. Calibrate ALL advice and grading to the user's selected tolerance level
6. Where clinical data is thin, say so and offer anecdotal/practitioner evidence clearly labeled

When you want to suggest concrete changes to the user's stack, describe them clearly in your message. When the user agrees to a change, use the propose_changes tool to formally propose the modifications.

IMPORTANT RULES:
- NEVER use emoji or emoticons — the UI handles all iconography
- Never propose changes unless the user has agreed or asked for them
- Always explain the reasoning and expected impact before proposing
- Be conversational and helpful, not just transactional
- Do NOT moralize about FDA approval, regulatory status, or legality — the user is an informed adult
- Do NOT add disclaimers like "this compound is not FDA approved" — focus on practical pharmacology
- Where clinical evidence is limited, provide anecdotal feedback, practitioner observations, and community consensus, clearly labeled as "Anecdotal" or "Community consensus"
- You are providing analysis for tracking and comparison purposes only
- Always remind users to consult healthcare professionals for medical decisions
- Use horizontal rules (---) to visually separate major sections
- Keep individual paragraphs to 2-3 sentences for mobile readability
- Bold all compound names on first mention in each section
- Use tables when comparing 2+ compounds or options side-by-side`;

function formatStackForChat(compounds: any[], protocols: any[], toleranceLevel: string, analysis: any) {
  const stackDesc = compounds.map((c: any) => {
    let line = `- ${c.name} (${c.category}): ${c.dosePerUse} ${c.doseLabel} × ${c.dosesPerDay}/day × ${c.daysPerWeek}d/wk`;
    if (c.cycleOnDays && c.cycleOffDays) {
      line += ` [ACTIVE CYCLING: ${c.cycleOnDays} days ON / ${c.cycleOffDays} days OFF`;
      if (c.cycleStartDate) line += `, started ${c.cycleStartDate}`;
      line += `]`;
    } else if (c.cyclingNote) {
      line += ` [Cycling note: ${c.cyclingNote}]`;
    } else {
      line += ` [No cycling configured — continuous use]`;
    }
    if (c.timingNote) line += ` [Timing: ${c.timingNote}]`;
    line += ` | Price: $${c.unitPrice}/unit`;
    return line;
  }).join('\n');

  const protocolDesc = protocols?.length > 0
    ? '\n\nProtocol Groups:\n' + protocols.map((p: any) =>
      `- ${p.name}: ${p.compoundNames?.join(', ') || 'No compounds assigned'}`
    ).join('\n')
    : '';

  const analysisDesc = analysis ? `\n\nPrevious Analysis Results:
Overall Grade: ${analysis.overallGrade}
Summary: ${analysis.overallSummary}
Contraindications: ${analysis.contraindications?.map((c: any) => `[${c.severity}] ${c.description}`).join('; ') || 'None'}
Top Recommendations: ${analysis.topRecommendations?.join('; ') || 'None'}` : '';

  return `Current Stack (Tolerance: ${toleranceLevel}):\n${stackDesc}${protocolDesc}${analysisDesc}\n\nIMPORTANT: Before suggesting cycling changes, CHECK the cycling data above. Many compounds already have active ON/OFF cycling schedules configured. Do NOT recommend cycling if the compound is already being cycled — instead acknowledge the existing schedule and evaluate whether the cycle parameters are appropriate.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { compounds, protocols, toleranceLevel, analysisType, messages, analysis } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
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
      const stackDescription = compounds.map((c: any) => {
        let line = `- ${c.name} (${c.category}): ${c.dosePerUse} ${c.doseLabel} × ${c.dosesPerDay}/day × ${c.daysPerWeek}d/wk`;
        if (c.cycleOnDays && c.cycleOffDays) {
          line += ` [ACTIVE CYCLING: ${c.cycleOnDays}d ON / ${c.cycleOffDays}d OFF]`;
        } else if (c.cyclingNote) {
          line += ` [Cycling: ${c.cyclingNote}]`;
        }
        if (c.timingNote) line += ` [Timing: ${c.timingNote}]`;
        line += ` | Price: $${c.unitPrice}/unit`;
        return line;
      }).join('\n');

      const protocolDescription = protocols?.length > 0
        ? '\n\nProtocol Groups:\n' + protocols.map((p: any) =>
          `- ${p.name}: ${p.compoundNames?.join(', ') || 'No compounds assigned'}`
        ).join('\n')
        : '';

      const comparePrompt = `Analyze this complete stack and grade it at ALL FOUR tolerance levels simultaneously:

${stackDescription}
${protocolDescription}

For EACH tolerance level (conservative, moderate, aggressive, performance), provide:
1. The letter grade (A+ through F) calibrated properly for that level
2. A brief 1-2 sentence summary explaining why this grade was given at that level
3. The top risk or concern at that level
4. The top strength or advantage at that level

Remember the grading calibration rules — conservative grades harshly, performance grades on goal alignment.`;

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

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
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
    const stackDescription = compounds.map((c: any) => {
      let line = `- ${c.name} (${c.category}): ${c.dosePerUse} ${c.doseLabel} × ${c.dosesPerDay}/day × ${c.daysPerWeek}d/wk`;
      if (c.cycleOnDays && c.cycleOffDays) {
        line += ` [ACTIVE CYCLING: ${c.cycleOnDays}d ON / ${c.cycleOffDays}d OFF]`;
      } else if (c.cyclingNote) {
        line += ` [Cycling: ${c.cyclingNote}]`;
      }
      if (c.timingNote) line += ` [Timing: ${c.timingNote}]`;
      line += ` | Price: $${c.unitPrice}/unit`;
      return line;
    }).join('\n');

    const protocolDescription = protocols?.length > 0
      ? '\n\nProtocol Groups:\n' + protocols.map((p: any) =>
        `- ${p.name}: ${p.compoundNames?.join(', ') || 'No compounds assigned'}`
      ).join('\n')
      : '';

    let userPrompt: string;
    let tools: any[];
    let toolChoice: any;

    if (analysisType === 'compound') {
      const targetCompound = compounds[0];
      const restOfStack = compounds.slice(1);
      userPrompt = `Analyze this specific compound within the context of the user's full stack:

TARGET COMPOUND: ${targetCompound.name} (${targetCompound.category}) - ${targetCompound.dosePerUse} ${targetCompound.doseLabel} × ${targetCompound.dosesPerDay}/day × ${targetCompound.daysPerWeek}d/wk

REST OF STACK:
${restOfStack.map((c: any) => `- ${c.name} (${c.category}): ${c.dosePerUse} ${c.doseLabel}`).join('\n')}

Tolerance Level: ${toleranceLevel}

Analyze interactions, bioavailability, and provide suggestions specific to this compound.`;

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
                    severity: { type: "string", enum: ["info", "warning", "danger"] }
                  },
                  required: ["withCompound", "type", "description", "severity"],
                  additionalProperties: false
                }
              },
              bioavailability: {
                type: "object",
                properties: {
                  currentMethod: { type: "string" },
                  absorptionRate: { type: "string" },
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
                required: ["currentMethod", "absorptionRate", "alternatives"],
                additionalProperties: false
              },
              suggestions: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["interactions", "bioavailability", "suggestions"],
            additionalProperties: false
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "compound_analysis" } };
    } else {
      userPrompt = `Analyze this complete supplement/compound stack:

${stackDescription}
${protocolDescription}

Tolerance Level: ${toleranceLevel}

CRITICAL GRADING INSTRUCTION: The tolerance level is "${toleranceLevel}". ${
  toleranceLevel === 'performance' 
    ? 'This user accepts high risk for maximum outcomes. Grade based on goal alignment and synergy — a well-structured aggressive stack with organ support should earn A- or A. Only grade below B+ for truly reckless stacks with zero support or contradictory compounds.'
    : toleranceLevel === 'aggressive'
    ? 'This user accepts above-average risk. A well-supported aggressive stack can earn A-. Only penalize for genuinely dangerous unsupported combinations.'
    : toleranceLevel === 'conservative'
    ? 'Grade HARSHLY. Any supra-physiological dosing or multiple orals should heavily penalize the grade. Even moderate biohacker stacks get B- at best.'
    : 'Balanced grading. Standard biohacker dosing is acceptable. A well-structured stack with support can earn B+.'
}

Provide a comprehensive analysis covering:
1. Contraindications and dangerous interactions
2. Bioavailability issues and optimization suggestions
3. Protocol efficiency grades (A-F) for each protocol group
4. Cost-efficiency analysis
5. Overall stack grade and top recommendations`;

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
                    impactLabel: { type: "string", description: "Brief label like 'efficacy', 'health risk', 'organ stress'" }
                  },
                  required: ["compounds", "severity", "category", "description", "recommendation", "impactPercent", "impactLabel"],
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
                    improvementEstimate: { type: "string" }
                  },
                  required: ["compound", "currentMethod", "issue", "suggestion", "improvementEstimate"],
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
                    alternative: { type: "string" }
                  },
                  required: ["compound", "verdict", "reasoning", "alternative"],
                  additionalProperties: false
                }
              },
              topRecommendations: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["overallGrade", "overallSummary", "contraindications", "bioavailabilityIssues", "protocolGrades", "costEfficiency", "topRecommendations"],
            additionalProperties: false
          }
        }
      }];
      toolChoice = { type: "function", function: { name: "stack_analysis" } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
