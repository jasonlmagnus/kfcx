/**
 * Reindex script: builds embeddings, syncs OpenAI vector store, generates themes and opportunities.
 * Writes OPENAI_VECTOR_STORE_ID to .env.local when created.
 *
 * Run from project root: npm run reindex
 * Requires OPENAI_API_KEY in .env.local (or env).
 */
import { promises as fs } from "fs";
import path from "path";

const PROJECT_ROOT = process.cwd();
const ENV_LOCAL = path.join(PROJECT_ROOT, ".env.local");

async function loadEnvLocal(): Promise<void> {
  try {
    const content = await fs.readFile(ENV_LOCAL, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        process.env[key] = value.slice(1, -1).replace(/\\n/g, "\n");
      } else {
        process.env[key] = value;
      }
    }
    console.log("Loaded .env.local");
  } catch {
    console.warn(".env.local not found; using existing env.");
  }
}

async function main(): Promise<void> {
  await loadEnvLocal();

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Add it to .env.local and run again.");
    process.exit(1);
  }

  const { buildEmbeddingIndex } = await import("../src/lib/ai/embeddings");
  const { syncVectorStore } = await import("../src/lib/ai/vector-store");
  const { generateThemeAnalysis, generateOpportunityAnalysis } = await import("../src/lib/ai/analysis");

  console.log("Building embedding index...");
  const embeddingIndex = await buildEmbeddingIndex();
  console.log(`  Embeddings: ${embeddingIndex.chunks.length} chunks indexed`);

  console.log("Syncing OpenAI vector store...");
  const { vectorStoreId, fileCount } = await syncVectorStore();
  console.log(`  Vector store: ${vectorStoreId} (${fileCount} file(s)); Chat will use Responses API + file_search`);
  console.log("  OPENAI_VECTOR_STORE_ID written to .env.local");

  console.log("Generating theme and opportunity analysis (in parallel)...");
  const [themes, opps] = await Promise.all([
    generateThemeAnalysis(),
    generateOpportunityAnalysis(),
  ]);
  const totalThemes =
    themes.whyClientsChoose.themes.length +
    themes.promoterExperience.themes.length +
    themes.whereFallsShort.themes.length +
    (themes.additionalThemes?.reduce((s, g) => s + g.themes.length, 0) ?? 0);
  console.log(`  Themes: ${totalThemes} identified`);
  console.log(`  Opportunities: ${opps.opportunities.length} identified`);

  console.log("Reindex complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
