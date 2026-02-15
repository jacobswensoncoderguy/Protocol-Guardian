import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an advanced pharmacology and supplement intelligence engine for a biohacker's protocol tracker. Your job is to analyze a user's complete compound/supplement stack and provide detailed, evidence-based analysis.

You MUST cross-reference multiple pharmacological sources and clinical data to produce trustworthy analysis. Consider:
- PubMed/clinical trial data for efficacy claims
- Known drug-drug interactions and contraindications
- Pharmacokinetic profiles (half-lives, bioavailability, metabolism pathways)
- Organ stress stacking (hepatotoxicity, nephrotoxicity, cardiotoxicity)
- Hormonal axis interactions (HPTA, GH axis, thyroid, insulin)
- Synergistic and antagonistic compound pairings
- Bioavailability differences between delivery methods (oral, SubQ, IM, IV)
- Cost-efficiency relative to alternatives

The user will specify a TOLERANCE LEVEL that affects your dosing recommendations and risk assessment:
- "conservative": Minimize risk, clinical-grade dosing, longest cycling, most organ support
- "moderate": Balanced risk/reward, standard biohacker dosing
- "aggressive": Short-term maximum effect, accept higher risk, shorter cycles
- "performance": Supra-physiological outcomes, maximum potency, for experienced users only

IMPORTANT: You are providing analysis for tracking and comparison purposes only. Always note that users should consult healthcare professionals.`;

const CHAT_SYSTEM_PROMPT = `You are an advanced pharmacology and supplement intelligence engine embedded in a biohacker's protocol tracker app. You have deep knowledge of pharmacology, peptide therapy, hormone optimization, and supplement science.

The user is discussing their compound stack with you based on an AI analysis that was already performed. Your role is to:
1. Answer questions about findings, explain reasoning with clinical data
2. Suggest specific, actionable changes to improve the stack grade
3. When recommending changes, be SPECIFIC: name the compound, the exact change (dose adjustment, removal, addition, timing change), and why
4. Cross-reference PubMed, clinical trials, and pharmacological databases for trustworthy advice
5. Consider the user's tolerance level when making recommendations

When you want to suggest concrete changes to the user's stack, describe them clearly in your message. When the user agrees to a change, use the propose_changes tool to formally propose the modifications. The user can then accept or reject each change in the app UI.

IMPORTANT RULES:
- Never propose changes unless the user has agreed or asked for them
- Always explain the reasoning and expected impact before proposing
- Be conversational and helpful, not just transactional
- You are providing analysis for tracking and comparison purposes only
- Always remind users to consult healthcare professionals for medical decisions`;

function formatStackForChat(compounds: any[], protocols: any[], toleranceLevel: string, analysis: any) {
  const stackDesc = compounds.map((c: any) =>
    `- ${c.name} (${c.category}): ${c.dosePerUse} ${c.doseLabel} × ${c.dosesPerDay}/day × ${c.daysPerWeek}d/wk${c.cyclingNote ? ` [Cycling: ${c.cyclingNote}]` : ''}${c.timingNote ? ` [Timing: ${c.timingNote}]` : ''} | Price: $${c.unitPrice}/unit`
  ).join('\n');

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

  return `Current Stack (Tolerance: ${toleranceLevel}):\n${stackDesc}${protocolDesc}${analysisDesc}`;
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

    // ── STRUCTURED ANALYSIS MODES (stack / compound) ──
    const stackDescription = compounds.map((c: any) =>
      `- ${c.name} (${c.category}): ${c.dosePerUse} ${c.doseLabel} × ${c.dosesPerDay}/day × ${c.daysPerWeek}d/wk${c.cyclingNote ? ` [Cycling: ${c.cyclingNote}]` : ''}${c.timingNote ? ` [Timing: ${c.timingNote}]` : ''} | Price: $${c.unitPrice}/unit`
    ).join('\n');

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
              overallGrade: { type: "string", enum: ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"] },
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
                    recommendation: { type: "string" }
                  },
                  required: ["compounds", "severity", "category", "description", "recommendation"],
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
