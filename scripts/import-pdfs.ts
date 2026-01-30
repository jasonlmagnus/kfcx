/**
 * Bulk PDF Import Script
 *
 * Imports 43 coded PDF reports from the OneDrive data directory into
 * the platform's data store.
 *
 * Run with: npx tsx scripts/import-pdfs.ts
 *
 * What it does:
 * 1. Reads all PDF files from the source directory
 * 2. Copies each PDF to data/store/originals/
 * 3. Parses filename metadata (score, region, solution, accountType, monthYear)
 * 4. Parses PDF text (client, company, date, report sections)
 * 5. Creates normalized report JSONs in data/store/reports/
 * 6. Updates data/store/metadata/index.json with new entries
 */
import { promises as fs } from "fs";
import path from "path";
import {
  parseFilenameMetadata,
  parsePdfBuffer,
} from "../src/lib/data/pdf-parser";

const PROJECT_ROOT = process.cwd();
const STORE_ROOT = path.join(PROJECT_ROOT, "data", "store");
const PDF_SOURCE_DIR =
  "/Users/jasonryan/Library/CloudStorage/OneDrive-TheMagnusClub/Documents/kfcx/data/reports";

function getNPSCategory(
  score: number
): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function importPdfs(): Promise<void> {
  console.log("=== PDF Report Import ===\n");

  // Ensure output directories exist
  await ensureDir(path.join(STORE_ROOT, "originals"));
  await ensureDir(path.join(STORE_ROOT, "reports"));
  await ensureDir(path.join(STORE_ROOT, "metadata"));

  // Read existing metadata index
  const metadataPath = path.join(STORE_ROOT, "metadata", "index.json");
  let metadataIndex: {
    version: number;
    lastUpdated: string;
    interviews: any[];
  };
  try {
    const raw = await fs.readFile(metadataPath, "utf-8");
    metadataIndex = JSON.parse(raw);
  } catch {
    metadataIndex = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      interviews: [],
    };
  }

  // Get current max interview ID
  const existingMaxId = metadataIndex.interviews.reduce((max, item) => {
    const num = parseInt(item.id.replace("t-", ""));
    return num > max ? num : max;
  }, 0);

  // List all PDF files
  const allFiles = await fs.readdir(PDF_SOURCE_DIR);
  const pdfFiles = allFiles
    .filter((f) => f.endsWith(".pdf") && f.startsWith("R"))
    .sort((a, b) => {
      // Sort by R-number
      const numA = parseInt(a.match(/^R(\d+)/)?.[1] || "0");
      const numB = parseInt(b.match(/^R(\d+)/)?.[1] || "0");
      return numA - numB;
    });

  console.log(`Found ${pdfFiles.length} PDF reports in ${PDF_SOURCE_DIR}\n`);

  const results: Array<{
    filename: string;
    id: string;
    client: string;
    company: string;
    score: number;
    region: string;
    solution: string;
    status: string;
  }> = [];

  let nextIdNum = existingMaxId + 1;

  for (const filename of pdfFiles) {
    const id = `t-${String(nextIdNum).padStart(3, "0")}`;

    try {
      // 1. Parse filename metadata
      const filenameMeta = parseFilenameMetadata(filename);

      // 2. Read and parse PDF
      const pdfPath = path.join(PDF_SOURCE_DIR, filename);
      const pdfBuffer = await fs.readFile(pdfPath);
      const parsed = await parsePdfBuffer(pdfBuffer);

      // 3. Copy original PDF to store
      const destPath = path.join(STORE_ROOT, "originals", filename);
      await fs.copyFile(pdfPath, destPath);

      // 4. Determine interview date
      // Prefer PDF-parsed date, fall back to first day of filename month
      let interviewDate = parsed.interviewDate;
      if (!interviewDate) {
        interviewDate = `${filenameMeta.monthYear}-01`;
      }

      // 5. Build normalized report
      const report = {
        id,
        client: parsed.client || "Unknown",
        interviewDate,
        project: parsed.engagement || filenameMeta.solution,
        score: filenameMeta.score,
        overview: parsed.overview,
        whatWentWell: parsed.whatWentWell,
        challengesPainPoints: parsed.challengesPainPoints,
        gapsIdentified: parsed.gapsIdentified,
        keyThemes: parsed.keyThemes,
        actionsRecommendations: parsed.actionsRecommendations,
        additionalInsight: parsed.additionalInsight,
      };

      // 6. Save report JSON
      await fs.writeFile(
        path.join(STORE_ROOT, "reports", `${id}.json`),
        JSON.stringify(report, null, 2),
        "utf-8"
      );

      // 7. Create metadata entry
      const now = new Date().toISOString();
      const metadata = {
        id,
        interviewId: nextIdNum,
        client: parsed.client || "Unknown",
        company: parsed.company || "Unknown",
        interviewDate,
        score: filenameMeta.score,
        npsCategory: getNPSCategory(filenameMeta.score),
        region: filenameMeta.region,
        solution: filenameMeta.solution,
        accountType: filenameMeta.accountType,
        monthYear: filenameMeta.monthYear,
        hasTranscript: false,
        hasReport: true,
        transcriptFile: "",
        reportFile: `reports/${id}.json`,
        originalPdfFile: `originals/${filename}`,
        createdAt: now,
        updatedAt: now,
      };

      metadataIndex.interviews.push(metadata);

      results.push({
        filename,
        id,
        client: parsed.client || "Unknown",
        company: parsed.company || "Unknown",
        score: filenameMeta.score,
        region: filenameMeta.region,
        solution: filenameMeta.solution,
        status: "OK",
      });

      console.log(
        `  [${id}] ${filename} -> ${parsed.client}, ${parsed.company} (NPS ${filenameMeta.score})`
      );

      nextIdNum++;
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : String(error);
      console.error(`  [FAIL] ${filename}: ${errMsg}`);
      results.push({
        filename,
        id,
        client: "ERROR",
        company: "",
        score: 0,
        region: "",
        solution: "",
        status: `FAILED: ${errMsg}`,
      });
      nextIdNum++;
    }
  }

  // Save updated metadata index
  metadataIndex.lastUpdated = new Date().toISOString();
  await fs.writeFile(metadataPath, JSON.stringify(metadataIndex, null, 2), "utf-8");

  // Print summary
  const successful = results.filter((r) => r.status === "OK");
  const failed = results.filter((r) => r.status !== "OK");

  console.log("\n=== Import Summary ===");
  console.log(`Total PDFs: ${pdfFiles.length}`);
  console.log(`Imported: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(
    `Total interviews in index: ${metadataIndex.interviews.length}`
  );

  if (failed.length > 0) {
    console.log("\nFailed imports:");
    for (const f of failed) {
      console.log(`  ${f.filename}: ${f.status}`);
    }
  }

  // Print table of all imported interviews
  console.log("\n=== Imported Interviews ===");
  console.log(
    "ID       | Score | Region | Solution           | Account   | Client                    | Company"
  );
  console.log(
    "---------+-------+--------+--------------------+-----------+---------------------------+----------------------------"
  );
  for (const r of successful) {
    const id = r.id.padEnd(8);
    const score = String(r.score).padEnd(5);
    const region = r.region.padEnd(6);
    const solution = r.solution.padEnd(18);
    const client = r.client.substring(0, 25).padEnd(25);
    const company = r.company.substring(0, 28);
    const acct = results.find((x) => x.id === r.id)
      ? ""
      : "";
    console.log(
      `${id} | ${score} | ${region} | ${solution} | ${acct.padEnd(9)} | ${client} | ${company}`
    );
  }
}

importPdfs().catch(console.error);
