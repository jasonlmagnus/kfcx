/**
 * Trim store to 43 interviews: remove t-001 through t-005 (no reportCode;
 * they don’t match data/reports R1–R43). Keep t-006 through t-048 (R1–R43).
 *
 * Run: npx tsx scripts/trim-to-43.ts
 *
 * After running:
 * - data/store/metadata/index.json will have 43 interviews (t-006 … t-048) with R1–R43
 * - data/store/transcripts and reports will have 43 files (t-006 … t-048)
 *
 * Then run: npm run reindex  (to regenerate themes, opportunities, embeddings, vector store)
 */
import { promises as fs } from "fs";
import path from "path";

const PROJECT_ROOT = process.cwd();
const STORE_ROOT = path.join(PROJECT_ROOT, "data", "store");
const IDS_TO_REMOVE = ["t-001", "t-002", "t-003", "t-004", "t-005"];

async function main(): Promise<void> {
  console.log("=== Trim to 43 interviews ===\n");

  const indexPath = path.join(STORE_ROOT, "metadata", "index.json");
  const indexRaw = await fs.readFile(indexPath, "utf-8");
  const index = JSON.parse(indexRaw) as {
    version: number;
    lastUpdated: string;
    interviews: Array<{ id: string; [key: string]: unknown }>;
  };

  const before = index.interviews.length;
  index.interviews = index.interviews.filter(
    (i) => !IDS_TO_REMOVE.includes(i.id)
  );
  const after = index.interviews.length;

  if (after !== 43) {
    console.warn(
      `Expected 43 interviews after trim, got ${after}. Proceeding anyway.`
    );
  }

  index.lastUpdated = new Date().toISOString();
  await fs.writeFile(
    indexPath,
    JSON.stringify(index, null, 2),
    "utf-8"
  );
  console.log(`Index: removed ${before - after} interviews (${before} → ${after})`);

  const transcriptsDir = path.join(STORE_ROOT, "transcripts");
  const reportsDir = path.join(STORE_ROOT, "reports");

  for (const id of IDS_TO_REMOVE) {
    const transcriptPath = path.join(transcriptsDir, `${id}.json`);
    const reportPath = path.join(reportsDir, `${id}.json`);
    try {
      await fs.unlink(transcriptPath);
      console.log(`  Deleted ${transcriptPath}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        console.warn(`  Could not delete ${transcriptPath}:`, e);
    }
    try {
      await fs.unlink(reportPath);
      console.log(`  Deleted ${reportPath}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        console.warn(`  Could not delete ${reportPath}:`, e);
    }
  }

  console.log("\nDone. Run: npm run reindex");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
