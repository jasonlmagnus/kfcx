# Where the app reads data from

The dashboard and APIs read interview data from **one path**:

- **Path:** `{DATA_ROOT}/metadata/index.json`
- **DATA_ROOT** is chosen in this order:
  1. **If `KFCX_DATA_ROOT` is set in `.env.local`:** that path (absolute or relative to `process.cwd()`).
  2. **Otherwise:** `process.cwd() + "/data/store"`.

So the index file is always:

- Either: `$KFCX_DATA_ROOT/metadata/index.json`
- Or: `$CWD/data/store/metadata/index.json`

**Code:** `src/lib/data/store.ts` — `getDataRoot()` and `readMetadataIndex()`.

---

# 5 reasons the data might show as zero

## 1. **`process.cwd()` is not the project root**

The app uses `process.cwd()` when `KFCX_DATA_ROOT` is not set. If the Next.js server was started from another directory (e.g. parent folder, or a different terminal cwd), then `data/store` is looked for in the wrong place and the read fails → you get the empty index (0 interviews).

**Check:** Run from the project root:  
`cd /path/to/kfcx && npm run dev`

**Or:** Set `KFCX_DATA_ROOT` in `.env.local` to the **absolute** path to `data/store` so cwd no longer matters.

---

## 2. **`.env.local` is not loaded where the store runs**

Next.js loads `.env.local` at server startup. If the code that runs `readMetadataIndex()` runs in a different process or context (e.g. another worker, or a different entrypoint), that context might not have `KFCX_DATA_ROOT` (or any env). Then the app falls back to `process.cwd()/data/store`, which might be wrong (see reason 1).

**Check:** Call `GET /api/debug-data`. If `hasKfcxDataRoot` is `false` even though `.env.local` has `KFCX_DATA_ROOT`, env is not available in that context.

---

## 3. **`output: 'standalone'` and where the app runs**

Your `next.config.js` has `output: 'standalone'`. In standalone mode the built app runs from a different directory (e.g. `.next/standalone` or the deploy root). At runtime, `process.cwd()` is that directory, not your repo root, so `process.cwd()/data/store` does not exist there and the read fails → 0 interviews.

**Fix:** Either set `KFCX_DATA_ROOT` to the **absolute** path where `data/store` actually lives at runtime, or run with `next dev` (no standalone) from the project root so cwd is correct.

---

## 4. **OneDrive (or similar) and “Files On-Demand”**

If the project lives under OneDrive (e.g. `Library/CloudStorage/OneDrive-TheMagnusClub/...`) with “Files On-Demand” enabled, the file may exist in the UI but not be fully on disk when Node reads it. Then `readFile` / `readFileSync` can get an empty file or an error → parse fails → we return the empty index (0 interviews).

**Fix:** Right‑click the project (or the `data` folder) → “Always keep on this device” and wait for sync, then restart the dev server and reload.

---

## 5. **Wrong or typo’d path in `KFCX_DATA_ROOT`**

If `KFCX_DATA_ROOT` in `.env.local` has a typo, extra space, or points to a different folder (e.g. `data` instead of `data/store`), the app will read from that path. If `metadata/index.json` isn’t there (or is empty/different), you get 0 interviews.

**Check:**  
- Value should be the **directory** that contains `metadata/`, `transcripts/`, `reports/`, e.g.  
  `…/kfcx/data/store`  
- No trailing slash needed.  
- Confirm that `$KFCX_DATA_ROOT/metadata/index.json` exists and has an `interviews` array.

---

# Quick diagnostic

1. Open **`/api/debug-data`** and note:
   - `dataRoot` — path we’re using
   - `indexPath` — full path to `index.json`
   - `accessOk` / `readOk` / `readLength` / `directInterviewCount` / `storeInterviewCount`
   - `cwd` — server’s current working directory
   - `hasKfcxDataRoot` — whether env was seen

2. In a terminal (same machine):
   ```bash
   ls -la "$KFCX_DATA_ROOT/metadata/index.json"
   # or, if unset:
   ls -la "$(pwd)/data/store/metadata/index.json"
   ```
   Confirm the file exists and has size.

3. Restart the dev server from the project root and hard‑refresh the dashboard; if still zero, use the `/api/debug-data` and `ls` results to see which of the 5 reasons applies.
