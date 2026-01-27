import { NPSCategory } from "@/types";

export function getNPSCategory(score: number): NPSCategory {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

export function getNPSColor(category: NPSCategory): string {
  switch (category) {
    case "promoter":
      return "#22c55e";
    case "passive":
      return "#eab308";
    case "detractor":
      return "#ef4444";
  }
}

export function getNPSBgClass(category: NPSCategory): string {
  switch (category) {
    case "promoter":
      return "bg-nps-promoter";
    case "passive":
      return "bg-nps-passive";
    case "detractor":
      return "bg-nps-detractor";
  }
}

export function getNPSLabel(category: NPSCategory): string {
  switch (category) {
    case "promoter":
      return "Promoter";
    case "passive":
      return "Passive";
    case "detractor":
      return "Detractor";
  }
}

export function calculateNPSScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}
