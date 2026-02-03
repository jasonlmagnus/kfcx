/**
 * Cross-check R1–R43 and T1–T43 raw files against index/store.
 * Verifies that each raw report/transcript is correctly represented in the store
 * and that embeddings/data align (reportCode, transcriptCode, store files exist).
 *
 * Run: npx tsx scripts/verify-raw-vs-store.ts
 */
import { promises as fs } from "fs";
import path from "path";

const PROJECT_ROOT = process.cwd();
const DATA_REPORTS = path.join(PROJECT_ROOT, "data", "reports");
const DATA_TRANSCRIPTS = path.join(PROJECT_ROOT, "data", "transcripts");
const STORE_ROOT = path.join(PROJECT_ROOT, "data", "store");
const STORE_METADATA = path.join(STORE_ROOT, "metadata", "index.json");
const STORE_ORIGINALS = path.join(STORE_ROOT, "originals");
const STORE_TRANSCRIPTS = path.join(STORE_ROOT, "transcripts");
const STORE_REPORTS = path.join(STORE_ROOT, "reports");

interface InterviewMeta {
  id: string;
  reportCode?: string;
  originalReportFile?: string;
  transcriptCode?: string;
  originalTranscriptFile?: string;
  transcriptFile?: string;
  reportFile?: string;
  client?: string;
  company?: string;
}

function extractRCode(filename: string): string | null {
  const m = filename.match(/^R(\d+)_/);
  return m ? `R${m[1]}` : null;
}

function extractTCode(filename: string): string | null {
  const m = filename.match(/^T(\d+)_/);
  return m ? `T${m[1]}` : null;
}

async function main(): Promise<void> {
  console.log("=== Verify R1–R43 / T1–T43 vs store ===\n");

  const indexRaw = await fs.readFile(STORE_METADATA, "utf-8");
  const index = JSON.parse(indexRaw) as { interviews: InterviewMeta[] };
  const interviews = index.interviews;

  const reportFiles = (await fs.readdir(DATA_REPORTS)).filter(
    (f) => f.endsWith(".pdf") && f.startsWith("R")
  );
  const transcriptFiles = (await fs.readdir(DATA_TRANSCRIPTS)).filter(
    (f) => f.endsWith(".pdf") && f.startsWith("T")
  );

  const rawR = new Map<string, string>(); // R1 -> filename
  const rawT = new Map<string, string>(); // T1 -> filename
  reportFiles.forEach((f) => {
    const code = extractRCode(f);
    if (code) rawR.set(code, f);
  });
  transcriptFiles.forEach((f) => {
    const code = extractTCode(f);
    if (code) rawT.set(code, f);
  });

  const indexByReportCode = new Map<string, InterviewMeta[]>();
  const indexByTranscriptCode = new Map<string, InterviewMeta[]>();
  interviews.forEach((i) => {
    if (i.reportCode) {
      const list = indexByReportCode.get(i.reportCode) || [];
      list.push(i);
      indexByReportCode.set(i.reportCode, list);
    }
    if (i.transcriptCode) {
      const list = indexByTranscriptCode.get(i.transcriptCode) || [];
      list.push(i);
      indexByTranscriptCode.set(i.transcriptCode, list);
    }
  });

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1) Every raw R1–R43 should be in exactly one interview
  for (let n = 1; n <= 43; n++) {
    const code = `R${n}`;
    const rawFile = rawR.get(code);
    if (!rawFile) {
      warnings.push(`Raw: no file for ${code} in data/reports`);
      continue;
    }
    const list = indexByReportCode.get(code) || [];
    if (list.length === 0) {
      errors.push(`R: ${code} (${rawFile}) has no interview in index`);
    } else if (list.length > 1) {
      errors.push(
        `R: ${code} appears in ${list.length} interviews: ${list.map((i) => i.id).join(", ")}`
      );
    } else {
      const i = list[0];
      const expectedOrig = `originals/${rawFile}`;
      if (i.originalReportFile !== expectedOrig) {
        warnings.push(
          `R: ${code} interview ${i.id} has originalReportFile="${i.originalReportFile}" expected "${expectedOrig}"`
        );
      }
    }
  }

  // 2) Every raw T1–T43 should be in exactly one interview
  for (let n = 1; n <= 43; n++) {
    const code = `T${n}`;
    const rawFile = rawT.get(code);
    if (!rawFile) {
      warnings.push(`Raw: no file for ${code} in data/transcripts`);
      continue;
    }
    const list = indexByTranscriptCode.get(code) || [];
    if (list.length === 0) {
      errors.push(`T: ${code} (${rawFile}) has no interview in index`);
    } else if (list.length > 1) {
      errors.push(
        `T: ${code} appears in ${list.length} interviews: ${list.map((i) => i.id).join(", ")}`
      );
    } else {
      const i = list[0];
      const expectedOrig = `originals/${rawFile}`;
      if (i.originalTranscriptFile !== expectedOrig) {
        warnings.push(
          `T: ${code} interview ${i.id} has originalTranscriptFile="${i.originalTranscriptFile}" expected "${expectedOrig}"`
        );
      }
    }
  }

  // 3) Interviews that reference R44+ or T44+ (not in raw)
  interviews.forEach((i) => {
    if (i.reportCode) {
      const num = parseInt(i.reportCode.replace("R", ""), 10);
      if (num > 43 || num < 1) {
        errors.push(
          `Interview ${i.id} has reportCode=${i.reportCode} (no raw R${num} in data/reports)`
        );
      }
    }
    if (i.transcriptCode) {
      const num = parseInt(i.transcriptCode.replace("T", ""), 10);
      if (num > 43 || num < 1) {
        errors.push(
          `Interview ${i.id} has transcriptCode=${i.transcriptCode} (no raw T${num} in data/transcripts)`
        );
      }
    }
  });

  // 4) Store files exist: transcripts and reports for each interview
  for (const i of interviews) {
    if (i.transcriptFile) {
      const p = path.join(STORE_ROOT, i.transcriptFile);
      try {
        await fs.access(p);
      } catch {
        errors.push(`Missing store file: ${i.transcriptFile} (interview ${i.id})`);
      }
    }
    if (i.reportFile) {
      const p = path.join(STORE_ROOT, i.reportFile);
      try {
        await fs.access(p);
      } catch {
        errors.push(`Missing store file: ${i.reportFile} (interview ${i.id})`);
      }
    }
  }

  // 5) originals in store: each interview's originalReportFile / originalTranscriptFile should exist in store/originals
  const originalsList = await fs.readdir(STORE_ORIGINALS).catch(() => []);
  for (const i of interviews) {
    if (i.originalReportFile) {
      const basename = path.basename(i.originalReportFile);
      if (!originalsList.includes(basename)) {
        warnings.push(
          `Store originals: missing ${basename} (interview ${i.id} originalReportFile)`
        );
      }
    }
    if (i.originalTranscriptFile) {
      const basename = path.basename(i.originalTranscriptFile);
      if (!originalsList.includes(basename)) {
        warnings.push(
          `Store originals: missing ${basename} (interview ${i.id} originalTranscriptFile)`
        );
      }
    }
  }

  // Summary
  console.log(`Raw data/reports: ${reportFiles.length} files (R1–R${reportFiles.length})`);
  console.log(`Raw data/transcripts: ${transcriptFiles.length} files (T1–T${transcriptFiles.length})`);
  console.log(`Index interviews: ${interviews.length}`);
  console.log("");

  if (warnings.length) {
    console.log("Warnings:");
    warnings.forEach((w) => console.log("  ", w));
    console.log("");
  }
  if (errors.length) {
    console.log("Errors:");
    errors.forEach((e) => console.log("  ", e));
    console.log("");
    process.exit(1);
  }

  console.log("OK: R1–R43 and T1–T43 raw files match index/store; no errors.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
