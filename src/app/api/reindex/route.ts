import { NextResponse } from "next/server";
import { buildEmbeddingIndex } from "@/lib/ai/embeddings";
import { generateThemeAnalysis, generateOpportunityAnalysis } from "@/lib/ai/analysis";

// Reindex can take 1–2 minutes (embeddings + AI analysis)
export const maxDuration = 120;

export async function POST() {
  const results: string[] = [];
  let allOk = true;

  try {
    // Build embeddings
    try {
      const embeddingIndex = await buildEmbeddingIndex();
      results.push(
        `Embeddings: ${embeddingIndex.chunks.length} chunks indexed`
      );
    } catch (error) {
      allOk = false;
      const msg = error instanceof Error ? error.message : String(error);
      results.push(`Embeddings: Failed - ${msg}`);
    }

    // Generate theme analysis
    try {
      const themes = await generateThemeAnalysis();
      const totalThemes =
        themes.whyClientsChoose.themes.length +
        themes.promoterExperience.themes.length +
        themes.whereFallsShort.themes.length;
      results.push(`Themes: ${totalThemes} themes identified`);
    } catch (error) {
      allOk = false;
      const msg = error instanceof Error ? error.message : String(error);
      results.push(`Themes: Failed - ${msg}`);
    }

    // Generate opportunity analysis
    try {
      const opps = await generateOpportunityAnalysis();
      results.push(
        `Opportunities: ${opps.opportunities.length} opportunities identified`
      );
    } catch (error) {
      allOk = false;
      const msg = error instanceof Error ? error.message : String(error);
      results.push(`Opportunities: Failed - ${msg}`);
    }

    if (!allOk) {
      return NextResponse.json(
        {
          success: false,
          error: "One or more steps failed. See details below.",
          results,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "Reindex failed", details: msg, results },
      { status: 500 }
    );
  }
}
