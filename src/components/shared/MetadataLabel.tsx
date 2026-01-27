interface MetadataLabelProps {
  type: "region" | "solution" | "account" | "date";
  value: string;
}

const typeStyles: Record<string, string> = {
  region: "bg-blue-50 text-blue-700 border-blue-200",
  solution: "bg-purple-50 text-purple-700 border-purple-200",
  account: "bg-gray-50 text-gray-700 border-gray-200",
  date: "bg-green-50 text-green-700 border-green-200",
};

export default function MetadataLabel({ type, value }: MetadataLabelProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${typeStyles[type]}`}
    >
      {value}
    </span>
  );
}
