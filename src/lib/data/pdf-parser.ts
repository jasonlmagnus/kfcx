/**
 * PDF Parser for Korn Ferry NPS Interview Reports
 *
 * Parses both the coded filename metadata and the structured PDF text content.
 * All 43 production PDF reports follow a consistent format.
 */

import type { Region, Solution } from "@/types";

// --- Filename Parsing ---

export interface FilenameMetadata {
  reportCode: string; // "R1", "R2", etc.
  score: number;
  region: Region;
  solution: Solution;
  accountType: string;
  monthYear: string; // "2025-09"
}

const MONTH_MAP: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

const SOLUTION_MAP: Record<string, Solution> = {
  ES: "Executive Search",
  PS: "Professional Search",
  CONSULTING: "Consulting",
};

const ACCOUNT_TYPE_MAP: Record<string, string> = {
  HOUSE: "House",
  DIAMOND: "Diamond",
  MARQUEE: "Marquee",
  REGIONAL: "Regional",
};

export function parseFilenameMetadata(filename: string): FilenameMetadata {
  // Pattern: R{ID}_NPS{Score}_{Region}_{Solution}_{AccountType}_{MonthYear}.pdf
  // Example: R1_NPS6_EMEA_ES_HOUSE_SEP25.pdf
  // Example: R20_NPS10_EMEA_CONSULTING_REGIONAL_OCT25.pdf
  const basename = filename.replace(/\.pdf$/i, "");
  const parts = basename.split("_");

  // First part is always R{ID}
  const reportCode = parts[0]; // "R1", "R20", etc.

  // Second part is always NPS{Score}
  const scoreStr = parts[1].replace(/^NPS/, "");
  const score = parseInt(scoreStr, 10);

  // Third part is always Region
  const region = parts[2] as Region;

  // Fourth part is Solution (ES, PS, or CONSULTING)
  const solutionKey = parts[3];
  const solution = SOLUTION_MAP[solutionKey] || solutionKey;

  // Fifth part is Account Type
  const accountTypeKey = parts[4];
  const accountType = ACCOUNT_TYPE_MAP[accountTypeKey] || accountTypeKey;

  // Sixth part is MonthYear (e.g., SEP25, OCT25, JAN26)
  const monthYearRaw = parts[5]; // "SEP25"
  const monthCode = monthYearRaw.slice(0, -2); // "SEP"
  const yearShort = monthYearRaw.slice(-2); // "25"
  const year = `20${yearShort}`;
  const month = MONTH_MAP[monthCode] || "01";
  const monthYear = `${year}-${month}`;

  return {
    reportCode,
    score,
    region,
    solution: solution as Solution,
    accountType,
    monthYear,
  };
}

// --- PDF Text Parsing ---

export interface ParsedPdfReport {
  client: string;
  company: string;
  engagement: string;
  interviewDate: string; // ISO 8601
  score: number | null; // from header if present (some have NPS field)
  overview: string;
  whatWentWell: string[];
  challengesPainPoints: string[];
  gapsIdentified: string[];
  keyThemes: string[];
  actionsRecommendations: string[];
  additionalInsight: string;
}

/**
 * Parse the raw text extracted from a Korn Ferry NPS Interview Report PDF.
 *
 * The text has a consistent structure:
 * - Title: "Customer Centricity: NPS ... Interview Report"
 * - Header fields: Client, NPS (optional), Engagement, Interview Date
 * - "Interview Report" heading
 * - Sections: Overview, What Went Well, Challenges/ Pain Points,
 *   Gaps Identified, Key Themes, Actions & Recommendations, Additional Insight
 * - Page breaks appear as "-- N of M --"
 */
export function parsePdfText(text: string): ParsedPdfReport {
  // Remove page break markers
  const cleaned = text.replace(/\n-- \d+ of \d+ --\n/g, "\n");

  // Extract header fields
  let clientField = extractHeaderField(cleaned, "Client");
  const npsField = extractHeaderField(cleaned, "NPS");
  const engagement = extractHeaderField(cleaned, "Engagement");
  const dateRaw = extractHeaderField(cleaned, "Interview Date");

  // Some PDFs don't have a "Client" keyword — the name appears directly
  // on the line after the title, often with the first name duplicated.
  // Pattern: "Title\n{Name} {Name} {LastName}, {Company}\nNPS ..."
  if (!clientField) {
    clientField = extractClientFromTitle(cleaned);
  }

  // Parse client name and company from client field
  // Format: "FirstName LastName, CompanyName" or just "FirstName"
  let clientName = clientField;
  let company = "";
  const commaIdx = clientField.indexOf(",");
  if (commaIdx !== -1) {
    clientName = clientField.substring(0, commaIdx).trim();
    company = clientField.substring(commaIdx + 1).trim();
  }

  // Fix duplicated first names (PDF artifact: "Mike Mike Arshinskiy" -> "Mike Arshinskiy")
  clientName = deduplicateFirstName(clientName);

  // Parse date from dd.mm.yy format to ISO
  const interviewDate = parseDateField(dateRaw);

  // Parse NPS score from header (if present)
  const score = npsField ? parseInt(npsField, 10) : null;

  // Extract sections by splitting on known headings
  const sections = extractSections(cleaned);

  return {
    client: clientName,
    company,
    engagement,
    interviewDate,
    score,
    overview: sections.overview,
    whatWentWell: sections.whatWentWell,
    challengesPainPoints: sections.challengesPainPoints,
    gapsIdentified: sections.gapsIdentified,
    keyThemes: sections.keyThemes,
    actionsRecommendations: sections.actionsRecommendations,
    additionalInsight: sections.additionalInsight,
  };
}

/**
 * Extract client info when there's no "Client" keyword in the header.
 * Some PDFs have the name on the line directly after the title.
 * Pattern: "Customer Centricity: NPS ... Interview Report\n{Name}, {Company}\n"
 */
function extractClientFromTitle(text: string): string {
  // Look for the line after the title that contains a name with comma
  const titleMatch = text.match(
    /Customer Centricity:[\s\S]*?Interview Report\n(.+?)(?:\nNPS\s|\nEngagement\s|\nInterview Date\s)/
  );
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  return "";
}

/**
 * Fix duplicated first names from PDF table extraction artifacts.
 * "Mike Mike Arshinskiy" -> "Mike Arshinskiy"
 * "Gerd Gerd Pircher" -> "Gerd Pircher"
 */
function deduplicateFirstName(name: string): string {
  const words = name.split(/\s+/);
  if (words.length >= 2 && words[0] === words[1]) {
    return words.slice(1).join(" ");
  }
  return name;
}

function extractHeaderField(text: string, field: string): string {
  // Match the field name at the start of a line, then capture everything until the next known field or "Interview Report"
  const fieldPattern = new RegExp(
    `^${field}\\s+(.+?)$`,
    "m"
  );
  const match = text.match(fieldPattern);
  return match ? match[1].trim() : "";
}

function parseDateField(dateStr: string): string {
  if (!dateStr) return "";

  // Handle formats: "02.09.25", "8.12.25", "18.09.25"
  const parts = dateStr.split(".");
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = `20${parts[2]}`;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

interface ExtractedSections {
  overview: string;
  whatWentWell: string[];
  challengesPainPoints: string[];
  gapsIdentified: string[];
  keyThemes: string[];
  actionsRecommendations: string[];
  additionalInsight: string;
}

function extractSections(text: string): ExtractedSections {
  // Define section markers as they appear in the extracted text.
  // Some headings span multiple lines in the PDF text (e.g., "Challenges/ Pain\nPoints")
  const sectionMarkers = [
    { key: "overview", pattern: /\nOverview\n/i },
    { key: "whatWentWell", pattern: /\nWhat Went Well\n/i },
    {
      key: "challengesPainPoints",
      pattern: /\nChallenges\s*\/?\s*Pain\s*\n?\s*Points\n/i,
    },
    {
      key: "gapsIdentified",
      pattern: /\nGaps Identified\s*\n?\s*\(?raised by\s*\n?\s*interviewee\)?\n/i,
    },
    { key: "keyThemes", pattern: /\nKey Themes\n/i },
    {
      key: "actionsRecommendations",
      pattern: /\nActions\s*&?\s*\n?\s*Recommendations\n/i,
    },
    { key: "additionalInsight", pattern: /\nAdditional Insight\n/i },
  ];

  // Find the position of each section marker
  const positions: { key: string; start: number; end: number }[] = [];

  for (const marker of sectionMarkers) {
    const match = text.match(marker.pattern);
    if (match && match.index !== undefined) {
      positions.push({
        key: marker.key,
        start: match.index + match[0].length,
        end: 0,
      });
    }
  }

  // Sort by position
  positions.sort((a, b) => a.start - b.start);

  // Set end positions
  for (let i = 0; i < positions.length; i++) {
    positions[i].end =
      i + 1 < positions.length ? positions[i + 1].start : text.length;
  }

  // Extract text for each section
  const sectionTexts: Record<string, string> = {};
  for (const pos of positions) {
    // Go backwards to find the start of the section heading
    sectionTexts[pos.key] = text.substring(pos.start, pos.end).trim();
  }

  return {
    overview: sectionTexts["overview"] || "",
    whatWentWell: splitBulletPoints(sectionTexts["whatWentWell"] || ""),
    challengesPainPoints: splitBulletPoints(
      sectionTexts["challengesPainPoints"] || ""
    ),
    gapsIdentified: splitBulletPoints(sectionTexts["gapsIdentified"] || ""),
    keyThemes: splitBulletPoints(sectionTexts["keyThemes"] || ""),
    actionsRecommendations: splitBulletPoints(
      sectionTexts["actionsRecommendations"] || ""
    ),
    additionalInsight: sectionTexts["additionalInsight"] || "",
  };
}

/**
 * Split section text into individual bullet points.
 *
 * Each bullet point starts with a bold heading (a short descriptive phrase)
 * followed by a period, colon, or dash, then body text with optional quotes.
 *
 * Strategy: join all lines into one string, then split on bold heading patterns.
 * A bold heading is detected when preceded by an end-of-thought marker
 * (closing quote, period, or start of text) and followed by a distinctive
 * heading phrase pattern.
 */
function splitBulletPoints(text: string): string[] {
  if (!text.trim()) return [];

  // Join all lines into a single string, replacing newlines with spaces
  const joined = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  // Bold heading pattern: a capitalized phrase of 2+ words ending with
  // period, colon, or dash separator, where the heading part is 10-120 chars.
  // Must be preceded by: start of text, closing quote, or sentence-ending period.
  //
  // Examples:
  //   "Strong candidate-side experience [Greg was bought in...]. "
  //   "Psychometric testing and reporting. "
  //   "Work closely with clients on candidate quality – "
  //   "Candidate quality. "
  //
  // Character class includes smart quotes/apostrophes from PDFs.
  const headingPattern =
    /(?:^|[."\u201d\u201c]\s+)([A-Z][A-Za-z][A-Za-z\s,/&'()\[\]\u2018\u2019\u2013\u2014-]{8,118}?(?:\.\s|:\s|\s[\u2013\u2014\u2015–-]\s))/g;

  // Words that commonly start regular sentences but never start bold headings
  const NON_HEADING_STARTERS = new Set([
    "They", "And", "The", "But", "It", "We", "He", "She", "That", "This",
    "However", "Also", "Not", "For", "As", "If", "When", "Where", "While",
    "Although", "Because", "Since", "Or", "So", "Yet", "Both", "Each",
    "Over", "From", "With", "Into", "After", "Before", "Upon",
  ]);

  const splits: number[] = [0];
  let match;

  while ((match = headingPattern.exec(joined)) !== null) {
    // The heading starts at the beginning of the captured group
    const headingStart = match.index + match[0].indexOf(match[1]);
    const headingText = match[1];

    // Filter out false positives: sentences starting with common non-heading words
    const firstWord = headingText.split(/[\s,]/)[0];
    if (NON_HEADING_STARTERS.has(firstWord)) {
      continue;
    }

    if (headingStart > 0) {
      splits.push(headingStart);
    }
  }

  // Extract bullet points between split positions
  const points: string[] = [];
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i];
    const end = i + 1 < splits.length ? splits[i + 1] : joined.length;
    const chunk = joined.substring(start, end).trim();
    if (chunk.length > 10) {
      points.push(cleanText(chunk));
    }
  }

  // If regex found no splits, return the whole text as one point
  if (points.length === 0 && joined.length > 10) {
    points.push(cleanText(joined));
  }

  return points;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ") // normalize whitespace
    .replace(/\u201c/g, '"') // smart quotes to straight
    .replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2026/g, "...")
    .trim();
}

// --- Main PDF parsing function using pdf-parse ---

export async function parsePdfBuffer(
  buffer: Buffer | Uint8Array
): Promise<ParsedPdfReport> {
  const { PDFParse } = await import("pdf-parse");
  // pdf-parse requires a plain Uint8Array, not a Node.js Buffer
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const parser = new PDFParse(uint8, { verbosity: 0 });
  const result = await parser.getText();
  return parsePdfText(result.text);
}
