/**
 * OpenAI Vector Store + Assistant for Chat.
 * Syncs interview content as one file per interview for better retrieval,
 * and provides an assistant that uses file_search for retrieval.
 */

import fs from "fs";
import path from "path";
import { getOpenAIClient, ASSISTANT_MODEL } from "./openai";
import {
  readMetadataIndex,
  readTranscript,
  readReport,
  readVectorStoreConfig,
  writeVectorStoreConfig,
} from "@/lib/data/store";
import type {
  NormalizedReport,
  NormalizedTranscript,
  InterviewMetadata,
} from "@/types";

const VECTOR_STORE_NAME = "KFCX NPS Interview Content";
const ASSISTANT_INSTRUCTIONS = `You are the KFCX NPS Interview Insight Assistant for Korn Ferry. You answer questions using only the attached interview knowledge base from Korn Ferry's Customer Centricity NPS programme.

RULES:
1. Base every answer on the retrieved files. If the files do not contain enough information, say so — do not guess or generalise.
2. Always cite the source: use the client name and company in brackets, e.g. [Lisa Bolger, PartnerRe]. If multiple clients support a point, list them.
3. Prefer direct quotes from the interviews; put them in quotation marks. Use transcript content for verbatim client voice and report content for themes and recommendations.
4. When mentioning NPS, state the category: Promoter (9–10), Passive (7–8), or Detractor (0–6).
5. For themes, patterns, or trends: synthesise across the retrieved interviews and name which clients said what.
6. Keep answers specific and actionable. End with clear takeaways or next steps when relevant.`;

/** Build text content for a single interview (one file per interview = better retrieval). */
export async function buildContentForInterview(
  interview: InterviewMetadata
): Promise<string> {
  const header = [
    "INTERVIEW",
    `Client: ${interview.client}`,
    `Company: ${interview.company}`,
    `ID: ${interview.id} | NPS: ${interview.score} (${interview.npsCategory}) | ${interview.region} | ${interview.solution}`,
    "",
  ].join("\n");

  const parts: string[] = [header];

  if (interview.hasReport) {
    const report = await readReport(interview.id);
    if (report) parts.push(formatReport(report));
  }

  if (interview.hasTranscript) {
    const transcript = await readTranscript(interview.id);
    if (transcript) parts.push(formatTranscript(transcript));
  }

  return parts.join("\n\n");
}

/** Build a single document from all interviews (legacy / optional). */
export async function buildInterviewContentForVectorStore(): Promise<string> {
  const index = await readMetadataIndex();
  const parts: string[] = [];
  for (const interview of index.interviews) {
    parts.push(await buildContentForInterview(interview));
  }
  return parts.join("\n\n---\n\n");
}

function formatReport(r: NormalizedReport): string {
  const sections: string[] = [];
  sections.push("[REPORT]");
  sections.push("Overview: " + r.overview);
  if (r.whatWentWell.length)
    sections.push("What went well: " + r.whatWentWell.join(" | "));
  if (r.challengesPainPoints.length)
    sections.push("Challenges: " + r.challengesPainPoints.join(" | "));
  if (r.gapsIdentified.length)
    sections.push("Gaps: " + r.gapsIdentified.join(" | "));
  if (r.keyThemes.length)
    sections.push("Key themes: " + r.keyThemes.join(" | "));
  if (r.actionsRecommendations.length)
    sections.push("Actions & recommendations: " + r.actionsRecommendations.join(" | "));
  if (r.additionalInsight)
    sections.push("Additional insight: " + r.additionalInsight);
  return sections.join("\n");
}

function formatTranscript(t: NormalizedTranscript): string {
  const parts: string[] = [];
  parts.push("[TRANSCRIPT]");
  if (t.overview) parts.push("Overview: " + t.overview);
  for (const section of t.sections) {
    parts.push(section.title + ": " + section.points.join(" "));
  }
  if (t.fullTranscript?.length) {
    const dialogue = t.fullTranscript
      .map((turn) => `${turn.speaker}: ${turn.text}`)
      .join("\n");
    parts.push("Dialogue:\n" + dialogue);
  } else if (t.rawText) {
    parts.push("Transcript: " + t.rawText);
  }
  return parts.join("\n");
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

/** Max concurrent file uploads to the vector store. */
const VECTOR_STORE_UPLOAD_CONCURRENCY = 5;

/** Replace all files in the vector store with one file per interview for better retrieval. */
export async function syncVectorStore(): Promise<{
  vectorStoreId: string;
  fileCount: number;
}> {
  const openai = getOpenAIClient();
  const vectorStoreId = await getOrCreateVectorStore();
  const config = await readVectorStoreConfig();
  const index = await readMetadataIndex();
  const dataRoot = path.join(process.cwd(), "data", "store");
  const tmpDir = path.join(dataRoot, "vs_upload");
  await fs.promises.mkdir(tmpDir, { recursive: true });

  // Remove existing files in parallel
  const existingFiles = await openai.vectorStores.files.list(vectorStoreId);
  const fileIds: string[] = [];
  for await (const file of existingFiles) fileIds.push(file.id);
  await Promise.all(
    fileIds.map((id) => openai.vectorStores.files.del(vectorStoreId, id))
  );

  // Build content and write temp files for all interviews
  const toUpload: { tmpPath: string }[] = [];
  for (const interview of index.interviews) {
    const content = await buildContentForInterview(interview);
    if (!content.trim()) continue;
    const safeId = interview.id.replace(/[^a-z0-9-_]/gi, "_");
    const tmpPath = path.join(tmpDir, `interview_${safeId}.txt`);
    await fs.promises.writeFile(tmpPath, content, "utf-8");
    toUpload.push({ tmpPath });
  }

  // Upload in parallel batches
  let fileCount = 0;
  for (let i = 0; i < toUpload.length; i += VECTOR_STORE_UPLOAD_CONCURRENCY) {
    const batch = toUpload.slice(i, i + VECTOR_STORE_UPLOAD_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ tmpPath }) => {
        const fileStream = fs.createReadStream(tmpPath);
        try {
          await openai.vectorStores.files.uploadAndPoll(
            vectorStoreId,
            fileStream
          );
          fileCount++;
        } finally {
          await fs.promises.unlink(tmpPath).catch(() => {});
        }
      })
    );
  }

  await fs.promises.rm(tmpDir, { recursive: true }).catch(() => {});

  await writeVectorStoreConfig({
    ...config,
    vectorStoreId,
    lastSyncedAt: new Date().toISOString(),
  });

  return { vectorStoreId, fileCount };
}

/** Get existing assistant ID or create one that uses the vector store. */
export async function getOrCreateAssistant(vectorStoreId: string): Promise<string> {
  const openai = getOpenAIClient();
  const config = await readVectorStoreConfig();

  if (config.assistantId) {
    try {
      const assistant = await openai.beta.assistants.retrieve(config.assistantId);
      const updates: Parameters<typeof openai.beta.assistants.update>[1] = {};
      const vsIds = assistant.tool_resources?.file_search?.vector_store_ids ?? [];
      if (vsIds[0] !== vectorStoreId) {
        updates.tool_resources = {
          file_search: { vector_store_ids: [vectorStoreId] },
        };
      }
      if (assistant.model !== ASSISTANT_MODEL) {
        updates.model = ASSISTANT_MODEL;
      }
      if (Object.keys(updates).length > 0) {
        await openai.beta.assistants.update(config.assistantId, updates);
      }
      return config.assistantId;
    } catch {
      // Assistant was deleted; create new one
    }
  }

  const assistant = await openai.beta.assistants.create({
    model: ASSISTANT_MODEL,
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
