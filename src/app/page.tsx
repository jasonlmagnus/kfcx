import Link from "next/link";
import { readMetadataIndex } from "@/lib/data/store";
import { calculateNPSScore } from "@/lib/utils/nps";
import { formatDate } from "@/lib/utils/dates";
import NPSBadge from "@/components/shared/NPSBadge";
import MetadataLabel from "@/components/shared/MetadataLabel";

export default async function DashboardPage() {
  const index = await readMetadataIndex();
  const interviews = index.interviews;

  // --- Stats ---
  const totalInterviews = interviews.length;
  const scores = interviews.map((i) => i.score);
  const averageNPS =
    scores.length > 0
      ? parseFloat(
          (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        )
      : 0;
  const npsScore = calculateNPSScore(scores);

  const promoters = interviews.filter(
    (i) => i.npsCategory === "promoter"
  ).length;
  const passives = interviews.filter(
    (i) => i.npsCategory === "passive"
  ).length;
  const detractors = interviews.filter(
    (i) => i.npsCategory === "detractor"
  ).length;

  // --- Region breakdown ---
  const regionCounts: Record<string, number> = {};
  for (const i of interviews) {
    regionCounts[i.region] = (regionCounts[i.region] || 0) + 1;
  }
  const regionEntries = Object.entries(regionCounts).sort(
    (a, b) => b[1] - a[1]
  );
  const maxRegionCount = regionEntries.length > 0 ? regionEntries[0][1] : 1;

  // --- Category percentages ---
  const promoterPct =
    totalInterviews > 0
      ? Math.round((promoters / totalInterviews) * 100)
      : 0;
  const passivePct =
    totalInterviews > 0
      ? Math.round((passives / totalInterviews) * 100)
      : 0;
  const detractorPct =
    totalInterviews > 0
      ? Math.round((detractors / totalInterviews) * 100)
      : 0;

  // --- Recent interviews (sorted by date descending) ---
  const sortedInterviews = [...interviews].sort(
    (a, b) =>
      new Date(b.interviewDate).getTime() -
      new Date(a.interviewDate).getTime()
  );

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">NPS Interview Insight Overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="stat-card">
          <div className="stat-value">{totalInterviews}</div>
          <div className="stat-label">Total Interviews</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{averageNPS}</div>
          <div className="stat-label">Average NPS Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{npsScore}</div>
          <div className="stat-label">NPS Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {promoters} / {passives} / {detractors}
          </div>
          <div className="stat-label">Promoters / Passives / Detractors</div>
        </div>
      </div>

      {/* Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* NPS Category Breakdown */}
        <div className="section-card p-6">
          <h2 className="section-title">NPS Category Distribution</h2>
          <div className="space-y-4">
            {/* Promoters */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">
                  Promoters ({promoters})
                </span>
                <span className="text-gray-500">{promoterPct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4">
                <div
                  className="h-4 rounded-full"
                  style={{
                    width: `${promoterPct}%`,
                    backgroundColor: "#22c55e",
                  }}
                />
              </div>
            </div>
            {/* Passives */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">
                  Passives ({passives})
                </span>
                <span className="text-gray-500">{passivePct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4">
                <div
                  className="h-4 rounded-full"
                  style={{
                    width: `${passivePct}%`,
                    backgroundColor: "#eab308",
                  }}
                />
              </div>
            </div>
            {/* Detractors */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">
                  Detractors ({detractors})
                </span>
                <span className="text-gray-500">{detractorPct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4">
                <div
                  className="h-4 rounded-full"
                  style={{
                    width: `${detractorPct}%`,
                    backgroundColor: "#ef4444",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Region Breakdown */}
        <div className="section-card p-6">
          <h2 className="section-title">Region Breakdown</h2>
          <div className="space-y-4">
            {regionEntries.map(([region, count]) => (
              <div key={region}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{region}</span>
                  <span className="text-gray-500">{count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-4">
                  <div
                    className="h-4 rounded-full bg-kf-gradient"
                    style={{
                      width: `${Math.round((count / maxRegionCount) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {regionEntries.length === 0 && (
              <p className="text-sm text-gray-400">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Interviews */}
      <div className="section-card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="section-title mb-0">Recent Interviews</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Score</th>
                <th className="px-6 py-3">Region</th>
                <th className="px-6 py-3">Solution</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedInterviews.map((interview) => (
                <tr
                  key={interview.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/interviews/${interview.id}`}
                      className="text-sm font-medium text-kf-primary hover:underline"
                    >
                      {interview.client}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {interview.company}
                  </td>
                  <td className="px-6 py-4">
                    <NPSBadge score={interview.score} size="sm" />
                  </td>
                  <td className="px-6 py-4">
                    <MetadataLabel type="region" value={interview.region} />
                  </td>
                  <td className="px-6 py-4">
                    <MetadataLabel
                      type="solution"
                      value={interview.solution}
                    />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(interview.interviewDate)}
                  </td>
                </tr>
              ))}
              {sortedInterviews.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-400 text-sm"
                  >
                    No interviews found. Upload transcripts to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
