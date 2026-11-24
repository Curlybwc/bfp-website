# Bahr Family Properties — public website

The public site for Bahr Family Properties (BFP 04.03, Phase 1). Static
Eleventy build deployed to GitHub Pages on every merge to `main` — the same
operating model as Ezzie.

**Preview address:** https://curlybwc.github.io/bfp-website/
Jen approves the preview before `bahrfamilyproperties.com` is pointed at it
(Piece 12). The old Bluehost site stays up until then.

## How it works

- This repo holds chrome, design, and page structure only. **Facts live in
  Ezzie** — listing pages read Ezzie's anonymous `listing_public_read` at
  request time, so a status flip Jen or Samantha makes in Ezzie takes effect
  immediately, with no redeploy. The browse set rides a publish-time identity
  manifest (listing IDs/slugs only, never facts).
- There is no admin page or CMS here, by ruling. Publication runs
  draft → review → approved → published on the Ezzie side only.
- Apply buttons hand off to the tenant screener (bfpapply.lovable.app);
  rent payment stays on Apartments.com. The site builds neither.

## Build

```sh
npm ci
npm run build   # outputs _site/
npm run serve   # local preview
```

Grounding and the Phase 1 build plan: `~/workspace/bfp-website-plan/GROUNDING-phase1-2026-11-24.md`.
