#!/usr/bin/env python3
"""BFP public website — publish job (Piece 5).

Maven-run at publish time. One home for the facts (Ezzie): this job never
writes facts. It does three things:

  1. PUBLICATION CONFIRMATION — for every Ezzie listing Jen/Samantha have
     approved and moved to `publish_pending`, it enables serving (the
     owner-gated activation flag no SQL function owns — coverage_read calls
     it "owner_gated_not_in_this_pair") and records the serving read-back
     (`listing_record_serving_readback`, observed='live'), which is the act
     that flips publish_pending -> published in Ezzie's state machine
     (PL-06: Published is a verified serving outcome, never a bare
     transition).
  2. MANIFEST — it enumerates the listings now in a published-family state
     with serving on, and writes src/_data/listingsManifest.json holding
     IDENTITY ONLY: listing_id + slug + address label. Never facts.
  3. SERVING READ-BACK — every manifest candidate is verified through the
     anonymous public route (PostgREST + Ezzie's publishable key, the same
     call the site's browser code makes). A candidate whose public read
     does not return the published projection is REPORTED, excluded from
     the manifest, and flagged in Ezzie via a 'discrepancy' read-back —
     never silently dropped.

Listings that were in the previous manifest but no longer publish are
reported as removed; the rebuilt site simply stops linking them.

Usage:
    python3 tools/publish_listings.py [--dry-run]

Exit code is non-zero when any candidate failed verification, so the gate
notices instead of shipping a partial set unexamined.
"""

import json
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ORG_ID = "584a72ed-0b99-482e-8a5a-1ce81d5d68e6"
# Jen's Ezzie user — the approver/operator of record for the SQL write
# family, exactly as the Piece 3 seed ran (SET request.jwt.claims).
OPERATOR_SUB = "2bda1a1a-f693-45d9-8584-0fa5b63f29da"
JWT_HEADER = (
    "SET request.jwt.claims = "
    f"'{{\"sub\":\"{OPERATOR_SUB}\",\"role\":\"authenticated\"}}'; "
)
SUPABASE_URL = "https://hpuugxbrvdxdpnyeueyv.supabase.co"
# Publishable client key — public by design; listing_public_read itself
# is the lock (it serves only the approved published projection).
PUBLISHABLE_KEY = "sb_publishable_OX7MU_Y_byuwkAVppdfNBQ_hWsa-nmm"
SB_API = Path.home() / "workspace/custom-connectors/custom.supabase/bin/sb_api.py"
REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = REPO_ROOT / "src/_data/listingsManifest.json"
READBACK_SOURCE = "bfp-website publish job"
PUBLISHED_FAMILY = ("published", "paused", "under_application", "lease_pending")
STREET_SUFFIXES = {
    "drive", "dr", "street", "st", "avenue", "ave", "lane", "ln",
    "court", "ct", "road", "rd", "boulevard", "blvd", "circle", "cir",
    "place", "pl",
}


def sql(query: str):
    """Run one SQL statement through the Supabase helper; return parsed rows."""
    proc = subprocess.run(
        [sys.executable, str(SB_API), "query", "--sql", query],
        capture_output=True, text=True, timeout=120,
    )
    out = proc.stdout
    marker = out.find(":: ")
    if proc.returncode != 0 or marker < 0:
        raise RuntimeError(f"sb_api failed: {out.strip()} {proc.stderr.strip()}")
    return json.loads(out[marker + 3:])


def call_fn(fn: str, payload: dict):
    body = json.dumps(payload).replace("'", "''")
    rows = sql(f"{JWT_HEADER}SELECT public.{fn}('{body}'::jsonb) AS r")
    return rows[0]["r"]


def anon_public_read(listing_id: str) -> dict:
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/listing_public_read",
        data=json.dumps({"p_input": {"listing_id": listing_id}}).encode(),
        headers={
            "apikey": PUBLISHABLE_KEY,
            "Authorization": f"Bearer {PUBLISHABLE_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def slugify_address(address_line_1: str) -> str:
    tokens = re.sub(r"[^a-z0-9 ]", " ", address_line_1.lower()).split()
    if tokens and tokens[-1] in STREET_SUFFIXES and len(tokens) > 1:
        tokens = tokens[:-1]
    return "-".join(tokens)


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    failures = []

    prev_ids = set()
    if MANIFEST_PATH.exists():
        prev = json.loads(MANIFEST_PATH.read_text())
        prev_ids = {e["listing_id"] for e in prev.get("listings", [])}

    family = ",".join(f"'{s}'" for s in PUBLISHED_FAMILY)
    candidates = sql(
        "SELECT l.id, l.publication_state, l.serving_enabled, "
        "l.approved_version_id, l.published_version_id, "
        "p.display_name, p.address_line_1, p.city, p.state "
        "FROM public.listings l JOIN public.properties p ON p.id = l.property_id "
        f"WHERE l.org_id = '{ORG_ID}' "
        f"AND l.publication_state IN ('publish_pending',{family}) "
        "ORDER BY p.address_line_1"
    )

    # 1. Confirm publication for anything standing at publish_pending.
    for row in candidates:
        if row["publication_state"] != "publish_pending":
            continue
        lid = row["id"]
        if not row["approved_version_id"]:
            failures.append(f"{lid}: publish_pending with no approved version — skipped")
            continue
        if not dry_run:
            if not row["serving_enabled"]:
                sql(f"UPDATE public.listings SET serving_enabled = true, "
                    f"updated_at = now() WHERE id = '{lid}'")
            res = call_fn("listing_record_serving_readback", {
                "org_id": ORG_ID, "listing_id": lid,
                "version_id": row["approved_version_id"],
                "observed": "live", "source": READBACK_SOURCE,
            })
            if res.get("result") != "published":
                failures.append(f"{lid}: read-back did not publish: {res}")
        print(f"publish_pending -> confirmed: {row['address_line_1']} ({lid})")

    # 2. Enumerate the published set as it now stands.
    published = sql(
        "SELECT l.id, l.publication_state, p.display_name, p.address_line_1, "
        "p.city, p.state "
        "FROM public.listings l JOIN public.properties p ON p.id = l.property_id "
        f"WHERE l.org_id = '{ORG_ID}' AND l.serving_enabled "
        f"AND l.publication_state IN ({family}) "
        "AND l.published_version_id IS NOT NULL ORDER BY p.address_line_1"
    )

    # 3. Verify each candidate through the anonymous public read.
    entries = []
    seen_slugs = {}
    for row in published:
        lid = row["id"]
        read = anon_public_read(lid)
        if read.get("outcome") != "ok":
            failures.append(
                f"{lid} ({row['address_line_1']}): public read returned "
                f"{read.get('outcome')!r} — excluded from manifest")
            if not dry_run:
                call_fn("listing_record_serving_readback", {
                    "org_id": ORG_ID, "listing_id": lid,
                    "observed": "discrepancy", "source": READBACK_SOURCE,
                })
            continue
        slug = slugify_address(row["address_line_1"])
        if slug in seen_slugs:
            failures.append(f"{lid}: slug {slug!r} collides with {seen_slugs[slug]}")
            continue
        seen_slugs[slug] = lid
        entries.append({
            "listing_id": lid,
            "slug": slug,
            "address_label": f"{row['display_name']}, {row['city']}, {row['state']}",
        })
        print(f"verified serving: {row['address_line_1']} -> /homes/{slug}/ "
              f"(state {row['publication_state']})")

    new_ids = {e["listing_id"] for e in entries}
    for removed_id in sorted(prev_ids - new_ids):
        print(f"removed from manifest (no longer publishing): {removed_id}")

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "listings": entries,
    }
    if dry_run:
        print("[dry-run] manifest not written:")
        print(json.dumps(manifest, indent=2))
    else:
        MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"manifest written: {MANIFEST_PATH} ({len(entries)} listing(s))")

    if failures:
        print("\nFAILURES — candidates that did not serve (reported, not dropped silently):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("publish run clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
