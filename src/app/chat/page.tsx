"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

const SUGGESTED_QUERIES = [
  "Why do clients choose Korn Ferry?",
  "What are the main challenges reported by detractors?",
  "Show me positive quotes about candidate quality",
  "What opportunities for follow-up exist?",
  "How does the promoter experience differ from detractors?",
];

/**
 * Renders assistant message content with basic formatting:
 * - Preserves line breaks via whitespace-pre-wrap
 * - Bold text wrapped in **double asterisks**
 * - Lines starting with "- " rendered as list items
 */
function FormattedContent({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trimStart();
        const isBullet = trimmed.startsWith("- ");

        // Process inline bold markers (**text**)
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={j}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-gray-400 select-none">&bull;</span>
              <span>{rendered.map((r, idx) => {
                // Strip the leading "- " from the first text span
                if (idx === 0 && typeof parts[0] === "string" && parts[0].trimStart().startsWith("- ")) {
                  const stripped = parts[0].trimStart().slice(2);
                  const subParts = stripped.split(/(\*\*[^*]+\*\*)/g);
                  return subParts.map((sp, si) => {
                    if (sp.startsWith("**") && sp.endsWith("**")) {
                      return (
                        <strong key={`${idx}-${si}`} className="font-semibold">
                          {sp.slice(2, -2)}
                        </strong>
                      );
                    }
                    return <span key={`${idx}-${si}`}>{sp}</span>;
                  });
                }
                return r;
              })}</span>
            </div>
          );
        }

        return (
          <div key={i} style={{ whiteSpace: "pre-wrap" }}>
            {rendered}
          </div>
        );
      })}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError("");
      setInput("");

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);

      // Add placeholder assistant message for streaming
      const assistantMessage: ChatMessage = { role: "assistant", content: "" };
      setMessages([...updatedMessages, assistantMessage]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            filters: {},
          }),
        });

        if (response.status === 503) {
          setMessages(updatedMessages);
          setError(
            "Embeddings not generated. Please run reindex first."
          );
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          let errMsg = "An error occurred while processing your request.";
          try {
            const errData = await response.json();
            if (errData.error) errMsg = errData.error;
          } catch {
            // ignore parse error
          }
          setMessages(updatedMessages);
          setError(errMsg);
          setIsLoading(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setMessages(updatedMessages);
          setError("Failed to read response stream.");
          setIsLoading(false);
          return;
        }

        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let sources: string[] = [];
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines from buffer
          const lines = buffer.split("\n");
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith("data: ")) continue;

            const jsonStr = trimmedLine.slice(6);
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.error) {
                setMessages(updatedMessages);
                setError(data.error);
                setIsLoading(false);
                reader.cancel();
                return;
              }

              if (data.content) {
                accumulatedContent += data.content;
                setMessages([
                  ...updatedMessages,
                  { role: "assistant", content: accumulatedContent },
                ]);
              }

              if (data.sources && Array.isArray(data.sources)) {
                sources = data.sources;
              }

              if (data.done) {
                setMessages([
                  ...updatedMessages,
                  {
                    role: "assistant",
                    content: accumulatedContent,
                    sources: sources.length > 0 ? sources : undefined,
                  },
                ]);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // Process any remaining buffer content
        if (buffer.trim().startsWith("data: ")) {
          const jsonStr = buffer.trim().slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.content) {
              accumulatedContent += data.content;
            }
            if (data.sources && Array.isArray(data.sources)) {
              sources = data.sources;
            }
          } catch {
            // ignore
          }
        }

        // Ensure final message is set with sources
        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: accumulatedContent,
            sources: sources.length > 0 ? sources : undefined,
          },
        ]);
      } catch (err) {
        setMessages(updatedMessages);
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestedClick = (query: string) => {
    sendMessage(query);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Page Header */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-gray-900">Chat</h1>
        <p className="text-gray-500 mt-1">
          Ask questions about NPS interview data
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-4">
        {/* Suggested queries (shown when chat is empty) */}
        {isEmpty && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center mb-8">
              <svg
                className="mx-auto h-12 w-12 text-gray-300 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-gray-400 text-sm">
                Start a conversation or try one of these suggestions
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
              {SUGGESTED_QUERIES.map((query) => (
                <button
                  key={query}
                  type="button"
                  onClick={() => handleSuggestedClick(query)}
                  className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-full text-gray-700 hover:border-kf-primary hover:text-kf-primary transition-colors shadow-sm"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {!isEmpty && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-lg text-sm ${
                    message.role === "user"
                      ? "bg-kf-primary text-white"
                      : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <>
                      {message.content ? (
                        <FormattedContent text={message.content} />
                      ) : (
                        <div className="flex items-center gap-2 text-gray-400">
                          <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                          <div
                            className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                            style={{ animationDelay: "0.15s" }}
                          />
                          <div
                            className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                            style={{ animationDelay: "0.3s" }}
                          />
                        </div>
                      )}

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            Sources
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {message.sources.map((source, si) => (
                              <span
                                key={si}
                                className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                              >
                                {source}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ whiteSpace: "pre-wrap" }}>
                      {message.content}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex-shrink-0 max-w-3xl mx-auto w-full mb-3">
          <div className="rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 -mx-8 px-8 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the NPS data..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-kf-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            )}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
