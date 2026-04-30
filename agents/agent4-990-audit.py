"""
Agent 4 — 990 Funder Audit Agent
Trigger: Weekly cron — Sundays at 2AM via Vercel Cron → /api/cron/990-audit
         OR standalone: python agents/agent4-990-audit.py

Logic:
  1. Pull all funder_profiles records that have an EIN
  2. Call ProPublica Nonprofit Explorer API for most recent 990 filing
  3. Extract total_assets, total_distributions, fiscal_year_end
  4. Calculate required_distribution = total_assets * 0.05
  5. Calculate underspend_gap = required_distribution - total_distributions
  6. If underspend_gap > $50K AND fiscal year ends within 120 days:
     → write/upsert a liquidity_alert record (published = false)
  7. Update funder_profiles with fresh 990 data
"""

import json
import logging
import os
import sys
import time
from calendar import monthrange
from datetime import date, datetime, timezone

import requests
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PROPUBLICA_BASE = "https://projects.propublica.org/nonprofits/api/v2"

UNDERSPEND_THRESHOLD = 50_000
DAYS_THRESHOLD = 120
REQUEST_DELAY = 0.5  # seconds between API calls — be polite to ProPublica


# ── ProPublica helpers ────────────────────────────────────────────────────────

def fetch_org(ein: str) -> dict | None:
    """Fetch full org + filings from ProPublica."""
    clean_ein = ein.replace("-", "")
    url = f"{PROPUBLICA_BASE}/organizations/{clean_ein}.json"
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        log.warning(f"ProPublica {ein}: HTTP {resp.status_code}")
        return None
    except requests.RequestException as e:
        log.warning(f"ProPublica request failed for {ein}: {e}")
        return None


def most_recent_filing(data: dict) -> dict | None:
    """Return the most recent filing that has financial data."""
    filings = data.get("filings_with_data") or []
    if not filings:
        return None
    return max(filings, key=lambda f: f.get("tax_prd") or 0)


def fiscal_year_end_date(tax_prd: int | None) -> date | None:
    """Convert ProPublica tax_prd (YYYYMM) to the last day of that month."""
    if not tax_prd:
        return None
    try:
        s = str(int(tax_prd))
        year, month = int(s[:4]), int(s[4:6])
        last_day = monthrange(year, month)[1]
        return date(year, month, last_day)
    except (ValueError, IndexError):
        return None


# ── Recommendation copy ───────────────────────────────────────────────────────

def recommended_action(funder_name: str, gap: int, days: int) -> str:
    gap_fmt = f"${gap:,.0f}"
    if days <= 30:
        return (
            f"Submit LOI to {funder_name} immediately — only {days} days remain "
            f"before their fiscal year ends. They must deploy {gap_fmt} in qualifying distributions."
        )
    if days <= 60:
        return (
            f"Contact {funder_name} this week. They carry {gap_fmt} in unspent "
            f"distributions with {days} days left in their fiscal year."
        )
    return (
        f"Flag {funder_name} for near-term outreach. Tracking {gap_fmt} below "
        f"required 5% distribution with {days} days remaining in their fiscal year."
    )


# ── Main run ──────────────────────────────────────────────────────────────────

def run() -> dict:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    funders_resp = supabase.table("funder_profiles").select("*").not_.is_("ein", "null").execute()
    funders = funders_resp.data or []
    log.info(f"Funders to audit: {len(funders)}")

    audited = 0
    alerts_created = 0
    today = date.today()

    for funder in funders:
        ein = (funder.get("ein") or "").strip()
        if not ein:
            continue

        data = fetch_org(ein)
        time.sleep(REQUEST_DELAY)

        if not data:
            continue

        filing = most_recent_filing(data)
        if not filing:
            log.info(f"No filing data for {funder['foundation_name']}")
            continue

        total_assets = int(filing.get("totassetsend") or 0)
        total_distributions = int(filing.get("totfuncexpns") or 0)
        required_distribution = int(total_assets * 0.05)
        underspend_gap = required_distribution - total_distributions
        fye = fiscal_year_end_date(filing.get("tax_prd"))
        last_990_year = filing.get("tax_prd_yr") or (int(str(filing.get("tax_prd", "0"))[:4]) if filing.get("tax_prd") else None)

        # Refresh funder_profiles with live 990 data
        supabase.table("funder_profiles").update({
            "total_assets": total_assets,
            "total_distributions": total_distributions,
            "fiscal_year_end": fye.isoformat() if fye else None,
            "required_distribution": required_distribution,
            "underspend_gap": max(0, underspend_gap),
            "last_990_year": last_990_year,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", funder["id"]).execute()

        audited += 1

        # Hidden liquidity check
        days_remaining = (fye - today).days if fye else None
        is_hidden_liquidity = (
            underspend_gap > UNDERSPEND_THRESHOLD
            and days_remaining is not None
            and 0 < days_remaining <= DAYS_THRESHOLD
        )

        if is_hidden_liquidity:
            action = recommended_action(funder["foundation_name"], underspend_gap, days_remaining)
            supabase.table("liquidity_alerts").upsert(
                {
                    "funder_id": funder["id"],
                    "funder_name": funder["foundation_name"],
                    "gap_amount": underspend_gap,
                    "fiscal_year_end": fye.isoformat(),
                    "days_remaining": days_remaining,
                    "hidden_liquidity": True,
                    "recommended_action": action,
                    "published": False,
                },
                on_conflict="funder_id",
            ).execute()
            alerts_created += 1
            log.info(f"Alert: {funder['foundation_name']} | gap ${underspend_gap:,} | {days_remaining}d remaining")

    log.info(f"Audited: {audited} | Alerts created/updated: {alerts_created}")
    return {"audited": audited, "alerts_created": alerts_created}


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
