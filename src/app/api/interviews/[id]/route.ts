import { NextRequest, NextResponse } from "next/server";
import { readMetadataIndex, readTranscript, readReport } from "@/lib/data/store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = await readMetadataIndex();
  const metadata = index.interviews.find((i) => i.id === id);

  if (!metadata) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const transcript = metadata.hasTranscript ? await readTranscript(id) : null;
  const report = metadata.hasReport ? await readReport(id) : null;

  return NextResponse.json({
    metadata,
    transcript,
    report,
  });
}
