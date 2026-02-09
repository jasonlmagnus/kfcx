import OpenAI from "openai";

/** Model for Chat Completions (legacy RAG path). */
export const CHAT_MODEL = "gpt-5.2";

/** Model for Assistants API (vector store chat). gpt-5.2 not supported there yet. */
export const ASSISTANT_MODEL = "gpt-4o";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}
