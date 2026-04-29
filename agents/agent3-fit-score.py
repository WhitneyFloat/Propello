"""
Agent 3 — Strategic Fit Score Agent
Trigger: Runs after Agent 2 completes.
Logic: Scores each unscored grant_match across 8 weighted dimensions (0-100).
       Writes final_score, score_breakdown JSON, rationale. Flags 85+ as high_priority.

Scoring weights:
  mission_alignment    0.25
  budget_fit           0.20
  geo_match            0.15
  deadline_urgency     0.10
  funder_history       0.10
  program_type_overlap 0.10
  competitive_density  0.05
  liquidity_signal     0.05

Built in Phase 4.
"""
