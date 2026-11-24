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

## Publishing homes (Piece 5)

Publication itself happens in Ezzie (Jen or Samantha approve a version and
move the listing to `publish_pending`). The site side is one Maven-run job:

```sh
npm run publish-listings          # or: python3 tools/publish_listings.py
```

It confirms each `publish_pending` listing's serving read-back in Ezzie
(the act that flips it to `published`), rewrites
`src/_data/listingsManifest.json` with identity only (listing_id, slug,
address label — never facts), and verifies every entry through the
anonymous `listing_public_read` the site itself uses. A listing that does
not serve is reported and left out, never silently dropped; the job exits
non-zero in that case. Commit the manifest change and push — Pages
redeploys and the home appears. To unpublish: move the listing in Ezzie,
re-run the job, commit, push.

## Build

```sh
npm ci
npm run build   # outputs _site/
npm run serve   # local preview
```

Grounding and the Phase 1 build plan: `~/workspace/bfp-website-plan/GROUNDING-phase1-2026-11-24.md`.
