# After you get the Qloo key

About ten minutes. Everything unconfirmed about the Qloo API is marked `TODO(verify)` in
`api/_lib/qloo/client.ts` and `api/_lib/qloo/normalize.ts`. Those are the only two files that should change.

1. **Install and set the key**
   `npm install`, then create `.env.local` with `QLOO_API_KEY=...` and `QLOO_MODE=live`.
2. **Run the smoke test**: `npm run smoke`. It makes about 9 calls, saves raw JSON in `fixtures/raw/`,
   and prints which fields exist (affinity, year, image, tags, explainability), result counts and HTTP errors.
3. **Paste the evidence to Claude.** Send the report plus 2 or 3 files from `fixtures/raw/`
   (one `search`, one `insights`, the `place` one). Ask: "Adjust `normalize.ts` (and `client.ts` if a parameter
   was wrong) so every field maps." Files in `fixtures/raw/` are git-ignored.
4. **Re-run** `npm run smoke` until counts and field lines look right, then `npm test` (update normalize tests if shapes changed).
5. **Record real responses**: `npm run record`. This writes `fixtures/recorded/recorded.json` (about 40 calls).
6. **Rebuild the bundled presets from real data**: `npm run presets:recorded`
   (add `LLM_API_KEY` first if you want real AI plans and a real AI-only comparison instead of templates and a labelled sample).
   Commit `fixtures/recorded/recorded.json` and `src/data/presets.generated.json`.
7. **Deploy**: import the repo in Vercel, set env vars `QLOO_MODE=live`, `QLOO_API_KEY`, `LLM_PROVIDER`, `LLM_API_KEY`
   (optionally `QLOO_MONTHLY_BUDGET`, `RATE_LIMIT_PER_MIN`), then deploy.
8. **Check the live URL**: open `/api/health` (expect `"mode":"live"`), open a preset (badge should say
   "Cached from Qloo, recorded <date>"), start your own session, rate items, run "Next session", open
   "With Qloo vs without" and generate the AI-only list. Try it on a phone too.

If the real year data exists, the era filter switches on by itself and the session screen says so.
If `/search` rejects several comma-separated types, change `searchQuery` in `client.ts` (marked TODO).
