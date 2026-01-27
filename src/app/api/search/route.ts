import { NextRequest, NextResponse } from "next/server";
import { readMetadataIndex, readTranscript, readReport } from "@/lib/data/store";
import type { SearchResult } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase();
  const region = searchParams.get("region");
  const solution = searchParams.get("solution");
  const npsCategory = searchParams.get("npsCategory");

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const index = await readMetadataIndex();
  let interviews = index.interviews;

  if (region) interviews = interviews.filter((i) => i.region === region);
  if (solution) interviews = interviews.filter((i) => i.solution === solution);
  if (npsCategory)
    interviews = interviews.filter((i) => i.npsCategory === npsCategory);

  const results: SearchResult[] = [];

  for (const meta of interviews) {
    const matches: { text: string; section: string }[] = [];

    if (meta.hasReport) {
      const report = await readReport(meta.id);
      if (report) {
        const sections = [
          { name: "Overview", items: [report.overview] },
          { name: "What Went Well", items: report.whatWentWell },
          { name: "Challenges", items: report.challengesPainPoints },
          { name: "Gaps", items: report.gapsIdentified },
          { name: "Key Themes", items: report.keyThemes },
          { name: "Actions", items: report.actionsRecommendations },
          { name: "Additional Insight", items: [report.additionalInsight] },
        ];

        for (const section of sections) {
          for (const item of section.items) {
            if (item.toLowerCase().includes(query)) {
              matches.push({ text: item, section: section.name });
            }
          }
        }
      }
    }

    if (meta.hasTranscript) {
      const transcript = await readTranscript(meta.id);
      if (transcript && transcript.rawText.toLowerCase().includes(query)) {
        // Find matching segments
        const lines = transcript.rawText.split("\n");
        for (const line of lines) {
          if (line.toLowerCase().includes(query) && line.trim().length > 20) {
            matches.push({ text: line.trim(), section: "Transcript" });
            if (matches.filter((m) => m.section === "Transcript").length >= 3)
              break;
          }
        }
      }
    }

    if (matches.length > 0) {
      results.push({
        interviewId: meta.id,
        client: meta.client,
        company: meta.company,
        score: meta.score,
        npsCategory: meta.npsCategory,
        matches,
      });
    }
  }

  return NextResponse.json({ results });
}
