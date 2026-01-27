import { NextResponse } from "next/server";
import { readMetadataIndex } from "@/lib/data/store";
import { calculateNPSScore } from "@/lib/utils/nps";

export async function GET() {
  const index = await readMetadataIndex();
  const interviews = index.interviews;

  const scores = interviews.map((i) => i.score);
  const avgNPS =
    scores.length > 0
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : 0;

  const promoters = interviews.filter((i) => i.npsCategory === "promoter").length;
  const passives = interviews.filter((i) => i.npsCategory === "passive").length;
  const detractors = interviews.filter((i) => i.npsCategory === "detractor").length;

  const regionCounts: Record<string, number> = {};
  const solutionCounts: Record<string, number> = {};
  const monthData: Record<string, { count: number; totalScore: number }> = {};

  for (const i of interviews) {
    regionCounts[i.region] = (regionCounts[i.region] || 0) + 1;
    solutionCounts[i.solution] = (solutionCounts[i.solution] || 0) + 1;

    if (!monthData[i.monthYear]) {
      monthData[i.monthYear] = { count: 0, totalScore: 0 };
    }
    monthData[i.monthYear].count++;
    monthData[i.monthYear].totalScore += i.score;
  }

  return NextResponse.json({
    totalInterviews: interviews.length,
    averageNPS: avgNPS,
    npsScore: calculateNPSScore(scores),
    promoters,
    passives,
    detractors,
    byRegion: Object.entries(regionCounts).map(([region, count]) => ({
      region,
      count,
    })),
    bySolution: Object.entries(solutionCounts).map(([solution, count]) => ({
      solution,
      count,
    })),
    byMonth: Object.entries(monthData)
      .map(([month, data]) => ({
        month,
        count: data.count,
        avgScore: parseFloat((data.totalScore / data.count).toFixed(1)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  });
}
