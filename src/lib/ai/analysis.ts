import { getOpenAIClient } from "./openai";
import {
  readMetadataIndex,
  readReport,
  readTranscript,
  writeThemeAnalysis,
  writeOpportunities,
} from "@/lib/data/store";
import type {
  ThemeAnalysis,
  ThemeGroup,
  OpportunitiesAnalysis,
  Opportunity,
  InterviewMetadata,
  NormalizedReport,
  NormalizedTranscript,
} from "@/types";

interface InterviewData {
  metadata: InterviewMetadata;
  report: NormalizedReport | null;
  transcript: NormalizedTranscript | null;
}

async function loadAllInterviewData(): Promise<InterviewData[]> {
  const index = await readMetadataIndex();
  const data: InterviewData[] = [];

  for (const meta of index.interviews) {
    const report = meta.hasReport ? await readReport(meta.id) : null;
    const transcript = meta.hasTranscript
      ? await readTranscript(meta.id)
      : null;
    data.push({ metadata: meta, report, transcript });
  }

  return data;
}

function buildInterviewSummary(data: InterviewData): string {
  const parts: string[] = [];
  const m = data.metadata;
  parts.push(
    `## ${m.client}, ${m.company} (NPS: ${m.score}, ${m.npsCategory}, ${m.region}, ${m.solution})`
  );

  if (data.report) {
    const r = data.report;
    parts.push(`Overview: ${r.overview}`);
    if (r.whatWentWell.length > 0)
      parts.push(`What went well:\n- ${r.whatWentWell.join("\n- ")}`);
    if (r.challengesPainPoints.length > 0)
      parts.push(
        `Challenges/Pain Points:\n- ${r.challengesPainPoints.join("\n- ")}`
      );
    if (r.gapsIdentified.length > 0)
      parts.push(`Gaps Identified:\n- ${r.gapsIdentified.join("\n- ")}`);
    if (r.keyThemes.length > 0)
      parts.push(`Key Themes:\n- ${r.keyThemes.join("\n- ")}`);
    if (r.actionsRecommendations.length > 0)
      parts.push(
        `Actions & Recommendations:\n- ${r.actionsRecommendations.join("\n- ")}`
      );
    if (r.additionalInsight)
      parts.push(`Additional Insight: ${r.additionalInsight}`);
  }

  if (data.transcript && !data.report) {
    parts.push(`Transcript overview: ${data.transcript.overview}`);
  }

  return parts.join("\n\n");
}

export async function generateThemeAnalysis(): Promise<ThemeAnalysis> {
  const openai = getOpenAIClient();
  const interviews = await loadAllInterviewData();
  const corpus = interviews.map(buildInterviewSummary).join("\n\n---\n\n");
  const interviewIds = interviews.map((i) => i.metadata.id);

  const themePrompt = (focus: string, instruction: string) => `
You are analysing NPS interview data from Korn Ferry's Customer Centricity programme.

${instruction}

For each theme you identify, provide:
- label: A concise theme name (3-6 words)
- description: One sentence explaining the theme
- frequency: How many interviews reference this theme
- sentiment: "positive", "negative", or "neutral"
- supportingQuotes: Array of objects with:
  - text: A direct quote or close paraphrase from the interview data
  - interviewId: The interview ID (e.g. "t-001")
  - client: Client name
  - company: Company name
- interviewIds: Array of interview IDs that reference this theme

Interview Data:
${corpus}

Return your response as a JSON object with:
{
  "name": "${focus}",
  "description": "Brief description of this theme category",
  "themes": [array of theme objects as described above]
}

Return ONLY valid JSON, no markdown code fences or other formatting.`;

  // Generate three theme categories in parallel
  const [whyChooseRes, promoterRes, fallsShortRes] = await Promise.all([
    openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: themePrompt(
            "Why Clients Choose Korn Ferry",
            "Identify 4-6 themes that explain WHY clients choose Korn Ferry and what differentiates them from competitors. Focus on positive factors, competitive advantages, and selection criteria mentioned across interviews."
          ),
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: themePrompt(
            "The Promoter Experience",
            "Identify 4-6 themes that characterise what PROMOTERS (score 9-10) value most about working with Korn Ferry. Focus on what creates exceptional experiences and strong satisfaction."
          ),
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: themePrompt(
            "Where the Experience Falls Short",
            "Identify 4-6 themes about where Korn Ferry's experience FALLS SHORT. Focus on challenges, pain points, gaps, and areas for improvement mentioned across interviews, particularly by detractors and passives."
          ),
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  ]);

  const parseThemeGroup = (content: string): ThemeGroup => {
    try {
      const parsed = JSON.parse(content);
      return {
        name: parsed.name || "Unknown",
        description: parsed.description || "",
        themes: (parsed.themes || []).map(
          (t: Record<string, unknown>, idx: number) => ({
            id: `theme-${idx}`,
            label: t.label || "",
            description: t.description || "",
            frequency: t.frequency || 0,
            sentiment: t.sentiment || "neutral",
            supportingQuotes: Array.isArray(t.supportingQuotes)
              ? (t.supportingQuotes as Record<string, unknown>[]).map(
                  (q) => ({
                    text: q.text || "",
                    interviewId: q.interviewId || "",
                    client: q.client || "",
                    company: q.company || "",
                    region: "",
                    solution: "",
                    accountType: "",
                    npsCategory: "",
                    score: 0,
                  })
                )
              : [],
            interviewIds: Array.isArray(t.interviewIds) ? t.interviewIds : [],
          })
        ),
      };
    } catch {
      return { name: "Parse Error", description: "Could not parse theme data", themes: [] };
    }
  };

  const whyClientsChoose = parseThemeGroup(
    whyChooseRes.choices[0].message.content || "{}"
  );
  const promoterExperience = parseThemeGroup(
    promoterRes.choices[0].message.content || "{}"
  );
  const whereFallsShort = parseThemeGroup(
    fallsShortRes.choices[0].message.content || "{}"
  );

  // Assign unique IDs
  let themeIdx = 0;
  for (const group of [whyClientsChoose, promoterExperience, whereFallsShort]) {
    for (const theme of group.themes) {
      theme.id = `theme-${themeIdx++}`;
    }
  }

  // Build timeline data (simplified: count themes by month)
  const monthSet = new Set(interviews.map((i) => i.metadata.monthYear));
  const timelineData = Array.from(monthSet)
    .sort()
    .map((month) => ({
      month,
      themes: [] as { themeId: string; count: number }[],
    }));

  const analysis: ThemeAnalysis = {
    lastGenerated: new Date().toISOString(),
    generatedFrom: interviewIds,
    whyClientsChoose,
    promoterExperience,
    whereFallsShort,
    additionalThemes: [],
    timelineData,
  };

  await writeThemeAnalysis(analysis);
  return analysis;
}

const OPPORTUNITY_CONCURRENCY = 10;

async function analyzeOneInterview(
  openai: Awaited<ReturnType<typeof getOpenAIClient>>,
  data: InterviewData
): Promise<Omit<Opportunity, "id">[]> {
  const summary = buildInterviewSummary(data);
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `Analyse this NPS interview for opportunity- and action-oriented insights.

Identify any mentions of:
1. future_need - Services or support the client may need in future
2. expansion - Ways to deepen or expand the relationship
3. re_engagement - Signals that action should be taken to re-engage or strengthen the partnership
4. improvement - Specific actions that would improve the service

For each opportunity found, provide:
- type: one of "future_need", "expansion", "re_engagement", "improvement"
- title: Concise label (5-10 words)
- description: 1-2 sentences explaining the opportunity
- urgency: "high", "medium", or "low"
- supportingQuote: A direct quote or close paraphrase from the data
- suggestedAction: What Korn Ferry should do (1 sentence)

Interview data:
${summary}

Client: ${data.metadata.client}
Company: ${data.metadata.company}
Interview ID: ${data.metadata.id}

Return a JSON object: { "opportunities": [...] }
Return ONLY valid JSON.`,
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content || '{"opportunities":[]}';
  try {
    const parsed = JSON.parse(content);
    const opps = parsed.opportunities || [];
    return opps.map((opp: Record<string, unknown>) => ({
      type: (opp.type as Opportunity["type"]) || "improvement",
      title: (opp.title as string) || "",
      description: (opp.description as string) || "",
      urgency: (opp.urgency as Opportunity["urgency"]) || "medium",
      sourceInterviewId: data.metadata.id,
      client: data.metadata.client,
      company: data.metadata.company,
      supportingQuote: (opp.supportingQuote as string) || "",
      suggestedAction: (opp.suggestedAction as string) || "",
      status: "identified" as const,
    }));
  } catch {
    console.error(`Failed to parse opportunities for ${data.metadata.client}`);
    return [];
  }
}

export async function generateOpportunityAnalysis(): Promise<OpportunitiesAnalysis> {
  const openai = getOpenAIClient();
  const interviews = await loadAllInterviewData();

  const allOpportunities: Opportunity[] = [];
  let oppIdx = 0;

  // Process in parallel batches to respect rate limits but speed up (e.g. ~10 at a time)
  for (let i = 0; i < interviews.length; i += OPPORTUNITY_CONCURRENCY) {
    const chunk = interviews.slice(i, i + OPPORTUNITY_CONCURRENCY);
    const results = await Promise.all(
      chunk.map((data) => analyzeOneInterview(openai, data))
    );
    for (const opportunities of results) {
      for (const opp of opportunities) {
        allOpportunities.push({ ...opp, id: `opp-${oppIdx++}` });
      }
    }
  }

  const analysis: OpportunitiesAnalysis = {
    lastGenerated: new Date().toISOString(),
    opportunities: allOpportunities,
  };

  await writeOpportunities(analysis);
  return analysis;
}
