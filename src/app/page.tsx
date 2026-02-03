import Link from "next/link";
import {
  readMetadataIndex,
  readThemeAnalysis,
  readOpportunities,
} from "@/lib/data/store";
import { formatDate } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [index, themeAnalysis, opportunitiesData] = await Promise.all([
    readMetadataIndex(),
    readThemeAnalysis(),
    readOpportunities(),
  ]);
  const interviews = index.interviews;

  // --- Stats ---
  const totalInterviews = interviews.length;

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

  // --- Solution breakdown ---
  const solutionCounts: Record<string, number> = {};
  for (const i of interviews) {
    solutionCounts[i.solution] = (solutionCounts[i.solution] || 0) + 1;
  }
  const solutionEntries = Object.entries(solutionCounts).sort(
    (a, b) => b[1] - a[1]
  );

  // --- Account type breakdown ---
  const accountCounts: Record<string, number> = {};
  for (const i of interviews) {
    const acct = i.accountType || "Unknown";
    accountCounts[acct] = (accountCounts[acct] || 0) + 1;
  }
  const accountEntries = Object.entries(accountCounts).sort(
    (a, b) => b[1] - a[1]
  );

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

  // --- Theme summary ---
  const totalThemes = themeAnalysis
    ? themeAnalysis.whyClientsChoose.themes.length +
      themeAnalysis.promoterExperience.themes.length +
      themeAnalysis.whereFallsShort.themes.length +
      (themeAnalysis.additionalThemes?.reduce(
        (sum, g) => sum + g.themes.length,
        0
      ) ?? 0)
    : 0;
  const sampleThemes = themeAnalysis
    ? [
        ...themeAnalysis.whyClientsChoose.themes,
        ...themeAnalysis.promoterExperience.themes,
        ...themeAnalysis.whereFallsShort.themes,
      ]
        .slice(0, 4)
        .map((t) => t.label)
    : [];

  // --- Opportunities summary ---
  const opportunitiesCount = opportunitiesData?.opportunities?.length ?? 0;
  const sampleOpportunities = opportunitiesData?.opportunities?.slice(0, 3) ?? [];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="page-title">Our Insights</h1>
        <p className="text-gray-500 mt-2">NPS Interview Insight Overview</p>
        <p className="text-sm text-gray-400 mt-1">
          NPS interviews have been running since August 2025
        </p>
      </div>

      {/* Stats Grid - 3 Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="stat-card">
          <div className="stat-value">{totalInterviews}</div>
          <div className="stat-label">Total Interviews</div>
        </div>
        <Link href="/themes" className="stat-card hover:shadow-md transition-shadow">
          <div className="stat-value">{totalThemes}</div>
          <div className="stat-label">Themes Identified</div>
        </Link>
        <Link href="/opportunities" className="stat-card hover:shadow-md transition-shadow">
          <div className="stat-value">{opportunitiesCount}</div>
          <div className="stat-label">Opportunities</div>
        </Link>
      </div>

      {/* Distribution Section - 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* NPS Category Breakdown */}
        <div className="section-card p-6">
          <h2 className="section-title">NPS Category Distribution</h2>
          <div className="space-y-4">
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

        {/* Solution Breakdown */}
        <div className="section-card p-6">
          <h2 className="section-title">By Solution</h2>
          <div className="space-y-4">
            {solutionEntries.map(([solution, count]) => {
              const maxSolutionCount = solutionEntries.length > 0 ? solutionEntries[0][1] : 1;
              return (
                <div key={solution}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{solution}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4">
                    <div
                      className="h-4 rounded-full"
                      style={{
                        width: `${Math.round((count / maxSolutionCount) * 100)}%`,
                        backgroundColor: "#007B5E",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {solutionEntries.length === 0 && (
              <p className="text-sm text-gray-400">No data available</p>
            )}
          </div>
        </div>

        {/* Account Type Breakdown */}
        <div className="section-card p-6">
          <h2 className="section-title">By Account Type</h2>
          <div className="space-y-4">
            {accountEntries.map(([account, count]) => {
              const maxAccountCount = accountEntries.length > 0 ? accountEntries[0][1] : 1;
              return (
                <div key={account}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{account}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4">
                    <div
                      className="h-4 rounded-full"
                      style={{
                        width: `${Math.round((count / maxAccountCount) * 100)}%`,
                        backgroundColor: "#C4A35A",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {accountEntries.length === 0 && (
              <p className="text-sm text-gray-400">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Themes & Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Themes */}
        <div className="section-card">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="section-title mb-0">Themes</h2>
            <Link
              href="/themes"
              className="text-sm font-medium text-kf-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="p-6">
            {themeAnalysis ? (
              <>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-bold text-gray-900">
                    {totalThemes}
                  </span>
                  <span className="text-gray-500 text-sm">themes</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Last updated: {formatDate(themeAnalysis.lastGenerated)}
                </p>
                {sampleThemes.length > 0 && (
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {sampleThemes.map((label) => (
                      <li key={label} className="truncate">
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Theme analysis not generated yet. Go to{" "}
                <Link href="/themes" className="text-kf-primary hover:underline">
                  Themes
                </Link>{" "}
                and click &quot;Generate themes &amp; insights&quot;.
              </p>
            )}
          </div>
        </div>

        {/* Opportunities */}
        <div className="section-card">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="section-title mb-0">Opportunities</h2>
            <Link
              href="/opportunities"
              className="text-sm font-medium text-kf-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="p-6">
            {opportunitiesData && opportunitiesData.opportunities.length > 0 ? (
              <>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-bold text-gray-900">
                    {opportunitiesCount}
                  </span>
                  <span className="text-gray-500 text-sm">opportunities</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Last updated:{" "}
                  {formatDate(opportunitiesData.lastGenerated)}
                </p>
                <ul className="space-y-2 text-sm text-gray-700">
                  {sampleOpportunities.map((opp) => (
                    <li key={opp.id}>
                      <Link
                        href="/opportunities"
                        className="text-kf-primary hover:underline font-medium"
                      >
                        {opp.title}
                      </Link>
                      <span className="text-gray-400 text-xs ml-1">
                        {opp.client}, {opp.company}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Opportunity analysis not generated yet. Go to{" "}
                <Link
                  href="/opportunities"
                  className="text-kf-primary hover:underline"
                >
                  Opportunities
                </Link>{" "}
                and click &quot;Generate themes &amp; insights&quot;.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
