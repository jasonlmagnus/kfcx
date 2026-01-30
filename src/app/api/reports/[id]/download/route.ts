import { NextRequest, NextResponse } from "next/server";
import {
  readReport,
  readMetadataIndex,
  readOriginalPdf,
} from "@/lib/data/store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = await readMetadataIndex();
  const metadata = index.interviews.find((i) => i.id === id);

  if (!metadata || !metadata.hasReport) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Serve original PDF if available
  if (metadata.originalPdfFile) {
    const pdfData = await readOriginalPdf(metadata.originalPdfFile);
    if (pdfData) {
      const filename = metadata.originalPdfFile.split("/").pop() ||
        `Report_${metadata.client}_${metadata.company}.pdf`;

      return new NextResponse(new Uint8Array(pdfData), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  }

  // Fall back to JSON report
  const report = await readReport(id);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const filename = `Report_${metadata.client}_${metadata.company}.json`;

  return new NextResponse(JSON.stringify(report, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
