import { NextResponse } from "next/server";
import { buildEmbeddingIndex } from "@/lib/ai/embeddings";
import { generateThemeAnalysis, generateOpportunityAnalysis } from "@/lib/ai/analysis";
import { syncVectorStore } from "@/lib/ai/vector-store";

// Reindex can take 1–2 minutes (embeddings + vector store + AI analysis)
export const maxDuration = 120;

export async function POST() {
  const results: string[] = [];
  let allOk = true;

  try {
    // Build local embeddings (for search API if used elsewhere)
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

    // Sync OpenAI vector store (for Chat)
    try {
      const { vectorStoreId, fileCount } = await syncVectorStore();
      results.push(
        `Vector store: synced (${fileCount} file(s)); Chat ready (Responses API + file_search)`
      );
    } catch (error) {
      allOk = false;
      const msg = error instanceof Error ? error.message : String(error);
      results.push(`Vector store: Failed - ${msg}`);
    }

    // Generate theme and opportunity analysis in parallel (independent steps)
    const [themesResult, oppsResult] = await Promise.allSettled([
      generateThemeAnalysis(),
      generateOpportunityAnalysis(),
    ]);

    try {
      if (themesResult.status === "fulfilled") {
        const themes = themesResult.value;
        const totalThemes =
          themes.whyClientsChoose.themes.length +
          themes.promoterExperience.themes.length +
          themes.whereFallsShort.themes.length;
        results.push(`Themes: ${totalThemes} themes identified`);
      } else {
        allOk = false;
        const msg =
          themesResult.reason instanceof Error
            ? themesResult.reason.message
            : String(themesResult.reason);
        results.push(`Themes: Failed - ${msg}`);
      }
    } catch (error) {
      allOk = false;
      const msg = error instanceof Error ? error.message : String(error);
      results.push(`Themes: Failed - ${msg}`);
    }

    try {
      if (oppsResult.status === "fulfilled") {
        const opps = oppsResult.value;
        results.push(
          `Opportunities: ${opps.opportunities.length} opportunities identified`
        );
      } else {
        allOk = false;
        const msg =
          oppsResult.reason instanceof Error
            ? oppsResult.reason.message
            : String(oppsResult.reason);
        results.push(`Opportunities: Failed - ${msg}`);
      }
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
