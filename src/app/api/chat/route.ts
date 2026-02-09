import { NextRequest } from "next/server";
import {
  streamChatResponse,
  streamChatResponseWithVectorStore,
  streamStaticResponse,
} from "@/lib/ai/chat";
import { getVectorStoreIdIfReady } from "@/lib/ai/vector-store";
import { readEmbeddingIndex } from "@/lib/data/store";
import { exhaustiveSearchInterviews } from "@/lib/ai/exhaustive-search";

function isExhaustiveListQuery(text: string): boolean {
  return /\b(list|all|every|which|who|count|by region|by solution|by engagement|by account)\b/i.test(
    text
  );
}

function formatExhaustiveMatches(query: string, matches: Awaited<ReturnType<typeof exhaustiveSearchInterviews>>): string {
  if (matches.length === 0) {
    return `## No matches found\n\nNo interviews matched this query using a full scan. Try adding a specific phrase in quotes (e.g. \"more information\") or another keyword.`;
  }

  const lines = [
    `## Matches (${matches.length})`,
    "",
  ];

  for (const m of matches) {
    const meta = m.interview;
    lines.push(
      `- **${meta.client}, ${meta.company}** — ${meta.region} | ${meta.solution} | ${meta.accountType} | NPS ${meta.score} (${meta.npsCategory}) | ${meta.id}`
    );
    if (m.snippet) {
      lines.push(`  > ${m.snippet}`);
    }
  }

  lines.push("");
  lines.push(`_Matched using full scan for query:_ ${query}`);
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const { messages, filters } = await request.json();

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const latestMessage = messages[messages.length - 1]?.content ?? "";

    // Deterministic exhaustive scan for list-style queries
    if (latestMessage && isExhaustiveListQuery(latestMessage)) {
      const matches = await exhaustiveSearchInterviews(latestMessage);
      const content = formatExhaustiveMatches(latestMessage, matches);
      const stream = streamStaticResponse(content);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Prefer Responses API with file_search (vector store) when available
    const vectorStoreId = await getVectorStoreIdIfReady();
    if (vectorStoreId) {
      const stream = await streamChatResponseWithVectorStore(messages, vectorStoreId);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Fallback: local embeddings (legacy)
    const embeddingIndex = await readEmbeddingIndex();
    if (!embeddingIndex || embeddingIndex.chunks.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Chat is not ready. Go to Themes or Opportunities and click \"Generate themes & insights\" to run reindex (this sets up the vector store and embeddings).",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const stream = await streamChatResponse(messages, filters);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
