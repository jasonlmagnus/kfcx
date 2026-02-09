import OpenAI from "openai";

/** Model for all Responses API usage (chat + analysis). */
export const CHAT_MODEL = "gpt-5.2";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}
