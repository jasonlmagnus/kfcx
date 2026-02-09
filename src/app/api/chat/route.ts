import { NextRequest } from "next/server";
import {
  streamChatResponse,
  streamChatResponseWithVectorStore,
} from "@/lib/ai/chat";
import { getVectorStoreIdIfReady } from "@/lib/ai/vector-store";
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
