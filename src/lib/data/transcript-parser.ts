/**
 * PDF Parser for Korn Ferry NPS Interview Transcripts
 *
 * Parses both the coded filename metadata and the structured PDF text content.
 * Transcript PDFs contain the raw interview dialogue with speaker turns.
 */

import type { Region, Solution, TranscriptTurn } from "@/types";

// --- Filename Parsing ---

export interface TranscriptFilenameMetadata {
  transcriptCode: string; // "T1", "T10", etc.
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

/**
 * Parse transcript filename to extract metadata.
 * Pattern: T{ID}_NPS{Score}_{Region}_{Solution}_{AccountType}_{MonthYear}.pdf
 * Example: T1_NPS6_EMEA_ES_HOUSE_SEP25.pdf
 */
export function parseTranscriptFilename(
  filename: string
): TranscriptFilenameMetadata {
  const basename = filename.replace(/\.pdf$/i, "");
  const parts = basename.split("_");

  // First part is T{ID}
  const transcriptCode = parts[0]; // "T1", "T10", etc.

  // Second part is NPS{Score}
  const scoreStr = parts[1].replace(/^NPS/, "");
  const score = parseInt(scoreStr, 10);

  // Third part is Region
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
    transcriptCode,
    score,
    region,
    solution: solution as Solution,
    accountType,
    monthYear,
  };
}

/**
 * Extract the numeric ID from a transcript code.
 * "T1" -> 1, "T10" -> 10
 */
export function getTranscriptNumber(transcriptCode: string): number {
  const match = transcriptCode.match(/^T(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// --- PDF Text Parsing ---

export interface ParsedTranscriptPdf {
  client: string; // Full client string: "Name, Title, Company"
  clientName: string; // Just the name
  clientTitle: string; // Job title
  company: string;
  project: string;
  interviewDate: string; // ISO 8601
  score: number;
  fullTranscript: TranscriptTurn[];
  rawText: string;
}

/**
 * Parse the raw text extracted from a Korn Ferry NPS Interview Transcript PDF.
 *
 * The text has a consistent structure:
 * - Title: "NPS Interview Transcript"
 * - Header fields: Interview Date, Client, Project, Score
 * - "FULL TRANSCRIPT" heading
 * - Speaker turns: "Interviewer 1:53\n{text}" or "Speaker 1 2:16\n{text}"
 */
export function parseTranscriptPdfText(text: string): ParsedTranscriptPdf {
  // Extract header fields
  const dateRaw = extractHeaderField(text, "Interview Date");
  const clientField = extractHeaderField(text, "Client");
  const project = extractHeaderField(text, "Project");
  const scoreStr = extractHeaderField(text, "Score");

  // Parse client field: "Name, Title, Company"
  const { clientName, clientTitle, company } = parseClientField(clientField);

  // Parse date from dd.mm.yyyy format to ISO
  const interviewDate = parseDateField(dateRaw);

  // Parse score
  const score = parseInt(scoreStr, 10) || 0;

  // Extract full transcript section
  const fullTranscript = extractTranscriptTurns(text);

  // Build raw text for embeddings
  const rawText = fullTranscript.map((t) => `${t.speaker}: ${t.text}`).join("\n\n");

  return {
    client: clientField,
    clientName,
    clientTitle,
    company,
    project,
    interviewDate,
    score,
    fullTranscript,
    rawText,
  };
}

function extractHeaderField(text: string, field: string): string {
  // Match "Field: Value" or "Field Value" pattern
  const colonPattern = new RegExp(`^${field}:\\s*(.+?)$`, "m");
  const colonMatch = text.match(colonPattern);
  if (colonMatch) {
    return colonMatch[1].trim();
  }

  // Try without colon
  const spacePattern = new RegExp(`^${field}\\s+(.+?)$`, "m");
  const spaceMatch = text.match(spacePattern);
  return spaceMatch ? spaceMatch[1].trim() : "";
}

interface ParsedClientField {
  clientName: string;
  clientTitle: string;
  company: string;
}

function parseClientField(clientField: string): ParsedClientField {
  // Format: "Greg Austin, Chief People Officer, SYNLAB"
  // Split on commas
  const parts = clientField.split(",").map((p) => p.trim());

  if (parts.length >= 3) {
    // Name, Title, Company (possibly with more parts in title/company)
    return {
      clientName: parts[0],
      clientTitle: parts.slice(1, -1).join(", "),
      company: parts[parts.length - 1],
    };
  } else if (parts.length === 2) {
    // Could be "Name, Company" or "Name, Title"
    return {
      clientName: parts[0],
      clientTitle: "",
      company: parts[1],
    };
  }

  return {
    clientName: clientField,
    clientTitle: "",
    company: "",
  };
}

function parseDateField(dateStr: string): string {
  if (!dateStr) return "";

  // Handle formats: "02.09.2025", "8.12.25", "18.09.25"
  const parts = dateStr.split(".");
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    let year = parts[2];
    // Handle 2-digit year
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

/**
 * Extract transcript turns from the "FULL TRANSCRIPT" section.
 *
 * Speaker patterns:
 * - "Interviewer 1:53" or "Interviewer" (with or without timestamp)
 * - "Speaker 1 2:16" or "Speaker 1" (numbered speakers)
 * - Sometimes just "Speaker" followed by timestamp
 */
function extractTranscriptTurns(text: string): TranscriptTurn[] {
  // Find the start of the transcript section
  const transcriptMatch = text.match(/FULL TRANSCRIPT\s*/i);
  if (!transcriptMatch || transcriptMatch.index === undefined) {
    return [];
  }

  const transcriptText = text.substring(
    transcriptMatch.index + transcriptMatch[0].length
  );

  // Pattern to match speaker lines with optional timestamps
  // Matches: "Interviewer 1:53", "Speaker 1 2:16", "Interviewer", "Speaker 1"
  const speakerPattern =
    /^(Interviewer|Speaker(?:\s+\d+)?)\s*(?:(\d{1,2}:\d{2})\s*)?$/gm;

  const turns: TranscriptTurn[] = [];
  const matches: { speaker: string; timestamp?: string; index: number }[] = [];

  let match;
  while ((match = speakerPattern.exec(transcriptText)) !== null) {
    matches.push({
      speaker: match[1],
      timestamp: match[2],
      index: match.index,
    });
  }

  // Extract text between speaker markers
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];

    // Find the end of the speaker line
    const speakerLineEnd = transcriptText.indexOf("\n", currentMatch.index);
    if (speakerLineEnd === -1) continue;

    // Text starts after the speaker line
    const textStart = speakerLineEnd + 1;
    const textEnd = nextMatch ? nextMatch.index : transcriptText.length;

    const turnText = transcriptText
      .substring(textStart, textEnd)
      .trim()
      .replace(/\s+/g, " ");

    if (turnText) {
      // Format speaker with timestamp if present
      const speaker = currentMatch.timestamp
        ? `${currentMatch.speaker} ${currentMatch.timestamp}`
        : currentMatch.speaker;

      turns.push({
        speaker: cleanSpeakerName(speaker),
        text: cleanText(turnText),
      });
    }
  }

  return turns;
}

function cleanSpeakerName(speaker: string): string {
  // Normalize speaker names
  // "Speaker 1" -> "Client" or keep as is
  // "Interviewer" -> "Interviewer"
  return speaker.trim();
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

export async function parseTranscriptPdfBuffer(
  buffer: Buffer | Uint8Array
): Promise<ParsedTranscriptPdf> {
  const { PDFParse } = await import("pdf-parse");
  // pdf-parse requires a plain Uint8Array, not a Node.js Buffer
  const uint8 = new Uint8Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength
  );
  const parser = new PDFParse(uint8, { verbosity: 0 });
  const result = await parser.getText();
  return parseTranscriptPdfText(result.text);
}
