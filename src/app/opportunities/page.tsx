"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";

// --- Types ---

type OpportunityType =
  | "future_need"
  | "expansion"
  | "re_engagement"
  | "improvement";

type Urgency = "high" | "medium" | "low";
type Status = "identified" | "in_progress" | "actioned";

interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  description: string;
  urgency: Urgency;
  sourceInterviewId: string;
  client: string;
  company: string;
  supportingQuote: string;
  suggestedAction: string;
  status: Status;
}

interface OpportunitiesResponse {
  lastGenerated: string;
  opportunities: Opportunity[];
  empty?: boolean;
}

// --- Constants ---

const TYPE_CONFIG: Record<
  OpportunityType,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  future_need: {
    label: "Future Need",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  expansion: {
    label: "Expansion",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4",
  },
  re_engagement: {
    label: "Re-engagement",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  },
  improvement: {
    label: "Improvement",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  },
};

const URGENCY_CONFIG: Record<
  Urgency,
  { label: string; color: string; bgColor: string }
> = {
  high: { label: "High", color: "text-red-700", bgColor: "bg-red-100" },
  medium: {
    label: "Medium",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  low: { label: "Low", color: "text-green-700", bgColor: "bg-green-100" },
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "identified", label: "Identified" },
  { value: "in_progress", label: "In Progress" },
  { value: "actioned", label: "Actioned" },
];

const TYPE_ORDER: OpportunityType[] = [
  "future_need",
  "expansion",
  "re_engagement",
  "improvement",
];

// --- Component ---

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Collapsible sections
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  // Status update loading
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpportunities = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/opportunities");
        const data: OpportunitiesResponse = await res.json();

        if (data.empty) {
          setIsEmpty(true);
          setOpportunities([]);
        } else {
          setIsEmpty(false);
          setOpportunities(data.opportunities || []);
          setLastGenerated(data.lastGenerated || null);
        }
      } catch (error) {
        console.error("Failed to fetch opportunities:", error);
        setOpportunities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, []);

  // --- Filtered opportunities ---
  const filtered = opportunities.filter((opp) => {
    if (filterType !== "all" && opp.type !== filterType) return false;
    if (filterUrgency !== "all" && opp.urgency !== filterUrgency) return false;
    if (filterStatus !== "all" && opp.status !== filterStatus) return false;
    return true;
  });

  // --- Grouped by type ---
  const grouped: Record<OpportunityType, Opportunity[]> = {
    future_need: [],
    expansion: [],
    re_engagement: [],
    improvement: [],
  };
  for (const opp of filtered) {
    grouped[opp.type].push(opp);
  }

  // --- Summary stats (from all opportunities, not filtered) ---
  const countByType: Record<OpportunityType, number> = {
    future_need: 0,
    expansion: 0,
    re_engagement: 0,
    improvement: 0,
  };
  for (const opp of opportunities) {
    countByType[opp.type]++;
  }

  // --- Toggle section collapse ---
  const toggleSection = (type: string) => {
    setCollapsedSections((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // --- Status update handler ---
  const handleStatusChange = async (id: string, newStatus: Status) => {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.ok) {
        setOpportunities((prev) =>
          prev.map((opp) =>
            opp.id === id ? { ...opp, status: newStatus } : opp
          )
        );
      } else {
        console.error("Failed to update opportunity status");
      }
    } catch (error) {
      console.error("Failed to update opportunity status:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  // --- Format last generated timestamp ---
  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
        <p className="text-gray-500 mt-1">
          Action-oriented insights from NPS interviews
        </p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : isEmpty || opportunities.length === 0 ? (
        <EmptyState
          title="No opportunities found"
          description="Opportunity analysis has not been generated yet. Run the reindex process to generate insights."
        />
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {TYPE_ORDER.map((type) => {
              const config = TYPE_CONFIG[type];
              return (
                <div
                  key={type}
                  className="section-card p-4 flex items-center gap-3"
                >
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}
                  >
                    <svg
                      className={`w-5 h-5 ${config.color}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d={config.icon}
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {countByType[type]}
                    </div>
                    <div className="text-xs text-gray-500">{config.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Types</option>
              <option value="future_need">Future Need</option>
              <option value="expansion">Expansion</option>
              <option value="re_engagement">Re-engagement</option>
              <option value="improvement">Improvement</option>
            </select>

            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Urgency</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="identified">Identified</option>
              <option value="in_progress">In Progress</option>
              <option value="actioned">Actioned</option>
            </select>
          </div>

          {/* Results Count */}
          <p className="text-sm text-gray-500 mb-4">
            {filtered.length} opportunit{filtered.length !== 1 ? "ies" : "y"}{" "}
            found
          </p>

          {/* Grouped Opportunity Cards */}
          {filtered.length === 0 ? (
            <EmptyState
              title="No matching opportunities"
              description="Try adjusting your filters to see more results."
            />
          ) : (
            <div className="space-y-6">
              {TYPE_ORDER.map((type) => {
                const items = grouped[type];
                if (items.length === 0) return null;

                const config = TYPE_CONFIG[type];
                const isCollapsed = collapsedSections[type] || false;

                return (
                  <div key={type}>
                    {/* Group Heading */}
                    <button
                      onClick={() => toggleSection(type)}
                      className="flex items-center gap-2 mb-3 w-full text-left group"
                    >
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          isCollapsed ? "-rotate-90" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                      <div
                        className={`w-6 h-6 rounded ${config.bgColor} flex items-center justify-center`}
                      >
                        <svg
                          className={`w-3.5 h-3.5 ${config.color}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d={config.icon}
                          />
                        </svg>
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900 group-hover:text-kf-primary transition-colors">
                        {config.label}
                      </h2>
                      <span className="text-sm text-gray-400">
                        ({items.length})
                      </span>
                    </button>

                    {/* Cards */}
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {items.map((opp) => (
                          <OpportunityCard
                            key={opp.id}
                            opportunity={opp}
                            updatingId={updatingId}
                            onStatusChange={handleStatusChange}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Last Generated Timestamp */}
          {lastGenerated && (
            <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-right">
              Last generated: {formatTimestamp(lastGenerated)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Opportunity Card ---

function OpportunityCard({
  opportunity,
  updatingId,
  onStatusChange,
}: {
  opportunity: Opportunity;
  updatingId: string | null;
  onStatusChange: (id: string, status: Status) => void;
}) {
  const typeConfig = TYPE_CONFIG[opportunity.type];
  const urgencyConfig = URGENCY_CONFIG[opportunity.urgency];
  const isUpdating = updatingId === opportunity.id;

  return (
    <div className="section-card p-5">
      {/* Badges */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeConfig.bgColor} ${typeConfig.color}`}
        >
          {typeConfig.label}
        </span>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${urgencyConfig.bgColor} ${urgencyConfig.color}`}
        >
          {urgencyConfig.label} Urgency
        </span>
      </div>

      {/* Title */}
      <h3 className="font-bold text-gray-900 mb-2">{opportunity.title}</h3>

      {/* Description */}
      <p className="text-sm text-gray-700 leading-relaxed mb-3">
        {opportunity.description}
      </p>

      {/* Supporting Quote */}
      {opportunity.supportingQuote && (
        <div className="border-l-3 border-l-gray-300 pl-3 mb-3">
          <p className="text-sm text-gray-500 italic">
            &ldquo;{opportunity.supportingQuote}&rdquo;
          </p>
        </div>
      )}

      {/* Source */}
      <div className="text-sm text-gray-500 mb-3">
        <span className="font-medium text-gray-600">Source: </span>
        <Link
          href={`/interviews/${opportunity.sourceInterviewId}`}
          className="text-kf-primary hover:underline"
        >
          {opportunity.client}, {opportunity.company}
        </Link>
      </div>

      {/* Suggested Action */}
      {opportunity.suggestedAction && (
        <div className="bg-kf-primary/5 border border-kf-primary/20 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-kf-primary flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <div>
              <p className="text-xs font-semibold text-kf-primary mb-0.5">
                Suggested Action
              </p>
              <p className="text-sm text-gray-700">
                {opportunity.suggestedAction}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = opportunity.status === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => {
                if (!isActive) onStatusChange(opportunity.id, opt.value);
              }}
              disabled={isUpdating}
              className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              } ${isUpdating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
