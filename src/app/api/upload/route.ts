import { NextRequest, NextResponse } from "next/server";
import {
  readMetadataIndex,
  writeMetadataIndex,
  getNextInterviewId,
  writeTranscript,
  writeReport,
  writeOriginalPdf,
} from "@/lib/data/store";
import { parsePdfBuffer } from "@/lib/data/pdf-parser";
import { getNPSCategory } from "@/lib/utils/nps";
import { getMonthYear } from "@/lib/utils/dates";
import type {
  InterviewMetadata,
  NormalizedTranscript,
  NormalizedReport,
  Region,
  Solution,
  MetadataIndex,
} from "@/types";

function isPdfFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".pdf") ||
    file.type === "application/pdf"
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // --- Extract files ---
    const transcriptFile = formData.get("transcriptFile") as File | null;
    const reportFile = formData.get("reportFile") as File | null;

    if (!transcriptFile && !reportFile) {
      return NextResponse.json(
        { error: "At least one file (transcript or report) must be provided." },
        { status: 400 }
      );
    }

    // --- Extract metadata fields ---
    const clientName = formData.get("clientName") as string | null;
    const companyName = formData.get("companyName") as string | null;
    const interviewDate = formData.get("interviewDate") as string | null;
    const scoreStr = formData.get("score") as string | null;
    const region = formData.get("region") as Region | null;
    const solution = formData.get("solution") as Solution | null;
    const accountType =
      (formData.get("accountType") as string | null) || "Unknown";

    // --- Validate required metadata ---
    if (!clientName || !companyName || !interviewDate || !scoreStr || !region || !solution) {
      return NextResponse.json(
        {
          error:
            "Missing required metadata fields: clientName, companyName, interviewDate, score, region, and solution are all required.",
        },
        { status: 400 }
      );
    }

    const score = parseInt(scoreStr, 10);
    if (isNaN(score) || score < 0 || score > 10) {
      return NextResponse.json(
        { error: "Score must be a number between 0 and 10." },
        { status: 400 }
      );
    }

    const validRegions: Region[] = ["NA", "EMEA", "APAC", "LATAM"];
    if (!validRegions.includes(region)) {
      return NextResponse.json(
        { error: `Invalid region. Must be one of: ${validRegions.join(", ")}` },
        { status: 400 }
      );
    }

    const validSolutions: Solution[] = [
      "Executive Search",
      "Professional Search",
      "Consulting",
    ];
    if (!validSolutions.includes(solution)) {
      return NextResponse.json(
        {
          error: `Invalid solution. Must be one of: ${validSolutions.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // --- Read current metadata index and generate ID ---
    const index: MetadataIndex = await readMetadataIndex();
    const id = getNextInterviewId(index);
    const interviewIdNum =
      index.interviews.reduce((max, item) => {
        const num = parseInt(item.id.replace("t-", ""));
        return num > max ? num : max;
      }, 0) + 1;

    // --- Process transcript file ---
    let transcriptSourceFile = "";
    if (transcriptFile) {
      const transcriptText = await transcriptFile.text();
      const transcriptJSON = JSON.parse(transcriptText);

      let rawText = "";
      if (Array.isArray(transcriptJSON.paragraphs)) {
        rawText = transcriptJSON.paragraphs.join("\n\n");
      } else if (typeof transcriptJSON.text === "string") {
        rawText = transcriptJSON.text;
      } else {
        rawText = transcriptText;
      }

      const normalizedTranscript: NormalizedTranscript = {
        id,
        sourceFile: transcriptFile.name,
        overview: "",
        sections: [],
        fullTranscript: [],
        rawText,
      };

      await writeTranscript(id, normalizedTranscript);
      transcriptSourceFile = transcriptFile.name;
    }

    // --- Process report file ---
    let originalPdfFile: string | null = null;
    if (reportFile) {
      if (isPdfFile(reportFile)) {
        // PDF report: parse structured content and save original
        const arrayBuffer = await reportFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save original PDF
        const pdfFilename = reportFile.name;
        await writeOriginalPdf(pdfFilename, buffer);
        originalPdfFile = `originals/${pdfFilename}`;

        // Parse PDF into structured report
        const parsed = await parsePdfBuffer(buffer);
        const normalizedReport: NormalizedReport = {
          id,
          client: parsed.client || clientName,
          interviewDate: parsed.interviewDate || interviewDate,
          project: parsed.engagement || solution,
          score,
          overview: parsed.overview,
          whatWentWell: parsed.whatWentWell,
          challengesPainPoints: parsed.challengesPainPoints,
          gapsIdentified: parsed.gapsIdentified,
          keyThemes: parsed.keyThemes,
          actionsRecommendations: parsed.actionsRecommendations,
          additionalInsight: parsed.additionalInsight,
        };
        await writeReport(id, normalizedReport);
      } else {
        // JSON report: existing behavior
        const reportText = await reportFile.text();
        const reportJSON = JSON.parse(reportText);

        const normalizedReport: NormalizedReport = {
          id,
          client: reportJSON.client || clientName,
          interviewDate: reportJSON.interview_date || reportJSON.interviewDate || interviewDate,
          project: reportJSON.project || "",
          score: reportJSON.score ?? score,
          overview: reportJSON.overview || "",
          whatWentWell: reportJSON.what_went_well || reportJSON.whatWentWell || [],
          challengesPainPoints:
            reportJSON.challenges_pain_points ||
            reportJSON.challengesPainPoints ||
            [],
          gapsIdentified:
            reportJSON.gaps_identified || reportJSON.gapsIdentified || [],
          keyThemes: reportJSON.key_themes || reportJSON.keyThemes || [],
          actionsRecommendations:
            reportJSON.actions_recommendations ||
            reportJSON.actionsRecommendations ||
            [],
          additionalInsight:
            reportJSON.additional_insight ||
            reportJSON.additionalInsight ||
            "",
        };

        await writeReport(id, normalizedReport);
      }
    }

    // --- Create metadata entry ---
    const now = new Date().toISOString();
    const npsCategory = getNPSCategory(score);
    const monthYear = getMonthYear(interviewDate);

    const metadata: InterviewMetadata = {
      id,
      interviewId: interviewIdNum,
      client: clientName,
      company: companyName,
      interviewDate,
      score,
      npsCategory,
      region,
      solution,
      accountType,
      monthYear,
      hasTranscript: !!transcriptFile,
      hasReport: !!reportFile,
      transcriptFile: transcriptSourceFile,
      reportFile: reportFile ? `reports/${id}.json` : null,
      originalPdfFile,
      createdAt: now,
      updatedAt: now,
    };

    index.interviews.push(metadata);
    await writeMetadataIndex(index);

    return NextResponse.json(
      { success: true, interviewId: id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      { error: `Upload failed: ${message}` },
      { status: 500 }
    );
  }
}
