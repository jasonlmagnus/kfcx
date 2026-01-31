/**
 * OpenAI Vector Store + Assistant for Chat.
 * Syncs all interview content into one file, uploads to a vector store,
 * and provides an assistant that uses file_search for retrieval.
 */

import fs from "fs";
import path from "path";
import { getOpenAIClient } from "./openai";
import {
  readMetadataIndex,
  readTranscript,
  readReport,
  readVectorStoreConfig,
  writeVectorStoreConfig,
} from "@/lib/data/store";
import type { NormalizedReport, NormalizedTranscript } from "@/types";

const VECTOR_STORE_NAME = "KFCX NPS Interview Content";
const ASSISTANT_INSTRUCTIONS = `You are the KFCX NPS Interview Insight Assistant for Korn Ferry. You help users explore client feedback from NPS interviews conducted as part of Korn Ferry's Customer Centricity programme.

Your role is to answer questions based on the interview transcripts and structured reports in the attached knowledge base.

Guidelines:
- Always cite your sources by referencing the client name and company in brackets, e.g., [Lisa Bolger, PartnerRe]
- Include direct quotes where relevant, enclosed in quotation marks
- If asked about themes, patterns, or trends, synthesise across multiple interviews
- If you cannot find relevant information in the provided context, say so clearly
- Be specific and evidence-based; avoid speculation
- When discussing NPS scores, note whether the client is a Promoter (9-10), Passive (7-8), or Detractor (0-6)
- Focus on actionable insights that could help improve client experience`;

/** Build a single text document from all interviews for the vector store. */
export async function buildInterviewContentForVectorStore(): Promise<string> {
  const index = await readMetadataIndex();
  const parts: string[] = [];

  for (const interview of index.interviews) {
    const header = [
      "---",
      `Interview: ${interview.client}, ${interview.company}`,
      `ID: ${interview.id} | NPS: ${interview.score} | ${interview.npsCategory} | ${interview.region} | ${interview.solution}`,
      "---",
    ].join("\n");
    parts.push(header);

    if (interview.hasReport) {
      const report = await readReport(interview.id);
      if (report) parts.push(formatReport(report));
    }

    if (interview.hasTranscript) {
      const transcript = await readTranscript(interview.id);
      if (transcript) parts.push(formatTranscript(transcript));
    }

    parts.push("");
  }

  return parts.join("\n\n");
}

function formatReport(r: NormalizedReport): string {
  const sections: string[] = [];
  sections.push("Overview\n" + r.overview);
  if (r.whatWentWell.length)
    sections.push("What went well\n" + r.whatWentWell.join("\n"));
  if (r.challengesPainPoints.length)
    sections.push("Challenges / pain points\n" + r.challengesPainPoints.join("\n"));
  if (r.gapsIdentified.length)
    sections.push("Gaps identified\n" + r.gapsIdentified.join("\n"));
  if (r.keyThemes.length)
    sections.push("Key themes\n" + r.keyThemes.join("\n"));
  if (r.actionsRecommendations.length)
    sections.push("Actions & recommendations\n" + r.actionsRecommendations.join("\n"));
  if (r.additionalInsight)
    sections.push("Additional insight\n" + r.additionalInsight);
  return sections.join("\n\n");
}

function formatTranscript(t: NormalizedTranscript): string {
  const parts: string[] = [];
  if (t.overview) parts.push("Overview\n" + t.overview);
  for (const section of t.sections) {
    parts.push(section.title + "\n" + section.points.join("\n"));
  }
  if (t.fullTranscript?.length) {
    const dialogue = t.fullTranscript
      .map((turn) => `${turn.speaker}: ${turn.text}`)
      .join("\n");
    parts.push("Full transcript\n" + dialogue);
  } else if (t.rawText) {
    parts.push("Transcript\n" + t.rawText);
  }
  return parts.join("\n\n");
}

/** Get existing vector store ID or create a new one. */
export async function getOrCreateVectorStore(): Promise<string> {
  const openai = getOpenAIClient();
  const config = await readVectorStoreConfig();

  if (config.vectorStoreId) {
    try {
      await openai.vectorStores.retrieve(config.vectorStoreId);
      return config.vectorStoreId;
    } catch {
      // Vector store was deleted; create new one
    }
  }

  const vs = await openai.vectorStores.create({
    name: VECTOR_STORE_NAME,
  });
  await writeVectorStoreConfig({
    ...config,
    vectorStoreId: vs.id,
  });
  return vs.id;
}

/** Replace all files in the vector store with one file containing current interview content. */
export async function syncVectorStore(): Promise<{ vectorStoreId: string; fileCount: number }> {
  const openai = getOpenAIClient();
  const vectorStoreId = await getOrCreateVectorStore();
  const config = await readVectorStoreConfig();

  // Remove existing files
  const existingFiles = await openai.vectorStores.files.list(vectorStoreId);
  for await (const file of existingFiles) {
    await openai.vectorStores.files.del(vectorStoreId, file.id);
  }

  // Build content, write to temp file, upload (SDK needs a file with filename in Node)
  const content = await buildInterviewContentForVectorStore();
  const dataRoot = path.join(process.cwd(), "data", "store");
  await fs.promises.mkdir(dataRoot, { recursive: true });
  const tmpPath = path.join(dataRoot, "temp_kfcx_interviews.txt");
  await fs.promises.writeFile(tmpPath, content, "utf-8");
  try {
    const fileStream = fs.createReadStream(tmpPath);
    await openai.vectorStores.files.uploadAndPoll(vectorStoreId, fileStream);
  } finally {
    await fs.promises.unlink(tmpPath).catch(() => {});
  }

  await writeVectorStoreConfig({
    ...config,
    vectorStoreId,
    lastSyncedAt: new Date().toISOString(),
  });

  const filesAfter = await openai.vectorStores.files.list(vectorStoreId);
  let fileCount = 0;
  for await (const _ of filesAfter) fileCount++;

  return { vectorStoreId, fileCount };
}

/** Get existing assistant ID or create one that uses the vector store. */
export async function getOrCreateAssistant(vectorStoreId: string): Promise<string> {
  const openai = getOpenAIClient();
  const config = await readVectorStoreConfig();

  if (config.assistantId) {
    try {
      const assistant = await openai.beta.assistants.retrieve(config.assistantId);
      // Update vector store if it changed
      const vsIds = assistant.tool_resources?.file_search?.vector_store_ids ?? [];
      if (vsIds[0] !== vectorStoreId) {
        await openai.beta.assistants.update(config.assistantId, {
          tool_resources: {
            file_search: { vector_store_ids: [vectorStoreId] },
          },
        });
      }
      return config.assistantId;
    } catch {
      // Assistant was deleted; create new one
    }
  }

  const assistant = await openai.beta.assistants.create({
    model: "gpt-4o",
    name: "KFCX NPS Insight Assistant",
    instructions: ASSISTANT_INSTRUCTIONS,
    tools: [{ type: "file_search" }],
    tool_resources: {
      file_search: { vector_store_ids: [vectorStoreId] },
    },
  });

  await writeVectorStoreConfig({
    ...config,
    assistantId: assistant.id,
    vectorStoreId,
  });

  return assistant.id;
}

/** Return assistant ID if vector store and assistant are set up. */
export async function getAssistantIdIfReady(): Promise<string | null> {
  const config = await readVectorStoreConfig();
  if (!config.assistantId || !config.vectorStoreId) return null;
  try {
    await getOpenAIClient().beta.assistants.retrieve(config.assistantId);
    return config.assistantId;
  } catch {
    return null;
  }
}
