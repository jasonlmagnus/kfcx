"use client";

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getNPSCategory, getNPSLabel } from "@/lib/utils/nps";
import NPSBadge from "@/components/shared/NPSBadge";
import type { Region, Solution } from "@/types";

const REGIONS: Region[] = ["NA", "EMEA", "APAC", "LATAM"];
const SOLUTIONS: Solution[] = ["Executive Search", "Professional Search", "Consulting"];

export default function UploadPage() {
  const router = useRouter();

  // --- Step state ---
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // --- File state ---
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [transcriptDragOver, setTranscriptDragOver] = useState(false);
  const [reportDragOver, setReportDragOver] = useState(false);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const reportInputRef = useRef<HTMLInputElement>(null);

  // --- Metadata state ---
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [score, setScore] = useState<number | "">("");
  const [region, setRegion] = useState<Region | "">("");
  const [solution, setSolution] = useState<Solution | "">("");
  const [accountType, setAccountType] = useState("Unknown");

  // --- Submission state ---
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [newInterviewId, setNewInterviewId] = useState("");

  // --- File helpers ---
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleTranscriptDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTranscriptDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".json")) {
      setTranscriptFile(file);
    }
  }, []);

  const handleReportDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReportDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".json")) {
      setReportFile(file);
    }
  }, []);

  const handleTranscriptChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setTranscriptFile(file);
  }, []);

  const handleReportChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setReportFile(file);
  }, []);

  // --- Step navigation ---
  const canProceedToStep2 = transcriptFile || reportFile;

  const canSubmit =
    clientName.trim() !== "" &&
    companyName.trim() !== "" &&
    interviewDate !== "" &&
    score !== "" &&
    region !== "" &&
    solution !== "";

  // --- Upload handler ---
  const handleUpload = async () => {
    if (!canSubmit) return;
    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      if (transcriptFile) formData.append("transcriptFile", transcriptFile);
      if (reportFile) formData.append("reportFile", reportFile);
      formData.append("clientName", clientName);
      formData.append("companyName", companyName);
      formData.append("interviewDate", interviewDate);
      formData.append("score", String(score));
      formData.append("region", region as string);
      formData.append("solution", solution as string);
      formData.append("accountType", accountType || "Unknown");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }

      setNewInterviewId(data.interviewId);
      setStep(3);
      // Trigger reindex in background so themes and opportunities stay in sync
      fetch("/api/reindex", { method: "POST" }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- NPS category display ---
  const scoreNum = typeof score === "number" ? score : null;
  const npsCategory = scoreNum !== null ? getNPSCategory(scoreNum) : null;
  const npsLabel = npsCategory ? getNPSLabel(npsCategory) : null;
  const npsCategoryColorClass =
    npsCategory === "promoter"
      ? "text-green-600 bg-green-50 border-green-200"
      : npsCategory === "passive"
        ? "text-yellow-600 bg-yellow-50 border-yellow-200"
        : npsCategory === "detractor"
          ? "text-red-600 bg-red-50 border-red-200"
          : "";

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload Interview</h1>
      <p className="text-gray-500 mb-8">
        Add a new NPS interview transcript and/or report to the platform.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`w-12 h-0.5 ${
                  step > s ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-3 text-sm text-gray-500">
          {step === 1
            ? "Select Files"
            : step === 2
              ? "Enter Metadata"
              : "Complete"}
        </span>
      </div>

      {/* ============================== */}
      {/* STEP 1 — File Selection        */}
      {/* ============================== */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Transcript drop zone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcript File (.json)
            </label>
            <div
              onDragOver={(e) => {
                handleDragOver(e);
                setTranscriptDragOver(true);
              }}
              onDragLeave={() => setTranscriptDragOver(false)}
              onDrop={handleTranscriptDrop}
              onClick={() => transcriptInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                transcriptDragOver
                  ? "border-blue-500 bg-blue-50"
                  : transcriptFile
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 hover:border-gray-400 bg-gray-50"
              }`}
            >
              {transcriptFile ? (
                <div>
                  <svg
                    className="mx-auto h-8 w-8 text-green-500 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-medium text-green-700">{transcriptFile.name}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTranscriptFile(null);
                    }}
                    className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <svg
                    className="mx-auto h-10 w-10 text-gray-400 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <p className="text-sm text-gray-600">
                    Drag and drop transcript JSON here, or{" "}
                    <span className="text-blue-600 font-medium">browse</span>
                  </p>
                </div>
              )}
              <input
                ref={transcriptInputRef}
                type="file"
                accept=".json"
                onChange={handleTranscriptChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Report drop zone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report File (.json)
            </label>
            <div
              onDragOver={(e) => {
                handleDragOver(e);
                setReportDragOver(true);
              }}
              onDragLeave={() => setReportDragOver(false)}
              onDrop={handleReportDrop}
              onClick={() => reportInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                reportDragOver
                  ? "border-blue-500 bg-blue-50"
                  : reportFile
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 hover:border-gray-400 bg-gray-50"
              }`}
            >
              {reportFile ? (
                <div>
                  <svg
                    className="mx-auto h-8 w-8 text-green-500 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-medium text-green-700">{reportFile.name}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportFile(null);
                    }}
                    className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <svg
                    className="mx-auto h-10 w-10 text-gray-400 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <p className="text-sm text-gray-600">
                    Drag and drop report JSON here, or{" "}
                    <span className="text-blue-600 font-medium">browse</span>
                  </p>
                </div>
              )}
              <input
                ref={reportInputRef}
                type="file"
                accept=".json"
                onChange={handleReportChange}
                className="hidden"
              />
            </div>
          </div>

          {!canProceedToStep2 && (
            <p className="text-sm text-amber-600">
              Please select at least one file to continue.
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canProceedToStep2}
              onClick={() => setStep(2)}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* STEP 2 — Metadata Entry        */}
      {/* ============================== */}
      {step === 2 && (
        <div className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Client Name */}
          <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-1">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              id="clientName"
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Sarah Johnson"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Company Name */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              id="companyName"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Interview Date */}
          <div>
            <label htmlFor="interviewDate" className="block text-sm font-medium text-gray-700 mb-1">
              Interview Date <span className="text-red-500">*</span>
            </label>
            <input
              id="interviewDate"
              type="date"
              required
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* NPS Score */}
          <div>
            <label htmlFor="score" className="block text-sm font-medium text-gray-700 mb-1">
              NPS Score (0-10) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                id="score"
                type="number"
                required
                min={0}
                max={10}
                value={score}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setScore("");
                  } else {
                    const num = parseInt(val, 10);
                    if (num >= 0 && num <= 10) setScore(num);
                  }
                }}
                placeholder="0-10"
                className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {scoreNum !== null && npsLabel && (
                <div className="flex items-center gap-2">
                  <NPSBadge score={scoreNum} size="sm" />
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded border ${npsCategoryColorClass}`}
                  >
                    {npsLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Region */}
          <div>
            <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
              Region <span className="text-red-500">*</span>
            </label>
            <select
              id="region"
              required
              value={region}
              onChange={(e) => setRegion(e.target.value as Region)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a region</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Solution */}
          <div>
            <label htmlFor="solution" className="block text-sm font-medium text-gray-700 mb-1">
              Solution <span className="text-red-500">*</span>
            </label>
            <select
              id="solution"
              required
              value={solution}
              onChange={(e) => setSolution(e.target.value as Solution)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a solution</option>
              {SOLUTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Account Type */}
          <div>
            <label htmlFor="accountType" className="block text-sm font-medium text-gray-700 mb-1">
              Account Type
            </label>
            <input
              id="accountType"
              type="text"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              placeholder="Unknown"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* File summary */}
          <div className="rounded-md bg-gray-50 border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Files to upload
            </p>
            <ul className="text-sm text-gray-700 space-y-1">
              {transcriptFile && (
                <li className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  Transcript: {transcriptFile.name}
                </li>
              )}
              {reportFile && (
                <li className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
                  Report: {reportFile.name}
                </li>
              )}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setError("");
                setStep(1);
              }}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!canSubmit || isUploading}
              onClick={handleUpload}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* STEP 3 — Success               */}
      {/* ============================== */}
      {step === 3 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-16 w-16 text-green-500 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Interview Uploaded Successfully
          </h2>
          <p className="text-gray-500 mb-2">
            The interview has been saved with ID{" "}
            <span className="font-mono font-semibold text-gray-800">{newInterviewId}</span>.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Themes and opportunities are being updated in the background (1–2 min). Refresh{" "}
            <Link href="/themes" className="text-kf-primary hover:underline">Themes</Link>
            {" or "}
            <Link href="/opportunities" className="text-kf-primary hover:underline">Opportunities</Link>
            {" to see the latest."}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => router.push(`/interviews/${newInterviewId}`)}
              className="btn-primary"
            >
              View Interview
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setTranscriptFile(null);
                setReportFile(null);
                setClientName("");
                setCompanyName("");
                setInterviewDate("");
                setScore("");
                setRegion("");
                setSolution("");
                setAccountType("Unknown");
                setError("");
                setNewInterviewId("");
              }}
              className="btn-secondary"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
