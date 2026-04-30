"""
Grant Scraper — feeds grants_raw table
Trigger: Daily, before Agent 2 runs (5AM recommended)
Sources: Candid RSS · Google News RSS · Foundation direct feeds

Run: python agents/grant_scraper.py
"""

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from urllib.parse import quote_plus

import feedparser
import requests
from bs4 import BeautifulSoup
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# ── RSS feed sources ──────────────────────────────────────────────────────────

GOOGLE_NEWS_KEYWORDS = [
    "nonprofit grant New York City 2025",
    "foundation RFP nonprofit funding 2025",
    "community foundation grant deadline 2025",
    "arts education grant NYC nonprofit",
    "housing nonprofit grant New York",
]

FOUNDATION_RSS_FEEDS = [
    {
        "foundation_name": "New York Community Trust",
        "url": "https://www.nycommunitytrust.org/feed/",
        "geo": "New York City",
        "source": "foundation_site",
    },
    {
        "foundation_name": "Robin Hood Foundation",
        "url": "https://www.robinhood.org/feed/",
        "geo": "New York City",
        "source": "foundation_site",
    },
    {
        "foundation_name": "Ford Foundation",
        "url": "https://www.fordfoundation.org/feed/",
        "geo": "National",
        "source": "foundation_site",
    },
    {
        "foundation_name": "Robert Wood Johnson Foundation",
        "url": "https://www.rwjf.org/en/feeds/articles.rss",
        "geo": "National",
        "source": "foundation_site",
    },
    {
        "foundation_name": "W.K. Kellogg Foundation",
        "url": "https://www.wkkf.org/feed",
        "geo": "National",
        "source": "foundation_site",
    },
    # Add remaining foundations here as you curate the 100-funder list
]


# ── Parsers ───────────────────────────────────────────────────────────────────

def stable_id(url: str) -> str:
    """Deterministic ID from URL so we don't insert duplicates."""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def parse_rss_entry(entry: dict, foundation_name: str, geo: str, source: str) -> dict | None:
    url = entry.get("link") or ""
    if not url:
        return None
    return {
        "foundation_name": foundation_name,
        "grant_title": entry.get("title") or "",
        "description": entry.get("summary") or entry.get("title") or "",
        "source_url": url,
        "geo": geo,
        "source": source,
        "raw_data": json.dumps({"feed_id": stable_id(url)}),
    }


def scrape_google_news_rss(keyword: str) -> list[dict]:
    url = f"https://news.google.com/rss/search?q={quote_plus(keyword)}&hl=en-US&gl=US&ceid=US:en"
    feed = feedparser.parse(url)
    results = []
    for entry in feed.entries[:5]:
        parsed = parse_rss_entry(entry, "Google News", "National", "google_news")
        if parsed:
            results.append(parsed)
    return results


def scrape_foundation_rss(config: dict) -> list[dict]:
    try:
        feed = feedparser.parse(config["url"])
        results = []
        for entry in feed.entries[:10]:
            parsed = parse_rss_entry(
                entry,
                config["foundation_name"],
                config["geo"],
                config["source"],
            )
            if parsed:
                results.append(parsed)
        return results
    except Exception as e:
        log.warning(f"Failed to scrape {config['foundation_name']}: {e}")
        return []


# ── Supabase write (upsert by source_url) ────────────────────────────────────

def write_grants(grants: list[dict]) -> int:
    if not grants:
        return 0
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Fetch existing URLs to avoid duplicates
    existing_resp = supabase.table("grants_raw").select("source_url").execute()
    existing_urls = {r["source_url"] for r in (existing_resp.data or [])}

    new_grants = [g for g in grants if g.get("source_url") not in existing_urls]
    if not new_grants:
        return 0

    supabase.table("grants_raw").insert(new_grants).execute()
    return len(new_grants)


# ── Main ──────────────────────────────────────────────────────────────────────

def run() -> dict:
    all_grants: list[dict] = []

    for config in FOUNDATION_RSS_FEEDS:
        results = scrape_foundation_rss(config)
        log.info(f"{config['foundation_name']}: {len(results)} entries")
        all_grants.extend(results)

    for keyword in GOOGLE_NEWS_KEYWORDS:
        results = scrape_google_news_rss(keyword)
        log.info(f"Google News '{keyword}': {len(results)} entries")
        all_grants.extend(results)

    written = write_grants(all_grants)
    log.info(f"New grants written to grants_raw: {written}")
    return {"scraped": len(all_grants), "written": written}


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
