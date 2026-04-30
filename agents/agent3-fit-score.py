"""
Agent 3 — Strategic Fit Score Agent
Trigger: Runs after Agent 2 completes (Vercel Cron 6:30AM daily)
         OR standalone: python agents/agent3-fit-score.py

Logic:
  Reads all unscored grant_matches (final_score IS NULL).
  For each, scores across 8 weighted dimensions (0-100 each).
  Writes final_score (0-100), score_breakdown JSONB, rationale text.
  Flags high_priority = true for scores >= 85.

Scoring weights:
  mission_alignment    0.25  (from raw_similarity_score, Agent 2)
  budget_fit           0.20  (award range vs org budget tier)
  geo_match            0.15  (exact / regional / national)
  deadline_urgency     0.10  (days until deadline)
  funder_history       0.10  (program area overlap with funder's 990 focus)
  program_type_overlap 0.10  (grant program types vs org program types)
  competitive_density  0.05  (heuristic by geo scope)
  liquidity_signal     0.05  (hidden liquidity alert on this funder)
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone

from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HIGH_PRIORITY_THRESHOLD = 85

WEIGHTS = {
    "mission_alignment":    0.25,
    "budget_fit":           0.20,
    "geo_match":            0.15,
    "deadline_urgency":     0.10,
    "funder_history":       0.10,
    "program_type_overlap": 0.10,
    "competitive_density":  0.05,
    "liquidity_signal":     0.05,
}

DIMENSION_LABELS = {
    "mission_alignment":    "Mission alignment",
    "budget_fit":           "Budget fit",
    "geo_match":            "Geographic match",
    "deadline_urgency":     "Deadline urgency",
    "funder_history":       "Funder grant history",
    "program_type_overlap": "Program type overlap",
    "competitive_density":  "Competitive density",
    "liquidity_signal":     "Funder liquidity signal",
}


# ── Scoring functions (each returns 0–100) ────────────────────────────────────

def score_mission_alignment(raw_similarity: float) -> int:
    return min(100, round(raw_similarity * 100))


def score_budget_fit(award_min: int | None, award_max: int | None, budget_tier_minimum: int | None) -> int:
    if award_max is None or budget_tier_minimum is None:
        return 50  # neutral when data is missing
    # Grant max must meet a floor relative to org size
    floor = budget_tier_minimum * 0.05
    if award_max < floor:
        return 10
    if award_min and award_min > budget_tier_minimum * 10:
        return 20  # grant is too large for this org
    if award_max >= budget_tier_minimum * 0.10 and (not award_min or award_min <= budget_tier_minimum * 5):
        return 100
    return 70


def score_geo_match(grant_geo: str | None, profile_geo: str | None) -> int:
    g = (grant_geo or "").lower().strip()
    p = (profile_geo or "").lower().strip()
    if not g or g == "national":
        return 50
    if g == p or (len(g) > 3 and g in p) or (len(p) > 3 and p in g):
        return 100
    # Check for same state (simple heuristic)
    g_parts = set(g.replace(",", " ").split())
    p_parts = set(p.replace(",", " ").split())
    if g_parts & p_parts:
        return 70
    return 30


def score_deadline_urgency(deadline: str | None) -> int:
    if not deadline:
        return 40
    try:
        dl = datetime.fromisoformat(deadline.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
        days = (dl - datetime.now(timezone.utc)).days
        if days < 0:
            return 0   # expired
        if days <= 30:
            return 100
        if days <= 60:
            return 80
        if days <= 90:
            return 60
        return 40
    except ValueError:
        return 40


def score_funder_history(funder_name: str | None, profile_program_types: list, supabase) -> int:
    if not funder_name:
        return 50
    resp = supabase.table("funder_profiles").select("primary_program_areas").eq("foundation_name", funder_name).limit(1).execute()
    if not resp.data:
        return 50
    funder_areas = set(a.lower() for a in (resp.data[0].get("primary_program_areas") or []))
    org_types = set(t.lower() for t in (profile_program_types or []))
    if not funder_areas or not org_types:
        return 50
    overlap = len(funder_areas & org_types)
    if overlap >= 2:
        return 100
    if overlap == 1:
        return 70
    return 30


def score_program_type_overlap(grant_program_types: list, profile_program_types: list) -> int:
    g = set(t.lower() for t in (grant_program_types or []))
    p = set(t.lower() for t in (profile_program_types or []))
    if not g or not p:
        return 50
    overlap = len(g & p)
    union = len(g | p)
    jaccard = overlap / union if union else 0
    return min(100, round(jaccard * 100 + (overlap * 10)))


def score_competitive_density(grant_geo: str | None) -> int:
    g = (grant_geo or "").lower()
    if "new york city" in g or "nyc" in g or "manhattan" in g:
        return 30   # high competition
    if "new york" in g:
        return 50
    if "national" in g or not g:
        return 20   # widest competition
    return 65       # regional / smaller geo = less competition


def score_liquidity_signal(funder_name: str | None, supabase) -> int:
    if not funder_name:
        return 0
    resp = supabase.table("liquidity_alerts").select("hidden_liquidity").eq("funder_name", funder_name).eq("hidden_liquidity", True).limit(1).execute()
    return 100 if resp.data else 0


# ── Composite score + rationale ───────────────────────────────────────────────

def compute_score(dimensions: dict[str, int]) -> int:
    total = sum(dimensions[dim] * WEIGHTS[dim] for dim in WEIGHTS)
    return min(100, round(total))


def generate_rationale(dimensions: dict[str, int], grant: dict, profile: dict) -> str:
    ranked = sorted(dimensions.items(), key=lambda x: x[1] * WEIGHTS[x[0]], reverse=True)
    top3 = ranked[:3]
    parts = []
    for dim, score in top3:
        label = DIMENSION_LABELS[dim]
        if dim == "mission_alignment":
            parts.append(f"{label}: {score}% semantic match to your mission")
        elif dim == "budget_fit":
            award = f"${grant.get('award_min', 0):,}–${grant.get('award_max', 0):,}" if grant.get("award_max") else "unspecified award"
            parts.append(f"{label}: {award} aligns with your budget tier")
        elif dim == "geo_match":
            parts.append(f"{label}: {grant.get('geo') or 'national'} funding ({score}% match)")
        elif dim == "deadline_urgency":
            deadline = grant.get("deadline", "")
            try:
                dl = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
                days = (dl - datetime.now(timezone.utc)).days
                parts.append(f"{label}: closes in {days} days")
            except Exception:
                parts.append(f"{label}: active deadline")
        elif dim == "program_type_overlap":
            parts.append(f"{label}: strong alignment with your program focus")
        elif dim == "funder_history":
            parts.append(f"{label}: {grant.get('foundation_name', 'This funder')} has supported similar work")
        elif dim == "liquidity_signal":
            parts.append(f"{label}: funder may have unspent distribution requirement")
        else:
            parts.append(f"{label}: score {score}/100")
    return ". ".join(parts) + "."


# ── Main run ──────────────────────────────────────────────────────────────────

def run() -> dict:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Pull unscored matches
    matches_resp = supabase.table("grant_matches").select("*").is_("final_score", "null").execute()
    matches = matches_resp.data or []
    log.info(f"Unscored matches: {len(matches)}")

    if not matches:
        return {"scored": 0, "high_priority_flagged": 0}

    # Cache grants and profiles to avoid N+1 queries
    grant_ids = list({m["grant_id"] for m in matches})
    profile_ids = list({m["subscriber_id"] for m in matches})

    grants_resp = supabase.table("grants_raw").select("*").in_("id", grant_ids).execute()
    profiles_resp = supabase.table("subscriber_profiles").select("*").in_("id", profile_ids).execute()

    grants = {g["id"]: g for g in (grants_resp.data or [])}
    profiles = {p["id"]: p for p in (profiles_resp.data or [])}

    scored = 0
    high_priority_flagged = 0

    for match in matches:
        grant = grants.get(match["grant_id"])
        profile = profiles.get(match["subscriber_id"])
        if not grant or not profile:
            continue

        dimensions = {
            "mission_alignment":    score_mission_alignment(match.get("raw_similarity_score") or 0),
            "budget_fit":           score_budget_fit(grant.get("award_min"), grant.get("award_max"), profile.get("budget_tier_minimum")),
            "geo_match":            score_geo_match(grant.get("geo"), profile.get("primary_geo")),
            "deadline_urgency":     score_deadline_urgency(grant.get("deadline")),
            "funder_history":       score_funder_history(grant.get("foundation_name"), profile.get("program_types") or [], supabase),
            "program_type_overlap": score_program_type_overlap(grant.get("program_types") or [], profile.get("program_types") or []),
            "competitive_density":  score_competitive_density(grant.get("geo")),
            "liquidity_signal":     score_liquidity_signal(grant.get("foundation_name"), supabase),
        }

        final_score = compute_score(dimensions)
        is_high_priority = final_score >= HIGH_PRIORITY_THRESHOLD
        rationale = generate_rationale(dimensions, grant, profile)

        score_breakdown = {
            dim: {
                "score": dimensions[dim],
                "weight": WEIGHTS[dim],
                "contribution": round(dimensions[dim] * WEIGHTS[dim], 2),
            }
            for dim in WEIGHTS
        }

        supabase.table("grant_matches").update({
            "final_score": final_score,
            "score_breakdown": score_breakdown,
            "rationale": rationale,
            "high_priority": is_high_priority,
            "scored_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", match["id"]).execute()

        scored += 1
        if is_high_priority:
            high_priority_flagged += 1
            log.info(f"High priority [{final_score}]: {grant.get('grant_title')} → {profile.get('org_name')}")

    log.info(f"Scored: {scored} | High priority: {high_priority_flagged}")
    return {"scored": scored, "high_priority_flagged": high_priority_flagged}


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
