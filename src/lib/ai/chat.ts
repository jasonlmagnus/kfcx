import { getOpenAIClient } from "./openai";
import { generateEmbedding, searchSimilar } from "./embeddings";
import { readMetadataIndex } from "@/lib/data/store";
import type { ChatMessage, EmbeddingChunk, InterviewMetadata } from "@/types";

const SYSTEM_PROMPT = `You are the KFCX NPS Interview Insight Assistant for Korn Ferry. You help users explore client feedback from NPS interviews conducted as part of Korn Ferry's Customer Centricity programme.

Your role is to answer questions based on the interview transcripts and structured reports provided in the CONTEXT below.

Guidelines:
- Always cite your sources by referencing the client name and company in brackets, e.g., [Lisa Bolger, PartnerRe]
- Include direct quotes where relevant, enclosed in quotation marks
- If asked about themes, patterns, or trends, synthesise across multiple interviews
- If you cannot find relevant information in the provided context, say so clearly
- Be specific and evidence-based; avoid speculation
- When discussing NPS scores, note whether the client is a Promoter (9-10), Passive (7-8), or Detractor (0-6)
- Focus on actionable insights that could help improve client experience`;

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

  // Search for relevant chunks
  const relevantChunks = await searchSimilar(queryEmbedding, 15, filters);

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
    ...messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Stream response
  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
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
