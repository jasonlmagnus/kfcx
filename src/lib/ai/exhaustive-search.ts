import { readMetadataIndex, readReport, readTranscript } from "@/lib/data/store";
import type { InterviewMetadata, NormalizedReport, NormalizedTranscript } from "@/types";

const STOPWORDS = new Set([
  "a",
  "about",
  "all",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "did",
  "do",
  "does",
  "for",
  "from",
  "get",
  "had",
  "has",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "its",
  "list",
  "me",
  "more",
  "of",
  "on",
  "or",
  "our",
  "show",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "us",
  "was",
  "were",
  "what",
  "which",
  "who",
  "with",
  "would",
  "you",
]);

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function extractQuotedPhrases(query: string): string[] {
  const matches = query.match(/"([^"]+)"/g) || [];
  return matches.map((m) => m.slice(1, -1).trim()).filter(Boolean);
}

function extractKeywords(query: string): string[] {
  const normalized = normalizeText(query);
  const words = normalized.split(/\s+/).filter(Boolean);
  const keywords = words.filter(
    (w) => w.length >= 3 && !STOPWORDS.has(w)
  );
  return Array.from(new Set(keywords));
}

function reportToText(r: NormalizedReport): string {
  return [
    r.overview,
    r.whatWentWell.join(" "),
    r.challengesPainPoints.join(" "),
    r.gapsIdentified.join(" "),
    r.keyThemes.join(" "),
    r.actionsRecommendations.join(" "),
    r.additionalInsight,
  ]
    .filter(Boolean)
    .join("\n");
}

function transcriptToText(t: NormalizedTranscript): string {
  const sections = t.sections.map((s) => `${s.title}: ${s.points.join(" ")}`);
  const turns = t.fullTranscript.map((turn) => `${turn.speaker}: ${turn.text}`);
  return [t.overview, ...sections, ...turns, t.rawText]
    .filter(Boolean)
    .join("\n");
}

function findSnippet(text: string, term: string): string {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - 120);
  const end = Math.min(text.length, idx + 160);
  const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  return snippet;
}

export interface ExhaustiveMatch {
  interview: InterviewMetadata;
  matchTerm: string;
  snippet: string;
}

export async function exhaustiveSearchInterviews(query: string): Promise<ExhaustiveMatch[]> {
  const index = await readMetadataIndex();
  const phrases = extractQuotedPhrases(query);
  const keywords = extractKeywords(query);

  const matches: ExhaustiveMatch[] = [];

  for (const interview of index.interviews) {
    const report = interview.hasReport ? await readReport(interview.id) : null;
    const transcript = interview.hasTranscript ? await readTranscript(interview.id) : null;
    const text = [
      report ? reportToText(report) : "",
      transcript ? transcriptToText(transcript) : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (!text) continue;

    const haystack = text.toLowerCase();
    let matchTerm = "";

    if (phrases.length > 0) {
      const phrase = phrases.find((p) => haystack.includes(p.toLowerCase()));
      if (phrase) matchTerm = phrase;
    } else if (keywords.length > 0) {
      const keyword = keywords.find((k) => haystack.includes(k));
      if (keyword) matchTerm = keyword;
    }

    if (matchTerm) {
      const snippet = findSnippet(text, matchTerm);
      matches.push({ interview, matchTerm, snippet });
    }
  }

  return matches;
}
