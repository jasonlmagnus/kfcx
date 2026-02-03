"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import NPSBadge from "@/components/shared/NPSBadge";
import MetadataLabel from "@/components/shared/MetadataLabel";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils/dates";
import type {
  InterviewMetadata,
  NormalizedTranscript,
  NormalizedReport,
} from "@/types";

type ActiveTab = "report" | "transcript";

export default function InterviewDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [metadata, setMetadata] = useState<InterviewMetadata | null>(null);
  const [transcript, setTranscript] = useState<NormalizedTranscript | null>(
    null
  );
  const [report, setReport] = useState<NormalizedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("report");

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/interviews/${id}`);
        if (!res.ok) throw new Error("Failed to load interview");

        const data: {
          metadata: InterviewMetadata;
          transcript: NormalizedTranscript | null;
          report: NormalizedReport | null;
        } = await res.json();

        setMetadata(data.metadata);
        setTranscript(data.transcript);
        setReport(data.report);

        // Default to report tab if report exists, otherwise transcript
        setActiveTab(data.report ? "report" : "transcript");
      } catch (err) {
        console.error("Failed to fetch interview detail:", err);
        setError("Could not load interview details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <div>
        <Link
          href="/interviews"
          className="text-kf-primary hover:underline text-sm mb-6 inline-flex items-center gap-1"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Interviews
        </Link>
        <EmptyState
          title="Interview not found"
          description={error || "The requested interview could not be loaded."}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Back Link */}
      <Link
        href="/interviews"
        className="text-kf-primary hover:underline text-sm mb-6 inline-flex items-center gap-1"
      >
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Interviews
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 mt-4">
        <div>
          <h1 className="text-2xl font-bold text-kf-primary font-serif">
            {metadata.client}
          </h1>
          <p className="text-gray-500 mt-1">{metadata.company}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <MetadataLabel type="region" value={metadata.region} />
            <MetadataLabel type="solution" value={metadata.solution} />
            <MetadataLabel
              type="date"
              value={formatDate(metadata.interviewDate)}
            />
            <MetadataLabel type="account" value={metadata.accountType} />
          </div>
        </div>
        <NPSBadge score={metadata.score} size="lg" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab("report")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "report"
                ? "border-kf-primary text-kf-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Report
          </button>
          <button
            onClick={() => setActiveTab("transcript")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "transcript"
                ? "border-kf-primary text-kf-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Transcript
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "report" && <ReportTab report={report} id={id} />}
      {activeTab === "transcript" && <TranscriptTab transcript={transcript} />}
    </div>
  );
}

// ----- Report Tab -----
function ReportTab({
  report,
  id,
}: {
  report: NormalizedReport | null;
  id: string;
}) {
  if (!report) {
    return (
      <EmptyState
        title="No report available"
        description="A report has not been generated for this interview yet."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview */}
      {report.overview && (
        <div className="section-card p-5 border-l-4 border-l-kf-primary">
          <h2 className="section-title">Overview</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {report.overview}
          </p>
        </div>
      )}

      {/* What Went Well */}
      {report.whatWentWell.length > 0 && (
        <div>
          <h2 className="section-title">What Went Well</h2>
          <div className="space-y-0">
            {report.whatWentWell.map((item, i) => (
              <div key={i} className="list-item list-item-positive">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenges & Pain Points */}
      {report.challengesPainPoints.length > 0 && (
        <div>
          <h2 className="section-title">Challenges &amp; Pain Points</h2>
          <div className="space-y-0">
            {report.challengesPainPoints.map((item, i) => (
              <div key={i} className="list-item list-item-negative">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gaps Identified */}
      {report.gapsIdentified.length > 0 && (
        <div>
          <h2 className="section-title">Gaps Identified</h2>
          <div className="space-y-0">
            {report.gapsIdentified.map((item, i) => (
              <div key={i} className="list-item list-item-neutral">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Themes */}
      {report.keyThemes.length > 0 && (
        <div>
          <h2 className="section-title">Key Themes</h2>
          <div className="space-y-0">
            {report.keyThemes.map((item, i) => (
              <div key={i} className="list-item list-item-info">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions & Recommendations */}
      {report.actionsRecommendations.length > 0 && (
        <div>
          <h2 className="section-title">Actions &amp; Recommendations</h2>
          <div className="space-y-0">
            {report.actionsRecommendations.map((item, i) => (
              <div key={i} className="list-item list-item-info">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Insight */}
      {report.additionalInsight && (
        <div className="section-card p-5">
          <h2 className="section-title">Additional Insight</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {report.additionalInsight}
          </p>
        </div>
      )}

      {/* Download Button */}
      <div className="pt-4">
        <a
          href={`/api/reports/${id}/download`}
          className="btn-primary inline-flex items-center gap-2"
          download
        >
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download Report
        </a>
      </div>
    </div>
  );
}

// ----- Transcript Tab -----
function TranscriptTab({
  transcript,
}: {
  transcript: NormalizedTranscript | null;
}) {
  if (!transcript) {
    return (
      <EmptyState
        title="No transcript available"
        description="A transcript has not been uploaded for this interview yet."
      />
    );
  }

  return (
    <div className="space-y-4">
      {transcript.fullTranscript.length > 0 ? (
        transcript.fullTranscript.map((turn, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex-shrink-0 pt-1">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-kf-primary text-white text-xs font-bold">
                {turn.speaker
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 mb-1">
                {turn.speaker}
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                {turn.text}
              </p>
            </div>
          </div>
        ))
      ) : (
        <div className="section-card p-5">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {transcript.rawText}
          </p>
        </div>
      )}
    </div>
  );
}
