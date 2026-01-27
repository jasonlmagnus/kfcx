"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils/dates";
import type { ThemeAnalysis, ThemeGroup, Theme } from "@/types";

type TabKey = "whyClientsChoose" | "promoterExperience" | "whereFallsShort";

interface TabDefinition {
  key: TabKey;
  label: string;
}

const TABS: TabDefinition[] = [
  { key: "whyClientsChoose", label: "Why Clients Choose KF" },
  { key: "promoterExperience", label: "Promoter Experience" },
  { key: "whereFallsShort", label: "Where Falls Short" },
];

function SentimentDot({ sentiment }: { sentiment: Theme["sentiment"] }) {
  const colorClass =
    sentiment === "positive"
      ? "bg-green-500"
      : sentiment === "negative"
        ? "bg-red-500"
        : "bg-gray-400";

  const label =
    sentiment === "positive"
      ? "Positive"
      : sentiment === "negative"
        ? "Negative"
        : "Neutral";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${colorClass}`} />
      {label}
    </span>
  );
}

function ThemeCard({ theme }: { theme: Theme }) {
  const [quotesOpen, setQuotesOpen] = useState(false);

  return (
    <div className="section-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="font-bold text-gray-900">{theme.label}</h3>
        <SentimentDot sentiment={theme.sentiment} />
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3">{theme.description}</p>

      {/* Frequency badge */}
      <div className="mb-4">
        <span className="inline-flex items-center rounded-full bg-kf-primary/10 px-3 py-1 text-xs font-medium text-kf-primary">
          Mentioned in {theme.frequency} interview{theme.frequency !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Supporting Quotes toggle */}
      {theme.supportingQuotes.length > 0 && (
        <div>
          <button
            onClick={() => setQuotesOpen(!quotesOpen)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-kf-primary transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${quotesOpen ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            Supporting Quotes ({theme.supportingQuotes.length})
          </button>

          {quotesOpen && (
            <div className="mt-3 space-y-4 pl-5 border-l-2 border-gray-200">
              {theme.supportingQuotes.map((quote, idx) => (
                <div key={idx}>
                  <p className="text-sm italic text-gray-600">
                    &ldquo;{quote.text}&rdquo;
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">
                      &mdash; {quote.client}, {quote.company}
                    </span>
                    <Link
                      href={`/interviews/${quote.interviewId}`}
                      className="text-xs font-medium text-kf-primary hover:underline"
                    >
                      View Interview
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ThemesPage() {
  const [data, setData] = useState<ThemeAnalysis | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("whyClientsChoose");

  useEffect(() => {
    const fetchThemes = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/themes");
        const json = await res.json();

        if (json.empty) {
          setIsEmpty(true);
          setData(null);
        } else {
          setData(json as ThemeAnalysis);
          setIsEmpty(false);
        }
      } catch (error) {
        console.error("Failed to fetch themes:", error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchThemes();
  }, []);

  const activeGroup: ThemeGroup | null = data ? data[activeTab] : null;

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Themes</h1>
        <p className="text-gray-500 mt-1">
          Explore insights and patterns from NPS interviews
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner />
      ) : isEmpty || !data ? (
        <EmptyState
          title="No themes available"
          description="Theme analysis has not been generated yet. Use the reindex feature to generate themes."
        />
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-6 -mb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`pb-3 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? "border-b-2 border-kf-primary text-kf-primary"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Theme Group Header */}
          {activeGroup && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {activeGroup.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {activeGroup.description}
              </p>
            </div>
          )}

          {/* Theme Cards */}
          {activeGroup && activeGroup.themes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeGroup.themes.map((theme) => (
                <ThemeCard key={theme.id} theme={theme} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">
              No themes found in this category.
            </p>
          )}

          {/* Last Generated Timestamp */}
          {data.lastGenerated && (
            <p className="text-xs text-gray-400 mt-8 text-right">
              Last generated: {formatDate(data.lastGenerated)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
