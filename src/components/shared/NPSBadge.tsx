import { getNPSCategory, getNPSBgClass } from "@/lib/utils/nps";

interface NPSBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export default function NPSBadge({ score, size = "md" }: NPSBadgeProps) {
  const category = getNPSCategory(score);
  const bgClass = getNPSBgClass(category);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-lg",
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-white ${bgClass} ${sizeClasses[size]}`}
    >
      {score}
    </span>
  );
}
