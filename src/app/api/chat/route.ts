import { NextRequest } from "next/server";
import {
  streamChatResponse,
  streamChatResponseWithAssistant,
} from "@/lib/ai/chat";
import { getAssistantIdIfReady } from "@/lib/ai/vector-store";
import { readEmbeddingIndex } from "@/lib/data/store";

export async function POST(request: NextRequest) {
  try {
    const { messages, filters } = await request.json();

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prefer OpenAI vector store (Assistants API) when available
    const assistantId = await getAssistantIdIfReady();
    if (assistantId) {
      const stream = await streamChatResponseWithAssistant(messages, assistantId);
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
