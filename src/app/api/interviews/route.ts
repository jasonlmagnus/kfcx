import { NextRequest, NextResponse } from "next/server";
import { readMetadataIndex } from "@/lib/data/store";
import type { InterviewMetadata } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const region = searchParams.get("region");
  const solution = searchParams.get("solution");
  const npsCategory = searchParams.get("npsCategory");
  const monthStart = searchParams.get("monthStart");
  const monthEnd = searchParams.get("monthEnd");
  const search = searchParams.get("search")?.toLowerCase();
  const sort = searchParams.get("sort") || "date-desc";

  const index = await readMetadataIndex();
  let interviews: InterviewMetadata[] = [...index.interviews];

  // Apply filters
  if (region) {
    interviews = interviews.filter((i) => i.region === region);
  }
  if (solution) {
    interviews = interviews.filter((i) => i.solution === solution);
  }
  if (npsCategory) {
    interviews = interviews.filter((i) => i.npsCategory === npsCategory);
  }
  if (monthStart) {
    interviews = interviews.filter((i) => i.monthYear >= monthStart);
  }
  if (monthEnd) {
    interviews = interviews.filter((i) => i.monthYear <= monthEnd);
  }
  if (search) {
    interviews = interviews.filter(
      (i) =>
        i.client.toLowerCase().includes(search) ||
        i.company.toLowerCase().includes(search) ||
        i.solution.toLowerCase().includes(search) ||
        i.region.toLowerCase().includes(search)
    );
  }

  // Sort
  interviews.sort((a, b) => {
    switch (sort) {
      case "date-asc":
        return a.interviewDate.localeCompare(b.interviewDate);
      case "score-desc":
        return b.score - a.score;
      case "score-asc":
        return a.score - b.score;
      case "date-desc":
      default:
        return b.interviewDate.localeCompare(a.interviewDate);
    }
  });

  return NextResponse.json({
    interviews,
    total: interviews.length,
  });
}
