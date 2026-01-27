import { NextResponse } from "next/server";
import { readThemeAnalysis } from "@/lib/data/store";

export async function GET() {
  const themes = await readThemeAnalysis();

  if (!themes) {
    return NextResponse.json(
      {
        error: "Theme analysis has not been generated yet. Run the reindex process.",
        empty: true,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(themes);
}
