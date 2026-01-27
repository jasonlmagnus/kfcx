import { NextResponse } from "next/server";
import { buildEmbeddingIndex } from "@/lib/ai/embeddings";
import { generateThemeAnalysis, generateOpportunityAnalysis } from "@/lib/ai/analysis";

export async function POST() {
  try {
    const results: string[] = [];

    // Build embeddings
    try {
      const embeddingIndex = await buildEmbeddingIndex();
      results.push(
        `Embeddings: ${embeddingIndex.chunks.length} chunks indexed`
      );
    } catch (error) {
      results.push(`Embeddings: Failed - ${error}`);
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
      results.push(`Themes: Failed - ${error}`);
    }

    // Generate opportunity analysis
    try {
      const opps = await generateOpportunityAnalysis();
      results.push(
        `Opportunities: ${opps.opportunities.length} opportunities identified`
      );
    } catch (error) {
      results.push(`Opportunities: Failed - ${error}`);
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Reindex failed", details: String(error) },
      { status: 500 }
    );
  }
}
