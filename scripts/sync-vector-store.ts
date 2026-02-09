/**
 * Sync only the OpenAI vector store (one file per interview) for Responses API file_search.
 * Use after code changes to vector-store; skip full reindex.
 * Run: npx tsx scripts/sync-vector-store.ts
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
    console.warn(".env.local not found.");
  }
}

async function main(): Promise<void> {
  await loadEnvLocal();
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set. Add to .env.local");
    process.exit(1);
  }

  const { syncVectorStore } = await import("../src/lib/ai/vector-store");

  console.log("Syncing vector store (one file per interview)...");
  const { vectorStoreId, fileCount } = await syncVectorStore();
  console.log(`  Vector store: ${vectorStoreId} (${fileCount} files). Chat will use Responses API + file_search.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
