import { getOpenAIClient, CHAT_MODEL } from "./openai";
import { generateEmbedding, searchSimilar } from "./embeddings";
import { readMetadataIndex } from "@/lib/data/store";
import type { ChatMessage, EmbeddingChunk, InterviewMetadata } from "@/types";

/** Stream chat using OpenAI Assistants API (vector store). Preferred when vector store is synced. */
export async function streamChatResponseWithAssistant(
  messages: ChatMessage[],
  assistantId: string
): Promise<ReadableStream> {
  const openai = getOpenAIClient();
  const encoder = new TextEncoder();

  // Create thread and add full conversation history so follow-ups and context work
  const thread = await openai.beta.threads.create();
  for (const msg of messages) {
    if (!msg.content?.trim()) continue;
    const role = msg.role === "assistant" ? "assistant" : "user";
    await openai.beta.threads.messages.create(thread.id, {
      role,
      content: msg.content,
    });
  }

  // Create run with stream; keep last 50 messages in context for long threads
  const runStream = openai.beta.threads.runs.stream(thread.id, {
    assistant_id: assistantId,
    stream: true,
    truncation_strategy: { type: "last_messages" as const, last_messages: 50 },
  });

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runStream) {
          if (
            event.event === "thread.message.delta" &&
            "data" in event &&
            event.data &&
            "delta" in event.data &&
            event.data.delta?.content
          ) {
            for (const part of event.data.delta.content) {
              if (
                part &&
                typeof part === "object" &&
                "type" in part &&
                part.type === "text" &&
                "text" in part &&
                part.text &&
                typeof part.text.value === "string"
              ) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ content: part.text.value })}\n\n`
                  )
                );
              }
            }
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

RULES: (1) Base answers only on CONTEXT; if information is missing, say so. (2) Cite sources as [Client Name, Company]. (3) Use direct quotes in quotation marks where relevant. (4) For NPS, state Promoter (9-10), Passive (7-8), or Detractor (0-6). (5) Synthesise across interviews when asked about themes or trends. (6) Be specific and actionable.`;

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

export async function streamChatResponse(
  messages: ChatMessage[],
  filters?: {
    region?: string;
    solution?: string;
    npsCategory?: string;
  }
): Promise<ReadableStream> {
  const openai = getOpenAIClient();

  // Generate embedding for the latest user message
  const latestMessage = messages[messages.length - 1].content;
  const queryEmbedding = await generateEmbedding(latestMessage);

  // Search for relevant chunks (more = better context for synthesis)
  const relevantChunks = await searchSimilar(queryEmbedding, 25, filters);

  // Build context
  const metadata = await readMetadataIndex();
  const interviewMap = new Map(metadata.interviews.map((i) => [i.id, i]));
  const context = buildContext(relevantChunks, interviewMap);

  // Build source references for appending
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

  // Build the messages array
  const aiMessages = [
    {
      role: "system" as const,
      content: `${SYSTEM_PROMPT}\n\nCONTEXT:\n${context}`,
    },
    ...messages.slice(-16).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Stream response
  const stream = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: aiMessages,
    stream: true,
    temperature: 0.3,
  });

  // Convert to ReadableStream
  const encoder = new TextEncoder();
  let streamedContent = "";

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            streamedContent += content;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
            );
          }
        }

        // Send source references at the end
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
