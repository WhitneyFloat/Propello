"""
Agent 2 — Mission-Match Engine
Trigger: Daily cron at 6AM.
Logic: Pulls grants added in last 24h → semantic similarity vs. all subscriber profiles
       using sentence-transformers (all-MiniLM-L6-v2) → writes matches >= 0.60 to grant_matches.

Built in Phase 3.
"""
