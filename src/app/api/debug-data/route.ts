import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getDataRoot, readMetadataIndex } from "@/lib/data/store";

/** GET /api/debug-data - see which path the server uses and why interviewCount might be 0. */
export async function GET() {
  const dataRoot = getDataRoot();
  const indexPath = path.join(dataRoot, "metadata", "index.json");
  let accessOk = false;
  let readOk = false;
  let readLength = 0;
  let parseOk = false;
  let directInterviewCount = 0;
  let storeInterviewCount = 0;
  let readError: string | undefined;
  let parseError: string | undefined;

  try {
    await fs.access(indexPath);
    accessOk = true;
  } catch (e) {
    readError = e instanceof Error ? e.message : String(e);
  }

  if (accessOk) {
    try {
      const raw = await fs.readFile(indexPath, "utf-8");
      readOk = true;
      readLength = raw.length;
      const parsed = JSON.parse(raw) as { interviews?: unknown[] };
      parseOk = true;
      directInterviewCount = Array.isArray(parsed.interviews) ? parsed.interviews.length : 0;
    } catch (e) {
      if (!readOk) readError = e instanceof Error ? e.message : String(e);
      else parseError = e instanceof Error ? e.message : String(e);
    }
  }

  const index = await readMetadataIndex();
  storeInterviewCount = index.interviews.length;

  return NextResponse.json({
    dataRoot,
    indexPath,
    accessOk,
    readOk,
    readLength,
    parseOk,
    directInterviewCount,
    storeInterviewCount,
    readError,
    parseError,
    cwd: process.cwd(),
    hasKfcxDataRoot: !!process.env.KFCX_DATA_ROOT?.trim(),
  });
}
