"""
Agent 4 — 990 Funder Audit Agent
Trigger: Weekly cron — Sundays at 2AM.
Logic: Pulls IRS 990 data via ProPublica API → calculates required 5% distribution
       vs. actual giving → flags underspend >$50K within 120 days of fiscal year end
       as a Hidden Liquidity alert → writes to liquidity_alerts table.

Built in Phase 5.
"""
