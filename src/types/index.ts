// ============================================================
// KFCX NPS Interview Insight Platform — Type Definitions
// ============================================================

// --- NPS Categories ---
export type NPSCategory = "promoter" | "passive" | "detractor";
export type Region = "NA" | "EMEA" | "APAC" | "LATAM";
export type Solution = "Executive Search" | "Professional Search" | "Consulting";

// --- Master Metadata Index ---
export interface InterviewMetadata {
  id: string;
  interviewId: number;
  client: string;
  company: string;
  interviewDate: string; // ISO 8601
  score: number;
  npsCategory: NPSCategory;
  region: Region;
  solution: Solution;
  accountType: string;
  monthYear: string; // "2025-10"
  hasTranscript: boolean;
  hasReport: boolean;
  transcriptFile: string;
  reportFile: string | null;
  originalPdfFile?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetadataIndex {
  version: number;
  lastUpdated: string;
  interviews: InterviewMetadata[];
}

// --- Normalized Transcript ---
export interface TranscriptSection {
  title: string;
  points: string[];
}

export interface TranscriptTurn {
  speaker: string;
  text: string;
}

export interface NormalizedTranscript {
  id: string;
  sourceFile: string;
  overview: string;
  sections: TranscriptSection[];
  fullTranscript: TranscriptTurn[];
  rawText: string;
}

// --- Normalized Report ---
export interface NormalizedReport {
  id: string;
  client: string;
  interviewDate: string;
  project: string;
  score: number;
  overview: string;
  whatWentWell: string[];
  challengesPainPoints: string[];
  gapsIdentified: string[];
  keyThemes: string[];
  actionsRecommendations: string[];
  additionalInsight: string;
}

// --- Theme Analysis ---
export interface QuoteReference {
  text: string;
  interviewId: string;
  client: string;
  company: string;
  region: string;
  solution: string;
  accountType: string;
  npsCategory: string;
  score: number;
}

export interface Theme {
  id: string;
  label: string;
  description: string;
  frequency: number;
  sentiment: "positive" | "negative" | "neutral";
  supportingQuotes: QuoteReference[];
  interviewIds: string[];
}

export interface ThemeGroup {
  name: string;
  description: string;
  themes: Theme[];
}

export interface TimelinePoint {
  month: string;
  themes: { themeId: string; count: number }[];
}

export interface ThemeAnalysis {
  lastGenerated: string;
  generatedFrom: string[];
  whyClientsChoose: ThemeGroup;
  promoterExperience: ThemeGroup;
  whereFallsShort: ThemeGroup;
  additionalThemes: ThemeGroup[];
  timelineData: TimelinePoint[];
}

// --- Opportunities ---
export type OpportunityType = "future_need" | "expansion" | "re_engagement" | "improvement";
export type OpportunityUrgency = "high" | "medium" | "low";
export type OpportunityStatus = "identified" | "in_progress" | "actioned";

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  urgency: OpportunityUrgency;
  sourceInterviewId: string;
  client: string;
  company: string;
  supportingQuote: string;
  suggestedAction: string;
  status: OpportunityStatus;
}

export interface OpportunitiesAnalysis {
  lastGenerated: string;
  opportunities: Opportunity[];
}

// --- Embeddings ---
export interface EmbeddingChunk {
  id: string;
  interviewId: string;
  source: "transcript" | "report";
  sectionType: string;
  text: string;
  embedding: number[];
}

export interface EmbeddingIndex {
  model: string;
  lastUpdated: string;
  chunks: EmbeddingChunk[];
}

// --- API Request/Response Types ---
export interface InterviewFilters {
  region?: Region;
  solution?: Solution;
  npsCategory?: NPSCategory;
  monthStart?: string;
  monthEnd?: string;
  search?: string;
  sort?: "date-desc" | "date-asc" | "score-desc" | "score-asc";
}

export interface InterviewListResponse {
  interviews: InterviewMetadata[];
  total: number;
}

export interface InterviewDetailResponse {
  metadata: InterviewMetadata;
  transcript: NormalizedTranscript | null;
  report: NormalizedReport | null;
}

export interface StatsResponse {
  totalInterviews: number;
  averageNPS: number;
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  byRegion: { region: string; count: number }[];
  bySolution: { solution: string; count: number }[];
  byMonth: { month: string; count: number; avgScore: number }[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  filters?: {
    region?: string;
    solution?: string;
    npsCategory?: string;
  };
}

export interface UploadFormData {
  clientName: string;
  companyName: string;
  interviewDate: string;
  score: number;
  region: Region;
  solution: Solution;
  accountType: string;
}

export interface SearchResult {
  interviewId: string;
  client: string;
  company: string;
  score: number;
  npsCategory: NPSCategory;
  matches: { text: string; section: string }[];
}
