"use client";

import { useState } from "react";

export default function ReindexButton({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReindex = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reindex", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error || data.details || "Reindex failed";
        const details = Array.isArray(data.results) ? data.results.join(" ") : "";
        setError(details ? `${msg} ${details}` : msg);
        return;
      }

      if (data.success === false) {
        const msg = data.error || "One or more steps failed.";
        const details = Array.isArray(data.results) ? data.results.join(" • ") : "";
        setError(details ? `${msg} ${details}` : msg);
        return;
      }

      onSuccess?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Reindex failed";
      setError(
        msg.includes("fetch") || msg.includes("Failed to fetch")
          ? "Request failed or timed out. Check that OPENAI_API_KEY is set in .env.local (note the leading dot) and try again."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleReindex}
        disabled={loading}
        className="px-4 py-2 bg-kf-primary text-white text-sm font-medium rounded-md hover:bg-kf-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Generating… (can take 1–2 min)" : "Generate themes & insights"}
      </button>
      {error && (
        <p className="text-sm text-red-600 max-w-xl">
          {error}
          {error.includes("API") && (
            <span className="block mt-1 text-gray-600">
              Rename your env file to <code className="bg-gray-100 px-1 rounded">.env.local</code> if it’s currently <code className="bg-gray-100 px-1 rounded">env.local</code>.
            </span>
          )}
        </p>
      )}
    </div>
  );
}
