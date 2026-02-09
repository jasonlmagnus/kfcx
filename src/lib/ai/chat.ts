import { getOpenAIClient, CHAT_MODEL } from "./openai";
import { FILE_SEARCH_INSTRUCTIONS } from "./vector-store";
import { generateEmbedding, searchSimilar } from "./embeddings";
import { readMetadataIndex } from "@/lib/data/store";
import type { ChatMessage, EmbeddingChunk, InterviewMetadata } from "@/types";

/** Stream a static response (deterministic, no model call). */
export function streamStaticResponse(
  text: string,
  sources?: string[]
): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`)
      );
      if (sources && sources.length > 0) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ sources, done: true })}\n\n`
          )
        );
      } else {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
      }
      controller.close();
    },
  });
}

/** Stream chat using Responses API with file_search (vector store). Preferred when vector store is synced. */
export async function streamChatResponseWithVectorStore(
  messages: ChatMessage[],
  vectorStoreId: string
): Promise<ReadableStream> {
  const openai = getOpenAIClient();
  const encoder = new TextEncoder();

  const inputItems = messages
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content!,
    }));

  const stream = await openai.responses.create({
    model: CHAT_MODEL,
    instructions: FILE_SEARCH_INSTRUCTIONS,
    input: inputItems,
    tools: [{ type: "file_search", vector_store_ids: [vectorStoreId] }],
    stream: true,
    temperature: 0.3,
  });

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream as AsyncIterable<{ type: string; delta?: string }>) {
          if (event.type === "response.output_text.delta" && event.delta) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: event.delta })}\n\n`)
            );
          }
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        );
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : "An error occurred while generating the response.",
            })}\n\n`
          )
        );
      }
      controller.close();
    },
  });
}

const SYSTEM_PROMPT = `You are the KFCX NPS Interview Insight Assistant for Korn Ferry. Answer only using the CONTEXT below from Korn Ferry's Customer Centricity NPS interviews.

RULES: (1) Base answers only on CONTEXT; if information is missing, say so. (2) Cite sources as [Client Name, Company]. (3) Use direct quotes in quotation marks where relevant. (4) For NPS, state Promoter (9-10), Passive (7-8), or Detractor (0-6). (5) Synthesise across interviews when asked about themes or trends. (6) Be specific and actionable. (7) Format in Markdown: **bold** for key terms, bullet or numbered lists for multiple points, > blockquotes for citations, and ##/### headings to structure longer answers.`;

function buildContext(
  chunks: (EmbeddingChunk & { score: number })[],
  interviewMap: Map<string, InterviewMetadata>
): string {
  const contextParts: string[] = [];

  for (const chunk of chunks) {
    const interview = interviewMap.get(chunk.interviewId);
    if (!interview) continue;

    const header = `Source: ${interview.client}, ${interview.company} (Score: ${interview.score}, ${interview.region}, ${interview.solution})`;
    const section = `Section: ${chunk.sectionType.replace(/_/g, " ")}`;
    const source = `Type: ${chunk.source}`;

    contextParts.push(`---\n${header}\n${section} | ${source}\n${chunk.text}`);
  }

  return contextParts.join("\n\n");
}

/** Stream chat using Responses API with in-context RAG (legacy path when no vector store). */
export async function streamChatResponse(
  messages: ChatMessage[],
  filters?: {
    region?: string;
    solution?: string;
    npsCategory?: string;
  }
): Promise<ReadableStream> {
  const openai = getOpenAIClient();

  const latestMessage = messages[messages.length - 1].content;
  const queryEmbedding = await generateEmbedding(latestMessage);
  const relevantChunks = await searchSimilar(queryEmbedding, 25, filters);

  const metadata = await readMetadataIndex();
  const interviewMap = new Map(metadata.interviews.map((i) => [i.id, i]));
  const context = buildContext(relevantChunks, interviewMap);

  const sourceInterviews = new Set(
    relevantChunks.map((c) => c.interviewId)
  );
  const sourceRefs = Array.from(sourceInterviews)
    .map((id) => {
      const interview = interviewMap.get(id);
      return interview
        ? `- ${interview.client}, ${interview.company} (NPS: ${interview.score})`
        : null;
    })
    .filter(Boolean);

  const inputItems = [
    { role: "user" as const, content: `${SYSTEM_PROMPT}\n\nCONTEXT:\n${context}` },
    ...messages.slice(-16).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const stream = await openai.responses.create({
    model: CHAT_MODEL,
    input: inputItems,
    stream: true,
    temperature: 0.3,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream as AsyncIterable<{ type: string; delta?: string }>) {
          if (event.type === "response.output_text.delta" && event.delta) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: event.delta })}\n\n`)
            );
          }
        }

        if (sourceRefs.length > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                sources: sourceRefs,
                done: true,
              })}\n\n`
            )
          );
        } else {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );
        }

        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: "An error occurred while generating the response.",
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });
}
