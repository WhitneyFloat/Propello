"""
Agent 2 — Mission-Match Engine
Trigger: Daily cron at 6AM via Vercel Cron → /api/cron/mission-match
         OR run standalone: python agents/agent2-mission-match.py

Logic:
  1. Pull grants added to grants_raw in the last 24 hours
  2. Load all subscriber profiles
  3. Encode descriptions + mission statements with all-MiniLM-L6-v2
  4. Apply hard geo + budget filters
  5. Write matches >= 0.60 cosine similarity to grant_matches
"""

import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
from sentence_transformers import SentenceTransformer
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SIMILARITY_THRESHOLD = 0.60
MODEL_NAME = "all-MiniLM-L6-v2"


def geo_match(grant_geo: str, profile_geo: str) -> bool:
    """Return True if grant is eligible for this profile's geography."""
    g = (grant_geo or "").lower().strip()
    p = (profile_geo or "").lower().strip()
    if not g or g == "national":
        return True
    return g in p or p in g


def budget_eligible(grant_max: int | None, budget_tier_minimum: int | None) -> bool:
    """Reject if grant max award is less than 5% of org's minimum budget tier."""
    if not grant_max or not budget_tier_minimum:
        return True
    return grant_max >= budget_tier_minimum * 0.05


def run(hours_back: int = 24) -> dict:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Step 1: Pull new grants
    since = (datetime.now(timezone.utc) - timedelta(hours=hours_back)).isoformat()
    grants_resp = supabase.table("grants_raw").select("*").gte("created_at", since).execute()
    grants = grants_resp.data or []
    log.info(f"Grants pulled (last {hours_back}h): {len(grants)}")

    if not grants:
        return {"grants_processed": 0, "profiles_checked": 0, "matches_written": 0}

    # Step 2: Load all subscriber profiles
    profiles_resp = supabase.table("subscriber_profiles").select("*").execute()
    profiles = profiles_resp.data or []
    log.info(f"Profiles loaded: {len(profiles)}")

    if not profiles:
        return {"grants_processed": len(grants), "profiles_checked": 0, "matches_written": 0}

    # Step 3: Compute embeddings
    log.info(f"Loading model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)

    grant_texts = [g.get("description") or g.get("grant_title") or "" for g in grants]
    profile_texts = [p.get("mission_statement") or "" for p in profiles]

    grant_embeddings = model.encode(grant_texts, normalize_embeddings=True, show_progress_bar=False)
    profile_embeddings = model.encode(profile_texts, normalize_embeddings=True, show_progress_bar=False)

    # Step 4 + 5: Filter and write matches
    matches = []
    now = datetime.now(timezone.utc).isoformat()

    for i, grant in enumerate(grants):
        for j, profile in enumerate(profiles):
            if not geo_match(grant.get("geo"), profile.get("primary_geo")):
                continue
            if not budget_eligible(grant.get("award_max"), profile.get("budget_tier_minimum")):
                continue

            similarity = float(np.dot(grant_embeddings[i], profile_embeddings[j]))
            if similarity < SIMILARITY_THRESHOLD:
                continue

            matches.append({
                "subscriber_id": profile["id"],
                "grant_id": grant["id"],
                "raw_similarity_score": round(similarity, 4),
                "scored_at": now,
            })

    if matches:
        supabase.table("grant_matches").insert(matches).execute()

    log.info(f"Matches written: {len(matches)}")
    return {
        "grants_processed": len(grants),
        "profiles_checked": len(profiles),
        "matches_written": len(matches),
    }


if __name__ == "__main__":
    hours = int(sys.argv[1]) if len(sys.argv) > 1 else 24
    result = run(hours_back=hours)
    print(json.dumps(result, indent=2))
