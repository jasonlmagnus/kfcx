/**
 * Parse date strings like "02.10.25" or "01.12.25" into ISO format.
 * These are in DD.MM.YY format.
 */
export function parseLegacyDate(dateStr: string): string {
  const parts = dateStr.split(".");
  if (parts.length !== 3) return new Date().toISOString().split("T")[0];

  const day = parts[0].padStart(2, "0");
  const month = parts[1].padStart(2, "0");
  const year = `20${parts[2]}`;

  return `${year}-${month}-${day}`;
}

/**
 * Format ISO date string for display: "Jan 2025" or "2 Oct 2025"
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Get month-year string from ISO date: "2025-10"
 */
export function getMonthYear(isoDate: string): string {
  return isoDate.substring(0, 7);
}

/**
 * Format month-year for display: "Oct 2025"
 */
export function formatMonthYear(monthYear: string): string {
  const [year, month] = monthYear.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
