/**
 * Migration script: converts existing JSON data into the normalized store format.
 * Run with: npx tsx scripts/migrate.ts
 */
import { promises as fs } from "fs";
import path from "path";

const PROJECT_ROOT = process.cwd();
const LEGACY_JSON = path.join(PROJECT_ROOT, "data", "json");
const STORE_ROOT = path.join(PROJECT_ROOT, "data", "store");

interface LegacyTranscript {
  source_file: string;
  paragraphs: string[];
  text: string;
}

interface LegacyReport {
  client: string;
  interview_date: string;
  project: string;
  score: number;
  overview: string;
  what_went_well: string[];
  challenges_pain_points: string[];
  gaps_identified: string[];
  key_themes: string[];
  actions_recommendations: string[];
  additional_insight: string;
}

// Seed data mapping: we manually specify metadata for the 5 existing interviews
const SEED_DATA = [
  {
    id: "t-001",
    interviewId: 1,
    client: "Lisa Bolger",
    company: "PartnerRe",
    legacyDate: "02.10.25",
    score: 9,
    region: "EMEA" as const,
    solution: "Executive Search" as const,
    accountType: "Unknown",
    transcriptFile: "NPS Interview Transcript_02.10.25_Lisa, PartnerRe.json",
    reportFile:
      "Report_NPS Interview Transcript_02.10.25_Lisa, PartnerRe.json",
  },
  {
    id: "t-002",
    interviewId: 2,
    client: "Vanessa",
    company: "Heidelberg Materials",
    legacyDate: "01.10.25",
    score: 10,
    region: "EMEA" as const,
    solution: "Executive Search" as const,
    accountType: "Unknown",
    transcriptFile:
      "NPS Interview Transcript_011025_Vanessa, Heidelberg Materials.json",
    reportFile:
      "Report_NPS Interview Transcript_011025_Vanessa, Heidelberg Materials.json",
  },
  {
    id: "t-003",
    interviewId: 3,
    client: "Greg Aarssen",
    company: "TriSummit Utilities Inc.",
    legacyDate: "01.12.25",
    score: 10,
    region: "NA" as const,
    solution: "Executive Search" as const,
    accountType: "Unknown",
    transcriptFile:
      "NPS Interview Transcript_011225_Greg, TriSummit Utilities Inc.json",
    reportFile:
      "Report_NPS Interview Transcript_011225_Greg, TriSummit Utilities Inc.json",
  },
  {
    id: "t-004",
    interviewId: 4,
    client: "Jeanette Rooms",
    company: "Ocorian",
    legacyDate: "01.12.25",
    score: 6,
    region: "EMEA" as const,
    solution: "Executive Search" as const,
    accountType: "Unknown",
    transcriptFile:
      "NPS Interview Transcript_011225_Jeanette, Ocorian.json",
    reportFile:
      "Report_NPS Interview Transcript_011225_Jeanette, Ocorian.json",
  },
  {
    id: "t-005",
    interviewId: 5,
    client: "Duffield Ashmead IV",
    company: "Wadsworth Atheneum Museum of Art",
    legacyDate: "28.11.25",
    score: 10,
    region: "NA" as const,
    solution: "Professional Search" as const,
    accountType: "Unknown",
    // Note: \xa0 non-breaking space in filename
    transcriptFile:
      "NPS Interview Transcript_011225_Duff, Wadsworth\u00a0Atheneum Museum of Art.json",
    reportFile: null,
  },
];

function parseLegacyDate(dateStr: string): string {
  const parts = dateStr.split(".");
  const day = parts[0].padStart(2, "0");
  const month = parts[1].padStart(2, "0");
  const year = `20${parts[2]}`;
  return `${year}-${month}-${day}`;
}

function getNPSCategory(
  score: number
): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

function parseTranscriptTurns(
  paragraphs: string[]
): { speaker: string; text: string }[] {
  const turns: { speaker: string; text: string }[] = [];
  let inFullTranscript = false;

  for (const para of paragraphs) {
    if (para.includes("FULL TRANSCRIPT")) {
      inFullTranscript = true;
      continue;
    }
    if (!inFullTranscript) continue;

    // Try to identify speaker turns: lines starting with speaker names
    const speakerMatch = para.match(
      /^\n?(Interviewer|Interviwer|Speaker\d?|Speaker\s?\d|[A-Z][a-z]+)\s*\n/
    );
    if (speakerMatch) {
      const speaker = speakerMatch[1].trim();
      const text = para.replace(speakerMatch[0], "").trim();
      if (text) {
        turns.push({ speaker, text });
      }
    } else if (para.trim()) {
      // Continuation of previous speaker or standalone text
      if (turns.length > 0) {
        turns[turns.length - 1].text += "\n" + para.trim();
      } else {
        turns.push({ speaker: "Unknown", text: para.trim() });
      }
    }
  }

  return turns;
}

function extractOverview(paragraphs: string[]): string {
  let overviewStarted = false;
  const overviewParts: string[] = [];

  for (const para of paragraphs) {
    if (para.includes("TRANSCRIPT OVERVIEW")) {
      overviewStarted = true;
      continue;
    }
    if (overviewStarted) {
      // Stop at the next section (typically outline sections or FULL TRANSCRIPT)
      if (
        para.match(
          /^(Introduction|Duffield|Teresa|Greg|Jeanette|Vanessa|Lisa|Background|The Search|Communication|Challenges|Feedback|Assessment|Compensation|Future|Overall|Key|Summary|Engagement|FULL TRANSCRIPT)/
        )
      ) {
        break;
      }
      if (para.startsWith("http")) continue; // skip URLs
      if (para.trim()) {
        overviewParts.push(para.trim());
      }
    }
  }

  return overviewParts.join("\n\n");
}

function extractSections(
  paragraphs: string[]
): { title: string; points: string[] }[] {
  const sections: { title: string; points: string[] }[] = [];
  let pastOverview = false;
  let currentSection: { title: string; points: string[] } | null = null;

  for (const para of paragraphs) {
    if (para.includes("TRANSCRIPT OVERVIEW")) {
      pastOverview = true;
      continue;
    }
    if (!pastOverview) continue;
    if (para.includes("FULL TRANSCRIPT")) break;
    if (para.startsWith("http")) continue;

    const trimmed = para.trim();
    if (!trimmed) continue;

    // Heuristic: section titles are short (< 80 chars) and don't contain periods mid-sentence
    const isTitle =
      trimmed.length < 100 &&
      !trimmed.includes(". ") &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("•");

    if (isTitle && trimmed.length > 5) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: trimmed, points: [] };
    } else if (currentSection) {
      currentSection.points.push(trimmed);
    }
  }

  if (currentSection && currentSection.points.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function migrate(): Promise<void> {
  console.log("Starting migration...\n");

  // Create directory structure
  await ensureDir(path.join(STORE_ROOT, "transcripts"));
  await ensureDir(path.join(STORE_ROOT, "reports"));
  await ensureDir(path.join(STORE_ROOT, "embeddings"));
  await ensureDir(path.join(STORE_ROOT, "metadata"));

  const metadataIndex = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    interviews: [] as any[],
  };

  for (const seed of SEED_DATA) {
    console.log(`Processing: ${seed.client}, ${seed.company}`);

    // Read legacy transcript
    const transcriptPath = path.join(LEGACY_JSON, seed.transcriptFile);
    let legacyTranscript: LegacyTranscript | null = null;
    try {
      const raw = await fs.readFile(transcriptPath, "utf-8");
      legacyTranscript = JSON.parse(raw);
    } catch (e) {
      console.error(`  Warning: Could not read transcript: ${seed.transcriptFile}`);
    }

    // Read legacy report
    let legacyReport: LegacyReport | null = null;
    if (seed.reportFile) {
      const reportPath = path.join(LEGACY_JSON, seed.reportFile);
      try {
        const raw = await fs.readFile(reportPath, "utf-8");
        legacyReport = JSON.parse(raw);
      } catch (e) {
        console.error(`  Warning: Could not read report: ${seed.reportFile}`);
      }
    }

    // Normalize transcript
    if (legacyTranscript) {
      const overview = extractOverview(legacyTranscript.paragraphs);
      const sections = extractSections(legacyTranscript.paragraphs);
      const fullTranscript = parseTranscriptTurns(legacyTranscript.paragraphs);

      const normalized = {
        id: seed.id,
        sourceFile: legacyTranscript.source_file,
        overview:
          overview ||
          legacyReport?.overview ||
          legacyTranscript.paragraphs
            .slice(5, 8)
            .filter((p) => p.trim() && !p.startsWith("http"))
            .join("\n\n"),
        sections,
        fullTranscript,
        rawText: legacyTranscript.text || legacyTranscript.paragraphs.join("\n"),
      };

      await fs.writeFile(
        path.join(STORE_ROOT, "transcripts", `${seed.id}.json`),
        JSON.stringify(normalized, null, 2),
        "utf-8"
      );
      console.log(`  ✓ Transcript saved: ${seed.id}.json`);
    }

    // Normalize report
    if (legacyReport) {
      const normalized = {
        id: seed.id,
        client: legacyReport.client,
        interviewDate: parseLegacyDate(legacyReport.interview_date),
        project: legacyReport.project,
        score: legacyReport.score,
        overview: legacyReport.overview,
        whatWentWell: legacyReport.what_went_well,
        challengesPainPoints: legacyReport.challenges_pain_points,
        gapsIdentified: legacyReport.gaps_identified,
        keyThemes: legacyReport.key_themes,
        actionsRecommendations: legacyReport.actions_recommendations,
        additionalInsight: legacyReport.additional_insight,
      };

      await fs.writeFile(
        path.join(STORE_ROOT, "reports", `${seed.id}.json`),
        JSON.stringify(normalized, null, 2),
        "utf-8"
      );
      console.log(`  ✓ Report saved: ${seed.id}.json`);
    }

    // Build metadata entry
    const isoDate = parseLegacyDate(seed.legacyDate);
    metadataIndex.interviews.push({
      id: seed.id,
      interviewId: seed.interviewId,
      client: seed.client,
      company: seed.company,
      interviewDate: isoDate,
      score: seed.score,
      npsCategory: getNPSCategory(seed.score),
      region: seed.region,
      solution: seed.solution,
      accountType: seed.accountType,
      monthYear: isoDate.substring(0, 7),
      hasTranscript: legacyTranscript !== null,
      hasReport: legacyReport !== null,
      transcriptFile: `transcripts/${seed.id}.json`,
      reportFile: legacyReport ? `reports/${seed.id}.json` : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`  ✓ Metadata entry created\n`);
  }

  // Write metadata index
  await fs.writeFile(
    path.join(STORE_ROOT, "metadata", "index.json"),
    JSON.stringify(metadataIndex, null, 2),
    "utf-8"
  );
  console.log("✓ Metadata index saved");
  console.log(
    `\nMigration complete! Processed ${SEED_DATA.length} interviews.`
  );
}

migrate().catch(console.error);
