/**
 * Batch Transcript Import Script
 *
 * Imports transcript PDFs from data/transcripts/ and correlates them
 * with existing report-based interviews.
 *
 * Run with: npx tsx scripts/ingest-transcripts.ts
 *
 * What it does:
 * 1. Reads all transcript PDFs from data/transcripts/
 * 2. For each transcript, extracts the code (T1, T10, etc.)
 * 3. Finds matching interview by report code (T1 -> R1, T10 -> R10)
 * 4. Parses the transcript PDF content
 * 5. Creates/updates normalized transcript JSON in data/store/transcripts/
 * 6. Copies original PDF to data/store/originals/
 * 7. Updates metadata index with transcript fields
 */
import { promises as fs } from "fs";
import path from "path";
import {
  parseTranscriptFilename,
  parseTranscriptPdfBuffer,
  getTranscriptNumber,
} from "../src/lib/data/transcript-parser";
import type { InterviewMetadata, NormalizedTranscript, MetadataIndex } from "../src/types";

const PROJECT_ROOT = process.cwd();
const STORE_ROOT = path.join(PROJECT_ROOT, "data", "store");
const TRANSCRIPT_SOURCE_DIR = path.join(PROJECT_ROOT, "data", "transcripts");

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Find an interview by its report code (R1, R2, etc.)
 * by looking at the originalPdfFile field.
 */
function findInterviewByReportCode(
  interviews: InterviewMetadata[],
  reportCode: string
): InterviewMetadata | undefined {
  // Pattern: "originals/R1_NPS6_EMEA_ES_HOUSE_SEP25.pdf"
  const pattern = new RegExp(`originals/${reportCode}_`);
  return interviews.find(
    (interview) =>
      interview.originalPdfFile && pattern.test(interview.originalPdfFile)
  );
}

async function ingestTranscripts(): Promise<void> {
  console.log("=== Transcript Import ===\n");

  // Ensure output directories exist
  await ensureDir(path.join(STORE_ROOT, "originals"));
  await ensureDir(path.join(STORE_ROOT, "transcripts"));
  await ensureDir(path.join(STORE_ROOT, "metadata"));

  // Read existing metadata index
  const metadataPath = path.join(STORE_ROOT, "metadata", "index.json");
  const metadataIndex = await readJSON<MetadataIndex>(metadataPath);
  if (!metadataIndex) {
    console.error("Error: Could not read metadata index");
    process.exit(1);
  }

  console.log(`Loaded ${metadataIndex.interviews.length} interviews from index\n`);

  // List all transcript PDF files
  const allFiles = await fs.readdir(TRANSCRIPT_SOURCE_DIR);
  const transcriptFiles = allFiles
    .filter((f) => f.endsWith(".pdf") && f.startsWith("T"))
    .sort((a, b) => {
      // Sort by T-number
      const numA = parseInt(a.match(/^T(\d+)/)?.[1] || "0");
      const numB = parseInt(b.match(/^T(\d+)/)?.[1] || "0");
      return numA - numB;
    });

  console.log(`Found ${transcriptFiles.length} transcript PDFs in ${TRANSCRIPT_SOURCE_DIR}\n`);

  const results: Array<{
    filename: string;
    transcriptCode: string;
    matchedId: string | null;
    client: string;
    status: string;
  }> = [];

  let matched = 0;
  let notFound = 0;
  let alreadyHasTranscript = 0;

  for (const filename of transcriptFiles) {
    try {
      // 1. Parse filename metadata
      const filenameMeta = parseTranscriptFilename(filename);
      const transcriptCode = filenameMeta.transcriptCode; // "T1", "T10", etc.
      const transcriptNum = getTranscriptNumber(transcriptCode); // 1, 10, etc.
      const reportCode = `R${transcriptNum}`; // "R1", "R10", etc.

      // 2. Find matching interview by report code
      const interview = findInterviewByReportCode(
        metadataIndex.interviews,
        reportCode
      );

      if (!interview) {
        console.log(`  [SKIP] ${filename} - No matching interview for ${reportCode}`);
        results.push({
          filename,
          transcriptCode,
          matchedId: null,
          client: "N/A",
          status: "NO_MATCH",
        });
        notFound++;
        continue;
      }

      // Check if already has transcript
      if (interview.hasTranscript && interview.transcriptFile) {
        console.log(
          `  [SKIP] ${filename} - Interview ${interview.id} already has transcript`
        );
        results.push({
          filename,
          transcriptCode,
          matchedId: interview.id,
          client: interview.client,
          status: "ALREADY_HAS_TRANSCRIPT",
        });
        alreadyHasTranscript++;
        continue;
      }

      // 3. Read and parse transcript PDF
      const pdfPath = path.join(TRANSCRIPT_SOURCE_DIR, filename);
      const pdfBuffer = await fs.readFile(pdfPath);
      const parsed = await parseTranscriptPdfBuffer(pdfBuffer);

      // 4. Copy original transcript PDF to store
      const destFilename = `T${transcriptNum}_${filename.split("_").slice(1).join("_")}`;
      const destPath = path.join(STORE_ROOT, "originals", filename);
      await fs.copyFile(pdfPath, destPath);

      // 5. Build normalized transcript
      const normalizedTranscript: NormalizedTranscript = {
        id: interview.id,
        sourceFile: filename,
        client: parsed.clientName,
        interviewDate: parsed.interviewDate,
        project: parsed.project,
        score: parsed.score,
        overview: "", // Transcripts don't have a structured overview section
        sections: [], // No structured sections
        fullTranscript: parsed.fullTranscript,
        rawText: parsed.rawText,
      };

      // 6. Save transcript JSON
      const transcriptFilePath = path.join(
        STORE_ROOT,
        "transcripts",
        `${interview.id}.json`
      );
      await writeJSON(transcriptFilePath, normalizedTranscript);

      // 7. Update metadata entry
      interview.hasTranscript = true;
      interview.transcriptFile = `transcripts/${interview.id}.json`;
      interview.transcriptCode = transcriptCode;
      interview.originalTranscriptFile = `originals/${filename}`;
      interview.dataStatus = "complete";
      interview.updatedAt = new Date().toISOString();

      // Also update reportCode if not set
      if (!interview.reportCode && interview.originalPdfFile) {
        const reportMatch = interview.originalPdfFile.match(/originals\/(R\d+)_/);
        if (reportMatch) {
          interview.reportCode = reportMatch[1];
        }
      }
      // Update originalReportFile if needed
      if (interview.originalPdfFile && !interview.originalReportFile) {
        interview.originalReportFile = interview.originalPdfFile;
      }

      matched++;
      console.log(
        `  [OK] ${filename} -> ${interview.id} (${interview.client}, ${interview.company})`
      );
      results.push({
        filename,
        transcriptCode,
        matchedId: interview.id,
        client: interview.client,
        status: "OK",
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`  [FAIL] ${filename}: ${errMsg}`);
      results.push({
        filename,
        transcriptCode: filename.split("_")[0],
        matchedId: null,
        client: "ERROR",
        status: `FAILED: ${errMsg}`,
      });
    }
  }

  // Update reportCode for all interviews that have originalPdfFile but not reportCode
  for (const interview of metadataIndex.interviews) {
    if (interview.originalPdfFile && !interview.reportCode) {
      const reportMatch = interview.originalPdfFile.match(/originals\/(R\d+)_/);
      if (reportMatch) {
        interview.reportCode = reportMatch[1];
      }
    }
    // Set dataStatus based on hasTranscript and hasReport
    if (!interview.dataStatus) {
      if (interview.hasTranscript && interview.hasReport) {
        interview.dataStatus = "complete";
      } else if (interview.hasTranscript) {
        interview.dataStatus = "transcript_only";
      } else if (interview.hasReport) {
        interview.dataStatus = "report_only";
      }
    }
  }

  // Save updated metadata index
  metadataIndex.lastUpdated = new Date().toISOString();
  await writeJSON(metadataPath, metadataIndex);

  // Print summary
  console.log("\n=== Import Summary ===");
  console.log(`Total transcript PDFs: ${transcriptFiles.length}`);
  console.log(`Successfully matched: ${matched}`);
  console.log(`No matching interview: ${notFound}`);
  console.log(`Already had transcript: ${alreadyHasTranscript}`);
  console.log(`Failed: ${results.filter((r) => r.status.startsWith("FAILED")).length}`);

  // Count interviews with transcripts
  const withTranscripts = metadataIndex.interviews.filter((i) => i.hasTranscript).length;
  const withReports = metadataIndex.interviews.filter((i) => i.hasReport).length;
  const complete = metadataIndex.interviews.filter(
    (i) => i.hasTranscript && i.hasReport
  ).length;

  console.log(`\nTotal interviews: ${metadataIndex.interviews.length}`);
  console.log(`With transcripts: ${withTranscripts}`);
  console.log(`With reports: ${withReports}`);
  console.log(`Complete (both): ${complete}`);

  // Print table of matched transcripts
  const successful = results.filter((r) => r.status === "OK");
  if (successful.length > 0) {
    console.log("\n=== Matched Transcripts ===");
    console.log("Transcript | Interview | Client");
    console.log("-----------+-----------+------------------------");
    for (const r of successful) {
      console.log(
        `${r.transcriptCode.padEnd(10)} | ${(r.matchedId || "").padEnd(9)} | ${r.client}`
      );
    }
  }

  // List unmatched
  const unmatched = results.filter((r) => r.status === "NO_MATCH");
  if (unmatched.length > 0) {
    console.log("\n=== Unmatched Transcripts ===");
    for (const r of unmatched) {
      console.log(`  ${r.transcriptCode} (${r.filename})`);
    }
  }
}

ingestTranscripts().catch(console.error);
