"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import MetadataLabel from "@/components/shared/MetadataLabel";
import NPSBadge from "@/components/shared/NPSBadge";
import { formatDate } from "@/lib/utils/dates";
import type { ThemeAnalysis, Theme, InterviewMetadata, QuoteReference } from "@/types";

const REGION_OPTIONS = ["All", "NA", "EMEA", "APAC", "LATAM"] as const;
const NPS_OPTIONS = ["All", "Promoters", "Passives", "Detractors"] as const;

// Keywords that indicate engagement preferences
const ENGAGEMENT_KEYWORDS = [
  "communication",
  "engage",
  "contact",
  "meeting",
  "relationship",
  "partnership",
  "collaborate",
  "respond",
  "responsive",
  "proactive",
  "regular",
  "frequency",
  "update",
  "check-in",
  "touchpoint",
  "interaction",
  "accessibility",
  "available",
  "reach",
  "support",
  "service",
];

function QuoteCard({ quote }: { quote: QuoteReference }) {
  return (
    <div className="section-card p-5">
      <p className="text-sm italic text-gray-600 mb-3">
        &ldquo;{quote.text}&rdquo;
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-700">
          {quote.client}, {quote.company}
        </span>
        <NPSBadge score={quote.score} size="sm" />
        <MetadataLabel type="region" value={quote.region} />
        {quote.accountType && (
          <MetadataLabel type="account" value={quote.accountType} />
        )}
        {quote.solution && (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
            {quote.solution}
          </span>
        )}
      </div>
      <Link
        href={`/interviews/${quote.interviewId}`}
        className="text-xs font-medium text-kf-primary hover:underline"
      >
        View Interview →
      </Link>
    </div>
  );
}

function ThemeCard({ theme }: { theme: Theme }) {
  const [quotesOpen, setQuotesOpen] = useState(false);

  return (
    <div className="section-card p-5">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="font-bold text-gray-900">{theme.label}</h3>
        <span className="inline-flex items-center rounded-full bg-kf-primary/10 px-3 py-1 text-xs font-medium text-kf-primary">
          {theme.frequency} mention{theme.frequency !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-3">{theme.description}</p>

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
            <div className="mt-3 space-y-3">
              {theme.supportingQuotes.map((quote, idx) => (
                <QuoteCard key={idx} quote={quote} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EngagementPage() {
  const [data, setData] = useState<ThemeAnalysis | null>(null);
  const [interviews, setInterviews] = useState<InterviewMetadata[]>([]);
  const [isEmpty, setIsEmpty] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [region, setRegion] = useState("All");
  const [npsCategory, setNpsCategory] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [themesRes, interviewsRes] = await Promise.all([
          fetch("/api/themes"),
          fetch("/api/interviews"),
        ]);
        const themesJson = await themesRes.json();
        const interviewsJson = await interviewsRes.json();

        if (themesJson.empty) {
          setIsEmpty(true);
          setData(null);
        } else {
          setData(themesJson as ThemeAnalysis);
          setIsEmpty(false);
        }
        setInterviews(interviewsJson.interviews || []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Build lookup for interview dates
  const interviewDateMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const interview of interviews) {
      map[interview.id] = interview.interviewDate;
    }
    return map;
  }, [interviews]);

  // Filter function for quotes
  const quoteMatchesFilters = (quote: QuoteReference): boolean => {
    if (region !== "All" && quote.region !== region) {
      return false;
    }
    if (npsCategory !== "All") {
      const categoryMap: Record<string, string> = {
        Promoters: "promoter",
        Passives: "passive",
        Detractors: "detractor",
      };
      if (quote.npsCategory !== categoryMap[npsCategory]) {
        return false;
      }
    }
    const interviewDate = interviewDateMap[quote.interviewId];
    if (interviewDate) {
      if (dateFrom && interviewDate < dateFrom) {
        return false;
      }
      if (dateTo && interviewDate > dateTo) {
        return false;
      }
    }
    return true;
  };

  // Check if theme is related to engagement
  const isEngagementRelated = (theme: Theme): boolean => {
    const textToCheck = `${theme.label} ${theme.description}`.toLowerCase();
    return ENGAGEMENT_KEYWORDS.some((keyword) => textToCheck.includes(keyword));
  };

  // Get all themes and filter for engagement-related ones
  const engagementThemes = useMemo(() => {
    if (!data) return [];

    const allThemes = [
      ...data.whyClientsChoose.themes,
      ...data.promoterExperience.themes,
      ...data.whereFallsShort.themes,
      ...(data.additionalThemes?.flatMap((g) => g.themes) || []),
    ];

    // Filter for engagement-related themes
    const filtered = allThemes
      .filter(isEngagementRelated)
      .map((theme) => ({
        ...theme,
        supportingQuotes: theme.supportingQuotes.filter(quoteMatchesFilters),
      }))
      .filter((theme) => {
        // Only show if quotes match filters (or no filters applied)
        if (region === "All" && npsCategory === "All" && !dateFrom && !dateTo) {
          return true;
        }
        return theme.supportingQuotes.length > 0;
      });

    return filtered;
  }, [data, region, npsCategory, dateFrom, dateTo, interviewDateMap]);

  // Get all quotes related to engagement from non-theme sources
  const engagementQuotes = useMemo(() => {
    if (!data) return [];

    const allThemes = [
      ...data.whyClientsChoose.themes,
      ...data.promoterExperience.themes,
      ...data.whereFallsShort.themes,
    ];

    const quotes: QuoteReference[] = [];
    for (const theme of allThemes) {
      for (const quote of theme.supportingQuotes) {
        const quoteText = quote.text.toLowerCase();
        if (ENGAGEMENT_KEYWORDS.some((keyword) => quoteText.includes(keyword))) {
          if (quoteMatchesFilters(quote)) {
            quotes.push(quote);
          }
        }
      }
    }

    // Deduplicate by text
    const seen = new Set<string>();
    return quotes.filter((q) => {
      if (seen.has(q.text)) return false;
      seen.add(q.text);
      return true;
    });
  }, [data, region, npsCategory, dateFrom, dateTo, interviewDateMap]);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="page-title">How Clients Want to Be Engaged</h1>
        <p className="text-gray-500 mt-2">
          Insights on client engagement preferences and communication expectations
        </p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : isEmpty || !data ? (
        <div className="section-card p-8 max-w-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            No data available
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Theme analysis has not been generated yet. Go to{" "}
            <Link href="/themes" className="text-kf-primary hover:underline">
              Themes
            </Link>{" "}
            and generate insights first.
          </p>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="filter-select"
            >
              {REGION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "All" ? "All Regions" : opt}
                </option>
              ))}
            </select>

            <select
              value={npsCategory}
              onChange={(e) => setNpsCategory(e.target.value)}
              className="filter-select"
            >
              {NPS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "All" ? "All NPS Categories" : opt}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="filter-select"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="filter-select"
              />
            </div>

            {(region !== "All" || npsCategory !== "All" || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setRegion("All");
                  setNpsCategory("All");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-sm text-kf-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Engagement Themes */}
          {engagementThemes.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Engagement Themes ({engagementThemes.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {engagementThemes.map((theme) => (
                  <ThemeCard key={theme.id} theme={theme} />
                ))}
              </div>
            </div>
          )}

          {/* Direct Quotes */}
          {engagementQuotes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Client Quotes on Engagement ({engagementQuotes.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {engagementQuotes.slice(0, 20).map((quote, idx) => (
                  <QuoteCard key={idx} quote={quote} />
                ))}
              </div>
              {engagementQuotes.length > 20 && (
                <p className="text-sm text-gray-400 mt-4 text-center">
                  Showing 20 of {engagementQuotes.length} quotes
                </p>
              )}
            </div>
          )}

          {engagementThemes.length === 0 && engagementQuotes.length === 0 && (
            <EmptyState
              title="No engagement insights found"
              description="No themes or quotes matching engagement criteria were found. Try adjusting your filters."
            />
          )}

          {/* Last Generated Timestamp */}
          {data.lastGenerated && (
            <p className="text-xs text-gray-400 mt-8 text-right">
              Data generated: {formatDate(data.lastGenerated)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
