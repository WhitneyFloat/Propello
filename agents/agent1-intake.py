"""
Agent 1 — Intake & Profiling Agent
Trigger: Called once on new subscriber onboarding form submission.
Input:   JSON form payload
Output:  subscriber_profiles record written to Supabase, profile_id returned.

This logic mirrors the Next.js API route at /api/onboarding/route.ts.
Run standalone for batch imports or testing:
  python agents/agent1-intake.py --input sample.json
"""

import argparse
import json
import os
import random
import re
import string
import sys
from datetime import datetime

from supabase import create_client

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

BUDGET_TIER_MINIMUMS = {
    "<$100K": 0,
    "$100K-$500K": 100_000,
    "$500K-$1M": 500_000,
    "$1M-$5M": 1_000_000,
    "$5M+": 5_000_000,
}

VALID_NTEE_CODES = set("ABCDEFGHIJKLMNOPQRSTUWX")


def validate(payload: dict) -> dict:
    errors = []
    org_name = (payload.get("org_name") or "").strip()
    mission = (payload.get("mission_statement") or "").strip()
    ntee = (payload.get("ntee_code") or "").strip().upper()
    geo = (payload.get("primary_geo") or "").strip()
    program_types = payload.get("program_types") or []
    annual_budget = payload.get("annual_budget") or ""
    staff_count = payload.get("staff_count")

    if not org_name:
        errors.append("org_name is required")
    if not mission or len(mission) < 20:
        errors.append("mission_statement must be at least 20 characters")
    if ntee not in VALID_NTEE_CODES:
        errors.append(f"ntee_code must be one of {sorted(VALID_NTEE_CODES)}")
    if not geo:
        errors.append("primary_geo is required")
    if not isinstance(program_types, list) or len(program_types) == 0:
        errors.append("program_types must be a non-empty array")
    if annual_budget not in BUDGET_TIER_MINIMUMS:
        errors.append(f"annual_budget must be one of {list(BUDGET_TIER_MINIMUMS.keys())}")
    if staff_count is None:
        errors.append("staff_count is required")

    if errors:
        raise ValueError("; ".join(errors))

    return {
        "org_name": org_name,
        "mission_statement": mission,
        "ntee_code": ntee,
        "primary_geo": geo,
        "program_types": program_types,
        "annual_budget": annual_budget,
        "budget_tier_minimum": BUDGET_TIER_MINIMUMS[annual_budget],
        "staff_count": int(staff_count),
    }


def generate_profile_id(org_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", org_name.lower()).strip("-")[:40]
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"{slug}-{suffix}"


def run(payload: dict) -> dict:
    validated = validate(payload)
    profile_id = generate_profile_id(validated["org_name"])

    record = {
        **validated,
        "profile_id": profile_id,
        "tier": "free",
        "created_at": datetime.utcnow().isoformat(),
    }

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    response = supabase.table("subscriber_profiles").insert(record).execute()

    if not response.data:
        raise RuntimeError("Supabase insert returned no data")

    return {"profile_id": profile_id, "tier": "free"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agent 1 — Intake & Profiling")
    parser.add_argument("--input", required=True, help="Path to JSON form payload file")
    args = parser.parse_args()

    with open(args.input) as f:
        payload = json.load(f)

    try:
        result = run(payload)
        print(json.dumps(result, indent=2))
    except (ValueError, RuntimeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
