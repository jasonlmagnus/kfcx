"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NPSBadge from "@/components/shared/NPSBadge";
import MetadataLabel from "@/components/shared/MetadataLabel";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { formatDate } from "@/lib/utils/dates";
import type { InterviewMetadata } from "@/types";

const REGION_OPTIONS = ["All", "NA", "EMEA", "APAC", "LATAM"] as const;
const SOLUTION_OPTIONS = [
  "All",
  "Executive Search",
  "Professional Search",
  "Consulting",
] as const;
const NPS_OPTIONS = ["All", "Promoters", "Passives", "Detractors"] as const;
const SORT_OPTIONS = [
  { label: "Date Newest", value: "date-desc" },
  { label: "Date Oldest", value: "date-asc" },
  { label: "Score High-Low", value: "score-desc" },
  { label: "Score Low-High", value: "score-asc" },
] as const;

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewMetadata[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All");
  const [solution, setSolution] = useState("All");
  const [npsCategory, setNpsCategory] = useState("All");
  const [sort, setSort] = useState("date-desc");

  useEffect(() => {
    const fetchInterviews = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();

        if (search.trim()) params.set("search", search.trim());
        if (region !== "All") params.set("region", region);
        if (solution !== "All") params.set("solution", solution);
        if (npsCategory !== "All") {
          const categoryMap: Record<string, string> = {
            Promoters: "promoter",
            Passives: "passive",
            Detractors: "detractor",
          };
          params.set("npsCategory", categoryMap[npsCategory]);
        }
        params.set("sort", sort);

        const queryString = params.toString();
        const url = `/api/interviews${queryString ? `?${queryString}` : ""}`;
        const res = await fetch(url);
        const data: { interviews: InterviewMetadata[]; total: number } =
          await res.json();

        setInterviews(data.interviews);
        setTotal(data.total);
      } catch (error) {
        console.error("Failed to fetch interviews:", error);
        setInterviews([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchInterviews();
  }, [search, region, solution, npsCategory, sort]);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
        <p className="text-gray-500 mt-1">
          Explore NPS interview feedback
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search client or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-select flex-1 min-w-[200px]"
        />

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
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          className="filter-select"
        >
          {SOLUTION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "All" ? "All Solutions" : opt}
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

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="filter-select"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results Count */}
      {!loading && (
        <p className="text-sm text-gray-500 mb-4">
          {total} interview{total !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSpinner />
      ) : interviews.length === 0 ? (
        <EmptyState
          title="No interviews found"
          description="Try adjusting your filters to see more results."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {interviews.map((interview) => (
            <Link
              key={interview.id}
              href={`/interviews/${interview.id}`}
              className="section-card p-5 hover:shadow-md transition-shadow cursor-pointer block"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">
                    {interview.client}
                  </h3>
                  <p className="text-sm text-gray-500">{interview.company}</p>
                </div>
                <NPSBadge score={interview.score} />
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <MetadataLabel type="region" value={interview.region} />
                <MetadataLabel type="solution" value={interview.solution} />
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{formatDate(interview.interviewDate)}</span>
                {interview.hasReport && (
                  <span className="inline-flex items-center gap-1 text-kf-primary font-medium">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Has Report
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
