import { getOpenAIClient } from "./openai";
import {
  readMetadataIndex,
  readTranscript,
  readReport,
  readEmbeddingIndex,
  writeEmbeddingIndex,
} from "@/lib/data/store";
import type {
  EmbeddingIndex,
  EmbeddingChunk,
  NormalizedTranscript,
  NormalizedReport,
} from "@/types";

const EMBEDDING_MODEL = "text-embedding-3-small";

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.substring(0, 8000), // limit input length
  });
  return response.data[0].embedding;
}

const EMBEDDING_BATCH_SIZE = 20;
/** Number of embedding API calls to run in parallel (stays within typical rate limits). */
const EMBEDDING_PARALLEL_BATCHES = 4;

export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const openai = getOpenAIClient();
  const allEmbeddings: number[][] = [];
  const step = EMBEDDING_BATCH_SIZE * EMBEDDING_PARALLEL_BATCHES;

  for (let i = 0; i < texts.length; i += step) {
    const batchPromises: Promise<number[][]>[] = [];
    for (
      let j = 0;
      j < EMBEDDING_PARALLEL_BATCHES && i + j * EMBEDDING_BATCH_SIZE < texts.length;
      j++
    ) {
      const start = i + j * EMBEDDING_BATCH_SIZE;
      const batch = texts
        .slice(start, start + EMBEDDING_BATCH_SIZE)
        .map((t) => t.substring(0, 8000));
      if (batch.length === 0) continue;
      batchPromises.push(
        openai.embeddings
          .create({ model: EMBEDDING_MODEL, input: batch })
          .then((r) => r.data.map((d) => d.embedding))
      );
    }
    const results = await Promise.all(batchPromises);
    for (const emb of results) allEmbeddings.push(...emb);
  }

  return allEmbeddings;
}

function chunkTranscript(
  transcript: NormalizedTranscript,
  interviewId: string
): { id: string; text: string; sectionType: string }[] {
  const chunks: { id: string; text: string; sectionType: string }[] = [];
  let idx = 0;

  // Overview chunk
  if (transcript.overview) {
    chunks.push({
      id: `${interviewId}-tc-${idx++}`,
      text: transcript.overview,
      sectionType: "overview",
    });
  }

  // Section chunks
  for (const section of transcript.sections) {
    const text = `${section.title}\n${section.points.join("\n")}`;
    if (text.trim().length > 20) {
      chunks.push({
        id: `${interviewId}-tc-${idx++}`,
        text,
        sectionType: "section",
      });
    }
  }

  // Transcript windowed chunks (~500 words per chunk)
  if (transcript.fullTranscript.length > 0) {
    const turns = transcript.fullTranscript;
    let currentChunk = "";
    let wordCount = 0;

    for (const turn of turns) {
      const turnText = `${turn.speaker}: ${turn.text}`;
      const turnWords = turnText.split(/\s+/).length;

      if (wordCount + turnWords > 500 && currentChunk) {
        chunks.push({
          id: `${interviewId}-tc-${idx++}`,
          text: currentChunk.trim(),
          sectionType: "transcript_segment",
        });
        // Keep overlap: last 100 words
        const words = currentChunk.split(/\s+/);
        currentChunk = words.slice(-100).join(" ") + "\n" + turnText;
        wordCount = 100 + turnWords;
      } else {
        currentChunk += "\n" + turnText;
        wordCount += turnWords;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: `${interviewId}-tc-${idx++}`,
        text: currentChunk.trim(),
        sectionType: "transcript_segment",
      });
    }
  } else if (transcript.rawText) {
    // Fallback: chunk rawText by ~500 words
    const words = transcript.rawText.split(/\s+/);
    for (let i = 0; i < words.length; i += 400) {
      const chunk = words.slice(i, i + 500).join(" ");
      if (chunk.trim().length > 20) {
        chunks.push({
          id: `${interviewId}-tc-${idx++}`,
          text: chunk,
          sectionType: "transcript_segment",
        });
      }
    }
  }

  return chunks;
}

function chunkReport(
  report: NormalizedReport,
  interviewId: string
): { id: string; text: string; sectionType: string }[] {
  const chunks: { id: string; text: string; sectionType: string }[] = [];
  let idx = 0;

  // Overview
  if (report.overview) {
    chunks.push({
      id: `${interviewId}-rc-${idx++}`,
      text: report.overview,
      sectionType: "overview",
    });
  }

  // Each array section: individual items as chunks
  const sections: { items: string[]; type: string }[] = [
    { items: report.whatWentWell, type: "what_went_well" },
    { items: report.challengesPainPoints, type: "challenges" },
    { items: report.gapsIdentified, type: "gaps" },
    { items: report.keyThemes, type: "key_themes" },
    { items: report.actionsRecommendations, type: "actions" },
  ];

  for (const section of sections) {
    for (const item of section.items) {
      chunks.push({
        id: `${interviewId}-rc-${idx++}`,
        text: item,
        sectionType: section.type,
      });
    }
  }

  // Additional insight
  if (report.additionalInsight) {
    chunks.push({
      id: `${interviewId}-rc-${idx++}`,
      text: report.additionalInsight,
      sectionType: "additional_insight",
    });
  }

  return chunks;
}

export async function buildEmbeddingIndex(): Promise<EmbeddingIndex> {
  console.log("Building embedding index...");
  const metadata = await readMetadataIndex();
  const allChunks: Omit<EmbeddingChunk, "embedding">[] = [];

  for (const interview of metadata.interviews) {
    console.log(`  Chunking: ${interview.client}, ${interview.company}`);

    if (interview.hasTranscript) {
      const transcript = await readTranscript(interview.id);
      if (transcript) {
        const tChunks = chunkTranscript(transcript, interview.id);
        allChunks.push(
          ...tChunks.map((c) => ({
            id: c.id,
            interviewId: interview.id,
            source: "transcript" as const,
            sectionType: c.sectionType,
            text: c.text,
          }))
        );
      }
    }

    if (interview.hasReport) {
      const report = await readReport(interview.id);
      if (report) {
        const rChunks = chunkReport(report, interview.id);
        allChunks.push(
          ...rChunks.map((c) => ({
            id: c.id,
            interviewId: interview.id,
            source: "report" as const,
            sectionType: c.sectionType,
            text: c.text,
          }))
        );
      }
    }
  }

  console.log(`  Total chunks: ${allChunks.length}`);
  console.log("  Generating embeddings...");

  const texts = allChunks.map((c) => c.text);
  const embeddings = await generateEmbeddings(texts);

  const embeddingChunks: EmbeddingChunk[] = allChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i],
  }));

  const index: EmbeddingIndex = {
    model: EMBEDDING_MODEL,
    lastUpdated: new Date().toISOString(),
    chunks: embeddingChunks,
  };

  await writeEmbeddingIndex(index);
  console.log("  Embedding index saved.");

  return index;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function searchSimilar(
  queryEmbedding: number[],
  topK: number = 10,
  filters?: {
    region?: string;
    solution?: string;
    npsCategory?: string;
    interviewIds?: string[];
    source?: "transcript" | "report" | "both";
  }
): Promise<(EmbeddingChunk & { score: number })[]> {
  const embeddingIndex = await readEmbeddingIndex();
  if (!embeddingIndex) return [];

  const metadata = await readMetadataIndex();
  const interviewMap = new Map(metadata.interviews.map((i) => [i.id, i]));

  let chunks = embeddingIndex.chunks;

  // Apply metadata filters
  if (filters) {
    chunks = chunks.filter((chunk) => {
      const interview = interviewMap.get(chunk.interviewId);
      if (!interview) return false;
      if (filters.region && interview.region !== filters.region) return false;
      if (filters.solution && interview.solution !== filters.solution)
        return false;
      if (filters.npsCategory && interview.npsCategory !== filters.npsCategory)
        return false;
      if (
        filters.interviewIds &&
        !filters.interviewIds.includes(chunk.interviewId)
      )
        return false;
      // Source filter: "both" or undefined means include all, otherwise filter by specific source
      if (filters.source && filters.source !== "both") {
        if (chunk.source !== filters.source) return false;
      }
      return true;
    });
  }

  // Score and rank
  const scored = chunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
