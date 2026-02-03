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

// Categories for brand insights
const BRAND_CATEGORIES = {
  brand: {
    label: "Brand Perception",
    keywords: ["brand", "reputation", "name", "recognition", "known", "perception", "image", "trust"],
  },
  offering: {
    label: "Service Offering",
    keywords: ["offering", "service", "solution", "capability", "expertise", "specialization", "product"],
  },
  marketing: {
    label: "Marketing & Communications",
    keywords: ["marketing", "advertising", "campaign", "content", "website", "newsletter", "email", "social media"],
  },
  sponsorship: {
    label: "Sponsorship & Events",
    keywords: ["sponsor", "event", "conference", "webinar", "seminar", "thought leadership", "research", "publication"],
  },
  differentiation: {
    label: "Differentiation & Positioning",
    keywords: ["different", "unique", "competitor", "stand out", "advantage", "distinguish", "compared"],
  },
};

type CategoryKey = keyof typeof BRAND_CATEGORIES;

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

export default function BrandInsightsPage() {
  const [data, setData] = useState<ThemeAnalysis | null>(null);
  const [interviews, setInterviews] = useState<InterviewMetadata[]>([]);
  const [isEmpty, setIsEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryKey | "all">("all");

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

  // Check if text matches category keywords
  const matchesCategory = (text: string, category: CategoryKey): boolean => {
    const lowerText = text.toLowerCase();
    return BRAND_CATEGORIES[category].keywords.some((keyword) =>
      lowerText.includes(keyword)
    );
  };

  // Type for category insights
  type CategoryInsights = Record<CategoryKey, { themes: Theme[]; quotes: QuoteReference[] }>;

  // Get themes and quotes by category
  const insightsByCategory = useMemo((): CategoryInsights => {
    const emptyResult: CategoryInsights = {
      brand: { themes: [], quotes: [] },
      offering: { themes: [], quotes: [] },
      marketing: { themes: [], quotes: [] },
      sponsorship: { themes: [], quotes: [] },
      differentiation: { themes: [], quotes: [] },
    };

    if (!data) return emptyResult;

    const allThemes = [
      ...data.whyClientsChoose.themes,
      ...data.promoterExperience.themes,
      ...data.whereFallsShort.themes,
      ...(data.additionalThemes?.flatMap((g) => g.themes) || []),
    ];

    const result: CategoryInsights = {
      brand: { themes: [], quotes: [] },
      offering: { themes: [], quotes: [] },
      marketing: { themes: [], quotes: [] },
      sponsorship: { themes: [], quotes: [] },
      differentiation: { themes: [], quotes: [] },
    };

    // Categorize themes
    for (const theme of allThemes) {
      const textToCheck = `${theme.label} ${theme.description}`;
      for (const category of Object.keys(BRAND_CATEGORIES) as CategoryKey[]) {
        if (matchesCategory(textToCheck, category)) {
          const filteredTheme = {
            ...theme,
            supportingQuotes: theme.supportingQuotes.filter(quoteMatchesFilters),
          };
          if (
            region === "All" &&
            npsCategory === "All" &&
            !dateFrom &&
            !dateTo
          ) {
            result[category].themes.push(filteredTheme);
          } else if (filteredTheme.supportingQuotes.length > 0) {
            result[category].themes.push(filteredTheme);
          }
        }
      }
    }

    // Collect quotes by category
    const seenQuotes = new Set<string>();
    for (const theme of allThemes) {
      for (const quote of theme.supportingQuotes) {
        if (seenQuotes.has(quote.text)) continue;
        if (!quoteMatchesFilters(quote)) continue;

        for (const category of Object.keys(BRAND_CATEGORIES) as CategoryKey[]) {
          if (matchesCategory(quote.text, category)) {
            result[category].quotes.push(quote);
            seenQuotes.add(quote.text);
          }
        }
      }
    }

    return result;
  }, [data, region, npsCategory, dateFrom, dateTo, interviewDateMap]);

  // Get total counts
  const totalThemes = Object.values(insightsByCategory).reduce(
    (sum, cat) => sum + cat.themes.length,
    0
  );
  const totalQuotes = Object.values(insightsByCategory).reduce(
    (sum, cat) => sum + cat.quotes.length,
    0
  );

  // Get active insights
  const activeInsights =
    activeCategory === "all"
      ? {
          themes: Object.values(insightsByCategory).flatMap((c) => c.themes),
          quotes: Object.values(insightsByCategory).flatMap((c) => c.quotes),
        }
      : insightsByCategory[activeCategory] || { themes: [], quotes: [] };

  // Deduplicate
  const uniqueThemes = activeInsights.themes.filter(
    (theme, idx, arr) => arr.findIndex((t) => t.id === theme.id) === idx
  );
  const uniqueQuotes = activeInsights.quotes.filter(
    (quote, idx, arr) => arr.findIndex((q) => q.text === quote.text) === idx
  );

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="page-title">Brand Insights</h1>
        <p className="text-gray-500 mt-2">
          Client perspectives on brand, offering, marketing, and sponsorship
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
          {/* Category Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-4 -mb-px overflow-x-auto">
              <button
                onClick={() => setActiveCategory("all")}
                className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === "all"
                    ? "border-b-2 border-kf-primary text-kf-primary"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All ({totalThemes} themes)
              </button>
              {(Object.keys(BRAND_CATEGORIES) as CategoryKey[]).map((key) => {
                const count = insightsByCategory[key]?.themes.length || 0;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors ${
                      activeCategory === key
                        ? "border-b-2 border-kf-primary text-kf-primary"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {BRAND_CATEGORIES[key].label} ({count})
                  </button>
                );
              })}
            </nav>
          </div>

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

          {/* Themes */}
          {uniqueThemes.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {activeCategory === "all"
                  ? "All Brand-Related Themes"
                  : BRAND_CATEGORIES[activeCategory].label + " Themes"}{" "}
                ({uniqueThemes.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {uniqueThemes.map((theme) => (
                  <ThemeCard key={theme.id} theme={theme} />
                ))}
              </div>
            </div>
          )}

          {/* Direct Quotes */}
          {uniqueQuotes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Client Quotes ({uniqueQuotes.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {uniqueQuotes.slice(0, 20).map((quote, idx) => (
                  <QuoteCard key={idx} quote={quote} />
                ))}
              </div>
              {uniqueQuotes.length > 20 && (
                <p className="text-sm text-gray-400 mt-4 text-center">
                  Showing 20 of {uniqueQuotes.length} quotes
                </p>
              )}
            </div>
          )}

          {uniqueThemes.length === 0 && uniqueQuotes.length === 0 && (
            <EmptyState
              title="No brand insights found"
              description="No themes or quotes matching brand-related criteria were found. Try adjusting your filters."
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
