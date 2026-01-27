import { NextRequest } from "next/server";
import { streamChatResponse } from "@/lib/ai/chat";
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

    // Check if embeddings exist
    const embeddingIndex = await readEmbeddingIndex();
    if (!embeddingIndex || embeddingIndex.chunks.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Embeddings have not been generated yet. Please run the reindex process first.",
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
