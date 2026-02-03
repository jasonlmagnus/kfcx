import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  getCandidateDataRoots,
  getDataRoot,
  readMetadataIndex,
} from "@/lib/data/store";

/**
 * GET /api/test-data-connection
 *
 * Tests all hypotheses for why interview count might be zero:
 * 1. KFCX_DATA_ROOT from .env.local (if set)
 * 2. process.cwd()/data/store
 * 3. process.cwd()/../data/store
 * 4. process.cwd()/../kfcx/data/store
 * 5. process.cwd()/kfcx/data/store
 *
 * For each candidate, tries sync read of metadata/index.json and reports
 * exists, readOk, interviewCount. Then calls readMetadataIndex() and reports
 * the final root and count the app will use.
 */
export async function GET() {
  const cwd = process.cwd();
  const candidates = getCandidateDataRoots();

  const hypotheses: Array<{
    hypothesis: string;
    root: string;
    indexPath: string;
    exists: boolean;
    readOk: boolean;
    interviewCount: number;
    error?: string;
  }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const root = candidates[i];
    const indexPath = path.join(root, "metadata", "index.json");
    let exists = false;
    let readOk = false;
    let interviewCount = 0;
    let error: string | undefined;

    try {
      fs.accessSync(indexPath);
      exists = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    if (exists) {
      try {
        const content = fs.readFileSync(indexPath, "utf-8");
        const parsed = JSON.parse(content) as { interviews?: unknown[] };
        readOk = true;
        interviewCount = Array.isArray(parsed.interviews)
          ? parsed.interviews.length
          : 0;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }

    const label =
      i === 0 && process.env.KFCX_DATA_ROOT?.trim()
        ? "KFCX_DATA_ROOT (env)"
        : root === path.resolve(cwd, "data", "store")
          ? "process.cwd()/data/store"
          : root === path.resolve(cwd, "..", "data", "store")
            ? "process.cwd()/../data/store"
            : root === path.resolve(cwd, "..", "kfcx", "data", "store")
              ? "process.cwd()/../kfcx/data/store"
              : root === path.resolve(cwd, "kfcx", "data", "store")
                ? "process.cwd()/kfcx/data/store"
                : `candidate ${i + 1}`;

    hypotheses.push({
      hypothesis: label,
      root,
      indexPath,
      exists,
      readOk,
      interviewCount,
      error,
    });
  }

  const index = await readMetadataIndex();
  const effectiveRoot = getDataRoot();

  const winning = hypotheses.find((h) => h.readOk && h.interviewCount > 0);

  return NextResponse.json({
    cwd,
    hasKfcxDataRootEnv: !!process.env.KFCX_DATA_ROOT?.trim(),
    hypotheses,
    winningHypothesis: winning
      ? {
          hypothesis: winning.hypothesis,
          root: winning.root,
          interviewCount: winning.interviewCount,
        }
      : null,
    storeResult: {
      effectiveRoot,
      interviewCount: index.interviews.length,
      success: index.interviews.length > 0,
    },
  });
}
